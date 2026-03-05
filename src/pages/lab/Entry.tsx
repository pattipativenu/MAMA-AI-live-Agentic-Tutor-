import { useEffect, useRef, useState, ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, MicOff, Camera, X, Video, VideoOff, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useGeminiLive } from '../../hooks/useGeminiLive';
import { useProfile, UserProfile } from '../../hooks/useProfile';
import { useSessions } from '../../hooks/useSessions';

export const getLabSystemInstruction = (profile: UserProfile) => {
  let profileContext = "";
  if (profile.age || profile.gender || profile.hobbies.length > 0 || profile.learningStyle) {
    profileContext = `\n\n--- STUDENT PROFILE ---\n`;
    if (profile.age) profileContext += `Age/Grade: ${profile.age}\n`;
    if (profile.gender) profileContext += `Gender: ${profile.gender}\n`;
    if (profile.hobbies.length > 0) profileContext += `Favorite Activities/Hobbies: ${profile.hobbies.join(', ')}\n`;
    if (profile.learningStyle) profileContext += `Preferred Learning Style: ${profile.learningStyle}\n`;
    profileContext += `DO NOT ask the student for this information again, you already know it. Tailor all your examples, analogies, and image generation prompts specifically to their age, gender, and favorite activities.\n`;
  }

  return `
      You are Mama AI, a warm, encouraging, and patient voice-first AI tutor for students in Classes 5 through 12.
      The student is entering "Lab Mode". You teach Science (Physics, Chemistry, Biology) and Math.
      ${profileContext}
      CRITICAL TEACHING RULES:
      1. AGE & PERSONALIZATION FIRST: Politely ask the student for their age/grade, gender, and their favorite activity/hobby (e.g., a sport, reading, drawing) before explaining complex topics ONLY IF it is not provided in the profile above. DO NOT assume their favorite activity. Use their chosen activity to personalize your examples.
      2. REAL-WORLD FIRST: Whenever you explain a concept, you MUST first use a simple, relatable real-world example tailored to their age and chosen activity.
      3. SCIENCE/MATH SECOND: Only after the real-world example should you explain the formal language, formulas, and principles.
      4. INTERACTIVE LEARNING: Encourage the student to perform simple, physical actions to understand concepts. Also, ask them to write down formulas or draw diagrams on a piece of paper.
      5. VISUAL AIDS (CRITICAL): When explaining dimensions, geometry, or any visual concept, you MUST use the \`generate_image\` tool. 
         - The image prompt MUST be highly detailed, including specific measurements, dimensions, labels, etc.
         - Tailor the visual complexity to their age: for young kids, use simple, fun visuals without complex formulas. For older teens (Class 11/12), include advanced formulas, vectors, or graphs.
         - NEVER include the text "Class X" or the student's grade in the image prompt text.
         - Tell the user you are generating an image for them.
      6. QUIZ & VERIFY: After explaining, ask if they understood. If they say yes, give them a quick quiz question to test their knowledge. If they answer incorrectly, gently point out what they got right, where they went wrong, and explain it again clearly.
      
      CRITICAL SAFETY RULE:
      If you ask the student to pick up, throw, or use an object, you MUST explicitly specify safe, non-harmful objects (like paper, a feather, or a soft pillow). NEVER suggest or allow the use of heavy, sharp, or breakable objects (like glass, phones, scissors, or hard plastics). You must actively ensure their physical safety in your suggestions.

      Keep your responses concise, conversational, and natural. Do not use markdown or formatting. Speak directly to the student.
      Start by asking them what topic or experiment they want to explore today.
    `;
};

export default function LabEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('resumeId');

  const { profile } = useProfile();
  const { sessions, saveSession } = useSessions();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { isConnected, isConnecting, status, messages, isSilent, isMuted, currentImage, isGeneratingImage, connect, disconnect, toggleMute } = useGeminiLive((msgs) => {
    saveSession('lab', msgs);
  });

  useEffect(() => {
    return () => {
      stopVideo();
      disconnect();
    };
  }, [disconnect]);

  const stopVideo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsVideoActive(false);
  };

  const startVideo = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsVideoActive(true);
      setSelectedImage(null);
      handleConnect(null, videoRef.current);
    } catch (err: any) {
      console.error("Failed to start video:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Could not access the camera. Please check your browser settings.');
      }
    }
  };

  const toggleVideo = () => {
    if (isVideoActive) {
      stopVideo();
      // If we stop video, we might want to stay connected but without video. 
      // For simplicity, we can just disconnect and reconnect, or just stop the video stream.
      // Since video is sent via interval, stopping the stream will just send black frames or stop sending.
      // Better to disconnect and let user reconnect.
      disconnect();
    } else {
      startVideo();
    }
  };

  const handleMicClick = () => {
    if (isConnected) {
      toggleMute();
    } else {
      handleConnect(selectedImage, null);
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
        // Automatically connect when image is selected
        handleConnect(base64, null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConnect = (image: string | null = selectedImage, videoEl: HTMLVideoElement | null = null) => {
    const instruction = getLabSystemInstruction(profile);
    let previousMessages;
    if (resumeId) {
      const session = sessions.find(s => s.id === resumeId);
      if (session) {
        previousMessages = session.messages;
      }
    }
    connect(instruction, previousMessages, image, videoEl);
  };

  return (
    <div className="flex flex-col h-screen bg-[rgb(250,249,245)] text-zinc-900 overflow-hidden relative">

      {/* Main Visual Area */}
      <main className="flex-1 relative flex items-center justify-center overflow-hidden p-6">

        {/* Video Feed */}
        <div className={`absolute inset-0 transition-opacity duration-500 ${isVideoActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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

        {/* AI Generated Image Overlay */}
        {(currentImage || isGeneratingImage) && !isVideoActive && !selectedImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgb(250,249,245)] z-10 p-6">
            {isGeneratingImage ? (
              <div className="flex flex-col items-center gap-4 text-teal-600">
                <Loader2 size={48} className="animate-spin" />
                <p className="text-lg font-medium animate-pulse">Mama AI is drawing...</p>
              </div>
            ) : currentImage ? (
              <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden shadow-xl border border-zinc-200">
                <img src={currentImage} alt="AI Generated" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-zinc-200 shadow-sm">
                  <ImageIcon size={14} className="text-teal-600" />
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Visual Aid</span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Default State / Avatar */}
        {!isVideoActive && !selectedImage && !currentImage && !isGeneratingImage && (
          <div className="relative flex flex-col items-center justify-center z-10">
            {isConnected ? (
              <>
                <div className="absolute w-48 h-48 bg-teal-500/10 rounded-full animate-ping" />
                <div className="absolute w-64 h-64 bg-teal-500/5 rounded-full animate-pulse" />
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
                <p className="text-zinc-500 max-w-[250px]">Tap the mic to talk, or use the camera to show me your experiment.</p>
              </div>
            )}
          </div>
        )}

        {/* Camera Permission Error */}
        {cameraError && (
          <div className="absolute top-8 left-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium shadow-md z-20 text-center">
            {cameraError}
          </div>
        )}

        {/* Status Overlay */}
        {isConnecting && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md z-20 flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Connecting...
          </div>
        )}
        {isConnected && isSilent && !isMuted && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md z-20 animate-pulse">
            Microphone is silent!
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
            className="flex flex-col items-center gap-2 group"
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${isConnected ? (isMuted ? 'bg-zinc-100 border-zinc-300 text-zinc-500' : 'bg-teal-500 border-teal-400 text-white shadow-teal-500/30 scale-110') : 'bg-zinc-50 border-zinc-200 text-zinc-600 group-hover:bg-zinc-100'}`}>
              {isConnected && !isMuted ? <Mic size={28} /> : <MicOff size={28} />}
            </div>
            <span className={`text-xs font-medium ${isConnected && !isMuted ? 'text-teal-600' : 'text-zinc-500'}`}>Mic</span>
          </button>

          {/* Cancel Button */}
          <button
            onClick={() => navigate('/')}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center border border-red-100 group-hover:bg-red-100 transition-colors">
              <X size={24} className="text-red-500" />
            </div>
            <span className="text-xs font-medium text-red-500">Cancel</span>
          </button>

        </div>
      </div>
    </div>
  );
}
