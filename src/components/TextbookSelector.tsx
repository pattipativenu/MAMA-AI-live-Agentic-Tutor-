/**
 * TextbookSelector.tsx - Shared component for selecting textbooks and chapters
 * Used by Lab and Exam modes to provide curriculum context
 */
import { useState, useEffect } from 'react';
import { BookOpen, ChevronRight, Clock, X, Check } from 'lucide-react';
import { useTextbookParser, Textbook } from '../hooks/useTextbookParser';
import { useAuth } from '../contexts/AuthContext';

interface TextbookSelectorProps {
  mode: 'lab' | 'exam';
  onSelect: (bookId: string, chapterIndex: number, chapterTitle: string) => void;
  onSkip: () => void;
}

export default function TextbookSelector({ mode, onSelect, onSkip }: TextbookSelectorProps) {
  const { currentUser } = useAuth();
  const { textbooks, loadTextbooks, fetchChapterContent, isLoadingBooks } = useTextbookParser();
  
  const [selectedBook, setSelectedBook] = useState<Textbook | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingChapter, setLoadingChapter] = useState<number | null>(null);

  useEffect(() => {
    if (textbooks.length === 0) {
      loadTextbooks(currentUser?.uid);
    }
  }, [textbooks.length, loadTextbooks, currentUser?.uid]);

  const handleBookSelect = (book: Textbook) => {
    setSelectedBook(book);
  };

  const handleChapterSelect = async (chapterIndex: number, chapterTitle: string) => {
    if (!selectedBook) return;
    
    setLoadingChapter(chapterIndex);
    
    // Pre-load chapter content for context
    try {
      const chapter = selectedBook.chapters.find(c => c.index === chapterIndex);
      if (chapter && currentUser?.uid) {
        await fetchChapterContent(chapter.storagePath, selectedBook.id, chapterIndex, currentUser.uid);
      }
    } catch (e) {
      console.warn('[TextbookSelector] Failed to preload chapter:', e);
    } finally {
      setLoadingChapter(null);
    }
    
    onSelect(selectedBook.id, chapterIndex, chapterTitle);
  };

  const getModeDescription = () => {
    if (mode === 'lab') {
      return "Select a chapter to get experiment ideas and lab activities based on the curriculum.";
    }
    return "Select a chapter to practice with questions from that topic.";
  };

  const getModeTitle = () => {
    return mode === 'lab' ? 'Lab Setup' : 'Exam Setup';
  };

  if (isLoadingBooks) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-zinc-400 font-medium">Loading your textbooks...</p>
      </div>
    );
  }

  if (textbooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
          <BookOpen size={28} className="text-zinc-400" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">No Textbooks Found</h2>
        <p className="text-sm text-zinc-500 mb-6">
          Upload textbooks in the Study Library to get curriculum-aligned {mode} sessions.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="px-6 py-3 bg-zinc-100 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-200 transition-colors"
          >
            Continue Without
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[rgb(250,249,245)]">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-4 py-4 safe-area-pt">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-zinc-900">{getModeTitle()}</h1>
          <button
            onClick={onSkip}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-700"
          >
            Skip
          </button>
        </div>
        <p className="text-sm text-zinc-500">
          {getModeDescription()}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedBook ? (
          /* Book Selection */
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
              Select a Textbook
            </h2>
            {textbooks.map((book) => (
              <button
                key={book.id}
                onClick={() => handleBookSelect(book)}
                className="w-full bg-white border border-zinc-200 rounded-2xl p-4 text-left hover:border-amber-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                    <BookOpen size={24} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-900 text-sm leading-tight">
                      {book.title}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      {book.chapters.length} chapters
                    </p>
                  </div>
                  <ChevronRight size={20} className="text-zinc-400 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Chapter Selection */
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setSelectedBook(null)}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                ← Back to Books
              </button>
            </div>
            
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 mb-4">
              <h2 className="font-bold text-zinc-900">{selectedBook.title}</h2>
              <p className="text-xs text-zinc-500 mt-1">Select a chapter to focus on</p>
            </div>

            <div className="space-y-2">
              {selectedBook.chapters.map((chapter) => (
                <button
                  key={chapter.index}
                  onClick={() => handleChapterSelect(chapter.index, chapter.title)}
                  disabled={loadingChapter === chapter.index}
                  className="w-full bg-white border border-zinc-200 rounded-xl p-3 text-left hover:border-amber-300 hover:shadow-sm transition-all disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 shrink-0 min-w-[32px] text-center">
                      {chapter.index}
                    </span>
                    <span className="text-sm font-medium text-zinc-700 flex-1 truncate">
                      {chapter.title}
                    </span>
                    {loadingChapter === chapter.index ? (
                      <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ChevronRight size={18} className="text-zinc-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action */}
      <div className="bg-white border-t border-zinc-200 p-4 safe-area-pb">
        <button
          onClick={onSkip}
          className="w-full py-3 bg-zinc-100 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-200 transition-colors text-sm"
        >
          Continue Without Textbook
        </button>
      </div>
    </div>
  );
}
