import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Star, PlayCircle, RotateCcw, Award, Lightbulb, Loader2 } from 'lucide-react';
import CarouselViewer from '../../components/Carousel/CarouselViewer';
import { CarouselSlide } from '../../hooks/useCarousel';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToSession } from '../../services/dataStore';
import { SavedSession } from '../../hooks/useSessions';

export default function Summary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const mode = (searchParams.get('mode') ?? 'lab') as 'lab' | 'exam';

  const { currentUser, userProfile } = useAuth();
  const [session, setSession] = useState<SavedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCarousel, setShowCarousel] = useState(false);

  // ── Subscribe to Firestore session document ─────────────────────────────
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid || !sessionId) {
      setLoading(false);
      return;
    }
    
    // Safety timeout: don't wait forever for session
    const timeoutId = setTimeout(() => {
      console.log('[Summary] Session load timeout - showing not found');
      setLoading(false);
    }, 10000); // 10 second timeout
    
    const unsubscribe = subscribeToSession(uid, sessionId, (s) => {
      if (s) {
        clearTimeout(timeoutId);
        setSession(s);
        setLoading(false);
      }
      // If null, keep loading=true and wait — the save is still in flight
    });
    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [currentUser?.uid, sessionId]);

  // ── Derived data ────────────────────────────────────────────────────────
  const hooks = session?.evaluation?.hooks ?? [];
  const correct = session?.evaluation?.correct ?? [];
  const missing = session?.evaluation?.missing ?? [];
  const incorrect = session?.evaluation?.incorrect ?? [];
  const totalConcepts = correct.length + missing.length + incorrect.length;
  const score = totalConcepts > 0
    ? Math.min(5, Math.round((correct.length / totalConcepts) * 5))
    : 0;

  const slides: CarouselSlide[] = session?.generationJob?.slides ?? [];

  // ─────────────────────────────────────────────────────────────────────────

  if (showCarousel) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <button
          onClick={() => setShowCarousel(false)}
          className="absolute top-12 right-6 z-50 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors cursor-pointer border border-white/10"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1 p-2 pt-12 pb-6 max-h-[92vh] max-w-[460px] mx-auto w-full">
          <CarouselViewer slides={slides} onComplete={() => setShowCarousel(false)} />
        </div>
      </div>
    );
  }

  // ── Loading state — waiting for session to appear in Firestore ───────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-[rgb(250,249,245)] p-6">
        <Loader2 size={40} className="animate-spin text-amber-500 mb-4" />
        <p className="text-base font-bold text-zinc-700">Saving your session…</p>
        <p className="text-sm text-zinc-400 mt-1 text-center max-w-xs">
          We're processing your conversation. This takes just a moment.
        </p>
      </div>
    );
  }

  // ── Session not found ────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-[rgb(250,249,245)] p-6 text-center">
        <p className="text-zinc-500 mb-4">Session data could not be loaded.</p>
        <button onClick={() => navigate('/')} className="text-amber-600 font-bold underline">Return Home</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[rgb(250,249,245)] text-zinc-900 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 pt-6 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/')} className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-colors">
            <ArrowLeft size={20} className="text-zinc-600" />
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${mode === 'exam' ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'}`}>
              {mode === 'exam' ? 'Exam Mode' : 'Lab Mode'}
            </span>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-6 max-w-md mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Hero Section */}
        <div className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4 border-4 border-amber-50 shadow-inner">
            <Award size={40} className="text-amber-500" />
          </div>
          <h1 className="text-2xl font-black text-zinc-900 mb-1">Session Complete!</h1>
          {session.summary && (
            <p className="text-sm font-semibold text-amber-600 mb-2">{session.summary}</p>
          )}
          <p className="text-zinc-500 font-medium mb-6">
            Great job today, {userProfile?.name?.split(' ')[0] || 'Student'}!
          </p>

          {/* Star Rating — only meaningful for exam sessions with evaluation data */}
          {totalConcepts > 0 && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={32}
                  className={`${star <= score ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_4px_rgba(251,191,36,0.5)]' : 'fill-zinc-100 text-zinc-200'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Concept summary chips — correct/missing/incorrect */}
        {totalConcepts > 0 && (
          <div className="space-y-3">
            {correct.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">✓ Got right</p>
                <div className="flex flex-wrap gap-2">
                  {correct.map((c, i) => (
                    <span key={i} className="text-xs bg-green-100 text-green-800 font-semibold px-2.5 py-1 rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {missing.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">○ Worth reviewing</p>
                <div className="flex flex-wrap gap-2">
                  {missing.map((m, i) => (
                    <span key={i} className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full">{m}</span>
                  ))}
                </div>
              </div>
            )}
            {incorrect.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">✗ Needs work</p>
                <div className="flex flex-wrap gap-2">
                  {incorrect.map((ic, i) => (
                    <span key={i} className="text-xs bg-red-100 text-red-800 font-semibold px-2.5 py-1 rounded-full">{ic}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Memory Hooks */}
        {hooks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <Lightbulb size={20} className="text-amber-500" />
              <h2 className="text-lg font-bold text-zinc-800">Memory Hooks</h2>
            </div>
            <div className="grid gap-3">
              {hooks.map((hook, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm hover:border-amber-300 transition-colors group">
                  <h3 className="font-black text-indigo-600 mb-1 group-hover:text-amber-600 transition-colors">{hook.term}</h3>
                  <p className="text-sm font-medium text-zinc-600 leading-relaxed">{hook.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          {slides.length > 0 && (
            <button
              onClick={() => setShowCarousel(true)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-md active:scale-[0.98]"
            >
              <PlayCircle size={22} />
              Replay Visuals
            </button>
          )}

          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 bg-white text-zinc-800 border-2 border-zinc-200 font-bold py-4 rounded-2xl hover:bg-zinc-50 transition-all active:scale-[0.98]"
          >
            <RotateCcw size={22} />
            Return Home
          </button>
        </div>

      </div>
    </div>
  );
}
