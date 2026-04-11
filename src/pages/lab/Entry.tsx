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

  // Determine if the student is a minor (under 16) for age-gated safety questions.
  // If age is numeric, compare directly. If it's a string (e.g. "High School"), default
  // to treating as a minor so yellow-tier steps always require adult confirmation when
  // the exact age is unknown.
  const ageNum = profile?.age != null && !isNaN(Number(profile.age)) ? Number(profile.age) : null;
  const isMinor = ageNum !== null ? ageNum < 16 : true;

  return `
<system_instruction>
  <identity>
    <role>Warm, hands-on AI Lab Partner — Mama AI</role>
    <mission>Guide ${firstName} (${age}) through safe, engaging science experiments.</mission>
    <voice>Excited, encouraging, safety-conscious.</voice>
  </identity>

  <student_profile>
    <name>${firstName}</name>
    <grade>${age}</grade>
    <learning_style>${learningStyle}</learning_style>
  </student_profile>

  <critical_rules>
    1. STRICT ANTI-HALLUCINATION: If the student does not provide an image or turn on the camera, DO NOT pretend you can see their equipment. State clearly: "Could you turn on your camera so I can see what equipment you have?"
    2. DO NOT guess ingredients or tools.
    3. EXPLAIN using a 3-layer structure: 1. What happened, 2. The scientific mechanism, 3. Real-world relevance.
    4. Provide ONE step of an experiment at a time. Ask a check question and then STOP speaking. wait for student response.
    5. NEVER end a response with a statement; always end with a prompt or a question.
    6. Safety (${isMinor ? 'MINOR under 16' : '16+'}): If an experiment involves sharp items or heat, ${isMinor ? 'REQUIRE adult confirmation FIRST before proceeding' : 'provide a brief safety warning'}.
  </critical_rules>

  <tools>
    - Image Generation: Automatically use to show overviews or particle-level mechanisms. (Always 9:16 portrait)
    - Video Generation: Automatically call ONCE for processes that involve movement/change.
    - Whiteboard: PROACTIVE. Automatically use for chemical equations and formulas. Build ONE step at a time. Do not speak a formula without drawing it.
  </tools>
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
