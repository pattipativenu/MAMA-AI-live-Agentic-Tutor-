import { useEffect, useRef, useState, ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mic, MicOff, Image as ImageIcon, Loader2, Camera, X, ArrowRight, Lightbulb, PlayCircle,
} from 'lucide-react';
import { useGeminiLive } from '../../hooks/useGeminiLive';
import { useProfile, UserProfile } from '../../hooks/useProfile';
import { useAuth } from '../../contexts/AuthContext';
import { useSessions } from '../../hooks/useSessions';
import { useGeminiReasoning, ConceptHook } from '../../hooks/useGeminiReasoning';
import { useExamMachine, getNextStep } from '../../machines/examMachine';
import CarouselViewer from '../../components/Carousel/CarouselViewer';
import { CarouselSlide } from '../../hooks/useCarousel';
import { subscribeToVideoJobs, startGenerationQueue } from '../../services/generationQueue';
import { subscribeToSession } from '../../services/dataStore';

// ─────────────────────────────────────────────────────────────────────────────
// System Instruction (complete — all 6 rules)
// ─────────────────────────────────────────────────────────────────────────────

export const getExamSystemInstruction = (profile: UserProfile): string => {
  let profileContext = '';
  if (profile.age || profile.gender || profile.hobbies.length > 0 || profile.learningStyle) {
    profileContext = `\n\n--- STUDENT PROFILE ---\n`;
    if (profile.age) profileContext += `Age/Grade: ${profile.age}\n`;
    if (profile.gender) profileContext += `Gender: ${profile.gender}\n`;
    if (profile.hobbies.length > 0) profileContext += `Favourite Activities/Hobbies: ${profile.hobbies.join(', ')}\n`;
    if (profile.learningStyle) profileContext += `Preferred Learning Style: ${profile.learningStyle}\n`;
    profileContext += `DO NOT ask the student for this information again — you already know it. Tailor all your questions, examples, and image generation prompts specifically to their age, gender, and favourite activities.\n`;
  }

  return `
You are Mama AI, a warm, encouraging, and patient voice-first AI examiner for students in Classes 5 through 12.
The student is entering "Exam Mode". You test them on Science (Physics, Chemistry, Biology) and Math.
${profileContext}
CRITICAL EXAM RULES:
1. AGE & PERSONALIZATION FIRST: Only ask the student for their age/grade and favourite hobby if it is NOT already provided in the profile above. Use this context to personalise all questions, examples, and corrections throughout the session.

2. QUESTION STRATEGY: Ask clear, targeted questions ONE AT A TIME. Begin with a foundational concept, then progressively increase difficulty based on the student's answers. Never bundle multiple questions together.

3. LISTEN & EVALUATE: After the student answers, clearly identify:
   - What they got RIGHT (acknowledge with genuine praise).
   - What they MISSED (mention gently — "One thing worth adding is...").
   - What they got WRONG (correct kindly and clearly — "Great try! Let me clarify...").

4. CORRECT & EXPLAIN: When correcting, ALWAYS start with a simple, relatable real-world example tailored to their interests or hobbies BEFORE introducing the formal scientific language or formula. This anchors the concept in something they already understand.

5. VISUAL AIDS (CRITICAL): When explaining or correcting any concept that involves shape, motion, forces, chemistry, or geometry, you MUST use the \`generate_image\` tool.
   - Tailor visual complexity to their age: young students get simple, fun diagrams; Class 11/12 students get advanced formulas, vectors, or graphs.
   - NEVER include the text "Class X" or the student's grade level in the image prompt itself.
   - Always tell the student: "I'm generating a visual to help you see this more clearly."

6. QUIZ & VERIFY: After every explanation or correction, ask a short follow-up question to confirm understanding. If the student answers incorrectly again, gently point out what they got right, where they went wrong, and walk through it once more.

CRITICAL SAFETY RULE:
If you ask the student to demonstrate a concept physically, you MUST specify safe, non-harmful objects (e.g. paper, a feather, a soft pillow). NEVER suggest heavy, sharp, or breakable objects (glass, phones, scissors, hard plastics). Their physical safety is your responsibility.

Keep your responses concise, clear, and conversational. Do not use markdown or formatting — speak naturally to the student.
Start by asking them what topic or concept they want to be tested on today.
  `.trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ExamEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('resumeId');

  const { profile } = useProfile();
  const { currentUser } = useAuth();
  const { sessions, saveSession } = useSessions();
  const { evaluateTranscript, isEvaluating } = useGeminiReasoning();
  const { step, nextStep, jumpToStep } = useExamMachine();

  // Stable session ID — generated once at mount
  const sessionIdRef = useRef(Date.now().toString());

  // Concept hooks produced by evaluation
  const [conceptHooks, setConceptHooks] = useState<ConceptHook[]>([]);

  // Carousel slides (populated as Firestore generationJob updates)
  const [asyncSlides, setAsyncSlides] = useState<CarouselSlide[]>([]);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isConnected, isConnecting, isSilent, isMuted,
    messages, currentImage, isGeneratingImage,
    connect, disconnect, toggleMute, sendClientMessage,
  } = useGeminiLive((msgs) => {
    saveSession('exam', msgs, sessionIdRef.current);
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  // ── Auto-wire: hooks_generation → evaluateTranscript ────────────────────
  useEffect(() => {
    if (step !== 'hooks_generation') return;
    if (!messages || messages.length === 0) {
      jumpToStep('hooks_review');
      return;
    }
    const transcript = messages.map((m) => `${m.role}: ${m.text}`).join('\n');
    evaluateTranscript(transcript).then((result) => {
      if (result?.hooks && result.hooks.length > 0) {
        setConceptHooks(result.hooks);
      }
      jumpToStep('hooks_review');
    });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-wire: carousel_generation → startGenerationQueue ───────────────
  useEffect(() => {
    if (step !== 'carousel_generation') return;
    const uid = currentUser?.uid;
    if (!uid || conceptHooks.length === 0) {
      jumpToStep('carousel_playback');
      return;
    }
    startGenerationQueue(
      uid,
      sessionIdRef.current,
      conceptHooks,
      profile.theme ?? 'realistic',
      profile.age ?? '',
    ).catch((err) => console.error('[ExamEntry] startGenerationQueue failed:', err));
    // Advance immediately — CarouselViewer shows a spinner until slides load
    jumpToStep('carousel_playback');
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to Firestore session for live slide updates ───────────────
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeToSession(uid, sessionIdRef.current, (session) => {
      if (session?.generationJob?.slides && session.generationJob.slides.length > 0) {
        setAsyncSlides(session.generationJob.slides);
      }
    });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // ── Subscribe to background Veo video job completions ───────────────────
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeToVideoJobs(
      uid,
      sessionIdRef.current,
      (slideId, videoUrl) => {
        setAsyncSlides((prev) =>
          prev.map((slide) =>
            slide.id === slideId ? { ...slide, url: videoUrl, type: 'video' } : slide
          )
        );
      }
    );
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setSelectedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleMicClick = () => {
    if (isConnected) {
      toggleMute();
    } else {
      handleConnect();
    }
  };

  const handleConnect = () => {
    const instruction = getExamSystemInstruction(profile);
    let previousMessages;
    if (resumeId) {
      const session = sessions.find((s) => s.id === resumeId);
      if (session) previousMessages = session.messages;
    }
    connect(instruction, previousMessages, selectedImage);
  };

  const handleNextStep = () => {
    nextStep();
    if (!isConnected) return;
    sendClientMessage(
      `[SYSTEM DYNAMIC INSTRUCTION]: The student has advanced to the next exam phase. ` +
        `Please seamlessly adapt your strategy without explicitly announcing the transition.`
    );
  };

  const handleEndExam = () => {
    disconnect(); // triggers saveSession callback
    navigate(`/summary?sessionId=${sessionIdRef.current}&mode=exam`);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-dvh bg-[rgb(250,249,245)] text-zinc-900 overflow-hidden relative">

      {/* ── Step Header ─────────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <button
          onClick={handleEndExam}
          className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-colors"
        >
          <X size={18} className="text-zinc-600" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Exam Step</span>
          <span className="text-sm font-bold text-amber-700 uppercase tracking-wide bg-amber-50 px-3 py-1 rounded-full mt-1 border border-amber-100">
            {step.replace(/_/g, ' ')}
          </span>
        </div>
        <button
          onClick={handleNextStep}
          disabled={step === 'complete' || !isConnected}
          className="p-2 border border-amber-200 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors text-amber-600 disabled:opacity-30"
          title="Advance to next step"
        >
          <ArrowRight size={18} />
        </button>
      </div>

      {/* ── Hooks Review Overlay ─────────────────────────────────────────── */}
      {step === 'hooks_review' && (
        <div className="fixed inset-0 z-50 bg-[rgb(250,249,245)] flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 pt-20 pb-36">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={22} className="text-amber-500" />
              <h2 className="text-xl font-black text-zinc-900">Memory Hooks</h2>
            </div>
            <p className="text-sm text-zinc-500 mb-5 font-medium">
              Review these memory anchors before the visual recap:
            </p>
            {isEvaluating ? (
              <div className="flex flex-col items-center gap-3 py-10 text-amber-600">
                <Loader2 size={36} className="animate-spin" />
                <p className="font-medium animate-pulse">Analysing your session…</p>
              </div>
            ) : conceptHooks.length === 0 ? (
              <p className="text-zinc-400 text-sm text-center py-10">No hooks generated yet.</p>
            ) : (
              <div className="grid gap-3">
                {conceptHooks.map((hook, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                    <h3 className="font-black text-indigo-600 mb-1">{hook.term}</h3>
                    <p className="text-sm font-medium text-zinc-600 leading-relaxed">{hook.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5 pb-8 bg-white border-t border-zinc-200 shadow-[0_-10px_30px_rgba(0,0,0,0.06)]">
            <button
              onClick={() => nextStep()} // hooks_review → carousel_generation
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-md"
            >
              <PlayCircle size={20} />
              Continue to Visual Review
            </button>
          </div>
        </div>
      )}

      {/* ── Carousel Playback Overlay ────────────────────────────────────── */}
      {step === 'carousel_playback' && (
        <div className="fixed inset-0 z-40 bg-black flex flex-col">
          <div className="flex-1 p-2 pt-16 pb-6 max-h-[92vh] max-w-[460px] mx-auto w-full">
            {asyncSlides.length > 0 ? (
              <CarouselViewer
                slides={asyncSlides}
                onComplete={() => {
                  nextStep(); // carousel_playback → next_question
                  if (isConnected) {
                    sendClientMessage(
                      `[SYSTEM DYNAMIC INSTRUCTION]: The student has finished the visual recap carousel. ` +
                        `Please transition seamlessly to the next exam question.`
                    );
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                <Loader2 className="w-10 h-10 animate-spin text-amber-600 mb-4" />
                <p className="font-medium animate-pulse">Generating your personalised review…</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main Visual Area ─────────────────────────────────────────────── */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden p-6 pt-24">

        {selectedImage && (
          <div className="absolute inset-0 p-6 flex items-center justify-center">
            <div className="relative w-full max-w-md aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-zinc-200 bg-white">
              <img src={selectedImage} alt="Question" className="w-full h-full object-contain" />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-3 right-3 bg-white/80 backdrop-blur-md text-zinc-800 p-2 rounded-full hover:bg-white transition-colors shadow-sm"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {(currentImage || isGeneratingImage) && !selectedImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgb(250,249,245)] z-10 p-6">
            {isGeneratingImage ? (
              <div className="flex flex-col items-center gap-4 text-amber-600">
                <Loader2 size={48} className="animate-spin" />
                <p className="text-lg font-medium animate-pulse">Mama AI is drawing…</p>
              </div>
            ) : currentImage ? (
              <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden shadow-xl border border-zinc-200">
                <img src={currentImage} alt="AI Generated" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-zinc-200 shadow-sm">
                  <ImageIcon size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Visual Aid</span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {!selectedImage && !currentImage && !isGeneratingImage && (
          <div className="relative flex flex-col items-center justify-center z-10">
            {isConnected ? (
              <>
                <div className="absolute w-48 h-48 bg-amber-500/10 rounded-full animate-ping" />
                <div className="absolute w-64 h-64 bg-amber-500/5 rounded-full animate-pulse" />
                <div className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-colors ${isMuted ? 'bg-zinc-200 text-zinc-500 shadow-zinc-200/50' : 'bg-amber-500 text-white shadow-amber-500/50'}`}>
                  {isMuted ? <MicOff size={48} /> : <Mic size={48} />}
                </div>
                <p className="mt-8 text-xl font-bold text-zinc-900 tracking-wide">
                  {isMuted ? 'Muted' : "I'm listening…"}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center text-center px-6">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 border border-zinc-200 shadow-sm">
                  <MicOff size={32} className="text-zinc-400" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Exam Mode</h2>
                <p className="text-zinc-500 max-w-[250px]">Tap the mic to start, or use the camera to scan a question.</p>
              </div>
            )}
          </div>
        )}

        {isConnecting && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md z-20 flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Connecting…
          </div>
        )}
        {isConnected && isSilent && !isMuted && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md z-20 animate-pulse">
            Microphone is silent!
          </div>
        )}
      </main>

      {/* ── Bottom Controls ──────────────────────────────────────────────── */}
      <div className="bg-white border-t border-zinc-200 p-6 pb-8 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-center gap-12 max-w-md mx-auto">

          <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-200 group-hover:bg-zinc-100 transition-colors">
              <Camera size={24} className="text-zinc-600" />
            </div>
            <span className="text-xs font-medium text-zinc-500">Photo</span>
          </button>
          <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />

          <button onClick={handleMicClick} className="flex flex-col items-center gap-2 group">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${isConnected ? (isMuted ? 'bg-zinc-100 border-zinc-300 text-zinc-500' : 'bg-amber-500 border-amber-400 text-white shadow-amber-500/30 scale-110') : 'bg-zinc-50 border-zinc-200 text-zinc-600 group-hover:bg-zinc-100'}`}>
              {isConnected && !isMuted ? <Mic size={28} /> : <MicOff size={28} />}
            </div>
            <span className={`text-xs font-medium ${isConnected && !isMuted ? 'text-amber-600' : 'text-zinc-500'}`}>Mic</span>
          </button>

          <button onClick={handleEndExam} className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center border border-red-100 group-hover:bg-red-100 transition-colors">
              <X size={24} className="text-red-500" />
            </div>
            <span className="text-xs font-medium text-red-500">End Exam</span>
          </button>

        </div>
      </div>
    </div>
  );
}
