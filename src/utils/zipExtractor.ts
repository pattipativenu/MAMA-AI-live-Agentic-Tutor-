import JSZip from 'jszip';
import { extractTextFromPdf } from './pdfExtractor';
import { extractDiagramsFromChapter } from './diagramExtractor';

export interface TocSubsection {
    num: string;     // e.g. "1.1", "9.7"
    title: string;   // e.g. "Introduction", "Optical Instruments"
}

export interface PreParsedChapter {
    index: number;
    title: string;        // Real chapter title, e.g. "Chapter 9: Ray Optics and Optical Instruments"
    summary: string;
    content: string;
    realChapterNum: number;      // Actual chapter number (9, 10...) for Part II or (1, 2...) for Part I
    subsections: TocSubsection[];// Parsed from the prelims TOC — the authoritative list
    subsectionRange?: string;    // e.g. "9.1–9.7" — derived from subsections array
    answersContent?: string;     // Hidden answers — injected into Gemini context only
}

export interface ZipExtractionResult {
    text: string;           // Prelims text or first chapter text for Gemini metadata
    chapters: PreParsedChapter[];
    bookTitleHint: string;  // e.g. "Physics Part II"
    gradeLevelHint: string; // e.g. "Class 12"
    diagramCount?: number;  // Number of diagrams extracted
}

// ─── Word-to-number map for NCERT chapter ordinals ─────────────────────────
const ORDINAL_MAP: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18,
};

// ─── Junk pages to skip (these headings signal non-chapter content) ─────────
const JUNK_KEYWORDS = [
    'foreword', 'rationalisation', 'preface', 'acknowledgement',
    'textbook development', 'advisory committee', 'constitution of india',
    'publication team', 'back cover', 'bibliography', 'reprint',
];

/**
 * NCERT PDFs use a large decorative font where each letter is stored as
 * a separate glyph. pdfjs-dist joins them with spaces:
 *   "PHYSICS" → "P HYSICS"
 *   "PART"    → "P ART"
 *   "CLASS"   → "C LASS"
 * This function collapses those split characters back into full words.
 */
function fixSplitChars(text: string): string {
    // Pattern: single capital letter + space + more capitals (the rest of the word)
    return text
        .replace(/\b([A-Z]) ([A-Z]{2,})\b/g, '$1$2')   // "P ART" → "PART"
        .replace(/\b([A-Z]) ([A-Z]{2,})\b/g, '$1$2');   // run twice for chained splits
}

/**
 * Parses the subsection entries from the prelims TOC text.
 * E.g. "1.1  Introduction   1" → { num: "1.1", title: "Introduction" }
 * Works on the FIXED (split-char-collapsed) prelims text.
 * Groups results by chapter number.
 */
function extractTocSubsections(fixedPrelimsText: string): Map<number, TocSubsection[]> {
    const result = new Map<number, TocSubsection[]>();

    // Match lines like:  "1.1   Introduction   1"  or  "10.3  Refraction and Reflection of Plane Waves...  258"
    // The title is mixed case (not ALL-CAPS like chapter headings)
    const regex = /(\d{1,2})\.(\d{1,2})\s{2,}([A-Z][A-Za-z'\-\s,()&.]+?)\s{2,}\d+/g;

    let match;
    while ((match = regex.exec(fixedPrelimsText)) !== null) {
        const chapterNum = parseInt(match[1], 10);
        const subNum = match[1] + '.' + match[2];
        const title = match[3].trim();

        if (!result.has(chapterNum)) result.set(chapterNum, []);
        result.get(chapterNum)!.push({ num: subNum, title });
    }

    return result;
}

/**
 * Extracts structured book info from the prelims PDF text:
 * - subject (e.g. "Physics")
 * - part (e.g. "Part I", "Part II")
 * - grade (e.g. "Class 12")
 * - clean title (e.g. "Physics Part II")
 */
function extractBookInfo(rawText: string): { title: string; gradeLevel: string } {
    const text = fixSplitChars(rawText);

    // The cover page line looks like: "PHYSICS PART – II TEXTBOOK FOR CLASS XII Reprint 2025-26"
    // Split into lines and look at first few
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3).slice(0, 30);

    let subject = '';
    let partStr = '';
    let grade = '';

    const SUBJECTS = ['physics', 'chemistry', 'biology', 'mathematics', 'math',
        'accountancy', 'biotechnology', 'computer science', 'economics', 'history'];

    for (const line of lines) {
        const lower = line.toLowerCase();

        // Skip junk lines
        if (JUNK_KEYWORDS.some(k => lower.startsWith(k))) continue;

        // Extract subject
        if (!subject) {
            for (const s of SUBJECTS) {
                if (lower.includes(s)) {
                    subject = s.charAt(0).toUpperCase() + s.slice(1);
                    break;
                }
            }
        }

        // Extract part (Part I, Part II, Part 1, Part 2, Part – II etc.)
        if (!partStr) {
            const partMatch = lower.match(/part\s*[–\-]?\s*(i{1,3}|iv|vi{0,3}|\d)/);
            if (partMatch) {
                const raw = partMatch[1].trim();
                // Normalise roman to arabic
                const romanMap: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4' };
                const num = romanMap[raw] || raw;
                partStr = `Part ${num === '1' ? 'I' : num === '2' ? 'II' : num === '3' ? 'III' : num}`;
            }
        }

        // Extract grade (Class XII, Class 12, Class XI etc.)
        if (!grade) {
            const gradeMatch = lower.match(/class\s+(xi{1,2}|x|xii|xi|\d{1,2})/);
            if (gradeMatch) {
                const raw = gradeMatch[1].trim();
                const classRoman: Record<string, string> = {
                    x: '10', xi: '11', xii: '12', ix: '9', viii: '8'
                };
                const num = classRoman[raw] || raw;
                grade = `Class ${num}`;
            }
        }

        if (subject && partStr && grade) break;
    }

    // Build clean title
    const title = [subject, partStr].filter(Boolean).join(' ');
    return {
        title: title || '',
        gradeLevel: grade || '',
    };
}

/**
 * Parses the Table of Contents from prelims text.
 * Handles NCERT split-char rendering and returns an ordered array of
 * { chapterNumber, title } for the relevant part.
 *
 * Strategy:
 *  1. Fix split chars across the full text
 *  2. Find all "CHAPTER [ORDINAL] [TITLE]" entries OR numbered entries like "1. Title"
 *  3. Detect which PART the ZIP belongs to by looking at chapter number ranges
 *     in both Part I and Part II TOC sections of the prelims
 */
function extractTocChapters(rawText: string): Array<{ num: number; title: string }> {
    const text = fixSplitChars(rawText);
    const chapters: Array<{ num: number; title: string }> = [];

    // First try: Match "CHAPTER NINE RAY OPTICS AND OPTICAL INSTRUMENTS" or "UNIT ONE SOLID STATE"
    // Pattern: (CHAPTER|UNIT) [WORD_OR_NUM] [TITLE_WORDS] [optional: page_number]
    // Character class includes colons, semicolons, apostrophes, slashes, dots for titles like
    // "SEMICONDUCTOR ELECTRONICS: MATERIALS, DEVICES AND SIMPLE CIRCUITS"
    const chapterRegex = /(?:CHAPTER|UNIT)\s+([A-Z]+|\d+)\s+([A-Z][A-Z\s\-&,():;'/.]+?)(?=\s+\d[\d.]*\s*|\s+CHAPTER\s|\s+UNIT\s|\s+APPENDIX|\s+ANSWERS|\s+BIBLIOGRAPHY|$)/gi;

    let match;
    while ((match = chapterRegex.exec(text)) !== null) {
        const numStr = match[1].trim().toLowerCase();
        const titleRaw = match[2].trim();

        // Resolve number word or digit
        const num = ORDINAL_MAP[numStr] ?? (isNaN(parseInt(numStr)) ? null : parseInt(numStr));
        if (num === null) continue;

        // Clean title: Title Case, collapse extra spaces
        const title = titleRaw
            .replace(/\s+/g, ' ')
            .split(' ')
            .map(w => {
                const lower = w.toLowerCase();
                // Keep short conjunctions lowercase unless first word
                if (['and', 'of', 'the', 'in', 'for', 'a', 'an', 'by', 'to'].includes(lower)) return lower;
                return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            })
            .join(' ');

        // Capitalise first letter regardless
        const finalTitle = title.charAt(0).toUpperCase() + title.slice(1);

        chapters.push({ num, title: finalTitle });
    }

    // Math books like Part II often have cross-references to Part I in the prelims
    // (e.g. "Chapter 1 Relations and Functions") that match the first regex, but their actual
    // chapters are formatted simply as "7. Integrals". We run BOTH regexes sequentially
    // to ensure we capture all chapters across both formats.

    // Match text like "1. Relations and Functions 15" or " 1 Relations and Functions 15"
    // Since PDF extraction flattens text into a single line separated by spaces,
    // we cannot rely on the ^ (start of line) anchor.
    // We look for a space boundary, chapter number, optional dot, title case string, and a page number lookahead.
    const mathChapterRegex = /(?:\s|^)(\d{1,2})\.?\s*([A-Z][a-zA-Z0-9\s\-&,():;'/.]+?)\s+(?=\d{1,3}(?:\s|$))/g;
    
    while ((match = mathChapterRegex.exec(text)) !== null) {
        const num = parseInt(match[1], 10);
        const titleRaw = match[2].trim();
        
        // Skip if this looks like a subsection (contains pattern like "1.1", "2.3" etc.)
        if (/^\d+\.\d+/.test(titleRaw)) continue;
        
        // Skip if title is too short or too long
        if (titleRaw.length < 3 || titleRaw.length > 100) continue;
        
        // Skip if title is literally just the word "Chapter" or "Unit", which happens when
        // the regex accidentally matches a page number (e.g. "17 Chapter 2").
        // We use \b boundary to also skip text that starts with Chapter like "Chapter Four Moving Charges and Magnetism"
        // which has its own match via the other regex.
        if (/^(?:chapter|unit)\b/i.test(titleRaw)) continue;
        
        // General sanity check: Skip if chapter number is unreasonably high (likely a page number parsed incorrectly)
        if (num > 40) continue;
        
        // Skip common non-chapter entries
        const lowerTitle = titleRaw.toLowerCase();
        if (JUNK_KEYWORDS.some(kw => lowerTitle.includes(kw))) continue;
        
        // Check if we already found this chapter from the first regex to avoid duplicates
        if (chapters.some(c => c.num === num)) continue;

        // Clean title: Title Case, collapse extra spaces
        const title = titleRaw
            .replace(/\s+/g, ' ')
            .split(' ')
            .map(w => {
                const lower = w.toLowerCase();
                // Keep short conjunctions lowercase unless first word
                if (['and', 'of', 'the', 'in', 'for', 'a', 'an', 'by', 'to'].includes(lower)) return lower;
                return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            })
            .join(' ');

        // Capitalise first letter regardless
        const finalTitle = title.charAt(0).toUpperCase() + title.slice(1);
        
        chapters.push({ num, title: finalTitle });
    }

    // Sort numerically to ensure cross-references (Part I) and actual chapters (Part II)
    // are arranged sequentially 1..N. The slice() logic later will grab the trailing ones for Part II.
    chapters.sort((a, b) => a.num - b.num);

    return chapters;
}

/**
 * Detects if a PDF filename signals answers, prelims, or a content chapter.
 */
function classifyPdf(fileName: string): 'answers' | 'prelims' | 'chapter' | 'unknown' {
    const base = fileName.split('/').pop()?.replace(/\.pdf$/i, '').toLowerCase() || '';
    if (/an$/.test(base)) return 'answers';
    if (/ps$|tt$|rr$|gl$|in$|bi$|pr$|fo$/.test(base)) return 'prelims';
    if (/\d{2,3}$/.test(base)) return 'chapter';
    return 'unknown';
}

/**
 * Extracts the real chapter title from PDF text for cases where the prelims
 * TOC wasn't available or couldn't be matched.
 * NCERT PDFs typically open with "CHAPTER [ORDINAL]\n[TITLE]".
 */
function extractChapterTitleFromContent(text: string, fallbackIndex: number): string {
    const fixed = fixSplitChars(text);
    const lines = fixed.split('\n').map(l => l.trim()).filter(l => l.length > 0).slice(0, 40);

    for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        const chapterMatch = lower.match(/^chapter\s+([\w]+)$/);
        if (chapterMatch) {
            const numStr = chapterMatch[1];
            const num = parseInt(numStr) || ORDINAL_MAP[numStr] || fallbackIndex;
            const titleLine = lines[i + 1] || '';
            if (titleLine.length > 2 && titleLine.length < 120) {
                const title = titleLine
                    .split(' ')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                    .join(' ');
                return `Chapter ${num}: ${title}`;
            }
            return `Chapter ${num}`;
        }
    }

    return `Chapter ${fallbackIndex}`;
}

/**
 * Main entry point: loads a ZIP, classifies all PDFs, extracts:
 * - Prelims → book title, grade, TOC chapter names
 * - Answers → stored silently for Gemini context injection (never shown to user)
 * - Chapters → content PDFs with real titles from TOC
 * - Diagrams → extracted and analyzed for multimodal tutoring (optional)
 */
export async function extractChaptersFromZip(
  file: File,
  options: {
    userId?: string;
    bookId?: string;
    extractDiagrams?: boolean;
    onDiagramProgress?: (pageNum: number, totalPages: number, status: string) => void;
  } = {}
): Promise<ZipExtractionResult> {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    const allPdfFiles = Object.keys(contents.files)
        .filter(name => {
            const lower = name.toLowerCase();
            return lower.endsWith('.pdf')
                && !name.includes('__MACOSX')
                && !name.includes('.DS_Store')
                && !lower.startsWith('._');
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (allPdfFiles.length === 0) {
        throw new Error('No PDF files found in the ZIP archive. Ensure the ZIP contains PDF files, not folders or other formats.');
    }
    
    console.log(`[ZipExtractor] Found ${allPdfFiles.length} PDF files:`, allPdfFiles);

    // Classify each PDF
    const chapterFiles: string[] = [];
    const answerFiles: string[] = [];
    const prelimFiles: string[] = [];

    for (const name of allPdfFiles) {
        const role = classifyPdf(name);
        console.log(`[ZipExtractor] Classified ${name} as: ${role}`);
        if (role === 'chapter') chapterFiles.push(name);
        else if (role === 'answers') answerFiles.push(name);
        else if (role === 'prelims') prelimFiles.push(name);
    }

    console.log(`[ZipExtractor] Classification: ${chapterFiles.length} chapters, ${answerFiles.length} answers, ${prelimFiles.length} prelims`);
    
    // Fallback: If no chapters detected but we have unclassified PDFs, treat them as chapters
    const unknownFiles = allPdfFiles.filter(name => {
        const role = classifyPdf(name);
        return role === 'unknown';
    });
    
    if (chapterFiles.length === 0 && unknownFiles.length > 0) {
        console.warn(`[ZipExtractor] No chapters detected, but found ${unknownFiles.length} unclassified PDFs.`);
        console.warn(`[ZipExtractor] Treating unclassified files as chapters as fallback.`);
        console.warn(`[ZipExtractor] Unclassified files:`, unknownFiles);
        chapterFiles.push(...unknownFiles);
    }
    
    if (chapterFiles.length === 0) {
        console.error(`[ZipExtractor] ERROR: No chapter files detected!`);
        console.error(`[ZipExtractor] All files:`, allPdfFiles);
        console.error(`[ZipExtractor] Classification rules: files ending in 2-3 digits = chapter, ending in 'an' = answers, others = prelims`);
    }

    // ── Extract Prelims (book info + TOC) ───────────────────────────────────
    let preliimText = '';
    let bookTitleHint = '';
    let gradeLevelHint = '';
    let tocChapters: Array<{ num: number; title: string }> = [];
    let tocSubsectionsMap = new Map<number, TocSubsection[]>();

    for (const name of prelimFiles) {
        try {
            const blob = await contents.files[name].async('blob');
            const f = new File([blob], name, { type: 'application/pdf' });
            preliimText = await extractTextFromPdf(f);

            const fixedText = fixSplitChars(preliimText);
            const info = extractBookInfo(preliimText);
            bookTitleHint = info.title;
            gradeLevelHint = info.gradeLevel;
            tocChapters = extractTocChapters(preliimText);
            tocSubsectionsMap = extractTocSubsections(fixedText);

            console.log(`[ZipExtractor] Book: "${bookTitleHint}", Grade: "${gradeLevelHint}", TOC chapters: ${tocChapters.length}, Subsection groups: ${tocSubsectionsMap.size}`);
            
            // Log subsections for each chapter
            tocSubsectionsMap.forEach((subsections, chapterNum) => {
                console.log(`[ZipExtractor] Chapter ${chapterNum} subsections (${subsections.length}):`, 
                    subsections.map(s => s.num).join(', '));
            });
            break;
        } catch (e) {
            console.warn('[ZipExtractor] Failed to read prelims:', e);
        }
    }

    // ── Extract Answers (hidden backstage context for Gemini) ────────────────
    let answersText = '';
    for (const name of answerFiles) {
        try {
            const blob = await contents.files[name].async('blob');
            const f = new File([blob], name, { type: 'application/pdf' });
            answersText = await extractTextFromPdf(f);
            break;
        } catch (e) {
            console.warn('[ZipExtractor] Failed to read answers:', e);
        }
    }

    // ── Extract Chapter PDFs ────────────────────────────────────────────────
    const chapters: PreParsedChapter[] = [];
    const failed: string[] = [];

    // KEY FIX: The Part II prelims PDF contains BOTH the Part I cross-reference TOC
    // (e.g. chapters 1-8) AND the actual Part II TOC (chapters 9-14).
    // By slicing the LAST N entries (N = number of chapter files), we skip
    // the cross-reference and get only the TOC entries that belong to THIS book.
    // - Part I ZIP (8 files): {1..8} → last 8 = chapters 1-8 ✓
    // - Part II ZIP (6 files): {1..14} → last 6 = chapters 9-14 ✓
    const relevantTocChapters = tocChapters.slice(-chapterFiles.length);
    console.log(`[ZipExtractor] Using ${relevantTocChapters.length} relevant TOC chapters:`,
        relevantTocChapters.map(c => `Ch${c.num}: ${c.title}`));

    // Heuristic: If the first relevant chapter is 6 or higher, it is overwhelmingly likely to be Part II.
    // This fixes cases where extractBookInfo() matched "Part I" from the cross-reference TOC.
    if (relevantTocChapters.length > 0) {
        const firstNum = relevantTocChapters[0].num;
        if (firstNum >= 6 && !/Part II/i.test(bookTitleHint)) {
            if (/Part I\b/i.test(bookTitleHint)) {
                bookTitleHint = bookTitleHint.replace(/Part I\b/i, 'Part II');
            } else {
                bookTitleHint += ' Part II';
            }
        } else if (firstNum === 1 && /Part II/i.test(bookTitleHint)) {
            bookTitleHint = bookTitleHint.replace(/Part II/i, 'Part I');
        }
    }

    let totalDiagramsExtracted = 0;

    for (let i = 0; i < chapterFiles.length; i++) {
        const name = chapterFiles[i];
        const zipEntry = contents.files[name];
        if (zipEntry.dir) continue;

        try {
            const blob = await zipEntry.async('blob');
            const pdfFile = new File([blob], name, { type: 'application/pdf' });
            const chapterText = await extractTextFromPdf(pdfFile);

            if (!chapterText || chapterText.trim().length < 50) {
                failed.push(`${name} (empty or scanned image)`);
                continue;
            }

            const chapterNumber = chapters.length + 1;

            // Match this file sequentially to the RELEVANT TOC subset
            const tocEntry = relevantTocChapters[i]; // i-th chapter in the relevant TOC
            let title: string;
            let realChapterNum: number;

            if (tocEntry) {
                title = `Chapter ${tocEntry.num}: ${tocEntry.title}`;
                realChapterNum = tocEntry.num;
            } else {
                // Fallback: extract from PDF content
                const fallbackNum = (relevantTocChapters[0]?.num ?? 1) + i;
                title = extractChapterTitleFromContent(chapterText, fallbackNum);
                realChapterNum = fallbackNum;
            }

            // Look up subsections for this chapter from the TOC
            const subsections = tocSubsectionsMap.get(realChapterNum) || [];
            const subsectionRange = subsections.length >= 2
                ? `${subsections[0].num}–${subsections[subsections.length - 1].num}`
                : undefined;

            chapters.push({
                index: chapterNumber,
                title,
                summary: chapterText.substring(0, 200) + '...',
                content: chapterText, // Full content — no truncation
                realChapterNum,       // e.g. 9 for first chapter of Part II
                subsections,          // From TOC — authoritative list
                subsectionRange,
                answersContent: answersText || undefined,
            });

            // ── Extract Diagrams (optional) ─────────────────────────────────────
            if (options.extractDiagrams && options.userId && options.bookId) {
                console.log(`[ZipExtractor] Extracting diagrams from ${name}...`);
                try {
                    const diagrams = await extractDiagramsFromChapter(
                        pdfFile,
                        options.bookId,
                        chapterNumber,
                        options.userId,
                        {
                            scale: 2.0,
                            onProgress: options.onDiagramProgress
                        }
                    );
                    totalDiagramsExtracted += diagrams.length;
                    console.log(`[ZipExtractor] Extracted ${diagrams.length} diagrams from ${name}`);
                } catch (diagramError) {
                    console.warn(`[ZipExtractor] Diagram extraction failed for ${name}:`, diagramError);
                    // Continue without diagrams - text extraction still succeeded
                }
            }

        } catch (err) {
            console.error(`[ZipExtractor] Failed to read ${name}:`, err);
            failed.push(name);
        }
    }

    if (chapters.length === 0) {
        // If we have chapter files but all failed, report the specific errors
        if (chapterFiles.length > 0 && failed.length > 0) {
            throw new Error(
                `Failed to extract ${failed.length} of ${chapterFiles.length} chapter PDFs. ` +
                `Failed files: ${failed.join(', ')}. ` +
                `Ensure PDFs contain selectable text (not scanned images, not corrupted).`
            );
        }
        
        // If no chapter files were detected at all
        if (chapterFiles.length === 0) {
            throw new Error(
                `No chapter files detected in the ZIP. Found ${allPdfFiles.length} PDF(s) but none matched chapter patterns. ` +
                `Expected chapter files to end with 2-3 digits (e.g., 'chapter09.pdf'). ` +
                `Files found: ${allPdfFiles.slice(0, 5).join(', ')}${allPdfFiles.length > 5 ? '...' : ''}`
            );
        }
        
        // Generic fallback
        throw new Error(
            `Could not extract any chapter PDFs from the ZIP. Failed: ${failed.join(', ')}. ` +
            `Ensure PDFs contain selectable text (not scanned images).`
        );
    }

    if (failed.length > 0) {
        console.warn(`[ZipExtractor] Skipped ${failed.length} PDFs:`, failed);
    }

    return {
        text: preliimText || chapters[0]?.content || '',
        chapters,
        bookTitleHint,
        gradeLevelHint,
        diagramCount: totalDiagramsExtracted,
    };
}
