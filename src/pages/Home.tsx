import { Beaker, BookOpen, Star, Microscope, Pencil, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import { useSessions } from '../hooks/useSessions';

export default function Home() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { sessions } = useSessions();

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = profile.name || 'Student';
    
    if (hour >= 22 || hour < 4) {
      return { line1: "Burning the midnight oil,", line2: `${name}!` };
    } else if (hour >= 4 && hour < 12) {
      return { line1: "You're unstoppable,", line2: `${name}!` };
    } else if (hour >= 12 && hour < 17) {
      return { line1: "Keep the momentum,", line2: `${name}!` };
    } else {
      return { line1: "Great work today,", line2: `${name}!` };
    }
  };

  const greeting = getGreeting();
  const initial = profile.name ? profile.name.charAt(0).toUpperCase() : 'S';

  return (
    <div className="flex flex-col gap-8 p-6 pt-12">
      
      {/* Header */}
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 leading-tight tracking-tight">
            {greeting.line1}<br />{greeting.line2}
          </h1>
          <p className="text-zinc-500 mt-2 text-sm font-medium">What are we learning today?</p>
        </div>
        <button 
          onClick={() => navigate('/settings')}
          className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-amber-950 font-bold text-xl shrink-0 shadow-lg shadow-amber-500/20 hover:scale-105 transition-transform active:scale-95"
        >
          {initial}
        </button>
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

      {/* Recent Sessions */}
      <section className="mt-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-900 tracking-tight">Recent Sessions</h2>
          {sessions.length > 0 && (
            <button 
              onClick={() => navigate('/sessions')}
              className="text-sm font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              View All <ChevronRight size={16} />
            </button>
          )}
        </div>
        
        {sessions.length === 0 ? (
          <div className="bg-white border border-zinc-200/60 rounded-[32px] p-10 text-center shadow-sm flex flex-col items-center">
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mb-5">
              <Clock size={32} className="text-zinc-300" />
            </div>
            <p className="text-zinc-900 font-bold text-lg">No recent sessions</p>
            <p className="text-sm text-zinc-500 mt-2 font-medium max-w-[200px]">Start a Lab or Exam to see your history here.</p>
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
                <h3 className="font-bold text-zinc-900 text-lg line-clamp-2 tracking-tight flex-1">{session.summary}</h3>
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
