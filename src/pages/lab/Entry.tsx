import { useEffect, useRef, useState, ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, MicOff, Camera, X, Video, VideoOff, Image as ImageIcon, Loader2, ChevronLeft } from 'lucide-react';
import { useGeminiLive } from '../../hooks/useGeminiLive';
import { WhiteboardView } from '../../components/whiteboard';
import ThinkingIndicator from '../../components/ThinkingIndicator';
import { useProfile, UserProfile } from '../../hooks/useProfile';
import { useSessions, SessionMessage } from '../../hooks/useSessions';
import { playModeEntrySound } from '../../utils/sound';

// Simple system instruction that works even without profile
const getLabSystemInstruction = (profile: UserProfile | null) => {
  const name = profile?.name?.split(' ')[0] || 'student';
  const age = profile?.age || 'High School';
  const hobbies = profile?.hobbies?.join(', ') || 'various activities';
  const rawStyle = profile?.learningStyle || '';
  const learningStyleLabel = rawStyle === 'all'
    ? 'Adaptive — choose the best style for each concept (visual, verbal, hands-on)'
    : rawStyle || 'Adaptive';

  return `
You are Mama AI, a warm, encouraging AI tutor for ${name}, a ${age} student.

You are in LAB MODE - helping with hands-on science experiments.

STUDENT PROFILE:
- Name: ${name}
- Grade: ${age}
- Interests: ${hobbies}
- Learning Style: ${learningStyleLabel}

CRITICAL RULES:
1. Be warm and personal - use "${name}" occasionally
2. Give step-by-step guidance for experiments
3. Explain the science behind what they observe
4. ALWAYS prioritize safety - warn about hot items, chemicals, sharp objects
5. If they show you something via camera, describe what you see and explain it
6. IMAGE (PERMISSION-GATED): Before calling generate_image, ALWAYS ask first — e.g. "Do you want me to create an image so you can understand this visually?" or "Want me to draw a diagram of this?" Only call generate_image after the student gives a positive response. Once granted, generate 2–4 connected images: Call 1 — Overview/big-picture, Call 2 — Close-up/detail, Call 3 — Real-world application, Call 4 (optional) — Comparison/process. Each prompt must be visually distinct.
7. VIDEO (PERMISSION-GATED): Before calling generate_video, ALWAYS ask first — e.g. "Do you want me to create a video animation so you can understand this better?" Only call generate_video after the student confirms. Once granted, generate ONE video only. Only generate a second if the student explicitly asks again.
8. WHITEBOARD (PERMISSION-GATED): When explaining a reaction equation, experiment setup, safety procedure, or step-by-step process — ASK FIRST: "Do you want me to walk through this on the whiteboard?" or "Can I draw this out real quick?" Only call add_whiteboard_step after the student confirms. Build ONE step at a time. Call clear_whiteboard between experiments. Use show_media(-1) to show a previously approved diagram mid-whiteboard, then hide_media() to return.
9. Ask questions to check understanding
10. Keep responses conversational and concise

When the student is ready to start, ask: "What experiment would you like to do today, ${name}?"
`;
};

export default function LabEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('resumeId');

  const { profile } = useProfile();
  const { sessions, saveSession } = useSessions();

  // Session state
  const sessionIdRef = useRef(Date.now().toString());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
    isConnected, isConnecting, isSilent, isMuted,
    status,
    currentImage, isGeneratingImage,
    whiteboardState, completeWhiteboardStep,
    isMediaFocused, hideMedia,
    connect, disconnect, toggleMute,
    startVideoCapture, stopVideoCapture,
  } = useGeminiLive(
    'lab', 
    (msgs) => {
      saveSession('lab', msgs, sessionIdRef.current);
    },
    profile?.voiceName || 'Victoria'
  );

  // Play notification sound on mount
  useEffect(() => {
    playModeEntrySound();
  }, []);

  // Auto-connect mic on mount
  useEffect(() => {
    // Small delay to ensure everything is ready
    const timer = setTimeout(() => {
      if (!isConnected && !isConnecting) {
        handleConnect(selectedImage, null);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVideo();
      disconnect();
    };
  }, []);

  const stopVideo = () => {
    stopVideoCapture();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsVideoActive(false);
  };

  const startVideo = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        }
      });
      if (videoRef.current) {
        const videoElement = videoRef.current;
        videoElement.srcObject = stream;
        const playVideo = () => {
          videoElement.play().catch(err => {
            console.warn('[Lab] video.play() failed:', err);
            setCameraError('Camera started but video could not be displayed. Click the page and toggle the camera again.');
          });
        };
        if ('onloadedmetadata' in videoElement) {
          videoElement.onloadedmetadata = playVideo;
        } else {
          playVideo();
        }
        console.log('[Lab] Camera stream attached to video element');
      }
      streamRef.current = stream;
      setIsVideoActive(true);
      setSelectedImage(null);

      // If already connected, start sending frames directly; otherwise connect fresh with video
      if (isConnected) {
        if (videoRef.current) startVideoCapture(videoRef.current);
      } else {
        await handleConnect(null, videoRef.current);
      }
    } catch (err: any) {
      console.error("[Lab] Failed to start video:", err);
      // Provide user-friendly error messages
      let errorMessage = 'Could not access camera';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another app. Please close other apps using the camera.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not support the requested settings. Trying default camera...';
        // Fallback to any available camera
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            const videoElement = videoRef.current;
            videoElement.srcObject = fallbackStream;
            const playVideo = () => {
              videoElement.play().catch(playErr => {
                console.warn('[Lab] fallback video.play() failed:', playErr);
                setCameraError('Fallback camera started but video could not be displayed. Click the page and toggle the camera again.');
              });
            };
            if ('onloadedmetadata' in videoElement) {
              videoElement.onloadedmetadata = playVideo;
            } else {
              playVideo();
            }
          }
          streamRef.current = fallbackStream;
          setIsVideoActive(true);
          setSelectedImage(null);
          if (isConnected) {
            if (videoRef.current) startVideoCapture(videoRef.current);
          } else {
            await handleConnect(null, videoRef.current);
          }
          setCameraError(null);
          return;
        } catch (fallbackErr) {
          errorMessage = 'Could not access any camera on this device.';
        }
      }
      
      setCameraError(errorMessage);
    }
  };

  const toggleVideo = () => {
    if (isVideoActive) {
      stopVideo();
    } else {
      startVideo();
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
      
      // Handle resume flow
      if (resumeId) {
        const session = sessions.find(s => s.id === resumeId);
        if (session && session.messages.length > 0) {
          previousMessages = session.messages;
          
          // Add resume-specific instruction with recap prompt
          const lastMessages = session.messages.slice(-3);
          const lastTopic = session.summary || 'this experiment';
          
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
    disconnect();
    navigate(`/summary?sessionId=${sessionIdRef.current}&mode=lab`);
  };

  return (
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
      {cameraError && (
        <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium shadow-md z-50 text-center">
          {cameraError}
        </div>
      )}

      {/* Main Visual Area */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden p-6">
        
        {/* Thinking Indicator - Shows when AI is processing */}
        {status === 'thinking' && (
          <div className="absolute top-20 left-0 right-0 flex justify-center z-30 pointer-events-none">
            <ThinkingIndicator isVisible={true} text="Thinking" />
          </div>
        )}

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
                {isSilent && !isMuted && (
                  <p className="mt-2 text-sm text-red-500 font-medium">Microphone is silent!</p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center text-center px-6">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 border border-zinc-200 shadow-sm">
                  <MicOff size={32} className="text-zinc-400" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Lab Mode</h2>
                <p className="text-zinc-500 max-w-[250px]">
                  {isConnecting ? 'Connecting...' : 'Tap the mic to talk, or use the camera to show me your experiment.'}
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

      {/* Bottom Control Bar */}
      <div className="bg-white border-t border-zinc-200 p-6 pb-8 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between max-w-md mx-auto">

          {/* Camera Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-14 h-14 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-200 group-hover:bg-zinc-100 transition-colors">
              <Camera size={24} className="text-zinc-600" />
            </div>
            <span className="text-xs font-medium text-zinc-500">Photo</span>
          </button>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />

          {/* Video Button */}
          <button
            onClick={toggleVideo}
            className="flex flex-col items-center gap-2 group"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-colors ${isVideoActive ? 'bg-teal-50 border-teal-200 text-teal-600 shadow-sm' : 'bg-zinc-50 border-zinc-200 text-zinc-600 group-hover:bg-zinc-100'}`}>
              {isVideoActive ? <Video size={24} /> : <VideoOff size={24} />}
            </div>
            <span className={`text-xs font-medium ${isVideoActive ? 'text-teal-600' : 'text-zinc-500'}`}>Video</span>
          </button>

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
  );
}
