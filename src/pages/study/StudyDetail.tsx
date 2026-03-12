import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronRight, Hash, FlaskConical, Atom, Calculator, BookText, Dna, Brain, Laptop } from 'lucide-react';
import { useTextbookParser } from '../../hooks/useTextbookParser';
import { useAuth } from '../../contexts/AuthContext';


// Subject-specific icons and labels
const SUBJECT_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
    'Chemistry': { icon: FlaskConical, label: 'Unit', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    'Physics': { icon: Atom, label: 'Chapter', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    'Math': { icon: Calculator, label: 'Chapter', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    'Biology': { icon: Dna, label: 'Chapter', color: 'text-rose-600 bg-rose-50 border-rose-200' },
    'Biotechnology': { icon: Brain, label: 'Unit', color: 'text-teal-600 bg-teal-50 border-teal-200' },
    'Computer Science': { icon: Laptop, label: 'Chapter', color: 'text-purple-600 bg-purple-50 border-purple-200' },
    'Accountancy': { icon: BookText, label: 'Chapter', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    'default': { icon: BookOpen, label: 'Chapter', color: 'text-zinc-600 bg-zinc-50 border-zinc-200' },
};

// Subject accent colors for borders and bubbles (matching StudyLibrary)
const getSubjectAccent = (subject: string) => {
    switch (subject.toLowerCase()) {
        case 'physics': return { 
            bubble: 'bg-blue-500/5 group-hover:bg-blue-500/10', 
            border: 'border-blue-200', 
            hoverBorder: 'group-hover:border-blue-300',
            badge: 'text-blue-600',
            badgeBg: 'bg-blue-50 group-hover:bg-blue-100'
        };
        case 'chemistry': return { 
            bubble: 'bg-emerald-500/5 group-hover:bg-emerald-500/10', 
            border: 'border-emerald-200', 
            hoverBorder: 'group-hover:border-emerald-300',
            badge: 'text-emerald-600',
            badgeBg: 'bg-emerald-50 group-hover:bg-emerald-100'
        };
        case 'biology': return { 
            bubble: 'bg-rose-500/5 group-hover:bg-rose-500/10', 
            border: 'border-rose-200', 
            hoverBorder: 'group-hover:border-rose-300',
            badge: 'text-rose-600',
            badgeBg: 'bg-rose-50 group-hover:bg-rose-100'
        };
        case 'math': return { 
            bubble: 'bg-indigo-500/5 group-hover:bg-indigo-500/10', 
            border: 'border-indigo-200', 
            hoverBorder: 'group-hover:border-indigo-300',
            badge: 'text-indigo-600',
            badgeBg: 'bg-indigo-50 group-hover:bg-indigo-100'
        };
        case 'accountancy': return { 
            bubble: 'bg-amber-500/5 group-hover:bg-amber-500/10', 
            border: 'border-amber-200', 
            hoverBorder: 'group-hover:border-amber-300',
            badge: 'text-amber-600',
            badgeBg: 'bg-amber-50 group-hover:bg-amber-100'
        };
        case 'biotechnology': return { 
            bubble: 'bg-teal-500/5 group-hover:bg-teal-500/10', 
            border: 'border-teal-200', 
            hoverBorder: 'group-hover:border-teal-300',
            badge: 'text-teal-600',
            badgeBg: 'bg-teal-50 group-hover:bg-teal-100'
        };
        case 'computer science': return { 
            bubble: 'bg-purple-500/5 group-hover:bg-purple-500/10', 
            border: 'border-purple-200', 
            hoverBorder: 'group-hover:border-purple-300',
            badge: 'text-purple-600',
            badgeBg: 'bg-purple-50 group-hover:bg-purple-100'
        };
        default: return { 
            bubble: 'bg-zinc-400/5 group-hover:bg-zinc-400/10', 
            border: 'border-zinc-200', 
            hoverBorder: 'group-hover:border-zinc-300',
            badge: 'text-zinc-600',
            badgeBg: 'bg-zinc-50 group-hover:bg-zinc-100'
        };
    }
};

export default function StudyDetail() {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { textbooks, loadTextbooks } = useTextbookParser();

    // Load books if accessing this route directly
    useEffect(() => {
        if (textbooks.length === 0) {
            loadTextbooks(currentUser?.uid);
        }
    }, [textbooks.length, loadTextbooks, currentUser?.uid]);

    const book = useMemo(() =>
        textbooks.find(b => b.id === bookId),
        [textbooks, bookId]);

    // Get subject configuration
    const subjectConfig = book ? (SUBJECT_CONFIG[book.subject] || SUBJECT_CONFIG['default']) : SUBJECT_CONFIG['default'];
    const SectionIcon = subjectConfig.icon;
    const sectionLabel = subjectConfig.label; // 'Chapter' or 'Unit'

    if (!book && textbooks.length > 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-full p-6 text-center">
                <h2 className="text-xl font-bold mb-2">Book Not Found</h2>
                <button onClick={() => navigate('/study')} className="text-amber-600 font-bold underline">Return to Library</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full bg-[rgb(250,249,245)] text-zinc-900 px-0 pt-0 relative">
            {/* Header */}
            <div className="bg-white border-b border-zinc-200 px-4 py-4 pt-6 sticky top-0 z-20 shadow-sm">
                <button
                    onClick={() => navigate('/study')}
                    className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 transition-colors mb-3 w-fit"
                >
                    <ArrowLeft size={18} />
                    <span className="font-semibold text-sm">Library</span>
                </button>
                {/* Book Header: Subject bold + Part highlighted */}
                {book ? (
                    <>
                        {/* Subject as big heading */}
                        <h1 className="text-2xl font-bold tracking-tight leading-tight">
                            {book.subject}
                        </h1>
                        {/* Part number + metadata row */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {/* Part pill if present */}
                            {(() => {
                                const partMatch = book.title.match(/(Part\s*[A-Za-z]+|\b[A-Za-z]*\s*Part\s*[A-Za-z0-9]+)/i);
                                let part = partMatch ? partMatch[0].trim() : '';
                                if (!part) {
                                    part = book.title.length > book.subject.length ? book.title : '';
                                }
                                return part ? (
                                    <span className="bg-amber-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                                        {part}
                                    </span>
                                ) : null;
                            })()}

                            <span className="text-sm font-medium text-zinc-500 flex items-center gap-1.5">
                                <SectionIcon size={14} /> {book.language} &bull; {book.gradeLevel} &bull; {book.numChapters} {sectionLabel}s
                            </span>
                        </div>
                    </>
                ) : (
                    <h1 className="text-2xl font-bold tracking-tight leading-tight">Loading...</h1>
                )}
            </div>

            {/* Chapters/Units List */}
            <div className="p-4 sm:p-6 pb-24">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4 ml-2">{sectionLabel}s</h2>

                <div className="flex flex-col gap-3">
                    {book?.chapters.map((chapter) => {
                        const accent = getSubjectAccent(book.subject);
                        return (
                            <button
                                key={chapter.index}
                                onClick={() => {
                                    navigate(`/study/${book.id}/${chapter.index}`);
                                }}
                                className={`bg-white rounded-3xl p-5 border ${accent.border} shadow-sm hover:shadow-md ${accent.hoverBorder} transition-all text-left flex gap-4 items-center group relative overflow-hidden`}
                            >
                                {/* Soft corner glow bubble - matching subject color */}
                                <div className={`pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full ${accent.bubble} transition-transform`} />

                                {/* Chapter number bubble with subject color */}
                                <div className={`w-12 h-12 ${accent.badgeBg} rounded-2xl border ${accent.border} flex items-center justify-center shrink-0 transition-colors`}>
                                    <div className={`flex items-center font-bold text-xl ${accent.badge}`}>
                                        <Hash size={16} strokeWidth={3} className="mr-0.5 opacity-50" />
                                        <span>{chapter.realChapterNum || chapter.index}</span>
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0 pr-4 relative z-10">
                                    {/* Bold section label heading with subject color */}
                                    <p className={`text-[11px] font-bold uppercase tracking-widest mb-0.5 ${accent.badge}`}>
                                        {sectionLabel} {chapter.realChapterNum || chapter.index}
                                    </p>
                                    {/* Section name — strip 'Chapter N:' or 'Unit N:' prefix if present */}
                                    <h3 className="font-bold text-zinc-900 group-hover:text-zinc-700 transition-colors line-clamp-2 leading-snug text-sm">
                                        {chapter.title.replace(/^(Chapter|Unit)\s+\d+[:\-]?\s*/i, '')}
                                    </h3>
                                    {/* Subsection range */}
                                    {chapter.subsectionRange && (
                                        <p className="text-xs font-medium text-zinc-400 mt-1">
                                            Subsections {chapter.subsectionRange}
                                        </p>
                                    )}
                                </div>

                                <ChevronRight className="text-zinc-300 group-hover:text-zinc-400 shrink-0 relative z-10" size={20} />
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
