import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { float32ToPcm16Base64, pcm16Base64ToFloat32 } from '../utils/audio';
import { SessionMessage } from './useSessions';
import { GeminiVoice, VOICE_NAME_MAP } from '../types/profile';
import { WhiteboardState, WhiteboardStep, DEFAULT_WHITEBOARD_STATE } from '../types/whiteboard';
import { parseWhiteboardChunk, cleanWhiteboardMarkers, stepToChatMessage } from '../utils/whiteboardParser';
import { startVideoGenerationJob, subscribeToVideoJobs, VideoJob } from '../services/videoGen';
import { getAuth } from 'firebase/auth';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export interface GeneratedMedia {
  type: 'image' | 'video';
  url: string;
  prompt?: string;
  timestamp: number;
  caption?: string;
}

export type VoiceStatus = 
  | 'listening'       // User speaking
  | 'thinking'        // AI processing
  | 'explaining'      // AI speaking general
  | 'clarifying'      // AI answering a doubt
  | 'creating-visual' // AI generating image
  | 'creating-video'  // AI generating video
  | 'asking'          // AI asking a question
  | 'referencing'     // AI referencing textbook page
  | 'waiting'         // AI waiting for user response
  | 'whiteboard'      // AI writing on whiteboard
  | 'muted';          // Mic muted

export interface StatusInfo {
  text: string;
  color: 'amber' | 'green' | 'purple' | 'blue' | 'zinc' | 'orange';
  icon: 'mic' | 'thinking' | 'speaking' | 'image' | 'video' | 'question' | 'book' | 'muted' | 'pencil';
}

export type LiveMode = 'lab' | 'exam' | 'tutor';

export function useGeminiLive(
  mode: LiveMode,
  onSessionEnd?: (messages: SessionMessage[], generatedMedia?: GeneratedMedia[]) => void,
  voiceName: GeminiVoice = 'Victoria'
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('listening');
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [isSilent, setIsSilent] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedMedia, setGeneratedMediaState] = useState<GeneratedMedia[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState<number>(0);
  
  // Video job subscriptions cleanup
  const videoJobUnsubscribersRef = useRef<(() => void)[]>([]);
  
  // Track generatedMedia in ref for access during disconnect
  const generatedMediaRef = useRef<GeneratedMedia[]>([]);
  
  // Wrapper to keep ref in sync with state
  const setGeneratedMedia = useCallback((value: GeneratedMedia[] | ((prev: GeneratedMedia[]) => GeneratedMedia[])) => {
    setGeneratedMediaState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      generatedMediaRef.current = newValue;
      return newValue;
    });
  }, []);
  
  // Whiteboard state for formula explanations
  const [whiteboardState, setWhiteboardState] = useState<WhiteboardState>(DEFAULT_WHITEBOARD_STATE);
  const whiteboardBufferRef = useRef('');  // Buffer for incomplete whiteboard markers

  // Media focus state — true when show_media is active (image overlays whiteboard temporarily)
  const [isMediaFocused, setIsMediaFocused] = useState(false);

  // Ref so onaudioprocess callback always reads the LATEST muted state (avoids stale closure bug)
  const isMutedRef = useRef(false);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);

  // Audio playback state
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  // Guard to prevent double connection
  const isConnectingRef = useRef(false);
  const isIntentionalDisconnectRef = useRef(false);
  const isCleaningUpRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  // WebSocket state tracking for function call safety
  const webSocketStateRef = useRef<'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED'>('CLOSED');
  const pendingFunctionCallsRef = useRef<Array<{call: any, resolve: (response: any) => void}>>([]);

  // Store connection params for reconnection
  const connectionParamsRef = useRef<{
    systemInstruction: string;
    initialImage?: string | null;
    videoElement?: HTMLVideoElement | null;
  } | null>(null);

  // Use a ref to access the latest messages inside callbacks without stale closures
  const messagesRef = useRef<SessionMessage[]>([]);
  
  // Track current AI transcript for smart status detection
  const currentAiTextRef = useRef('');
  const statusTimeoutRef = useRef<number | null>(null);
  
  // Track last AI message addition to prevent duplicates between text parts and audio transcription
  const lastAiMessageRef = useRef<{ text: string; timestamp: number } | null>(null);

  // Silence detection for audioStreamEnd (Gemini docs requirement).
  // SILENCE_FRAMES_BEFORE_END is intentionally large (600 frames ≈ 2.5 min)
  // to prevent premature sends on phone mics with consistently low RMS.
  const silentFrameCountRef = useRef(0);
  const audioStreamEndSentRef = useRef(false);
  const SILENCE_THRESHOLD = 0.005;
  const SILENCE_FRAMES_BEFORE_END = 600; // ~2.5 min — prevents premature audioStreamEnd on phone mic

  // Session duration tracking
  const sessionStartTimeRef = useRef<number>(0);
  const sessionTimerRef = useRef<number | null>(null);

  // Update ref immediately whenever messages change
  const updateMessages = useCallback((newMessages: SessionMessage[] | ((prev: SessionMessage[]) => SessionMessage[])) => {
    setMessages(prev => {
      const updated = typeof newMessages === 'function' ? newMessages(prev) : newMessages;
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  // Web Speech API for user transcription fallback (Native Audio models don't return inputAudioTranscription)
  const recognitionRef = useRef<any>(null);
  
  // Smart status detection based on AI text content
  const detectSmartStatus = useCallback((text: string): VoiceStatus => {
    const lowerText = text.toLowerCase();
    
    // Check for question patterns
    if (/\?\s*$/.test(text) || /^(can you|do you|are you|what|how|why|when|where|who|which)/i.test(text)) {
      return 'asking';
    }
    
    // Check for page/diagram references
    if (/(page\s+\d+|figure\s+\d+\.?\d*|diagram|look at|open to|flip to)/i.test(lowerText)) {
      return 'referencing';
    }
    
    // Check for clarification patterns
    if (/(does that make sense|do you understand|are you following|is that clear|any questions)/i.test(lowerText)) {
      return 'clarifying';
    }
    
    // Check for waiting patterns
    if (/(take your time|let me know when|i'll wait|ready\?)/i.test(lowerText)) {
      return 'waiting';
    }
    
    // Default to explaining
    return 'explaining';
  }, []);

  const getStatusDisplay = useCallback((): StatusInfo => {
    // Check if whiteboard is active first (highest priority)
    if (whiteboardState.isActive) {
      return { text: 'Writing on whiteboard...', color: 'orange', icon: 'pencil' };
    }
    
    if (isMuted) {
      return { text: 'Muted', color: 'zinc', icon: 'muted' };
    }
    
    switch (status) {
      case 'listening':
        return { text: "I'm listening...", color: 'amber', icon: 'mic' };
      case 'thinking':
        return { text: 'Mama is thinking...', color: 'amber', icon: 'thinking' };
      case 'explaining':
        return { text: 'Mama is explaining...', color: 'green', icon: 'speaking' };
      case 'clarifying':
        return { text: 'Mama is clarifying...', color: 'green', icon: 'speaking' };
      case 'creating-visual':
        return { text: 'Mama is creating a visual...', color: 'purple', icon: 'image' };
      case 'creating-video':
        return { text: 'Mama is creating a video...', color: 'purple', icon: 'video' };
      case 'asking':
        return { text: 'Mama is asking...', color: 'blue', icon: 'question' };
      case 'referencing':
        return { text: 'Check your textbook...', color: 'blue', icon: 'book' };
      case 'waiting':
        return { text: 'Take your time...', color: 'blue', icon: 'thinking' };
      default:
        return { text: "I'm listening...", color: 'amber', icon: 'mic' };
    }
  }, [status, isMuted, whiteboardState.isActive]);

  const disconnect = useCallback((reason?: string) => {
    console.log("[GeminiLive] Disconnecting and cleaning up...", reason);
    
    // Mark cleanup in progress - this suppresses WebSocket errors
    isCleaningUpRef.current = true;
    
    // Mark if this is an intentional disconnect (not for reconnection)
    if (reason !== 'reconnecting') {
      isIntentionalDisconnectRef.current = true;
    }

    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }

    // Clear session duration timer
    if (sessionTimerRef.current) {
      window.clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }

    // IMPORTANT: Stop audio/video capture BEFORE closing WebSocket
    // This prevents "WebSocket is already in CLOSING or CLOSED state" errors
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Clean up AudioWorkletNode specifically
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.port.close();
      audioWorkletNodeRef.current = null;
    }

    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    // Small delay to let audio processor stop before closing WebSocket
    // This prevents the race condition causing error spam
    const sessionToClose = sessionRef.current;
    sessionRef.current = null; // Clear ref immediately so audio callbacks stop
    
    if (sessionToClose) {
      try {
        sessionToClose.close();
      } catch (e) {
        // Silently ignore - connection may already be closed
      }
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }

    if (playbackContextRef.current) {
      if (playbackContextRef.current.state !== 'closed') {
        playbackContextRef.current.close();
      }
      playbackContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Stop Native Speech Recognition if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    isConnectingRef.current = false;
    setStatus('listening');
    setIsSilent(false);
    setIsMuted(false);
    isMutedRef.current = false;
    
    // Reset whiteboard state
    setWhiteboardState(DEFAULT_WHITEBOARD_STATE);
    whiteboardBufferRef.current = '';
    lastAiMessageRef.current = null;

    // Trigger session save with the latest messages and generated media
    // FIX: Always call onSessionEnd if it exists, even with empty messages
    // This ensures Summary page doesn't get stuck waiting for a session
    if (onSessionEnd) {
      console.log('[GeminiLive] Saving session with', messagesRef.current.length, 'messages and', generatedMediaRef.current.length, 'media items');
      console.log('[GeminiLive] Messages:', messagesRef.current);
      onSessionEnd([...messagesRef.current], [...generatedMediaRef.current]);
    } else {
      console.log('[GeminiLive] No onSessionEnd callback provided');
    }
  }, [onSessionEnd]);

  const connect = useCallback(async (
    systemInstruction: string, 
    previousMessages?: SessionMessage[], 
    initialImage?: string | null, 
    videoElement?: HTMLVideoElement | null
  ) => {
    if (isConnectingRef.current || sessionRef.current) {
      console.log("[GeminiLive] Already connecting or connected, skipping...");
      return;
    }

    try {
      // Store connection params for potential reconnection
      connectionParamsRef.current = { systemInstruction, initialImage, videoElement };
      
      // Reset flags
      isIntentionalDisconnectRef.current = false;
      isCleaningUpRef.current = false;
      
      // Clear all state to be completely fresh (unless reconnecting with context)
      isMutedRef.current = false;
      setIsMuted(false);
      setIsSilent(false);
      
      // Snapshot media before any reset so we can restore it on reconnect
      const mediaToPreserve = generatedMediaRef.current;

      // Only clear messages if not reconnecting with previous messages
      if (!previousMessages || previousMessages.length === 0) {
        setMessages([]);
        messagesRef.current = [];
        generatedMediaRef.current = [];
        setGeneratedMedia([]);
      }

      // Restore gallery if this is a reconnect (previousMessages supplied and non-empty)
      if (previousMessages && previousMessages.length > 0 && mediaToPreserve.length > 0) {
        setGeneratedMedia(mediaToPreserve);
      }
      
      setCurrentImage(null);
      setCurrentMediaIndex(0);
      isConnectingRef.current = true;
      setIsConnecting(true);
      setStatus('listening');
      console.log("[GeminiLive] Requesting mic access...");

      // 1. Setup Audio Contexts SYNCHRONOUSLY before any await!
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const playbackContext = new AudioContextClass({ sampleRate: 24000 });
      playbackContextRef.current = playbackContext;
      nextPlayTimeRef.current = playbackContext.currentTime;

      // 2. Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          // noiseSuppression and autoGainControl are intentionally DISABLED:
          // These browser-level filters aggressively compress quiet/normal speech
          // on phone mics to near-silence, requiring users to shout. Gemini's
          // own VAD handles noise robustly so we don't need these here.
          noiseSuppression: false,
          autoGainControl: false,
        }
      });
      mediaStreamRef.current = stream;

      // Log microphone details
      const audioTrack = stream.getAudioTracks()[0];
      console.log("[GeminiLive] Mic access granted.");
      console.log("[GeminiLive] Microphone:", audioTrack.label);
      console.log("[GeminiLive] Mic settings:", audioTrack.getSettings());

      if (audioContext.state === 'suspended') await audioContext.resume();
      if (playbackContext.state === 'suspended') await playbackContext.resume();

      setStatus('thinking');
      console.log("[GeminiLive] Connecting to Gemini API...");

      const getApiKey = () => {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
          return process.env.API_KEY;
        }
        return import.meta.env.VITE_GEMINI_API_KEY;
      };

      // Set up Native Web Speech API fallback for user transcriptions
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true; // Keep listening
          recognition.interimResults = false; // Only final results
          recognition.lang = 'en-US'; // Default to English, can be dynamic
          
          recognition.onresult = (event: any) => {
            if (isMutedRef.current) return; // Don't transcribe if explicitly muted
            
            // Get the latest result
            const currentResult = event.results[event.results.length - 1];
            if (currentResult.isFinal) {
              const transcript = currentResult[0].transcript.trim();
              if (transcript) {
                console.log("[GeminiLive] Native Speech Recognition:", transcript);
                
                // Track last transcript to prevent duplicates (in case Gemini ever fixes inputAudioTranscription)
                const now = Date.now();
                const isDuplicate = lastAiMessageRef.current?.text === transcript && 
                                   (now - (lastAiMessageRef.current?.timestamp || 0)) < 2000;
                
                if (!isDuplicate) {
                  updateMessages(prev => {
                    const last = prev[prev.length - 1];
                    // Append if very recent, otherwise new message
                    if (last && last.role === 'user' && (now - (last.timestamp || 0)) < 3000) {
                      return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + transcript, timestamp: now }];
                    }
                    return [...prev, { role: 'user', text: transcript, timestamp: now }];
                  });
                }
              }
            }
          };

          // Auto-restart if it stops unexpectedly while we're still connected
          recognition.onend = () => {
            if (sessionRef.current && !isCleaningUpRef.current) {
              try {
                recognition.start();
              } catch (e) {
                console.warn("[GeminiLive] Failed to restart SpeechRecognition");
              }
            }
          };
          
          recognitionRef.current = recognition;
          recognition.start();
          console.log("[GeminiLive] Native Speech Recognition started.");
        }
      } catch (err) {
        console.warn("[GeminiLive] SpeechRecognition not supported or failed to start:", err);
      }

      const apiKey = getApiKey();
      if (!apiKey) throw new Error("API Key is missing.");
      const ai = new GoogleGenAI({ apiKey });

      const generateImageDeclaration: FunctionDeclaration = {
        name: "generate_image",
        description: "Generates an educational image to help explain a concept visually to the student. Call this before or during an explanation when a visual aid would help.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: {
              type: Type.STRING,
              description: "A highly detailed prompt describing the image to generate. Include specific measurements, labels, and visual elements. Tailor the complexity to the user's age (simple for kids, advanced formulas/graphs for older teens). DO NOT include the user's grade level text in the image."
            }
          },
          required: ["prompt"]
        }
      };

      const addWhiteboardStepDeclaration: FunctionDeclaration = {
        name: "add_whiteboard_step",
        description: "Add ONE step to the whiteboard at a time. Call this once per step to build up a solution progressively — like a teacher writing on a physical whiteboard. PAUSE between steps to ask the student questions and check understanding. Do NOT add all steps in one call.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Problem title — ONLY include on the very first step (e.g. 'Symmetric Relations Proof', 'Quadratic Formula'). Omit for subsequent steps."
            },
            math: {
              type: Type.STRING,
              description: "LaTeX formula for this step. Use standard LaTeX: \\frac{a}{b} for fractions, \\sqrt{x} for roots, x^{2} for powers, \\pm for ±, \\in for ∈, \\Rightarrow for ⟹, \\perp for ⊥."
            },
            explanation: {
              type: Type.STRING,
              description: "Short label for what this step shows (e.g. 'Standard quadratic form', 'Apply the formula', 'Substitute values'). Displayed below the math."
            }
          },
          required: ["math", "explanation"]
        }
      };

      const highlightWhiteboardStepDeclaration: FunctionDeclaration = {
        name: "highlight_whiteboard_step",
        description: "Highlight and scroll to a specific step already on the whiteboard. Use this to draw the student's attention back to an earlier step when referencing it (e.g. 'As we wrote in step 1...').",
        parameters: {
          type: Type.OBJECT,
          properties: {
            stepIndex: {
              type: Type.NUMBER,
              description: "Zero-based index of the step to highlight (first step = 0, second = 1, etc.)"
            }
          },
          required: ["stepIndex"]
        }
      };

      const clearWhiteboardDeclaration: FunctionDeclaration = {
        name: "clear_whiteboard",
        description: "Clear all steps from the whiteboard to start fresh for a new problem.",
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      };

      const generateVideoDeclaration: FunctionDeclaration = {
        name: "generate_video",
        description: "Generates an 8-second COMPLETELY SILENT educational animation video to demonstrate a complex concept or physical process. Use this when explaining dynamic phenomena (osmosis, forces, chemical reactions, planetary motion, etc.) that would benefit from visual animation. The video generates in the background (takes 30-60 seconds) while you CONTINUE EXPLAINING - do not pause or wait. VIDEO DEFAULT RULE: Generate at most ONE video per topic by default. Only call generate_video a second time for the same topic if the student explicitly asks for another animation (e.g. 'show me another video', 'animate that differently'). Never auto-generate more than one video per concept without a student request.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            concept: {
              type: Type.STRING,
              description: "The specific concept or process to visualize (e.g., 'osmosis through semipermeable membrane', 'projectile motion with initial velocity', 'acid-base neutralization reaction'). Be specific and detailed."
            },
            topicName: {
              type: Type.STRING,
              description: "The topic or chapter name this concept belongs to (e.g., 'Cell Transport', 'Mechanics', 'Chemical Reactions'). Used for caching."
            },
            theme: {
              type: Type.STRING,
              enum: ["realistic", "space", "anime", "historical", "action"],
              description: "Visual theme for the animation. 'realistic' for photorealistic scientific accuracy, 'space' for cosmic/physics themes, 'anime' for stylized youth-friendly, 'historical' for vintage documentary feel, 'action' for high-energy comic style."
            },
            visualStyle: {
              type: Type.STRING,
              enum: ["diagram-only", "real-world-only", "transformation"],
              description: "Visual presentation style. 'diagram-only' shows pure textbook diagrams (DEFAULT - use for most concepts), 'real-world-only' shows photorealistic examples, 'transformation' morphs real-world into diagram. Pick based on what best illustrates the concept."
            }
          },
          required: ["concept"]
        }
      };

      const showMediaDeclaration: FunctionDeclaration = {
        name: "show_media",
        description: "Display a previously generated image or video to the student while on the whiteboard. Use this mid-explanation to pull up a relevant visual, show it, explain it verbally, then call hide_media() to return to the whiteboard. Pass -1 to show the most recently generated media.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            mediaIndex: {
              type: Type.NUMBER,
              description: "Zero-based index of the media item to show from the generated media list. Pass -1 to show the most recently generated image or video."
            }
          },
          required: ["mediaIndex"]
        }
      };

      const hideMediaDeclaration: FunctionDeclaration = {
        name: "hide_media",
        description: "Close the currently displayed image or video and return focus to the whiteboard. Call this after you have finished explaining the visual aid.",
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      };

      let finalSystemInstruction = systemInstruction;
      if (previousMessages && previousMessages.length > 0) {
        const historyText = previousMessages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
        finalSystemInstruction += `\n\n--- PREVIOUS SESSION HISTORY ---\nThe user is resuming a previous session. Here is the transcript of what you discussed so far. Continue the conversation naturally from where you left off.\n\n${historyText}`;
      }

      if (initialImage) {
        finalSystemInstruction += `\n\n--- VISUAL HOMEWORK / CAMERA INPUT ---\nThe user has uploaded an image of their homework or a problem they are working on. You will receive this image immediately. Acknowledge the image and ask how you can help with it.`;
      }

      // 3. Connect to Gemini Live API with selected voice
      // Use the current native‑audio Live model that supports tools +
      // bidiGenerateContent over WebSockets.
      //
      // NOTE:
      // - Older models like `gemini-2.0-flash-live-001` are no longer
      //   available for the v1beta Live API and will trigger errors like:
      //   "model ... is not found for API version v1beta, or is not
      //    supported for bidiGenerateContent. Call ListModels to see
      //    which models are available."
      // - `gemini-2.5-flash-native-audio-preview-12-2025` is the correct
      //   native-audio model for Google AI Studio (v1beta endpoint).
      //   Native audio models ONLY support Modality.AUDIO — adding
      //   Modality.TEXT causes an immediate 1008 WebSocket disconnect.
      // Model selection by mode:
      // - Tutor: 'latest' (most stable for large chapter content)
      // - Lab/Exam: 'preview-12-2025' (specific features needed)
      const liveModel = mode === 'tutor'
        ? 'gemini-2.5-flash-native-audio-latest'
        : 'gemini-2.5-flash-native-audio-preview-12-2025';
      const sessionPromise = ai.live.connect({
        model: liveModel,
        config: {
          tools: [
  { functionDeclarations: [addWhiteboardStepDeclaration, highlightWhiteboardStepDeclaration, clearWhiteboardDeclaration, generateImageDeclaration, generateVideoDeclaration, showMediaDeclaration, hideMediaDeclaration] },
  ...(mode === 'lab' ? [{ googleSearch: {} }] : []),
],
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: VOICE_NAME_MAP[voiceName]
              }
            }
          },
          systemInstruction: finalSystemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} },
        },
        callbacks: {
          onopen: async () => {
            console.log("[GeminiLive] WebSocket connection OPEN");
            // Reset reconnection attempts on successful connection
            reconnectAttemptsRef.current = 0;
            webSocketStateRef.current = 'OPEN';
            setIsConnected(true);
            setIsConnecting(false);
            isConnectingRef.current = false;
            setStatus('listening');

            // Track session start for duration limits
            sessionStartTimeRef.current = Date.now();
            // Clear any existing timer
            if (sessionTimerRef.current) {
              window.clearInterval(sessionTimerRef.current);
            }
            // Check session duration every 30 seconds
            // Gemini Live limits: 15 min audio-only, 2 min with video
            const maxDuration = videoElement ? 2 * 60 * 1000 : 15 * 60 * 1000;
            const warnAt = maxDuration - 60 * 1000; // Warn 1 min before
            sessionTimerRef.current = window.setInterval(() => {
              const elapsed = Date.now() - sessionStartTimeRef.current;
              if (elapsed >= warnAt && elapsed < maxDuration) {
                console.warn(`[GeminiLive] Session nearing limit: ${Math.round(elapsed / 1000)}s / ${Math.round(maxDuration / 1000)}s`);
              }
              if (elapsed >= maxDuration) {
                console.warn('[GeminiLive] Session duration limit reached, reconnecting...');
                if (sessionTimerRef.current) {
                  window.clearInterval(sessionTimerRef.current);
                  sessionTimerRef.current = null;
                }
                // Trigger reconnection instead of hard disconnect
                disconnect('reconnecting');
              }
            }, 30000);

            if (initialImage) {
              try {
                const base64Data = initialImage.split(',')[1];
                const mimeType = initialImage.split(';')[0].split(':')[1];
                sessionPromise.then(session => {
                  if (session) {
                    session.sendRealtimeInput({
                      media: { data: base64Data, mimeType }
                    });
                    console.log("[GeminiLive] Sent initial image to session.");
                  }
                });
              } catch (e) {
                console.error("[GeminiLive] Failed to send initial image:", e);
              }
            }

            const source = audioContext.createMediaStreamSource(stream);
            const gainNode = audioContext.createGain();
            // Gain at 1.5 — a balance between 1.0 (too quiet for phone mics)
            // and 2.0 (caused clipping). noiseSuppression/autoGainControl are
            // disabled in getUserMedia above, so this boost is safe from clipping.
            gainNode.gain.value = 1.5;

            let packetCount = 0;
            // Reset silence tracking for new session
            silentFrameCountRef.current = 0;
            audioStreamEndSentRef.current = false;

            // Try to use modern AudioWorkletNode, fallback to ScriptProcessorNode
            let useAudioWorklet = false;

            // TEMPORARY: Disable AudioWorklet to debug - fallback to ScriptProcessor
            const ENABLE_AUDIO_WORKLET = false;

            try {
              // Check if AudioWorklet is supported
              if (ENABLE_AUDIO_WORKLET && audioContext.audioWorklet) {
                useAudioWorklet = true;
                console.log('[GeminiLive] Using AudioWorkletNode (modern API)');

                // Load the audio processor worklet
                await audioContext.audioWorklet.addModule('/audio-processor.js');

                const workletNode = new AudioWorkletNode(audioContext, 'gemini-audio-processor');
                audioWorkletNodeRef.current = workletNode;
                processorRef.current = workletNode;

                // Handle audio data from worklet
                workletNode.port.onmessage = (event) => {
                  if (event.data.type === 'audioData') {
                    const { data: base64Data, rms, packetCount: count } = event.data;
                    packetCount = count;

                    // Log every 50 packets
                    if (packetCount % 50 === 0) {
                      console.log(`[GeminiLive] Sent ${packetCount} audio packets... Mic RMS: ${rms.toFixed(4)}`);
                      if (rms < 0.001) {
                        console.warn("[GeminiLive] Warning: Microphone audio is completely silent.");
                        setIsSilent(true);
                      } else {
                        setIsSilent(false);
                      }
                    }

                    // Silence detection
                    if (rms < SILENCE_THRESHOLD) {
                      silentFrameCountRef.current++;
                      if (silentFrameCountRef.current >= SILENCE_FRAMES_BEFORE_END && !audioStreamEndSentRef.current) {
                        audioStreamEndSentRef.current = true;
                        sessionPromise.then((session) => {
                          if (session && sessionRef.current === session && !isCleaningUpRef.current) {
                            try {
                              session.sendRealtimeInput({ audioStreamEnd: true });
                            } catch (_) { /* ignore */ }
                          }
                        });
                      }
                    } else {
                      silentFrameCountRef.current = 0;
                      audioStreamEndSentRef.current = false;
                    }

                    // Send audio to Gemini
                    sessionPromise.then((session) => {
                      if (session && sessionRef.current === session && !isCleaningUpRef.current) {
                        try {
                          session.sendRealtimeInput({
                            media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                          });
                        } catch (err: any) {
                          if (!isCleaningUpRef.current) {
                            console.warn('[GeminiLive] Audio send error:', err.message);
                          }
                        }
                      }
                    });
                  }
                };

                // Connect audio graph
                source.connect(gainNode);
                gainNode.connect(workletNode);
                workletNode.connect(audioContext.destination);
              }
            } catch (workletError) {
              console.warn('[GeminiLive] AudioWorklet not supported, falling back to ScriptProcessorNode:', workletError);
              useAudioWorklet = false;
            }

            // Fallback to deprecated ScriptProcessorNode if AudioWorklet fails
            if (!useAudioWorklet) {
              console.log('[GeminiLive] Using ScriptProcessorNode (deprecated fallback)');
              const processor = audioContext.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;

              processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              if (isMutedRef.current) return;

              const base64Data = float32ToPcm16Base64(inputData);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);

              packetCount++;
              if (packetCount % 50 === 0) {
                console.log(`[GeminiLive] Sent ${packetCount} audio packets... Mic RMS: ${rms.toFixed(4)}`);
                if (rms < 0.001) {
                  console.warn("[GeminiLive] Warning: Microphone audio is completely silent.");
                  setIsSilent(true);
                } else {
                  setIsSilent(false);
                }
              }

              // NOTE: audioStreamEnd is intentionally NOT sent in continuous
              // tutoring mode. It is designed for discrete utterance scenarios
              // and causes Gemini to prematurely flush its context mid-sentence
              // in always-on microphone sessions, causing jitter and cutoffs.

                sessionPromise.then((session) => {
                  // Guard: Only send if session exists and not cleaning up
                  if (session && sessionRef.current === session && !isCleaningUpRef.current) {
                    try {
                      session.sendRealtimeInput({
                        media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                      });
                    } catch (err: any) {
                      if (!isCleaningUpRef.current) {
                        console.warn('[GeminiLive] Audio send error:', err.message);
                      }
                    }
                  }
                });
              };

              source.connect(gainNode);
              gainNode.connect(processor);
              processor.connect(audioContext.destination);
            }

            // Handle video capture (works for both AudioWorklet and ScriptProcessor)
            if (videoElement) {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              let firstFrameLogged = false;
              videoIntervalRef.current = window.setInterval(() => {
                if (!sessionRef.current) return;
                // Require the video element to be actively playing before capturing frames
                if (videoElement.readyState < 2 || !videoElement.videoWidth) return;

                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                ctx?.drawImage(videoElement, 0, 0);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                const base64Data = dataUrl.split(',')[1];

                if (!firstFrameLogged) {
                  firstFrameLogged = true;
                  console.log(`[GeminiLive] First vision frame captured: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                }

                sessionPromise.then(session => {
                  // Guard: Only send if session exists and not cleaning up
                  if (session && sessionRef.current === session && !isCleaningUpRef.current) {
                    try {
                      session.sendRealtimeInput({
                        media: { data: base64Data, mimeType: 'image/jpeg' }
                      });
                    } catch (err: any) {
                      // Completely suppress all errors during cleanup
                      if (!isCleaningUpRef.current) {
                        console.warn('[GeminiLive] Video frame send error:', err.message);
                      }
                    }
                  }
                });
              }, 1000);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.setupComplete) console.log("[GeminiLive] Setup complete received.");
            if (message.serverContent?.turnComplete) {
              console.log("[GeminiLive] AI turn complete.");
            }

            // Handle Tool Calls (Whiteboard, Image, Video Generation)
            if (message.toolCall && message.toolCall.functionCalls) {
              console.log('[GeminiLive] Function calls received:', message.toolCall.functionCalls.map(c => c.name));

              // Check WebSocket state before processing
              if (isCleaningUpRef.current || !sessionRef.current) {
                console.warn('[GeminiLive] Skipping function calls - session closing or closed');
                return;
              }

              webSocketStateRef.current = 'OPEN'; // Mark as actively processing
              setStatus('creating-visual');
              const calls = message.toolCall.functionCalls;

              // Process function calls with error boundaries
              const responses = await Promise.all(calls.map(async (call) => {
                try {
                if (call.name === 'add_whiteboard_step') {
                  const args = call.args as any;
                  console.log('[GeminiLive] add_whiteboard_step called:', args.math);
                  
                  // CRITICAL: Close any open images/videos when whiteboard starts
                  // This ensures the whiteboard is visible when AI says "Let me explain on the whiteboard"
                  setCurrentImage(null);
                  setIsMediaFocused(false);
                  
                  // Add whiteboard step to messages for session tracking
                  updateMessages(prev => {
                    const whiteboardMsg: SessionMessage = {
                      role: 'ai',
                      text: `[Whiteboard] ${args.title || 'Step'}: ${args.explanation || 'Working through the solution...'}`,
                      timestamp: Date.now(),
                      whiteboardStep: {
                        math: args.math || '',
                        explanation: args.explanation || '',
                      },
                    };
                    return [...prev, whiteboardMsg];
                  });
                  
                  setWhiteboardState(prev => {
                    const newStep: WhiteboardStep = {
                      id: `step-${prev.steps.length}-${Date.now()}`,
                      math: args.math || '',
                      explanation: args.explanation || '',
                      decode: '',
                      status: 'typing' as const,  // Trigger typewriter animation
                      spokenText: '',
                      isSpeaking: true,
                    };
                    return {
                      isActive: true,
                      problemTitle: args.title || prev.problemTitle || 'Solution',
                      steps: [...prev.steps, newStep],
                      currentStepIndex: prev.steps.length,  // Index of the new step
                      highlightedStepIndex: undefined,
                      isTyping: true,
                    };
                  });
                  setStatus('whiteboard');
                  return { id: call.id, name: call.name, response: { result: 'Step added. NOW IMMEDIATELY call add_whiteboard_step again for the NEXT step of this explanation WITHOUT PAUSING. Keep building the derivation — write out ALL the key equations, definitions, fringe conditions, and formulas one step at a time. Do NOT stop after one step. Only pause to check understanding AFTER you have written at least 3–5 meaningful whiteboard steps that fully cover the concept with actual equations and values.' } };
                }

                if (call.name === 'highlight_whiteboard_step') {
                  const args = call.args as any;
                  const idx = typeof args.stepIndex === 'number' ? args.stepIndex : 0;
                  console.log('[GeminiLive] highlight_whiteboard_step:', idx);
                  setWhiteboardState(prev => ({ ...prev, highlightedStepIndex: idx }));
                  return { id: call.id, name: call.name, response: { result: `Step ${idx + 1} is now highlighted on the whiteboard.` } };
                }

                if (call.name === 'clear_whiteboard') {
                  console.log('[GeminiLive] clear_whiteboard called');
                  setWhiteboardState(DEFAULT_WHITEBOARD_STATE);
                  return { id: call.id, name: call.name, response: { result: 'Whiteboard cleared.' } };
                }

                if (call.name === 'generate_image') {
                  const prompt = (call.args as any).prompt;
                  console.log("[GeminiLive] Starting async image generation for prompt:", prompt);
                  setIsGeneratingImage(true);
                  
                  // Fire-and-forget async image generation
                  (async () => {
                    try {
                      const imageAi = new GoogleGenAI({ apiKey: getApiKey() });

                      let base64Image: string | null = null;
                      let mimeType = 'image/png';

                      for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                          const imageResponse = await imageAi.models.generateContent({
                            model: 'gemini-3.1-flash-image-preview',
                            contents: { parts: [{ text: prompt }] },
                            config: {
                              responseModalities: ['TEXT', 'IMAGE'],
                            }
                          });

                          for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
                            if (part.inlineData) {
                              mimeType = part.inlineData.mimeType || 'image/png';
                              base64Image = `data:${mimeType};base64,${part.inlineData.data}`;
                              break;
                            }
                          }
                          break; // success — exit retry loop
                        } catch (err: any) {
                          const isRetryable = err?.status === 503 || err?.status === 429 ||
                            err?.message?.includes('503') || err?.message?.includes('unavailable');
                          if (attempt < 3 && isRetryable) {
                            console.log(`[GeminiLive] Image generation attempt ${attempt} failed (${err?.status}), retrying in ${1500 * attempt}ms...`);
                            await new Promise(r => setTimeout(r, 1500 * attempt));
                            continue;
                          }
                          throw err; // rethrow non-retryable or final attempt
                        }
                      }

                      if (base64Image) {
                        // For Tutor mode: Don't show immediately - keep in gallery for sequential explanation
                        // For Exam/Lab mode: Show immediately
                        if (mode !== 'tutor') {
                          setCurrentImage(base64Image);
                        }

                        // Upload to Firebase Storage to avoid Firestore 1MB limit
                        let storageUrl = base64Image; // fallback to data URI
                        try {
                          const userId = getAuth().currentUser?.uid;
                          if (userId) {
                            const storagePath = `users/${userId}/generated/images/${Date.now()}.${mimeType.split('/')[1] || 'png'}`;
                            const storageRef = ref(storage, storagePath);
                            const rawBase64 = base64Image.split(',')[1];
                            await uploadString(storageRef, rawBase64, 'base64', { contentType: mimeType });
                            storageUrl = await getDownloadURL(storageRef);
                            console.log('[GeminiLive] Image uploaded to Storage:', storageUrl);
                          }
                        } catch (uploadErr) {
                          console.warn('[GeminiLive] Image upload to Storage failed, using data URI:', uploadErr);
                        }

                        setGeneratedMedia(prev => {
                          const mediaItem: GeneratedMedia = {
                            type: 'image',
                            url: storageUrl, // Use Storage URL for persistence
                            prompt,
                            timestamp: Date.now(),
                            caption: 'Generated visual aid'
                          };
                          return [...prev, mediaItem];
                        });
                        setCurrentMediaIndex(prev => prev + 1);

                        updateMessages(prev => {
                          const last = prev[prev.length - 1];
                          if (last && last.role === 'ai') {
                            return [...prev.slice(0, -1), { ...last, image: storageUrl }];
                          }
                          return [...prev, { role: 'ai', text: '', image: storageUrl }];
                        });
                      }
                    } catch (e: any) {
                      console.error("[GeminiLive] Image generation error:", e);
                      // Add user-facing error feedback asynchronously
                      updateMessages(prev => [...prev, {
                        role: 'ai' as const,
                        text: `I tried to generate an image but encountered an error: ${e.message}`,
                        timestamp: Date.now()
                      }]);
                    } finally {
                      setIsGeneratingImage(false);
                    }
                  })();

                  // Return IMMEDIATELY to Gemini so it keeps talking while the image generates in the background
                  return { id: call.id, name: call.name, response: { success: true, message: `Started generating the image. It will appear on screen momentarily. KEEP EXPLAINING the concept continuously without pausing.` } };
                }

                if (call.name === 'generate_video') {
                  const { concept, topicName, theme, visualStyle } = call.args as any;
                  console.log("[GeminiLive] Starting video generation for concept:", concept);
                  // Don't change status to 'creating-video' - keep AI speaking
                  // setStatus('creating-video');  // ← Removed to prevent muting

                  try {
                    const auth = getAuth();
                    const userId = auth.currentUser?.uid;

                    if (!userId) {
                      return { id: call.id, name: call.name, response: { success: false, message: "User not authenticated" } };
                    }

                    // Generate a session ID for this voice session
                    const sessionId = `voice_${Date.now()}`;

                    // Start async job (fire-and-forget pattern)
                    const jobId = await startVideoGenerationJob(
                      concept,
                      userId,
                      sessionId,
                      undefined, // legacySlideId - not needed for voice mode
                      {
                        topicName: topicName || concept,
                        theme: theme || 'realistic',
                        aspectRatio: '9:16',
                        visualStyle: visualStyle || 'diagram-only'  // NEW: Default to diagram-only
                      }
                    );

                    // Set up subscription to get video when ready
                    const unsubscribe = subscribeToVideoJobs(userId, sessionId, (jobs: VideoJob[]) => {
                      const completedJob = jobs.find(j => j.id === jobId && j.status === 'completed');
                      if (completedJob?.videoUrl) {
                        console.log("[GeminiLive] Video ready:", completedJob.videoUrl);
                        
                        const mediaItem: GeneratedMedia = {
                          type: 'video',
                          url: completedJob.videoUrl,
                          prompt: concept,
                          timestamp: Date.now(),
                          caption: `Animation: ${concept}`
                        };
                        
                        setGeneratedMedia(prev => [...prev, mediaItem]);
                        setCurrentMediaIndex(prev => prev + 1);
                        
                        // For Tutor mode: Don't auto-select - let user or sequential flow handle it
                        // For Exam/Lab mode: Auto-select the new video
                        if (mode !== 'tutor') {
                          setCurrentImage(null); // Clear any current image
                        }
                        
                        // Add video to messages for session history
                        updateMessages(prev => {
                          const last = prev[prev.length - 1];
                          if (last && last.role === 'ai') {
                            return [...prev.slice(0, -1), { ...last, video: completedJob.videoUrl }];
                          }
                          return [...prev, { role: 'ai', text: `Generated video: ${concept}`, video: completedJob.videoUrl }];
                        });
                        
                        // Unsubscribe after getting the video
                        unsubscribe();
                      }
                    });
                    
                    // Track subscription for cleanup
                    videoJobUnsubscribersRef.current.push(unsubscribe);

                    return {
                      id: call.id,
                      name: call.name,
                      response: {
                        success: true,
                        message: `Video generation started for "${concept}" (takes 30-60 seconds, will appear automatically). CONTINUE EXPLAINING NOW without pausing - keep narrating while it generates in the background.`
                      } 
                    };
                  } catch (e: any) {
                    console.error("[GeminiLive] Video generation error:", e);
                    // Add user-facing error feedback in the chat
                    updateMessages(prev => [...prev, {
                      role: 'ai' as const,
                      text: `I tried to generate a video animation but ran into an issue: ${e.message}. I'll continue explaining without the video.`,
                      timestamp: Date.now()
                    }]);
                    return { id: call.id, name: call.name, response: { success: false, message: e.message } };
                  } finally {
                    setStatus('explaining');
                  }
                }
                if (call.name === 'show_media') {
                  const idx = (call.args as any).mediaIndex;
                  // Access latest generatedMedia via setGeneratedMedia callback to avoid stale closure
                  let targetIndex = idx;
                  let targetUrl: string | null = null;
                  setGeneratedMedia(prev => {
                    const resolvedIndex = idx === -1 ? prev.length - 1 : idx;
                    targetIndex = resolvedIndex;
                    targetUrl = prev[resolvedIndex]?.url ?? null;
                    return prev; // no change
                  });
                  if (targetUrl) {
                    setCurrentImage(targetUrl);
                    setIsMediaFocused(true);
                  }
                  return { id: call.id, name: call.name, response: { result: `Showing media item ${targetIndex}. Call hide_media() when done explaining it.` } };
                }

                if (call.name === 'hide_media') {
                  setIsMediaFocused(false);
                  return { id: call.id, name: call.name, response: { result: 'Media closed. Whiteboard is now in focus.' } };
                }

                return { id: call.id, name: call.name, response: { success: false, message: "Unknown function" } };
                } catch (error: any) {
                  console.error(`[GeminiLive] Function call '${call.name}' failed:`, error);
                  return {
                    id: call.id,
                    name: call.name,
                    response: {
                      success: false,
                      message: `Function execution error: ${error.message || 'Unknown error'}`
                    }
                  };
                }
              }));

              // Send function responses with error handling
              try {
                const session = await sessionPromise;
                if (session && sessionRef.current === session && !isCleaningUpRef.current) {
                  console.log('[GeminiLive] Sending function responses:', responses.map(r => `${r.name}: ${r.response.success !== false ? 'success' : 'failed'}`));
                  session.sendToolResponse({ functionResponses: responses });
                } else {
                  console.warn('[GeminiLive] Skipping function response - session closed');
                }
              } catch (error: any) {
                console.error('[GeminiLive] Failed to send function responses:', error);
                // Don't crash - just log the error and continue
                if (!isCleaningUpRef.current) {
                  console.warn('[GeminiLive] Function response send failed, but session may continue');
                }
              }
            }

            // Extract AI text from standard parts
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.text) {
                  console.log("[GeminiLive] AI Text Response:", part.text);
                  // Add AI text to messages (avoid duplicates with audio transcription)
                  const now = Date.now();
                  const recentText = lastAiMessageRef.current?.text || '';
                  const isDuplicate = recentText && (
                    recentText.includes(part.text) ||
                    part.text.includes(recentText)
                  );
                  
                  if (!isDuplicate) {
                    updateMessages(prev => {
                      const last = prev[prev.length - 1];
                      if (last && last.role === 'ai' && (now - (last.timestamp || 0)) < 3000) {
                        return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + part.text, timestamp: now }];
                      }
                      return [...prev, { role: 'ai', text: part.text, timestamp: now }];
                    });
                    lastAiMessageRef.current = { text: part.text, timestamp: now };
                  }
                }
                if (part.inlineData && part.inlineData.data && playbackContextRef.current
                    && playbackContextRef.current.state !== 'closed') {
                  if (playbackContextRef.current.state === 'suspended') {
                    playbackContextRef.current.resume().catch(() => {
                      console.warn('[GeminiLive] Failed to resume playback context');
                    });
                  }

                  try {
                    const float32Data = pcm16Base64ToFloat32(part.inlineData.data);
                    const audioBuffer = playbackContextRef.current.createBuffer(1, float32Data.length, 24000);
                    audioBuffer.getChannelData(0).set(float32Data);

                    const source = playbackContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(playbackContextRef.current.destination);

                    const startTime = Math.max(playbackContextRef.current.currentTime, nextPlayTimeRef.current);
                    source.start(startTime);
                    nextPlayTimeRef.current = startTime + audioBuffer.duration;
                  } catch (audioErr) {
                    console.warn('[GeminiLive] Audio playback error:', audioErr);
                  }
                }
              }
            }

            // Extract transcriptions
            // @ts-ignore
            const inputTranscript = message.serverContent?.inputAudioTranscription?.text || message.inputAudioTranscription?.text || message.serverContent?.clientContent?.parts?.[0]?.text;
            if (inputTranscript) {
              console.log("[GeminiLive] User Transcript:", inputTranscript);
              // User just spoke - keep status as listening (AI will change to thinking/processing when it starts responding)
              currentAiTextRef.current = '';
              
              // Track last transcript to prevent duplicates
              const now = Date.now();
              const isDuplicate = lastAiMessageRef.current?.text === inputTranscript && 
                                 (now - (lastAiMessageRef.current?.timestamp || 0)) < 2000;
              
              if (!isDuplicate) {
                updateMessages(prev => {
                  const last = prev[prev.length - 1];
                  // Only append if the last message was very recent (within 3 seconds)
                  if (last && last.role === 'user' && (now - (last.timestamp || 0)) < 3000) {
                    return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + inputTranscript, timestamp: now }];
                  }
                  return [...prev, { role: 'user', text: inputTranscript, timestamp: now }];
                });
              }
            }

            // @ts-ignore
            const outputTranscript = message.serverContent?.outputAudioTranscription?.text || message.outputAudioTranscription?.text;
            if (outputTranscript) {
              console.log("[GeminiLive] AI Transcript from audio:", outputTranscript);
              currentAiTextRef.current += ' ' + outputTranscript;
              
              // Detect smart status based on accumulated text
              const smartStatus = detectSmartStatus(currentAiTextRef.current);
              setStatus(smartStatus);
              
              // Process whiteboard markers
              const previousStepCount = whiteboardState.steps.length;
              whiteboardBufferRef.current += outputTranscript;
              const parsed = parseWhiteboardChunk(whiteboardBufferRef.current, {
                isActive: whiteboardState.isActive,
                stepsCount: previousStepCount
              });
              
              // Handle whiteboard state changes
              if (parsed.isWhiteboardStart) {
                console.log('[GeminiLive] Whiteboard started:', parsed.problemTitle);
                setWhiteboardState({
                  isActive: true,
                  problemTitle: parsed.problemTitle || 'Problem',
                  steps: [],
                  currentStepIndex: -1,
                  isTyping: false,
                });
                whiteboardBufferRef.current = '';
              }
              
              if (parsed.newStep) {
                console.log('[GeminiLive] New whiteboard step:', parsed.newStep.math);
                setWhiteboardState(prev => {
                  // Mark previous step as complete if exists
                  const updatedSteps = prev.steps.map((step, idx) => 
                    idx === prev.currentStepIndex 
                      ? { ...step, status: 'complete' as const, isSpeaking: false }
                      : step
                  );
                  
                  // Add new step
                  const newStep: WhiteboardStep = { 
                    ...parsed.newStep!, 
                    status: 'typing' as const,
                    spokenText: '',
                    isSpeaking: true,
                  };
                  
                  return {
                    ...prev,
                    steps: [...updatedSteps, newStep],
                    currentStepIndex: updatedSteps.length,
                    isTyping: true,
                  };
                });
              }
              
              // Accumulate transcript for current whiteboard step
              // Use functional updater to always read fresh prev state (avoids stale closure)
              setWhiteboardState(prev => {
                if (!prev.isActive || prev.currentStepIndex < 0) return prev;
                const currentStep = prev.steps[prev.currentStepIndex];
                if (!currentStep) return prev;
                const updatedSteps = [...prev.steps];
                updatedSteps[prev.currentStepIndex] = {
                  ...currentStep,
                  spokenText: (currentStep.spokenText || '') + ' ' + outputTranscript,
                  isSpeaking: true,
                };
                return { ...prev, steps: updatedSteps };
              });
              
              if (parsed.isWhiteboardEnd) {
                console.log('[GeminiLive] Whiteboard ended');
                setWhiteboardState(prev => {
                  // Mark current step as complete
                  const updatedSteps = prev.steps.map((step, idx) => 
                    idx === prev.currentStepIndex 
                      ? { ...step, status: 'complete' as const, isSpeaking: false }
                      : step
                  );
                  return {
                    ...prev,
                    steps: updatedSteps,
                    isActive: false,
                    isTyping: false,
                  };
                });
                whiteboardBufferRef.current = '';
              }
              
              // Clean text for message display
              const cleanText = cleanWhiteboardMarkers(outputTranscript);
              
              if (cleanText.trim()) {
                const now = Date.now();
                const recentText = lastAiMessageRef.current?.text || '';
                const isDuplicate = recentText && (
                  recentText.includes(cleanText) ||
                  cleanText.includes(recentText)
                );
                
                if (!isDuplicate) {
                  updateMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'ai' && (now - (last.timestamp || 0)) < 3000) {
                      return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + cleanText, timestamp: now }];
                    }
                    return [...prev, { role: 'ai', text: cleanText, timestamp: now }];
                  });
                  lastAiMessageRef.current = { text: cleanText, timestamp: now };
                }
              }
            }

            if (message.serverContent?.interrupted) {
              console.log("[GeminiLive] Interrupted - clearing audio queue.");
              setStatus('listening');
              currentAiTextRef.current = '';
              // FIX: Don't destroy the AudioContext on interrupt. Closing it kills
              // all audio nodes and can cause subsequent audio to fail silently.
              // Instead, just reset the playback time so future audio starts
              // immediately (effectively clearing the queued audio).
              if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
                nextPlayTimeRef.current = playbackContextRef.current.currentTime;
              }
            }
          },
          onclose: (event?: CloseEvent) => {
            console.log("[GeminiLive] WebSocket connection CLOSED", event?.code, event?.reason);
            webSocketStateRef.current = 'CLOSED';

            // Circuit breaker: Don't reconnect if:
            // 1. This was an intentional disconnect
            // 2. We're already trying to connect (prevents race conditions)
            // 3. Max reconnect attempts reached
            // 4. No connection params available
            const shouldReconnect = !isIntentionalDisconnectRef.current && 
                                    !isConnectingRef.current &&
                                    reconnectAttemptsRef.current < maxReconnectAttempts &&
                                    connectionParamsRef.current;
            
            if (shouldReconnect) {
              reconnectAttemptsRef.current++;
              console.log(`[GeminiLive] Unexpected closure. Attempting auto-reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
              
              // Show reconnection status
              setStatus('thinking');
              
              // Get current context for reconnection
              const contextMessages = [...messagesRef.current];
              const { systemInstruction, initialImage, videoElement } = connectionParamsRef.current;
              
              // Clear session ref immediately to prevent any stale references
              sessionRef.current = null;
              
              // Exponential backoff: 2s, 4s, 6s delays
              const backoffDelay = 2000 * reconnectAttemptsRef.current;
              
              setTimeout(() => {
                // Double-check we're still not connected before attempting
                if (!sessionRef.current && !isConnectingRef.current) {
                  console.log('[GeminiLive] Reconnecting with', contextMessages.length, 'messages of context');
                  connect(systemInstruction, contextMessages, initialImage, videoElement)
                    .catch(err => {
                      console.error('[GeminiLive] Auto-reconnect attempt failed:', err);
                      // Note: onclose will be called again if connect fails, which will trigger next retry
                      // or give up if max attempts reached
                    });
                } else {
                  console.log('[GeminiLive] Skipping reconnect - already connected or connecting');
                }
              }, backoffDelay);
            } else {
              // Log why we're not reconnecting
              if (isIntentionalDisconnectRef.current) {
                console.log('[GeminiLive] Intentional disconnect - not reconnecting');
              } else if (isConnectingRef.current) {
                console.log('[GeminiLive] Already connecting - skipping duplicate reconnect');
              } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
                console.error('[GeminiLive] Max reconnect attempts reached. Giving up.');
              } else if (!connectionParamsRef.current) {
                console.log('[GeminiLive] No connection params - cannot reconnect');
              }
              
              // Full cleanup
              disconnect();
            }
          },
          onerror: (error) => {
            console.error("[GeminiLive] WebSocket Error:", error);
            // Attempt reconnect on transient errors (same logic as onclose)
            // rather than hard-disconnecting — mobile networks frequently
            // produce brief WebSocket errors that aren't fatal.
            const shouldReconnect = !isIntentionalDisconnectRef.current &&
                                    !isConnectingRef.current &&
                                    reconnectAttemptsRef.current < maxReconnectAttempts &&
                                    connectionParamsRef.current;

            if (shouldReconnect) {
              reconnectAttemptsRef.current++;
              console.warn(`[GeminiLive] WebSocket error — attempting reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
              setStatus('thinking');
              const contextMessages = [...messagesRef.current];
              const { systemInstruction, initialImage, videoElement } = connectionParamsRef.current!;
              sessionRef.current = null;
              const backoffDelay = 2000 * reconnectAttemptsRef.current;
              setTimeout(() => {
                if (!sessionRef.current && !isConnectingRef.current) {
                  connect(systemInstruction, contextMessages, initialImage, videoElement)
                    .catch(err => console.error('[GeminiLive] Reconnect after error failed:', err));
                }
              }, backoffDelay);
            } else {
              disconnect("Connection error. Please try again.");
            }
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (error: any) {
      console.error("[GeminiLive] Failed to connect:", error);
      disconnect(`Error: ${error.message}`);
      throw error; // Allow callers to react to connection failure
    }
  }, [disconnect, updateMessages, detectSmartStatus, voiceName, mode]);

  const toggleMute = useCallback(() => {
    const newMuted = !isMutedRef.current;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);
    setStatus(newMuted ? 'muted' : 'listening');

    // If using AudioWorklet, send mute command to worklet
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.port.postMessage({ type: 'setMuted', value: newMuted });
    }

    // Also disable/enable the media stream tracks for extra safety
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
    }

    console.log(`[GeminiLive] Mic ${newMuted ? 'MUTED' : 'UNMUTED'}`);
    return newMuted;
  }, []);

  // Send a ping to wake up a frozen AI
  const pingAI = useCallback(() => {
    if (sessionRef.current && isConnected) {
      console.log("[GeminiLive] Pinging AI to check responsiveness...");
      
      try {
        // Send a simple text message to force AI to respond
        sessionRef.current.send({
          clientContent: {
            turns: [{ 
              role: 'user', 
              parts: [{ text: "Are you there? Please acknowledge." }] 
            }],
            turnComplete: true
          }
        });
        
        setStatus('thinking');
        return true;
      } catch (err) {
        console.error("[GeminiLive] Ping failed:", err);
        return false;
      }
    }
    return false;
  }, [isConnected]);

  const sendClientMessage = useCallback((text: string, imageData?: string) => {
    if (sessionRef.current && isConnected) {
      console.log("[GeminiLive] Sending client message:", text, imageData ? "with image" : "");
      
      const parts: any[] = [{ text }];
      
      // Add image if provided (base64 data URL)
      if (imageData) {
        // Extract mime type and base64 data from data URL
        const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const [, mimeType, base64Data] = match;
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data
            }
          });
        }
      }
      
      sessionRef.current.send({
        clientContent: {
          turns: [{ role: 'user', parts }],
          turnComplete: true
        }
      });
      
      // Add to messages with image indicator
      const displayText = imageData ? `${text} [📷 Image shared]` : `*[System]* ${text}`;
      updateMessages(prev => [...prev, { role: 'user', text: displayText }]);
    }
  }, [isConnected, updateMessages]);

  // Start sending video frames from a live camera to an existing session.
  // This lets you add vision to an already-connected session without reconnecting.
  const startVideoCapture = useCallback((videoElement: HTMLVideoElement) => {
    // Clear any existing capture interval
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    if (!sessionRef.current) {
      console.warn('[GeminiLive] startVideoCapture called but session is not connected');
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    videoIntervalRef.current = window.setInterval(() => {
      if (!sessionRef.current) return;
      if (videoElement.readyState < 2 || !videoElement.videoWidth) return;

      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      ctx?.drawImage(videoElement, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      const base64Data = dataUrl.split(',')[1];

      try {
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'image/jpeg' }
        });
      } catch (e) {
        console.error('[GeminiLive] Failed to send video frame:', e);
      }
    }, 1000);

    console.log('[GeminiLive] Video capture started on existing session');
  }, []);

  const stopVideoCapture = useCallback(() => {
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
      console.log('[GeminiLive] Video capture stopped');
    }
  }, []);

  // Navigation for media gallery
  const nextMedia = useCallback(() => {
    setCurrentMediaIndex(prev => Math.min(prev + 1, generatedMedia.length - 1));
    setCurrentImage(generatedMedia[Math.min(currentMediaIndex + 1, generatedMedia.length - 1)]?.url || null);
  }, [generatedMedia, currentMediaIndex]);

  const prevMedia = useCallback(() => {
    setCurrentMediaIndex(prev => Math.max(prev - 1, 0));
    setCurrentImage(generatedMedia[Math.max(currentMediaIndex - 1, 0)]?.url || null);
  }, [generatedMedia, currentMediaIndex]);

  // Mark a step as complete when its typewriter animation finishes
  const completeWhiteboardStep = useCallback((stepIndex: number) => {
    setWhiteboardState(prev => {
      const updatedSteps = [...prev.steps];
      if (updatedSteps[stepIndex]) {
        updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], status: 'complete', isSpeaking: false };
      }
      return {
        ...prev,
        steps: updatedSteps,
        isTyping: false,
      };
    });
  }, []);

  // Clear whiteboard manually
  const clearWhiteboard = useCallback(() => {
    setWhiteboardState(DEFAULT_WHITEBOARD_STATE);
    whiteboardBufferRef.current = '';
  }, []);

  // Dismiss media focus manually (e.g. "← Back to Whiteboard" button)
  const hideMedia = useCallback(() => {
    setIsMediaFocused(false);
  }, []);

  return {
    isConnected,
    isConnecting,
    status,
    statusDisplay: getStatusDisplay(),
    messages,
    isSilent,
    isMuted,
    currentImage,
    isGeneratingImage,
    isGeneratingVideo,
    generatedMedia,
    currentMediaIndex,
    whiteboardState,
    connect,
    disconnect,
    toggleMute,
    sendClientMessage,
    startVideoCapture,
    stopVideoCapture,
    nextMedia,
    prevMedia,
    setCurrentImage,
    completeWhiteboardStep,
    clearWhiteboard,
    isMediaFocused,
    hideMedia,
    pingAI,
  };
}
