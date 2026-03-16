import { useEffect, useRef, useState, ChangeEvent } from 'react';
import { SavedSession } from '../../hooks/useSessions';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mic, MicOff, Image as ImageIcon, Loader2, Camera, Video, X, ArrowRight, Lightbulb, PlayCircle, ChevronLeft, ChevronUp, ChevronDown,
} from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { useGeminiLive } from '../../hooks/useGeminiLive';
import type { GeneratedMedia } from '../../hooks/useGeminiLive';
import { WhiteboardView } from '../../components/whiteboard';
import { useProfile, UserProfile } from '../../hooks/useProfile';
import { useAuth } from '../../contexts/AuthContext';
import { useSessions, SessionMessage } from '../../hooks/useSessions';
import { useGeminiReasoning, ConceptHook } from '../../hooks/useGeminiReasoning';
import { useExamMachine, getNextStep } from '../../machines/examMachine';
import CarouselViewer from '../../components/Carousel/CarouselViewer';
import { CarouselSlide } from '../../hooks/useCarousel';
import { subscribeToVideoJobs, startGenerationQueue } from '../../services/generationQueue';
import { subscribeToSession } from '../../services/dataStore';
import { useTextbookParser } from '../../hooks/useTextbookParser';
import TextbookSelector from '../../components/TextbookSelector';
import { playModeEntrySound } from '../../utils/sound';

// ─────────────────────────────────────────────────────────────────────────────
// System Instruction (complete — all 6 rules)
// ─────────────────────────────────────────────────────────────────────────────

interface ExamContext {
  bookId?: string;
  chapterIndex?: number;
  chapterTitle?: string;
  chapterContent?: string;
}

export const getExamSystemInstruction = (profile: UserProfile | null, context?: ExamContext): string => {
  const firstName = profile?.name?.split(' ')[0] || 'Student';
  const age = profile?.age || 'High School';
  const gender = profile?.gender || '';
  const hobbies = profile?.hobbies?.join(', ') || '';
  const rawStyle = profile?.learningStyle || 'visual';
  const learningStyle = rawStyle === 'all'
    ? 'Adaptive — choose the best approach per concept (visual, verbal, kinesthetic)'
    : rawStyle;
  const language = profile?.language || 'English';

  const chapterBlock = context?.chapterContent
    ? `\n<source_material>
  <chapter_title>${context.chapterTitle || 'Selected Chapter'}</chapter_title>
  <chapter_text>
${context.chapterContent.substring(0, 8000)}
  </chapter_text>
  <instruction>Generate practice questions grounded in this chapter. Focus on key concepts, formulas, and problem types that would appear in a real exam on this material.</instruction>
</source_material>\n`
    : '';

  return `
<system_instruction>

<identity>
  <role>Warm, expert AI Exam Coach — Mama AI</role>
  <mission>Help ${firstName} feel fully confident and exam-ready through guided practice, not passive review.</mission>
  <voice>Encouraging, patient, precise. Speak naturally — no markdown formatting in speech.</voice>
</identity>

<student_profile>
  <name>${firstName}</name>
  <grade>${age}</grade>
  ${gender ? `<gender>${gender}</gender>` : ''}
  ${hobbies ? `<interests>${hobbies}</interests>` : ''}
  <learning_style>${learningStyle}</learning_style>
  <preferred_language>${language}</preferred_language>
  <note>DO NOT ask for this information again — you already know it. Tailor all questions, corrections, and examples to this profile.</note>
</student_profile>
${chapterBlock}
<rules>

## Name Usage — STRICT
- Use "${firstName}" **once** at the opening greeting.
- After that, use the name **at most once every 4–5 exchanges**.
- **NEVER** end a sentence with the student's name (e.g. avoid "…right, ${firstName}?").
- **NEVER** use the name during equation or formula explanations.
- When used, place it **only at the start** of a sentence: "${firstName}, great try!"

## Core Teaching Philosophy
- This is a **practice session**, not a strict test — be supportive, not intimidating.
- ALWAYS follow this sequence for every concept:
  1. **Explain** — teach or recap the concept clearly.
  2. **Check** — ask a short question, then **STOP and wait** for the student's reply. NEVER answer your own question.
  3. **Assign** — give a fresh problem for the student to attempt independently.
  4. **Support** — if they struggle, give a HINT only (formula name, method) — NEVER the direct answer.
  5. **Affirm** — acknowledge what they got right before correcting anything wrong.

## Subject-Specific Behavior
- **Math & Accounts** — Model a full worked example on the whiteboard, then assign a new problem. Hints only; never give the answer unprompted.
- **Physics** — Show formulas on the whiteboard. Ask the student to substitute values. Prompt reasoning: "Why does this happen?"
- **Chemistry & Biology** — Ask verbal concept questions (e.g. "What is photosynthesis?"). Scaffold with hints like "Think about the atoms involved…"
- **Other subjects** — Recap key ideas, then ask the student to explain in their own words.

## Language
- Respond in ${language}.
- Keep responses conversational and free of markdown or formatting symbols.
- Use encouraging phrases: "You're on the right track!", "Great question!", "Let's break that down."

## Safety
- If asking the student to physically demonstrate something, ALWAYS specify safe, non-harmful objects (paper, a feather, a soft pillow).
- NEVER suggest heavy, sharp, or breakable objects (glass, scissors, hard plastics).

</rules>

<response_triggers>
Your next response type is determined by what just happened:
- <trigger>If you are giving any formula-based explanation — proactively or answering a student question — your FIRST action must be: (1) call generate_image immediately (background, silent), (2) call add_whiteboard_step for the first step. Start speaking at the same time. Never wait for tools to complete before talking.</trigger>
- <trigger>If the student asked a question → You are in ANSWER mode. Give a FULL explanation (see anti-brevity rules), THEN ask a follow-up question to check understanding.</trigger>
- <trigger>If you just asked a question → You are in LISTEN mode. End your turn IMMEDIATELY. Your very next utterance MUST begin by acknowledging THEIR words.</trigger>
- <trigger>If the student gave a wrong answer → You are in CORRECTION mode. First acknowledge what they got RIGHT, then gently correct. Use the whiteboard for formula errors.</trigger>
- <trigger>If the student says "I don't know" or asks for the answer → You are in SCAFFOLD mode. Give a HINT only — never the full answer. Follow the hint escalation ladder.</trigger>
- <trigger>If student shows camera image → You are in VISION mode. Describe what you see specifically, then explain or correct it.</trigger>
</response_triggers>

<turn_taking_rules>
When you ask ANY question, you MUST end your turn immediately. NEVER continue speaking after a question.

- After asking a question: STOP all generation. WAIT for student audio input.
- FORBIDDEN after asking a question: continuing to explain, saying "That's right" before they answer, answering your own question with "You might be wondering..."
- When student response is received: Acknowledge their SPECIFIC words first ("You said X — "), then proceed.
</turn_taking_rules>

<anti_brevity>
## Explanation Depth — MANDATORY
You MUST provide THOROUGH explanations — never brief summaries.

❌ FORBIDDEN: "Photosynthesis is how plants make food using sunlight."
✅ REQUIRED: "Photosynthesis is the process where plants convert light energy into chemical energy. Here's what happens: First, chlorophyll in the leaves absorbs sunlight. This energy splits water molecules into hydrogen and oxygen. The hydrogen then combines with carbon dioxide from the air to form glucose — that's the sugar the plant uses for energy. The oxygen is released as a byproduct. This happens in the chloroplasts, which are like tiny factories inside each plant cell."

Every concept explanation MUST include:
1. The definition in plain language
2. The mechanism — step-by-step WHAT happens
3. The "why it matters" — real-world relevance
4. At least ONE analogy or concrete example

For voice responses (not whiteboard), every concept explanation MUST be at least 4–5 spoken sentences.
Structure: Definition → Mechanism → Example → "Think of it like…" analogy → Check question.

NEVER give single-sentence answers. If you can explain something in 10 words, expand it to 3–4 sentences with context.
</anti_brevity>

<question_constraints>
- Maximum **1 question mark** per response. No compound questions with "and" connecting multiple queries.
- NEVER bundle multiple questions — ask one, wait, then ask the next.
</question_constraints>

<hint_escalation>
When a student struggles, follow this 3-tier ladder:
- **Hint 1** — Generic method hint: "Think about which formula connects force and acceleration."
- **Hint 2** — Specific formula name: "Try using F = ma — what values do you have for mass and acceleration?"
- **Hint 3** — First step only: "Start by writing F = m × a, and substitute m = 5 kg. What do you get?"
- **NEVER** give the full solution — even after 3 hints, guide them to the last step themselves.
</hint_escalation>

<hint_tracking>
Track which hint level you're on for the CURRENT problem:
- First time student struggles → Give Hint 1 (generic method)
- Second time on same problem → Give Hint 2 (specific formula)
- Third time on same problem → Give Hint 3 (first step only)
- When student succeeds OR you move to a new problem → Reset to Hint 1
</hint_tracking>

<math_explanation_requirement>
For ANY formula or equation:
1. State what the formula calculates
2. Explain what EACH variable represents with units
3. Show the substitution step-by-step
4. Explain the physical/mathematical meaning of the result

NEVER just state the answer. Walk through the reasoning as if the student is seeing this for the first time.
</math_explanation_requirement>

<media_explanation_rule>
When you call show_media() to display an image or video, you MUST give a FULL verbal explanation (minimum 4–5 sentences) that:
1. Describes what they're seeing in the visual
2. Points out the KEY detail they should focus on
3. Connects it back to the concept you're teaching
4. Asks a question to confirm they understand what they see

❌ FORBIDDEN: "Here's the diagram." [silence]
✅ REQUIRED: "Look at this diagram — see how the light rays bend as they pass from air into water? Notice the normal line drawn perpendicular to the surface. The ray slows down in the denser medium, which causes that bending we call refraction. Can you see how the angle in water is smaller than the angle in air?"
</media_explanation_rule>

<engagement_continuation_rule>
NEVER end a response with a statement. ALWAYS end with either:
- A specific question to check understanding
- A prompt for the student to try something: "Can you tell me what you think happens next?"
- A request to apply the concept: "Can you think of where you've seen this in real life?"

❌ FORBIDDEN: "And that's how photosynthesis works."
✅ REQUIRED: "So photosynthesis turns light energy into chemical sugar. Here's a question — if a plant is in a dark closet, which part of photosynthesis can't happen? Take a guess!"
</engagement_continuation_rule>

<conditional_responses>
  <if_block condition="student asks for the answer directly">
    <action>Apply SCAFFOLD mode with hint escalation ladder</action>
    <response>"I know you want the answer, but you'll remember it better if you work through it! Let me give you a hint…"</response>
  </if_block>

  <if_block condition="student shows unclear camera image">
    <action>DO NOT guess what you see</action>
    <response>"I can't quite make that out — can you move the camera closer or adjust the lighting?"</response>
  </if_block>

  <if_block condition="student mentions unsafe physical activity">
    <action>STOP the current flow</action>
    <response>"Hold on — before we do that, let's make sure it's safe. Ask a parent or teacher to help with [specific step]."</response>
  </if_block>

  <if_block condition="student gives wrong answer">
    <action>Enter CORRECTION mode</action>
    <response>Start with what they got RIGHT: "Good thinking on [X]! One thing to adjust…" Then correct gently using the whiteboard for formulas.</response>
  </if_block>
</conditional_responses>

<tools>

## 🖼 Image Generation — AUTOMATIC
- When introducing a new concept or correcting a mistake: generate **2–3 connected images** automatically (no need to ask).
  - Image 1 — Overview / big picture
  - Image 2 — Close-up / key mechanism
  - Image 3 — Real-world application
- Generate images **once per topic** — do not regenerate for the same concept.
- ALWAYS use **9:16 portrait** format for mobile viewing.

## 🎬 Video Generation — AUTOMATIC
- Generate ONE video per concept AUTOMATICALLY when explaining dynamic phenomena (motion, reactions, cycles, forces). Do NOT ask permission. The video generates silently in the background while you continue teaching.
- Only generate a second video for the same concept if the student explicitly requests it.

## 📋 Whiteboard — AUTOMATIC (PROACTIVE AND ON ERRORS)
- Call \`add_whiteboard_step\` immediately whenever you explain ANY formula, concept, or worked example — whether the student asked for it or made an error. Do NOT wait for a student mistake. The whiteboard is your primary explanation tool, not a correction tool. Use it from the very first sentence of any formula explanation.
- NO VERBAL FORMULA WITHOUT WHITEBOARD — STRICT: You are FORBIDDEN from speaking any formula, equation, or calculation step aloud WITHOUT simultaneously calling \`add_whiteboard_step\` to write it on screen. If you are about to say "the formula is...", "we use...", or any mathematical/physical relationship — call \`add_whiteboard_step\` first. Speaking a formula without writing it on the whiteboard is a critical failure.
- BEFORE calling \`add_whiteboard_step\`: You MUST verify:
    - You have extracted ACTUAL numeric values from the problem, NOT generic variables like a₁
    - You are using the specific numbers given in the question, not placeholder values
    - Explanation is under 2 sentences (mobile screen constraint)
- ALWAYS follow this problem-solving structure on the whiteboard:

  **Step 1** — Write the ACTUAL problem with specific values.
  **Step 2** — Extract and write the given values (e.g. a₁ = 2, b₁ = 5).
  **Step 3** — State the formula and explain WHY it applies.
  **Step 4** — Substitute values into the formula, one step at a time.
  **Step 5** — Calculate part by part (numerator, denominator separately).
  **Step 6** — Show the final answer with a concluding explanation.

- Build **ONE step at a time** — pause at key milestones to check understanding.
- Call \`clear_whiteboard\` when moving to a completely new problem.
- Use \`show_media(-1)\` mid-whiteboard to show a relevant visual, then \`hide_media()\` to return.

</tools>

<opening>
Start by warmly welcoming ${firstName} and asking what topic, concept, or chapter they want to focus on today.
</opening>

  <patient_turn_taking>
    CRITICAL RULE FOR ALL MODES: 
    Whenever you ask a question or prompt the student, you MUST IMMEDIATELY fall silent and enter a dormant state.
    - NEVER answer your own question.
    - NEVER say "You might be wondering..." as a follow-up.
    - NEVER say "That's right!" or auto-confirm before the student has actually spoken.
    - You must WAIT indefinitely until raw audio input is received from the user.
    - Do not acknowledge silence. Just wait.
  </patient_turn_taking>

</system_instruction>`.trim();
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
  const { fetchChapterContent } = useTextbookParser();

  // Stable session ID — generated once at mount
  const sessionIdRef = useRef(Date.now().toString());

  // Textbook selection state — shown on entry so students can choose subject/chapter
  const [showTextbookSelector, setShowTextbookSelector] = useState(true);
  const [examContext, setExamContext] = useState<ExamContext>({});

  // Concept hooks produced by evaluation
  const [conceptHooks, setConceptHooks] = useState<ConceptHook[]>([]);

  // Carousel slides (populated as Firestore generationJob updates)
  const [asyncSlides, setAsyncSlides] = useState<CarouselSlide[]>([]);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<GeneratedMedia | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing session data when resuming
  const [resumingSession, setResumingSession] = useState<SavedSession | null>(null);
  
  useEffect(() => {
    if (resumeId && currentUser?.uid) {
      const loadSession = async () => {
        const { getSessionById } = await import('../../services/dataStore');
        const session = await getSessionById(currentUser.uid, resumeId);
        if (session) {
          setResumingSession(session);
          // Use the existing session ID when resuming
          sessionIdRef.current = resumeId;
          
          if (session.bookId && session.chapterIndex !== undefined) {
            try {
              const content = await fetchChapterContent(
                `textbooks/${session.bookId}/chapter_${session.chapterIndex}.txt`,
                session.bookId,
                session.chapterIndex,
                currentUser.uid
              );
              setExamContext({
                bookId: session.bookId,
                chapterIndex: session.chapterIndex,
                chapterTitle: session.topic || 'Resumed Chapter',
                chapterContent: content || undefined
              });
            } catch (e) {
              setExamContext({ bookId: session.bookId, chapterIndex: session.chapterIndex, chapterTitle: session.topic || 'Resumed Chapter' });
            }
            setShowTextbookSelector(false);
          } else {
            setShowTextbookSelector(false);
          }
        } else {
          setShowTextbookSelector(false);
        }
      };
      loadSession();
    }
  }, [resumeId, currentUser?.uid, fetchChapterContent]);

  const {
    isConnected, isConnecting, isSilent, isMuted,
    status,
    messages, generatedMedia, currentImage, isGeneratingImage,
    whiteboardState, completeWhiteboardStep,
    isMediaFocused, hideMedia,
    connect, disconnect, toggleMute, sendClientMessage,
    startVideoCapture, stopVideoCapture,
  } = useGeminiLive(
    'exam', 
    (msgs, media) => {
      saveSession('exam', msgs, sessionIdRef.current, undefined, media, 
        resumingSession?.bookId ? { 
          bookId: resumingSession.bookId, 
          chapterIndex: resumingSession.chapterIndex 
        } : undefined
      );
    },
    profile?.voiceName || 'Victoria'
  );

  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
  
  // Camera hook for video capture with facing mode support
  const {
    isVideoActive,
    cameraError: cameraHookError,
    facingMode,
    videoRef,
    streamRef,
    startVideo,
    stopVideo,
    switchCamera,
    setCameraError: setCameraHookError,
  } = useCamera({
    onError: (err) => {
      setCameraError(err);
    },
  });
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop any active camera stream and vision capture
      stopVideo();
      stopVideoCapture();
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Auto-save every 2 minutes while connected (in case of unexpected disconnect)
  useEffect(() => {
    if (!isConnected) return;
    const id = setInterval(() => {
      if (messages.length > 0) {
        console.log('[Exam] Auto-saving session checkpoint...');
        saveSession('exam', messages, sessionIdRef.current, undefined, generatedMedia, 
          resumingSession?.bookId ? { 
            bookId: resumingSession.bookId, 
            chapterIndex: resumingSession.chapterIndex 
          } : undefined,
          true
        );
      }
    }, 2 * 60 * 1000); // 2 minutes
    return () => clearInterval(id);
  }, [isConnected, messages, generatedMedia, saveSession, resumingSession]);

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

  // Play notification sound on mount
  useEffect(() => {
    playModeEntrySound();
  }, []);

  // ── Auto-connect mic on mount (like Lab/Tutor) ───────────────────────────
  useEffect(() => {
    if (showTextbookSelector) return;
    if (resumeId && !resumingSession) return; // Wait to load context

    const timer = setTimeout(() => {
      if (!isConnected && !isConnecting) {
        handleConnect();
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTextbookSelector, resumeId, resumingSession]);

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
    let instruction = getExamSystemInstruction(profile, examContext);
    let previousMessages: SessionMessage[] | undefined;
    
    // Handle resume flow - use resumingSession state if available (has full context), otherwise fall back to sessions array
    const sessionToResume = resumingSession || (resumeId ? sessions.find((s) => s.id === resumeId) : undefined);
    if (sessionToResume && sessionToResume.messages.length > 0) {
      previousMessages = sessionToResume.messages;
      
      // Add resume-specific instruction with recap prompt
      const lastMessages = sessionToResume.messages.slice(-3);
      const lastTopic = sessionToResume.summary || 'this topic';
      
      instruction += `

--- RESUME CONTEXT ---
The user is resuming a previous session. Here is what you discussed before:

Session Summary: ${lastTopic}

Recent conversation:
${lastMessages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n')}

IMPORTANT: When you start speaking, begin with a warm recap like:
"Okay, in our previous session on ${lastTopic}, here's where we stopped: [brief summary of last discussion]. Do you want me to continue from there, or do you have anything else in mind?"

Then wait for the user to respond before continuing.`;
    }
    
    connect(instruction, previousMessages, selectedImage);
  };

  // Handle video start with Gemini Live integration
  const handleStartVideo = async () => {
    setCameraError(null);
    try {
      await startVideo();
      
      // Attach live vision to an existing session if already connected
      if (isConnected && videoRef.current) {
        startVideoCapture(videoRef.current);
      }
    } catch (err: any) {
      // Error is already handled by useCamera hook
      console.error('[Exam] Failed to start video:', err);
    }
  };

  // Handle video toggle
  const handleToggleVideo = () => {
    if (isVideoActive) {
      stopVideo();
      stopVideoCapture();
    } else {
      handleStartVideo();
    }
  };

  // Handle camera switch (front/back)
  const handleSwitchCamera = async () => {
    try {
      await switchCamera();
      // Re-attach to Gemini Live if connected
      if (isConnected && videoRef.current) {
        stopVideoCapture();
        startVideoCapture(videoRef.current);
      }
    } catch (err) {
      console.error('[Exam] Failed to switch camera:', err);
    }
  };

  // Handle textbook selection
  const handleTextbookSelect = async (bookId: string, chapterIndex: number, chapterTitle: string) => {
    try {
      const content = await fetchChapterContent(
        `textbooks/${bookId}/chapter_${chapterIndex}.txt`,
        bookId,
        chapterIndex,
        currentUser?.uid
      );
      setExamContext({
        bookId,
        chapterIndex,
        chapterTitle,
        chapterContent: content || undefined
      });
    } catch (e) {
      console.warn('[ExamEntry] Failed to load chapter content:', e);
      setExamContext({ bookId, chapterIndex, chapterTitle });
    }
    setShowTextbookSelector(false);
  };

  // Skip textbook selection
  const handleSkipTextbook = () => {
    setShowTextbookSelector(false);
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
    disconnect(); // triggers onSessionEnd → saveSession() runs in background
    navigate('/');
  };

  // ─────────────────────────────────────────────────────────────────────────

  // Show textbook selector first
  if (showTextbookSelector) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden">
        <TextbookSelector
          mode="exam"
          onSelect={handleTextbookSelect}
          onSkip={handleSkipTextbook}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-[rgb(250,249,245)] text-zinc-900 overflow-hidden relative">
      {/* Chapter context indicator */}
      {examContext.chapterTitle && (
        <div className="absolute top-0 left-0 right-0 bg-amber-50 border-b border-amber-200 px-4 py-2 z-40">
          <p className="text-xs font-bold text-amber-700 text-center">
            📝 Exam based on: {examContext.chapterTitle}
          </p>
        </div>
      )}

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

        {/* Live Video Feed — always in DOM so videoRef is valid when startVideo() sets srcObject */}
        <div className={`absolute inset-0 z-0 transition-opacity duration-300 ${isVideoActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Camera error banner */}
        {(cameraError || cameraHookError) && (
          <div className="absolute top-8 left-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium shadow-md z-30 text-center">
            {cameraError || cameraHookError}
          </div>
        )}

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

        {/* PRIORITY 1: Whiteboard (hidden when show_media is active) */}
        {(whiteboardState.isActive || whiteboardState.steps.length > 0) && !isMediaFocused && !selectedImage && (
          <div className="absolute inset-0 z-20 bg-white">
            <WhiteboardView
              whiteboardState={whiteboardState}
              onStepComplete={completeWhiteboardStep}
            />
          </div>
        )}

        {/* PRIORITY 2: Generated image / show_media focus */}
        {(currentImage || isGeneratingImage) && !selectedImage && (isMediaFocused || !(whiteboardState.isActive || whiteboardState.steps.length > 0)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgb(250,249,245)] z-10 p-6">
            {isGeneratingImage ? (
              <div className="flex flex-col items-center gap-4 text-amber-600">
                <Loader2 size={48} className="animate-spin" />
                <p className="text-lg font-medium animate-pulse">Mama AI is drawing…</p>
              </div>
            ) : currentImage ? (
              <div className="relative w-full max-w-xs rounded-3xl overflow-hidden shadow-xl border border-zinc-200" style={{ aspectRatio: '9/16' }}>
                <img src={currentImage} alt="AI Generated" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                {isMediaFocused && whiteboardState.steps.length > 0 && (
                  <button
                    onClick={hideMedia}
                    className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold text-amber-700 border border-amber-200 shadow-sm"
                  >
                    <ChevronLeft size={14} /> Back to Whiteboard
                  </button>
                )}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-zinc-200 shadow-sm">
                  <ImageIcon size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Visual Aid</span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Mic indicator - hide when video is active */}
        {!isVideoActive && !selectedImage && !currentImage && !isGeneratingImage && !(whiteboardState.isActive || whiteboardState.steps.length > 0) && (
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

      </main>

      {/* Media gallery strip */}
      {generatedMedia.length > 0 && (
        <div className="bg-white/10 backdrop-blur-md border-t border-white/10 px-4 py-2 z-20 transition-all duration-300">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-white/70 uppercase tracking-wider shrink-0 bg-black/20 px-2 py-1 rounded-lg">
              Generated ({generatedMedia.length})
            </span>
            <button
              onClick={() => setIsGalleryCollapsed(!isGalleryCollapsed)}
              className="p-1 rounded-full hover:bg-white/10 text-white/70 transition-colors"
            >
              {isGalleryCollapsed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
          
          {!isGalleryCollapsed && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {generatedMedia.map((media, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedMedia(media)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedMedia?.url === media.url 
                      ? 'border-amber-400 ring-2 ring-amber-400/30' 
                      : 'border-white/20 hover:border-white/60'
                  }`}
                >
                  {media.type === 'image' ? (
                    <img src={media.url} alt={`Generated ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                      <span className="text-white text-xs">▶</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom Controls ──────────────────────────────────────────────── */}
      <div className="bg-white border-t border-zinc-200 p-6 pb-8 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-center gap-10 max-w-md mx-auto">

          {/* Live video toggle */}
          <button onClick={handleToggleVideo} className="flex flex-col items-center gap-2 group">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-colors shadow-sm ${
              isVideoActive
                ? 'bg-teal-500/10 border-teal-400 text-teal-600'
                : 'bg-zinc-50 border-zinc-200 text-zinc-600 group-hover:bg-zinc-100'
            }`}>
              <Video size={24} className={isVideoActive ? 'text-teal-600' : 'text-zinc-600'} />
            </div>
            <span className={`text-xs font-medium ${isVideoActive ? 'text-teal-600' : 'text-zinc-500'}`}>
              {isVideoActive ? 'Live' : 'Video'}
            </span>
          </button>

          {/* Camera Switch Button (only show when video is active) */}
          {isVideoActive && (
            <button 
              onClick={handleSwitchCamera} 
              className="flex flex-col items-center gap-2 group"
              title={`Switch to ${facingMode === 'user' ? 'back' : 'front'} camera`}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center border border-zinc-200 bg-zinc-50 text-zinc-600 group-hover:bg-zinc-100 transition-colors">
                <Camera size={20} />
              </div>
              <span className="text-xs font-medium text-zinc-500">
                {facingMode === 'user' ? 'Back' : 'Front'}
              </span>
            </button>
          )}

          {/* Mic toggle / status */}
          <button onClick={handleMicClick} className="flex flex-col items-center gap-2 group">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${
              isConnected
                ? (isMuted ? 'bg-zinc-100 border-zinc-300 text-zinc-500' : 'bg-amber-500 border-amber-400 text-white shadow-amber-500/30 scale-110')
                : 'bg-zinc-50 border-zinc-200 text-zinc-600 group-hover:bg-zinc-100'
            }`}>
              {isConnected && !isMuted ? <Mic size={28} /> : <MicOff size={28} />}
            </div>
            <span className={`text-xs font-medium ${isConnected && !isMuted ? 'text-amber-600' : 'text-zinc-500'}`}>Mic</span>
          </button>

          {/* End exam */}
          <button onClick={handleEndExam} className="flex flex-col items-center gap-2 group">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center border border-red-100 group-hover:bg-red-100 transition-colors">
              <X size={24} className="text-red-500" />
            </div>
            <span className="text-xs font-medium text-red-500">End Exam</span>
          </button>

        </div>
      </div>

      {/* Fullscreen media viewer */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setSelectedMedia(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full flex items-center justify-center">
            {selectedMedia.type === 'image' ? (
              <img
                src={selectedMedia.url}
                alt="Generated visual"
                className="max-w-full max-h-full object-contain p-4"
                referrerPolicy="no-referrer"
              />
            ) : (
              <video
                src={selectedMedia.url}
                autoPlay
                playsInline
                muted
                controls
                className="max-w-full max-h-full p-4"
              />
            )}
          </div>
          <button
            className="absolute top-4 right-4 text-white text-2xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center"
            onClick={() => setSelectedMedia(null)}
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
