import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronRight, Hash } from 'lucide-react';
import { useTextbookParser } from '../../hooks/useTextbookParser';
import { useProfile } from '../../hooks/useProfile';

export default function StudyDetail() {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();
    const { profile } = useProfile();
    const { textbooks, loadTextbooks } = useTextbookParser();

    // Load books if accessing this route directly
    useEffect(() => {
        if (textbooks.length === 0) {
            loadTextbooks(profile?.uid);
        }
    }, [textbooks.length, loadTextbooks, profile?.uid]);

    const book = useMemo(() =>
        textbooks.find(b => b.id === bookId),
        [textbooks, bookId]);

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
                <h1 className="text-2xl font-bold tracking-tight leading-tight pr-6">{book?.title || 'Loading...'}</h1>

                {book && (
                    <div className="flex items-center gap-3 mt-3">
                        <span className="bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                            {book.subject}
                        </span>
                        <span className="text-sm font-medium text-zinc-500 flex items-center gap-1.5">
                            <BookOpen size={14} /> {book.language} • {book.gradeLevel}
                        </span>
                    </div>
                )}
            </div>

            {/* Chapters List */}
            <div className="p-4 sm:p-6 pb-24">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4 ml-2">Chapters</h2>

                <div className="flex flex-col gap-3">
                    {book?.chapters.map((chapter) => (
                        <button
                            key={chapter.index}
                            onClick={() => navigate(`/study/${book.id}/${chapter.index}`)}
                            className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all text-left flex gap-4 items-center group"
                        >
                            <div className="w-12 h-12 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-center shrink-0 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
                                {chapter.index === 0 ? (
                                    <span className="font-bold text-lg text-zinc-400">Intro</span>
                                ) : (
                                    <div className="flex items-center text-zinc-400 font-bold text-xl">
                                        <Hash size={16} strokeWidth={3} className="mr-0.5 opacity-50" />
                                        <span className="group-hover:text-amber-600">{chapter.index}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0 pr-4">
                                <h3 className="font-bold text-zinc-900 group-hover:text-amber-800 transition-colors line-clamp-1 mb-1">
                                    {chapter.title}
                                </h3>
                                <p className="text-xs font-medium text-zinc-500 line-clamp-2 leading-relaxed">
                                    {chapter.summary}
                                </p>
                            </div>

                            <ChevronRight className="text-zinc-300 group-hover:text-amber-500 shrink-0" size={20} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
