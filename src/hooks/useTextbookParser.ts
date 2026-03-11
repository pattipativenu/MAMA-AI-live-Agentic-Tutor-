import { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ref, uploadString, getDownloadURL, getBytes } from 'firebase/storage';
import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';

export interface TextbookChapter {
    index: number;               // Sequential 1-based index within this book (1, 2, 3...)
    realChapterNum?: number;     // Actual chapter number from TOC (e.g. 9 for Part II ch.1)
    title: string;
    summary: string;
    subsections: { num: string; title: string }[]; // Authoritative list from TOC
    storagePath?: string;         // Firebase Storage path to chapter .txt (legacy fallback)
    answersStoragePath?: string;  // Hidden answers path (legacy fallback)
    subsectionRange?: string;     // e.g. "9.1–9.7" — displayed on the chapter card
}

export interface Textbook {
    id: string;
    title: string;
    subject: 'Physics' | 'Chemistry' | 'Biology' | 'Math' | 'Accountancy' | 'Biotechnology' | 'Computer Science' | 'Other STEM' | 'Other';
    gradeLevel: string;
    language: string;
    numChapters: number;
    uploadedAt: number;
    chapters: TextbookChapter[];
}

const getApiKey = () => {
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
    return import.meta.env.VITE_GEMINI_API_KEY || '';
};

export function useTextbookParser() {
    const [isParsing, setIsParsing] = useState(false);
    const [parseProgress, setParseProgress] = useState('');
    const [textbooks, setTextbooks] = useState<Textbook[]>([]);
    const [isLoadingBooks, setIsLoadingBooks] = useState(false);

    /**
     * Load all books for the user from Firestore.
     * Requires userId — throws if not authenticated.
     */
    const loadTextbooks = useCallback(async (userId?: string) => {
        if (!userId) {
            console.warn('[useTextbookParser] loadTextbooks called without userId — skipping.');
            return;
        }
        setIsLoadingBooks(true);
        try {
            const col = collection(db, 'users', userId, 'textbooks');
            const snapshot = await getDocs(col);
            const books = snapshot.docs.map(d => d.data() as Textbook);
            setTextbooks(books.sort((a, b) => b.uploadedAt - a.uploadedAt));
        } catch (e) {
            console.error('[useTextbookParser] Error loading textbooks from Firestore:', e);
        } finally {
            setIsLoadingBooks(false);
        }
    }, []);

    /**
     * Parse a PDF / EPUB / ZIP file into a structured Textbook with chapters.
     * Saves chapter text to Firebase Storage and metadata to Firestore.
     * Throws if not authenticated.
     */
    const parseAndSave = useCallback(async (
        rawText: string,
        fileName: string,
        userId?: string,
        preParsedChapters?: any[],
        bookTitleHint?: string,
        gradeLevelHint?: string
    ): Promise<Textbook | null> => {
        if (!userId) {
            console.error('[useTextbookParser] parseAndSave called without userId.');
            return null;
        }
        const apiKey = getApiKey();
        if (!apiKey) {
            alert('No Gemini API key found. Check your .env.local file.');
            return null;
        }

        setIsParsing(true);
        setParseProgress('Analysing book metadata with Mama AI...');

        try {
            const ai = new GoogleGenAI({ apiKey });

            // Limit text to first 500k chars to fit in flash context
            const truncated = rawText.slice(0, 500000);

            const hasChapters = preParsedChapters && preParsedChapters.length > 0;

            const promptText = hasChapters
                ? `You are a textbook metadata parser for Indian school textbooks (NCERT/CBSE).
I have already extracted the chapters. Given the following sample text from the book:
1. Detect the subject (one of: Physics, Chemistry, Biology, Math, Accountancy, Biotechnology, Computer Science, Other STEM, Other).
2. Detect the grade level (e.g., "Class 11", "Class 12", "High School").
3. Detect the language (e.g., "English", "Hindi").
4. Most importantly: detect the PROPER book title from the text (e.g. "Physics Part I", "Chemistry Part 2", "Biology Textbook for Class 12").
   DO NOT use the filename. Extract the actual title from the book content.
   Hint from prelims if available: "${bookTitleHint || ''}"

Return ONLY valid JSON:
{
  "title": "Physics Part I",
  "subject": "Physics|Chemistry|Biology|Math|Accountancy|Biotechnology|Computer Science|Other STEM|Other",
  "gradeLevel": "string",
  "language": "string",
  "chapters": []
}

RAW SAMPLE TEXT:
${truncated}`
                : `You are a textbook parser. Given the following raw text from a PDF textbook:
1. Identify all chapters or major sections.
2. Detect the subject (one of: Physics, Chemistry, Biology, Math, Accountancy, Biotechnology, Computer Science, Other STEM, Other).
3. Detect the grade level (e.g., "Class 8", "High School", "Undergraduate").
4. Detect the language (e.g., "English", "Spanish", "Hindi").
5. For the textbook title, use the filename hint: "${fileName}".

Return ONLY valid JSON with no extra text:
{
  "title": "string",
  "subject": "Physics|Chemistry|Biology|Math|Accountancy|Biotechnology|Computer Science|Other STEM|Other",
  "gradeLevel": "string",
  "language": "string",
  "chapters": [
    { "index": 0, "title": "string", "summary": "one sentence", "content": "full chapter text..." }
  ]
}

RAW TEXT:
${truncated}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite-preview',
                contents: [{ role: 'user', parts: [{ text: promptText }] }],
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            subject: { type: Type.STRING },
                            gradeLevel: { type: Type.STRING },
                            language: { type: Type.STRING },
                            chapters: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        index: { type: Type.INTEGER },
                                        title: { type: Type.STRING },
                                        summary: { type: Type.STRING },
                                        content: { type: Type.STRING },
                                    },
                                    required: ['index', 'title', 'summary', 'content'],
                                },
                            },
                        },
                        required: ['title', 'subject', 'gradeLevel', 'language', 'chapters'],
                    },
                },
            });

            let parsed: any = {};
            try {
                parsed = JSON.parse(response.text || '{}');
            } catch (parseErr) {
                console.warn('[useTextbookParser] Failed to parse Gemini JSON response, using fallbacks.', parseErr);
            }

            const finalChaptersData = hasChapters ? preParsedChapters : parsed.chapters;

            console.log('[useTextbookParser] hasChapters:', hasChapters);
            console.log('[useTextbookParser] preParsedChapters count:', preParsedChapters?.length);
            console.log('[useTextbookParser] parsed.chapters count:', parsed.chapters?.length);
            console.log('[useTextbookParser] finalChaptersData count:', finalChaptersData?.length);

            if (!finalChaptersData || finalChaptersData.length === 0) {
                console.error('[useTextbookParser] No chapters detected. hasChapters:', hasChapters);
                console.error('[useTextbookParser] preParsedChapters:', preParsedChapters);
                console.error('[useTextbookParser] parsed:', parsed);
                throw new Error('No chapters detected. The file may not have a clear chapter structure.');
            }

            console.log('[useTextbookParser] First chapter sample:', finalChaptersData[0]);

            const bookId = `book_${Date.now()}`;
            const chapters: TextbookChapter[] = [];

            // Save each chapter's full content to a Firestore subcollection
            for (let i = 0; i < finalChaptersData.length; i++) {
                const ch = finalChaptersData[i];
                setParseProgress(`Saving chapter ${i + 1} of ${finalChaptersData.length}...`);

                // Save heavy content to subcollection
                const chapterDocRef = doc(db, 'users', userId, 'textbooks', bookId, 'chapters', ch.index.toString());
                const chapterPayload = {
                    index: ch.index,
                    realChapterNum: ch.realChapterNum || null,
                    title: ch.title || '',
                    summary: ch.summary || '',
                    subsections: ch.subsections || [],
                    content: ch.content || '',
                    answersContent: ch.answersContent || null,
                    subsectionRange: ch.subsectionRange || null,
                };
                await setDoc(chapterDocRef, chapterPayload);

                // Push clean metadata to the main textbook document array
                chapters.push({
                    index: ch.index,
                    realChapterNum: ch.realChapterNum || null,
                    title: ch.title || '',
                    summary: ch.summary || '',
                    subsections: ch.subsections || [],
                    subsectionRange: ch.subsectionRange || null,
                    // No storage paths pushed for new logic
                });
            }

            const textbook: Textbook = {
                id: bookId,
                title: bookTitleHint || parsed.title ||
                    fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
                subject: parsed.subject || 'Other',
                gradeLevel: gradeLevelHint || parsed.gradeLevel || 'Unknown',
                language: parsed.language || 'English',
                numChapters: chapters.length,
                uploadedAt: Date.now(),
                chapters,
            };

            setParseProgress('Saving to your library...');
            await setDoc(doc(db, 'users', userId, 'textbooks', bookId), textbook);

            setTextbooks(prev => [textbook, ...prev]);
            return textbook;

        } catch (err: any) {
            console.error('[useTextbookParser] Failed to parse textbook:', err);
            setParseProgress(`Error: ${err.message}`);
            return null;
        } finally {
            setIsParsing(false);
            setParseProgress('');
        }
    }, []);

    /**
     * Fetch a single chapter's content from Firebase Storage.
     * Uses Firebase SDK's getBytes which handles auth and CORS properly.
     */
    const fetchChapterContent = useCallback(async (
        storagePath: string | undefined,
        bookId: string,
        chapterIndex: number,
        userId?: string
    ): Promise<string> => {
        if (!userId || !bookId) {
            console.error('[useTextbookParser] fetchChapterContent called without valid IDs.');
            throw new Error('Missing user ID or book ID');
        }
        try {
            console.log(`[useTextbookParser] Fetching chapter ${chapterIndex} from Firestore...`);
            const chapterRef = doc(db, 'users', userId, 'textbooks', bookId, 'chapters', chapterIndex.toString());
            const chapterSnap = await getDoc(chapterRef);

            if (chapterSnap.exists()) {
                const data = chapterSnap.data();
                console.log('[useTextbookParser] Fetched chapter from Firestore, length:', data.content?.length);
                return data.content || '';
            } else if (storagePath) {
                // Fallback for older books that used Firebase Storage
                console.log('[useTextbookParser] Chapter not in Firestore, falling back to storage:', storagePath);
                const storageRef = ref(storage, storagePath);
                const bytes = await getBytes(storageRef);
                const text = new TextDecoder().decode(bytes);
                console.log('[useTextbookParser] Fetched chapter from Storage, length:', text.length);
                return text;
            }
            return '';
        } catch (error: any) {
            console.error('[useTextbookParser] Failed to fetch chapter:', error);
            throw error;
        }
    }, []);

    /**
     * Delete a textbook, its chapters subcollection, and Firestore metadata.
     * Firestore does NOT cascade deletes, so we must manually delete the
     * `chapters/` subcollection docs before removing the parent document.
     */
    const deleteTextbook = useCallback(async (bookId: string, userId?: string) => {
        if (!userId) return;
        try {
            // 1. Delete all chapter docs in the subcollection first
            const chaptersCol = collection(db, 'users', userId, 'textbooks', bookId, 'chapters');
            const chaptersSnap = await getDocs(chaptersCol);
            const deletePromises = chaptersSnap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);
            console.log(`[useTextbookParser] Deleted ${chaptersSnap.size} chapter docs for book ${bookId}`);

            // 2. Then delete the parent textbook document
            await deleteDoc(doc(db, 'users', userId, 'textbooks', bookId));
            console.log(`[useTextbookParser] Deleted textbook document ${bookId}`);
        } catch (e) {
            console.error('[useTextbookParser] Firestore delete error:', e);
        }
        setTextbooks(prev => prev.filter(b => b.id !== bookId));
    }, []);

    return {
        textbooks,
        isParsing,
        parseProgress,
        isLoadingBooks,
        loadTextbooks,
        parseAndSave,
        fetchChapterContent,
        deleteTextbook,
    };
}
