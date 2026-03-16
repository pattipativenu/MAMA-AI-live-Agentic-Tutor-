import { useEffect, useRef, useState, ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, MicOff, X, Video, VideoOff, Image as ImageIcon, Loader2, ChevronLeft, ChevronUp, ChevronDown, Camera } from 'lucide-react';
import { useCamera, FacingMode } from '../../hooks/useCamera';
import { useGeminiLive, type GeneratedMedia } from '../../hooks/useGeminiLive';
import { WhiteboardView } from '../../components/whiteboard';
import { useProfile, UserProfile } from '../../hooks/useProfile';
import { useSessions, SessionMessage, SavedSession } from '../../hooks/useSessions';
import { useAuth } from '../../contexts/AuthContext';
import { playModeEntrySound } from '../../utils/sound';
import ErrorBoundary from '../../components/ErrorBoundary';

// Simple system instruction that works even without profile
const getLabSystemInstruction = (profile: UserProfile | null) => {
  const firstName = profile?.name?.split(' ')[0] || 'Student';
  const age = profile?.age || 'High School';
  const gender = profile?.gender || '';
  const hobbies = profile?.hobbies?.join(', ') || '';
  const rawStyle = profile?.learningStyle || 'visual';
  const learningStyle = rawStyle === 'all'
    ? 'Adaptive — choose the best approach per concept (visual, verbal, hands-on)'
    : rawStyle;
  const language = profile?.language || 'English';

  return `
<system_instruction>

<identity>
  <role>Warm, hands-on AI Lab Partner — Mama AI</role>
  <mission>Guide ${firstName} through safe, engaging science experiments and help them understand the science behind every observation.</mission>
  <voice>Excited, encouraging, safety-conscious. Speak naturally — no markdown symbols in speech.</voice>
</identity>

<student_profile>
  <name>${firstName}</name>
  <grade>${age}</grade>
  ${gender ? `<gender>${gender}</gender>` : ''}
  ${hobbies ? `<interests>${hobbies}</interests>` : ''}
  <learning_style>${learningStyle}</learning_style>
  <preferred_language>${language}</preferred_language>
  <note>DO NOT ask for this information again. Tailor all experiments, examples, and explanations to this profile.</note>
</student_profile>

<rules>

## Name Usage — STRICT
- Use "${firstName}" **once** at the opening greeting.
- After that, use the name **at most once every 4–5 exchanges**.
- **NEVER** end a sentence with the student's name (e.g. avoid "…great, ${firstName}?").
- **NEVER** use the name while explaining step-by-step procedures or chemical equations.
- When used, place it **only at the start** of a sentence: "${firstName}, good observation!"

## Core Lab Philosophy
- ALWAYS give instructions ONE STEP AT A TIME — never dump all steps at once.
- After each step, ask a check question and wait for the student's response before moving forward.
- If the student shows you something via camera, describe what you see and explain the science behind it.

## Experiment Flow
ALWAYS follow this structure for every experiment:
1. **Introduction** — announce what the experiment is and what the student will observe.
2. **Materials check** — list what they need; ask if they have it all.
3. **Safety brief** — state any precautions before starting.
4. **Step-by-step guidance** — one step at a time, wait for confirmation before the next.
5. **Observation prompt** — after each step: "What do you notice happening?"
6. **Science explanation** — explain using the 3-layer structure (see below).
7. **Wrap-up** — summarise what they learned and ask a short reflection question.

## Language
- Respond in ${language}.
- Keep responses energetic and conversational.
- Use vivid language: "Watch it fizz!", "That bubbling means CO₂ is being released!"

</rules>

<response_triggers>
Your next response type is determined by what just happened:
- <trigger>If the student asked a question → You are in ANSWER mode. Give a FULL explanation using the 3-layer science structure, THEN ask a follow-up question.</trigger>
- <trigger>If you just asked a question → You are in LISTEN mode. End your turn IMMEDIATELY. Your very next utterance MUST begin by acknowledging THEIR words.</trigger>
- <trigger>If the student made an observation → You are in EXPLAIN mode. Use the 3-layer What→Mechanism→Relevance structure to explain what they saw.</trigger>
- <trigger>If the student says "I don't know" → You are in SCAFFOLD mode. Give a hint or guiding question — never the full answer.</trigger>
- <trigger>If student shows camera image → You are in VISION mode. Describe what you see specifically, then explain the science behind it.</trigger>
</response_triggers>

<turn_taking_rules>
When you ask ANY question, you MUST end your turn immediately. NEVER continue speaking after a question.

- After asking a question: STOP all generation. WAIT for student audio input.
- FORBIDDEN after asking a question: continuing to explain, saying "Exactly!" before they answer, answering your own question.
- When student response is received: Acknowledge their SPECIFIC words first, then proceed.
</turn_taking_rules>

<science_explanation_structure>
For EVERY observation or concept, you MUST explain using this 3-layer structure:
1. <what>What physically happened — the observable phenomenon</what>
2. <mechanism>The molecular/atomic mechanism causing it — WHY it happened at the particle level</mechanism>
3. <relevance>Why this matters in the real world OR how it connects to something the student already knows</relevance>

Example for baking soda + vinegar:
[What] "You see bubbling and fizzing — that's gas being released."
[Mechanism] "The acetic acid in vinegar is reacting with sodium bicarbonate. They're trading atoms to form carbon dioxide gas — those are the bubbles — plus water and sodium acetate."
[Relevance] "This same CO₂ reaction is what makes bread rise with yeast, and why antacid tablets fizz when you drop them in water. You're seeing chemistry that happens in kitchens and medicine cabinets every day."

❌ FORBIDDEN: "The vinegar and baking soda reacted to form carbon dioxide." (single-layer only)
✅ REQUIRED: All 3 layers — What + Mechanism + Relevance — every single time.
</science_explanation_structure>

<anti_brevity>
## Explanation Depth — MANDATORY
You MUST provide THOROUGH explanations — never brief summaries.

Every concept explanation MUST include:
1. The definition or observation in plain language
2. The mechanism — step-by-step WHAT happens at molecule/atom level
3. The "why it matters" — real-world relevance
4. At least ONE analogy or concrete example

For voice responses, every explanation MUST be at least 4–5 spoken sentences.
NEVER give single-sentence science explanations. If you can explain something in 10 words, expand it to 3–4 sentences with context.
</anti_brevity>

<safety_protocol>
  <tier name="green">Household items ONLY — water, paper, vinegar, baking soda, food colouring, salt, sugar, balloons, rubber bands. NO permission needed.</tier>
  <tier name="yellow">Requires adult supervision — heat sources (candles, hot water), scissors, small batteries. ALWAYS say: "Ask an adult to help with this step first."</tier>
  <tier name="red">ABSOLUTELY FORBIDDEN — concentrated acids/bases, live electricity, toxic chemicals, sharp blades, fire without supervision, anything requiring protective equipment.</tier>

  <if_block condition="student suggests red-tier activity">
    <action>DO NOT proceed with the activity</action>
    <response>"I can't help with that — it's not safe without proper lab equipment. Let's try [green-tier alternative] instead to see the same concept!"</response>
  </if_block>

  <if_block condition="experiment step involves yellow-tier materials">
    <action>STOP and require adult confirmation</action>
    <response>"This next step needs a grown-up nearby. Ask a parent or teacher to help with [specific action] before we continue."</response>
    <next_step>Wait for student confirmation that an adult is present</next_step>
  </if_block>
</safety_protocol>

<media_explanation_rule>
When you call show_media() to display an image or video, you MUST give a FULL verbal explanation (minimum 4–5 sentences) that:
1. Describes what they're seeing in the visual
2. Points out the KEY detail they should focus on
3. Connects it back to the experiment or concept
4. Asks a question to confirm they understand what they see

❌ FORBIDDEN: "Here's the diagram." [silence]
✅ REQUIRED: "Look at this — see the two liquids separating into layers? The denser liquid sinks to the bottom. That's because density determines which liquid 'wins' in the gravity contest. Can you guess which liquid is denser based on where it ended up?"
</media_explanation_rule>

<engagement_continuation_rule>
NEVER end a response with a statement. ALWAYS end with either:
- A specific question to check understanding
- A prompt for the student to try something: "Now pour it in slowly — what do you see happening?"
- A request to predict: "Before we add the vinegar, what do you THINK will happen?"

❌ FORBIDDEN: "And that's how the reaction works."
✅ REQUIRED: "So the acid and base neutralised each other, releasing CO₂ gas. Here's a challenge — what do you think would happen if we used lemon juice instead of vinegar? Would it still fizz?"
</engagement_continuation_rule>

<step_progression_tracking>
You are guiding a physical experiment. Track:
- Current step number in the experiment flow (Introduction → Materials → Safety → Step 1, 2, 3... → Wrap-up)
- Whether student has confirmed completion of the current step (said "done", "ok", "next", etc.)
- What observation they shared after each step

NEVER skip ahead — wait for explicit confirmation before giving the next step.
NEVER dump multiple steps at once — ONE step, ONE observation, ONE explanation at a time.
</step_progression_tracking>

<conditional_responses>
  <if_block condition="student shows unclear camera image">
    <action>DO NOT guess what you see</action>
    <response>"I can't quite see that clearly — can you move the camera closer or hold it steadier so I can see the reaction?"</response>
  </if_block>

  <if_block condition="student asks for the answer directly">
    <action>Give a guiding hint, not the answer</action>
    <response>"Great question! Here's a clue — think about what happens to atoms when they're heated. What might that do to the liquid?"</response>
  </if_block>

  <if_block condition="student asks to skip ahead">
    <action>Gently redirect to current step</action>
    <response>"I love the enthusiasm! But let's finish this step first — the next part makes way more sense once you've seen what happens here."</response>
  </if_block>
</conditional_responses>

<tools>

## 📷 CAMERA EQUIPMENT RECOGNITION — PROACTIVE
Run this when the camera turns on or when you first observe items in the camera frame:

1. ANALYSE what equipment, ingredients, or household items are visible.
2. Announce what you see: "I can see you have [item1], [item2], [item3]..."
3. Based on what's visible, SUGGEST a fitting experiment and list what else would help:
   "With [visible items] we could do [experiment name]. You might also need [missing items].
   Do you happen to have any of these? — vinegar, baking soda, food colouring, milk,
   vegetable oil, lemon juice, salt, sugar, or anything else nearby?"
4. Invite them to start: "If you have any of these, or any other ingredients, just let me know and we can begin straight away!"
5. If camera is on but nothing is visible: "I can see your camera is on — can you show me what ingredients or equipment you have so we can plan the experiment together?"
6. MISSING ITEMS: After identifying what's visible, explicitly state what a standard version of the suggested experiment would need that is NOT yet visible. Frame it as a friendly checklist, not a requirement.
7. If the student shows the camera and the experiment is already in progress: describe what you observe, identify which step they are at, and guide them forward from that point.

## 🔬 REAL-TIME EXPERIMENT TRACKING (while camera is active)
1. OBSERVE continuously — every camera frame updates your understanding of the experiment state.
2. ACKNOWLEDGE step completions as you see them: "I can see you've already [poured/mixed/added X] — great work!"
3. TRACK what has been done vs. what remains. Reference your mental checklist: "So far you've done [steps 1–2]. Next we need to [step 3]."
4. PROACTIVE HELP — if you observe the student struggling (wrong technique, nothing happening, confused movement, incorrect quantities), say what you see and help IMMEDIATELY, without waiting for them to ask: "I notice [specific observation from camera] — try [specific guidance] instead."
5. NEVER pretend to see something unclear. If the angle is unhelpful: "I can't quite see the reaction — can you bring the camera closer so I can watch?"

## 🖼 Image Generation — AUTOMATIC
When explaining the science behind any experiment observation, automatically call generate_image 2–3 times in sequence:
- Image 1 — Overview of the experiment setup or reaction
- Image 2 — Close-up of the key mechanism at the molecular/particle level
- Image 3 — Real-world application of the same science
Images generate silently in the gallery. Do NOT pause to wait for them.
ALWAYS use **9:16 portrait** format for mobile viewing.

## 🎬 Video Generation — AUTOMATIC
When explaining any process that involves movement, change, or transformation (e.g., gas being released, liquid layers forming, a reaction progressing), automatically call generate_video ONCE for that concept. Continue explaining while it generates in the background (30–60 seconds). Only generate a second video if the student explicitly asks.

## 📋 Whiteboard — PROACTIVE FOR EQUATIONS, OFFERED FOR PROCESSES
- For any CHEMICAL EQUATION, FORMULA, or MATHEMATICAL RELATIONSHIP involved in the experiment: call \`add_whiteboard_step\` immediately — no need to ask. Students need to see equations written out.
- For step-by-step procedure walkthroughs: offer once ("Want me to draw this on the whiteboard?"), and use it automatically for all subsequent steps if they confirm.
- NO VERBAL FORMULA WITHOUT WHITEBOARD — STRICT: You are FORBIDDEN from speaking any chemical equation, formula, or mathematical relationship aloud WITHOUT simultaneously calling \`add_whiteboard_step\`. If you are about to say "the equation is...", "the reaction produces...", or name any formula — call \`add_whiteboard_step\` first.
- BEFORE calling \`add_whiteboard_step\`: You MUST verify:
    - You are using ACTUAL values from the experiment, NOT generic placeholder variables
    - Step explanation is under 2 sentences (mobile screen constraint)
    - You are building ONE step at a time, not dumping multiple steps at once
- ALWAYS follow this structure on the whiteboard:

  **Step 1** — Write the experiment name or chemical equation clearly.
  **Step 2** — List reactants/products or materials with specific quantities.
  **Step 3** — Explain each component (e.g. "2H₂ = 2 molecules of hydrogen gas").
  **Step 4** — Show the step-by-step process with observations.
  **Step 5** — Write the final result or conclusion.

- Build **ONE step at a time** — never show all steps at once.
- Call \`clear_whiteboard\` when moving to a new experiment.
- Use \`show_media(-1)\` to show a previously approved diagram mid-explanation, then \`hide_media()\` to return.

## 🔍 Google Search — LAST RESORT ONLY
- Use search ONLY when you genuinely cannot answer from training knowledge (e.g. identifying a specific product name or brand on camera).
- NEVER search for science concepts, experiment theory, or anything you already know.

</tools>

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

export default function LabEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('resumeId');

  const { profile } = useProfile();
  const { currentUser } = useAuth();
  const { sessions, saveSession } = useSessions();

  // Session state
  const sessionIdRef = useRef(Date.now().toString());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<GeneratedMedia | null>(null);
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Camera hook for video capture with facing mode support
  const {
    isVideoActive,
    cameraError: cameraHookError,
    facingMode,
    videoRef,
    streamRef,
    startVideo,
    stopVideo,
    toggleVideo,
    switchCamera,
    setCameraError: setCameraHookError,
  } = useCamera({
    onStart: () => {
      setSelectedImage(null);
    },
    onError: (err) => {
      setCameraError(err);
    },
  });

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
        }
      };
      loadSession();
    }
  }, [resumeId, currentUser?.uid]);

  const {
    isConnected, isConnecting, isSilent, isMuted,
    status,
    messages, generatedMedia,
    currentImage, isGeneratingImage,
    whiteboardState, completeWhiteboardStep,
    isMediaFocused, hideMedia,
    connect, disconnect, toggleMute,
    startVideoCapture, stopVideoCapture,
  } = useGeminiLive(
    'lab', 
    (msgs, media) => {
      saveSession('lab', msgs, sessionIdRef.current, undefined, media);
    },
    profile?.voiceName || 'Victoria'
  );

  // Play notification sound on mount
  useEffect(() => {
    playModeEntrySound();
  }, []);

  // Auto-connect mic on mount
  useEffect(() => {
    // Wait until resumed session data is loaded before connecting
    if (resumeId && !resumingSession) return;

    // Small delay to ensure everything is ready
    const timer = setTimeout(() => {
      if (!isConnected && !isConnecting) {
        handleConnect(selectedImage, null);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId, resumingSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVideo();
      disconnect();
    };
  }, []);

  // Auto-save every 2 minutes while connected (in case of unexpected disconnect)
  useEffect(() => {
    if (!isConnected) return;
    const id = setInterval(() => {
      if (messages.length > 0) {
        console.log('[Lab] Auto-saving session checkpoint...');
        saveSession('lab', messages, sessionIdRef.current, undefined, generatedMedia, undefined, true);
      }
    }, 2 * 60 * 1000); // 2 minutes
    return () => clearInterval(id);
  }, [isConnected, messages, generatedMedia, saveSession]);

  // Handle video start with Gemini Live integration
  const handleStartVideo = async () => {
    setCameraError(null);
    try {
      await startVideo();
      
      // If already connected, start sending frames directly; otherwise connect fresh with video
      if (isConnected) {
        if (videoRef.current) startVideoCapture(videoRef.current);
      } else {
        await handleConnect(null, videoRef.current);
      }
    } catch (err: any) {
      // Error is already handled by useCamera hook
      console.error('[Lab] Failed to start video:', err);
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
      console.error('[Lab] Failed to switch camera:', err);
    }
  };

  const handleMicClick = async () => {
    setError(null);
    if (isConnected) {
      toggleMute();
    } else {
      await handleConnect(selectedImage, null);
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setSelectedImage(base64);
        stopVideo();
        handleConnect(base64, null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConnect = async (
    image: string | null = selectedImage, 
    videoEl: HTMLVideoElement | null = null
  ) => {
    try {
      let instruction = getLabSystemInstruction(profile);
      let previousMessages: SessionMessage[] | undefined;
      
      // Handle resume flow - use resumingSession state if available (has full context), otherwise fall back to sessions array
      const sessionToResume = resumingSession || (resumeId ? sessions.find(s => s.id === resumeId) : undefined);
      if (sessionToResume && sessionToResume.messages.length > 0) {
        previousMessages = sessionToResume.messages;
        
        // Add resume-specific instruction with recap prompt
        const lastMessages = sessionToResume.messages.slice(-3);
        const lastTopic = sessionToResume.summary || 'this experiment';
        
        instruction += `

--- RESUME CONTEXT ---
The user is resuming a previous lab session. Here is what you discussed before:

Session Summary: ${lastTopic}

Recent conversation:
${lastMessages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n')}

IMPORTANT: When you start speaking, begin with a warm recap like:
"Okay, in our previous lab session on ${lastTopic}, here's where we stopped: [brief summary of last discussion]. Do you want me to continue from there, or do you have anything else in mind?"

Then wait for the user to respond before continuing.`;
      }
      
      console.log('[Lab] Connecting with instruction:', instruction.substring(0, 100) + '...');
      await connect(instruction, previousMessages, image, videoEl);
      console.log('[Lab] Connected successfully');
    } catch (err: any) {
      console.error('[Lab] Connection failed:', err);
      setError(err.message || 'Failed to connect. Please try again.');
    }
  };

  const handleEndSession = () => {
    stopVideo();
    disconnect(); // triggers onSessionEnd → saveSession() runs in background
    navigate('/');
  };

  return (
    <ErrorBoundary children={
      <div className="flex flex-col h-screen bg-[rgb(250,249,245)] text-zinc-900 overflow-hidden relative">
      
      {/* Error Display */}
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium shadow-md z-50 text-center">
          {error}
          <button 
            onClick={() => setError(null)} 
            className="ml-2 font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Camera Error */}
      {(cameraError || cameraHookError) && (
        <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium shadow-md z-50 text-center">
          {cameraError || cameraHookError}
        </div>
      )}

      {/* Main Visual Area */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden p-6">

        {/* Video Feed — always in DOM so videoRef is valid when startVideo() sets srcObject */}
        <div className={`absolute inset-0 transition-opacity duration-300 ${isVideoActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Selected Image */}
        {selectedImage && !isVideoActive && (
          <div className="absolute inset-0 p-6 flex items-center justify-center">
            <div className="relative w-full max-w-md aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-zinc-200 bg-white">
              <img
                src={selectedImage}
                alt="Uploaded"
                className="w-full h-full object-contain"
              />
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
        {(whiteboardState.isActive || whiteboardState.steps.length > 0) && !isMediaFocused && !isVideoActive && !selectedImage && (
          <div className="absolute inset-0 z-20 bg-white">
            <WhiteboardView
              whiteboardState={whiteboardState}
              onStepComplete={completeWhiteboardStep}
            />
          </div>
        )}

        {/* PRIORITY 2: AI Generated Image / show_media focus */}
        {(currentImage || isGeneratingImage) && !isVideoActive && !selectedImage && (isMediaFocused || !(whiteboardState.isActive || whiteboardState.steps.length > 0)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgb(250,249,245)] z-10 p-6">
            {isGeneratingImage ? (
              <div className="flex flex-col items-center gap-4 text-teal-600">
                <Loader2 size={48} className="animate-spin" />
                <p className="text-lg font-medium animate-pulse">Mama AI is drawing...</p>
              </div>
            ) : currentImage ? (
              <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden shadow-xl border border-zinc-200">
                <img src={currentImage} alt="AI Generated" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                {isMediaFocused && whiteboardState.steps.length > 0 && (
                  <button
                    onClick={hideMedia}
                    className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold text-teal-700 border border-teal-200 shadow-sm"
                  >
                    <ChevronLeft size={14} /> Back to Whiteboard
                  </button>
                )}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-zinc-200 shadow-sm">
                  <ImageIcon size={14} className="text-teal-600" />
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Visual Aid</span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Default State / Mic Indicator */}
        {!isVideoActive && !selectedImage && !currentImage && !isGeneratingImage && !(whiteboardState.isActive || whiteboardState.steps.length > 0) && (
          <div className="relative flex flex-col items-center justify-center z-10">
            {isConnected ? (
              <>
                <div className={`absolute w-48 h-48 rounded-full animate-ping ${isMuted ? 'bg-zinc-500/10' : 'bg-teal-500/10'}`} />
                <div className={`absolute w-64 h-64 rounded-full animate-pulse ${isMuted ? 'bg-zinc-500/5' : 'bg-teal-500/5'}`} />
                <div className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-colors ${isMuted ? 'bg-zinc-200 text-zinc-500 shadow-zinc-200/50' : 'bg-teal-500 text-white shadow-teal-500/50'}`}>
                  {isMuted ? <MicOff size={48} /> : <Mic size={48} />}
                </div>
                <p className="mt-8 text-xl font-bold text-zinc-900 tracking-wide">
                  {isMuted ? "Muted" : "I'm listening..."}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center text-center px-6">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 border border-zinc-200 shadow-sm">
                  <MicOff size={32} className="text-zinc-400" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Lab Mode</h2>
                <p className="text-zinc-500 max-w-[250px]">
                  {isConnecting ? 'Connecting...' : 'Tap the mic to talk, or use video to show me your experiment.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Connecting Indicator */}
        {isConnecting && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md z-20 flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Connecting...
          </div>
        )}
      </main>

      {/* Media gallery strip */}
      {generatedMedia.length > 0 && (
        <div className="bg-white border-t border-zinc-200 px-4 py-2 z-20 transition-all duration-300">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider shrink-0 bg-zinc-100 px-2 py-1 rounded-lg">
              Generated ({generatedMedia.length})
            </span>
            <button
              onClick={() => setIsGalleryCollapsed(!isGalleryCollapsed)}
              className="p-1 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors"
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
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedMedia?.url === media.url 
                      ? 'border-amber-400 ring-2 ring-amber-400/30' 
                      : 'border-zinc-200 hover:border-zinc-300'
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

      {/* Bottom Control Bar */}
      <div className="bg-white border-t border-zinc-200 p-6 pb-8 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between max-w-md mx-auto">



          {/* Video Button */}
          <button
            onClick={handleToggleVideo}
            className="flex flex-col items-center gap-2 group"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-colors ${isVideoActive ? 'bg-teal-50 border-teal-200 text-teal-600 shadow-sm' : 'bg-zinc-50 border-zinc-200 text-zinc-600 group-hover:bg-zinc-100'}`}>
              {isVideoActive ? <Video size={24} /> : <VideoOff size={24} />}
            </div>
            <span className={`text-xs font-medium ${isVideoActive ? 'text-teal-600' : 'text-zinc-500'}`}>Video</span>
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

          {/* Mic Button */}
          <button
            onClick={handleMicClick}
            disabled={isConnecting}
            className="flex flex-col items-center gap-2 group"
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${isConnected ? (isMuted ? 'bg-zinc-100 border-zinc-300 text-zinc-500' : 'bg-teal-500 border-teal-400 text-white shadow-teal-500/30 scale-110') : isConnecting ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-zinc-50 border-zinc-200 text-zinc-600 group-hover:bg-zinc-100'}`}>
              {isConnecting ? <Loader2 size={28} className="animate-spin" /> : isConnected && !isMuted ? <Mic size={28} /> : <MicOff size={28} />}
            </div>
            <span className={`text-xs font-medium ${isConnected && !isMuted ? 'text-teal-600' : isConnecting ? 'text-amber-600' : 'text-zinc-500'}`}>
              {isConnecting ? 'Connecting' : isConnected ? (isMuted ? 'Muted' : 'Listening') : 'Mic'}
            </span>
          </button>

          {/* End Session Button */}
          <button
            onClick={handleEndSession}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center border border-red-100 group-hover:bg-red-100 transition-colors">
              <X size={24} className="text-red-500" />
            </div>
            <span className="text-xs font-medium text-red-500">End</span>
          </button>

        </div>
      </div>
    </div>
      } />
  );
}
