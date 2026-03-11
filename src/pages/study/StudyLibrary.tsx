import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Book, Trash2, Loader2, ChevronRight, FileX, FlaskConical, Atom, Calculator, Dna, Brain, Laptop, BookText } from 'lucide-react';
import { useTextbookParser } from '../../hooks/useTextbookParser';
import { extractTextFromPdf } from '../../utils/pdfExtractor';
import { extractTextFromEpub } from '../../utils/epubExtractor';
import { extractChaptersFromZip } from '../../utils/zipExtractor';
import { useAuth } from '../../contexts/AuthContext';

// Subject-specific icons
const SUBJECT_ICONS: Record<string, React.ElementType> = {
    'Chemistry': FlaskConical,
    'Physics': Atom,
    'Math': Calculator,
    'Biology': Dna,
    'Biotechnology': Brain,
    'Computer Science': Laptop,
    'Accountancy': BookText,
    'default': Book,
};

export default function StudyLibrary() {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { textbooks, isParsing, parseProgress, isLoadingBooks, loadTextbooks, parseAndSave, deleteTextbook } = useTextbookParser();

    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // We pass currentUser.uid to load books from Firestore.
        // If null, it falls back to localStorage.
        loadTextbooks(currentUser?.uid);
    }, [loadTextbooks, currentUser?.uid]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError(null);

        if (file.type !== 'application/pdf' && file.type !== 'application/epub+zip' && !file.name.endsWith('.epub') && file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
            setUploadError("Please upload a valid PDF, EPUB, or ZIP file.");
            return;
        }

        // 50MB reasonable limit for browser extraction
        if (file.size > 50 * 1024 * 1024) {
            setUploadError("File is too large. Please upload a file under 50MB.");
            return;
        }

        try {
            let text = '';
            let preParsedChapters = undefined;
            let bookTitleHint: string | undefined = undefined;

            if (file.type === 'application/epub+zip' || file.name.endsWith('.epub')) {
                // Extract chapters natively from EPUB structure
                const extracted = await extractTextFromEpub(file);
                if (extracted.length === 0) throw new Error("Could not extract any text from this EPUB.");

                text = extracted.map(c => `${c.title}\n${c.text.substring(0, 1000)}`).join('\n\n');
                preParsedChapters = extracted.map((c, i) => ({
                    index: i + 1,
                    title: c.title,
                    summary: c.text.substring(0, 100) + '...',
                    content: c.text
                }));
            } else if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
                // Smart ZIP extraction: classifies chapters/answers/prelims automatically
                console.log('[StudyLibrary] Starting ZIP extraction for:', file.name);
                const extracted = await extractChaptersFromZip(file);
                console.log('[StudyLibrary] ZIP extraction result:', {
                    chapterCount: extracted.chapters?.length,
                    bookTitleHint: extracted.bookTitleHint,
                    gradeLevelHint: extracted.gradeLevelHint,
                    diagramCount: extracted.diagramCount,
                    textLength: extracted.text?.length
                });
                text = extracted.text;
                preParsedChapters = extracted.chapters;
                bookTitleHint = extracted.bookTitleHint || undefined;
                const gradeLevelHintZip = extracted.gradeLevelHint || undefined;
                
                console.log('[StudyLibrary] Calling parseAndSave with:', {
                    chaptersCount: preParsedChapters?.length,
                    bookTitleHint,
                    gradeLevelHint: gradeLevelHintZip
                });
                
                // 2. Parse metadata and save to Storage/Firestore (pass hints from prelims)
                try {
                    const book = await parseAndSave(text, file.name, currentUser?.uid, preParsedChapters, bookTitleHint, gradeLevelHintZip);
                    if (book) { 
                        navigate(`/study/${book.id}`); 
                    } else { 
                        console.error('[StudyLibrary] parseAndSave returned null');
                        setUploadError('Failed to parse the textbook. The AI could not detect chapter boundaries. Check browser console for details.'); 
                    }
                } catch (parseError: any) {
                    console.error('[StudyLibrary] parseAndSave threw error:', parseError);
                    setUploadError(`Failed to parse: ${parseError.message || 'Unknown error'}`);
                }
                return; // early return — we already called parseAndSave
            } else {
                // 1. Extract raw text client-side for single PDF
                text = await extractTextFromPdf(file);
            }

            // 2. Parse metadata and save to Storage/Firestore
            const book = await parseAndSave(text, file.name, currentUser?.uid, preParsedChapters, bookTitleHint);

            if (book) {
                // Automatically navigate to the newly parsed book
                navigate(`/study/${book.id}`);
            } else {
                setUploadError("Failed to parse the textbook. The AI could not detect chapter boundaries.");
            }
        } catch (err: any) {
            console.error("Upload error:", err);
            setUploadError(err.message || "An error occurred while processing the file.");
        }
    };

    const getSubjectColor = (subject: string) => {
        switch (subject.toLowerCase()) {
            case 'physics': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'chemistry': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'biology': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'math': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'accountancy': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'biotechnology': return 'bg-teal-100 text-teal-700 border-teal-200';
            case 'computer science': return 'bg-purple-100 text-purple-700 border-purple-200';
            default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
        }
    };

    const getSubjectAccent = (subject: string) => {
        switch (subject.toLowerCase()) {
            case 'physics': return { bubble: 'bg-blue-500/5 group-hover:bg-blue-500/10', hoverBorder: 'hover:border-blue-300' };
            case 'chemistry': return { bubble: 'bg-emerald-500/5 group-hover:bg-emerald-500/10', hoverBorder: 'hover:border-emerald-300' };
            case 'biology': return { bubble: 'bg-rose-500/5 group-hover:bg-rose-500/10', hoverBorder: 'hover:border-rose-300' };
            case 'math': return { bubble: 'bg-indigo-500/5 group-hover:bg-indigo-500/10', hoverBorder: 'hover:border-indigo-300' };
            case 'accountancy': return { bubble: 'bg-amber-500/5 group-hover:bg-amber-500/10', hoverBorder: 'hover:border-amber-300' };
            case 'biotechnology': return { bubble: 'bg-teal-500/5 group-hover:bg-teal-500/10', hoverBorder: 'hover:border-teal-300' };
            case 'computer science': return { bubble: 'bg-purple-500/5 group-hover:bg-purple-500/10', hoverBorder: 'hover:border-purple-300' };
            default: return { bubble: 'bg-zinc-400/5 group-hover:bg-zinc-400/10', hoverBorder: 'hover:border-zinc-300' };
        }
    };

    return (
        <div className="flex flex-col min-h-full bg-[rgb(250,249,245)] text-zinc-900 px-6 py-8 relative">
            <div className="flex items-center justify-between mb-8 mt-4">
                <h1 className="text-3xl font-bold tracking-tight">Your Study Library</h1>
            </div>

            {uploadError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                    <FileX className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <p className="text-sm font-medium text-red-700">{uploadError}</p>
                </div>
            )}

            {/* Upload Card */}
            <div
                onClick={() => !isParsing && fileInputRef.current?.click()}
                className={`mb-10 w-full rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-8
          ${isParsing ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-zinc-300 hover:border-amber-400 hover:bg-amber-50/50 cursor-pointer shadow-sm hover:shadow-md'}`}
            >
                {isParsing ? (
                    <>
                        <Loader2 className="animate-spin text-amber-500 mb-4" size={32} />
                        <h3 className="font-bold text-lg text-amber-900">Crunching the Knowledge...</h3>
                        <p className="text-sm text-amber-700/80 mt-1 font-medium">{parseProgress}</p>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                            <Upload size={28} />
                        </div>
                        <h3 className="font-bold text-lg text-zinc-800">Upload a Textbook</h3>
                            <p className="text-sm text-zinc-500 mt-1 text-center max-w-[200px]">PDF, EPUB, or ZIP format. Mama AI will smartly process chapters.</p>
                    </>
                )}
            </div>

            <input
                type="file"
                accept="application/pdf,.epub,application/epub+zip,application/zip,.zip"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                disabled={isParsing}
            />

            {/* Library Grid */}
            <h2 className="text-lg font-bold text-zinc-800 mb-4">Subjects</h2>

            {isLoadingBooks ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-zinc-400" size={32} />
                </div>
            ) : textbooks.length === 0 ? (
                <div className="text-center py-10 px-6 bg-white rounded-3xl border border-zinc-200 shadow-sm">
                    <Book className="mx-auto text-zinc-300 mb-3" size={40} />
                    <p className="text-zinc-500 text-sm font-medium">Your library is empty. Upload a textbook to start studying.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {textbooks.map((book) => (
                        <div
                            key={book.id}
                            onClick={() => navigate(`/study/${book.id}`)}
                            className={`bg-white rounded-3xl p-5 border border-zinc-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center gap-4 relative overflow-hidden ${getSubjectAccent(book.subject).hoverBorder}`}
                        >
                            {/* Soft corner glow bubble */}
                            <div className={`pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full ${getSubjectAccent(book.subject).bubble} group-hover:scale-110 transition-transform`} />

                            {/* Delete button (only visible on hover/focus) */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Delete '${book.title}' from your library?`)) {
                                        deleteTextbook(book.id, currentUser?.uid);
                                    }
                                }}
                                className="absolute top-3 right-3 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                                title="Delete book"
                            >
                                <Trash2 size={16} />
                            </button>

                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${getSubjectColor(book.subject)}`}>
                                {(() => {
                                    const IconComponent = SUBJECT_ICONS[book.subject] || SUBJECT_ICONS['default'];
                                    return <IconComponent size={24} />;
                                })()}
                            </div>

                            <div className="flex-1 min-w-0 pr-8">
                                {/* Subject is the main heading */}
                                <h3 className="font-bold text-zinc-900 text-base truncate">
                                    {book.subject}
                                </h3>
                                {/* Part number (e.g. "Part I") — extracted from title by stripping subject name */}
                                {(() => {
                                    const part = book.title
                                        .replace(book.subject, '')
                                        .trim();
                                    return part ? (
                                        <p className="text-sm font-semibold text-amber-600 mt-0.5">{part}</p>
                                    ) : null;
                                })()}
                                {/* Grade + chapters/units */}
                                <p className="text-xs font-medium text-zinc-400 mt-1">
                                    {book.gradeLevel} &bull; {book.numChapters} {book.subject === 'Chemistry' || book.subject === 'Biotechnology' ? 'Units' : 'Chapters'}
                                </p>
                            </div>

                            <ChevronRight className="text-zinc-300 shrink-0" size={24} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
