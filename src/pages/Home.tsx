import { useEffect, useState } from 'react';
import {
  Beaker,
  BookOpen,
  Star,
  Microscope,
  Pencil,
  Clock,
  ChevronRight,
  Loader2,
  FlaskConical,
  Atom,
  Calculator,
  Dna,
  Brain,
  Laptop,
  BookText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSessions } from '../hooks/useSessions';
import { useTextbookParser } from '../hooks/useTextbookParser';
import { cleanSessionSummary, MarkdownText } from '../utils/markdown';

export default function Home() {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { sessions } = useSessions();
  const { textbooks, isLoadingBooks, loadTextbooks } = useTextbookParser();

  useEffect(() => {
    loadTextbooks(currentUser?.uid);
  }, [loadTextbooks, currentUser?.uid]);

  const getSubjectColor = (subject: string) => {
    switch (subject.toLowerCase()) {
      case 'physics':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'chemistry':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'biology':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'math':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'accountancy':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'biotechnology':
        return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'computer science':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const getSubjectAccent = (subject: string) => {
    switch (subject.toLowerCase()) {
      case 'physics':
        return { bubble: 'bg-blue-500/5 group-hover:bg-blue-500/10', hoverBorder: 'hover:border-blue-300' };
      case 'chemistry':
        return { bubble: 'bg-emerald-500/5 group-hover:bg-emerald-500/10', hoverBorder: 'hover:border-emerald-300' };
      case 'biology':
        return { bubble: 'bg-rose-500/5 group-hover:bg-rose-500/10', hoverBorder: 'hover:border-rose-300' };
      case 'math':
        return { bubble: 'bg-indigo-500/5 group-hover:bg-indigo-500/10', hoverBorder: 'hover:border-indigo-300' };
      case 'accountancy':
        return { bubble: 'bg-amber-500/5 group-hover:bg-amber-500/10', hoverBorder: 'hover:border-amber-300' };
      case 'biotechnology':
        return { bubble: 'bg-teal-500/5 group-hover:bg-teal-500/10', hoverBorder: 'hover:border-teal-300' };
      case 'computer science':
        return { bubble: 'bg-purple-500/5 group-hover:bg-purple-500/10', hoverBorder: 'hover:border-purple-300' };
      default:
        return { bubble: 'bg-zinc-400/5 group-hover:bg-zinc-400/10', hoverBorder: 'hover:border-zinc-300' };
    }
  };

  const getDisplayName = () => {
    let name = 'friend';
    if (userProfile?.name) {
      const rawName = userProfile.name.trim();
      if (rawName) {
        name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      }
    }
    return name;
  };

  const getGreeting = (variant: number, name: string) => {
    const hour = new Date().getHours();

    // Two variants per time-of-day band for light rotation
    if (hour >= 22 || hour < 4) {
      // Late night
      return variant === 0
        ? { before: 'Late night legends club, ', after: '.' }
        : { before: 'Midnight genius mode activated, ', after: '.' };
    } else if (hour >= 4 && hour < 12) {
      // Morning
      return variant === 0
        ? { before: 'Good morning, ', after: '! Brain switched on.' }
        : { before: 'Morning, ', after: '! Let’s wake those neurons up.' };
    } else if (hour >= 12 && hour < 17) {
      // Afternoon
      return variant === 0
        ? { before: '', after: ', your afternoon brain is in focus mode.' }
        : { before: 'Good afternoon, ', after: ' — your future self is proud.' };
    } else {
      // Evening
      return variant === 0
        ? { before: 'Nice work today, ', after: '! Ready for one more push?' }
        : { before: 'Evening, ', after: '. Let’s wrap the day strong.' };
    }
  };

  // Rotate between variant 0 and 1 on each visit/refresh of the dashboard
  const [greetingVariant, setGreetingVariant] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('mamaaiGreetingVariant');
      const previous = stored === '1' ? 1 : 0;
      const next = previous === 0 ? 1 : 0;
      setGreetingVariant(next);
      window.localStorage.setItem('mamaaiGreetingVariant', String(next));
    } catch {
      // If localStorage is unavailable, just default to variant 0
      setGreetingVariant(0);
    }
  }, []);

  const displayName = getDisplayName();
  const greeting = getGreeting(greetingVariant, displayName);

  return (
    <div className="flex flex-col gap-8 p-6 pt-12">
      
      {/* Header */}
      <header className="flex flex-col gap-3 items-start text-left">
        <h1 className="text-3xl font-bold text-zinc-900 leading-tight tracking-tight">
          {greeting.before}
          <span className="text-amber-500 font-semibold tracking-tight font-kavoon">
            {displayName}
          </span>
          {greeting.after}
        </h1>
        <p className="text-zinc-500 mt-2 text-sm font-medium">What are we learning today?</p>
      </header>

      {/* Mode Cards */}
      <div className="grid grid-cols-2 gap-4 mt-2">
        {/* Lab Mode Card */}
        <button 
          onClick={() => navigate('/lab/entry')}
          className="bg-white border border-zinc-200/60 shadow-sm rounded-[32px] p-6 flex flex-col items-start gap-6 hover:border-teal-500/30 hover:shadow-md hover:shadow-teal-500/5 transition-all text-left active:scale-[0.98] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-500/10 to-transparent rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 relative z-10">
            <Microscope size={28} strokeWidth={2} />
          </div>
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Lab Mode</h2>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed font-medium">Guide me through an experiment</p>
          </div>
        </button>

        {/* Exam Mode Card */}
        <button 
          onClick={() => navigate('/exam/entry')}
          className="bg-white border border-zinc-200/60 shadow-sm rounded-[32px] p-6 flex flex-col items-start gap-6 hover:border-amber-500/30 hover:shadow-md hover:shadow-amber-500/5 transition-all text-left active:scale-[0.98] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 relative z-10">
            <Pencil size={28} strokeWidth={2} />
          </div>
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Exam Mode</h2>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed font-medium">Test my knowledge on a topic</p>
          </div>
        </button>
      </div>

      {/* Subjects */}
      <section className="mt-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Subjects</h2>
          <button
            onClick={() => navigate('/study')}
            className="text-sm font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            View All <ChevronRight size={16} />
          </button>
        </div>

        {isLoadingBooks ? (
          <div className="bg-white border border-zinc-200/60 rounded-[32px] p-8 flex items-center justify-center shadow-sm">
            <Loader2 className="animate-spin text-zinc-400" size={24} />
          </div>
        ) : textbooks.length === 0 ? (
          <div className="bg-white border border-zinc-200/60 rounded-[32px] p-6 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center">
                <BookOpen className="text-zinc-300" size={22} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-900">No books in your library yet</p>
                <p className="text-xs text-zinc-500 font-medium mt-1">
                  Upload a textbook from the Study tab to see it here.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
            {textbooks.slice(0, 6).map((book) => {
              const SubjectIcon =
                book.subject === 'Chemistry'
                  ? FlaskConical
                  : book.subject === 'Physics'
                  ? Atom
                  : book.subject === 'Math'
                  ? Calculator
                  : book.subject === 'Biology'
                  ? Dna
                  : book.subject === 'Biotechnology'
                  ? Brain
                  : book.subject === 'Computer Science'
                  ? Laptop
                  : book.subject === 'Accountancy'
                  ? BookText
                  : BookOpen;

              const part = book.title.replace(book.subject, '').trim();
              const accent = getSubjectAccent(book.subject);

              return (
                <button
                  key={book.id}
                  onClick={() => navigate(`/study/${book.id}`)}
                  className={`relative overflow-hidden group min-w-[260px] max-w-[260px] bg-white rounded-3xl p-5 border border-zinc-200 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 ${accent.hoverBorder}`}
                >
                  {/* Soft corner glow bubble */}
                  <div className={`pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full ${accent.bubble} group-hover:scale-110 transition-transform`} />

                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${getSubjectColor(
                      book.subject
                    )}`}
                  >
                    <SubjectIcon size={24} />
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-bold text-zinc-900 text-base truncate">{book.subject}</h3>
                    {part && (
                      <p className="text-xs font-semibold text-amber-600 mt-0.5 truncate">{part}</p>
                    )}
                    <p className="text-[11px] font-medium text-zinc-400 mt-1">
                      {book.gradeLevel} &bull; {book.numChapters}{' '}
                      {book.subject === 'Chemistry' || book.subject === 'Biotechnology' ? 'Units' : 'Chapters'}
                    </p>
                  </div>

                  <ChevronRight className="text-zinc-300 shrink-0" size={20} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Notes */}
      <section className="mt-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Recent Notes</h2>
          {sessions.length > 0 && (
            <button 
              onClick={() => navigate('/sessions')}
              className="text-sm font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              My Notes <ChevronRight size={16} />
            </button>
          )}
        </div>
        
        {sessions.length === 0 ? (
          <div className="bg-white border border-zinc-200/60 rounded-[32px] p-10 text-center shadow-sm flex flex-col items-center">
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mb-5">
              <Clock size={32} className="text-zinc-300" />
            </div>
            <p className="text-zinc-900 font-bold text-lg">No recent notes</p>
            <p className="text-sm text-zinc-500 mt-2 font-medium max-w-[200px]">Start learning with Mama AI to see your study notes here.</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide -mx-6 px-6">
            {sessions.slice(0, 5).map(session => (
              <div 
                key={session.id} 
                className="min-w-[280px] max-w-[280px] bg-white border border-zinc-200/60 rounded-3xl p-5 snap-start shadow-sm flex flex-col cursor-pointer hover:border-teal-500/30 transition-colors"
                onClick={() => navigate('/sessions')}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    session.mode === 'lab' ? 'bg-teal-500/10 text-teal-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {session.mode} Mode
                  </span>
                </div>
                <h3 className="font-bold text-zinc-900 text-lg line-clamp-2 tracking-tight flex-1">
                  <MarkdownText text={cleanSessionSummary(session.summary)} />
                </h3>
                <p className="text-[10px] text-zinc-400 mt-4 uppercase tracking-widest font-semibold">
                  {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
