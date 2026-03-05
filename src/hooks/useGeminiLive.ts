import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { float32ToPcm16Base64, pcm16Base64ToFloat32 } from '../utils/audio';
import { SessionMessage } from './useSessions';

export function useGeminiLive(onSessionEnd?: (messages: SessionMessage[]) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [isSilent, setIsSilent] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Ref so onaudioprocess callback always reads the LATEST muted state (avoids stale closure bug)
  const isMutedRef = useRef(false);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  // Audio playback state
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  // Guard to prevent double connection
  const isConnectingRef = useRef(false);

  // Use a ref to access the latest messages inside callbacks without stale closures
  const messagesRef = useRef<SessionMessage[]>([]);
  messagesRef.current = messages;

  const disconnect = useCallback((reason?: string) => {
    console.log("[GeminiLive] Disconnecting and cleaning up...", reason);

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        console.error("Error closing session:", e);
      }
      sessionRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
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

    setIsConnected(false);
    setIsConnecting(false);
    isConnectingRef.current = false;
    setStatus(reason || 'Disconnected');
    setIsSilent(false);
    setIsMuted(false);
    isMutedRef.current = false;

    // Trigger session save
    if (onSessionEnd && messagesRef.current.length > 0) {
      onSessionEnd(messagesRef.current);
    }
  }, [onSessionEnd]);

  const connect = useCallback(async (systemInstruction: string, previousMessages?: SessionMessage[], initialImage?: string | null, videoElement?: HTMLVideoElement | null) => {
    if (isConnectingRef.current || sessionRef.current) {
      console.log("[GeminiLive] Already connecting or connected, skipping...");
      return;
    }

    try {
      // Clear all state to be completely fresh
      isMutedRef.current = false;
      setIsMuted(false);
      setIsSilent(false);
      setMessages([]);
      setCurrentImage(null);
      isConnectingRef.current = true;
      setIsConnecting(true);
      setStatus('Requesting microphone access...');
      console.log("[GeminiLive] Requesting mic access...");

      // 1. Setup Audio Contexts SYNCHRONOUSLY before any await!
      // This is CRUCIAL for Safari/Chrome auto-play policies. It must be in the same synchronous block as the user click.
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
          noiseSuppression: true
        }
      });
      mediaStreamRef.current = stream;
      console.log("[GeminiLive] Mic access granted.");

      // Explicitly resume contexts now that we have the stream
      if (audioContext.state === 'suspended') await audioContext.resume();
      if (playbackContext.state === 'suspended') await playbackContext.resume();

      setStatus('Connecting to Mama AI...');
      console.log("[GeminiLive] Connecting to Gemini API...");

      // Initialize AI inside connect to ensure fresh key
      const getApiKey = () => {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
          return process.env.API_KEY;
        }
        return import.meta.env.VITE_GEMINI_API_KEY;
      };

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

      let finalSystemInstruction = systemInstruction;
      if (previousMessages && previousMessages.length > 0) {
        const historyText = previousMessages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
        finalSystemInstruction += `\n\n--- PREVIOUS SESSION HISTORY ---\nThe user is resuming a previous session. Here is the transcript of what you discussed so far. Continue the conversation naturally from where you left off.\n\n${historyText}`;
      }

      if (initialImage) {
        finalSystemInstruction += `\n\n--- VISUAL HOMEWORK / CAMERA INPUT ---\nThe user has uploaded an image of their homework or a problem they are working on. You will receive this image immediately. Acknowledge the image and ask how you can help with it.`;
      }

      // 3. Connect to Gemini Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash',
        config: {
          tools: [{ functionDeclarations: [generateImageDeclaration] }],
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
          },
          systemInstruction: finalSystemInstruction,
          // Re-enable transcriptions for debugging
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("[GeminiLive] WebSocket connection OPEN");
            setIsConnected(true);
            setIsConnecting(false);
            isConnectingRef.current = false;
            setStatus('Listening...');

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

            // Add a gain node to boost the mic signal if it's too quiet
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 2.0; // Boost by 2x

            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            let packetCount = 0;
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);

              // MUTE CHECK: use the ref (not state) to avoid stale closure bug.
              // When muted, skip sending audio entirely to suppress mic input.
              if (isMutedRef.current) return;

              const base64Data = float32ToPcm16Base64(inputData);

              // Calculate RMS volume to verify mic is picking up sound
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);

              packetCount++;
              if (packetCount % 50 === 0) {
                console.log(`[GeminiLive] Sent ${packetCount} audio packets... Mic RMS: ${rms.toFixed(4)}`);
                if (rms < 0.001) {
                  console.warn("[GeminiLive] Warning: Microphone audio is completely silent. Check your OS mic settings.");
                  setIsSilent(true);
                } else {
                  setIsSilent(false);
                }
              }

              sessionPromise.then((session) => {
                if (session) {
                  session.sendRealtimeInput({
                    media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                  });
                }
              });
            };

            source.connect(gainNode);
            gainNode.connect(processor);
            processor.connect(audioContext.destination);

            if (videoElement) {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');

              videoIntervalRef.current = window.setInterval(() => {
                if (!videoElement.videoWidth || !sessionRef.current) return;

                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                ctx?.drawImage(videoElement, 0, 0);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                const base64Data = dataUrl.split(',')[1];

                sessionPromise.then(session => {
                  if (session) {
                    session.sendRealtimeInput({
                      media: { data: base64Data, mimeType: 'image/jpeg' }
                    });
                  }
                });
              }, 1000);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.setupComplete) console.log("[GeminiLive] Setup complete received.");
            if (message.serverContent?.turnComplete) console.log("[GeminiLive] AI turn complete.");

            // Handle Tool Calls (Image Generation)
            if (message.toolCall && message.toolCall.functionCalls) {
              const calls = message.toolCall.functionCalls;
              const responses = await Promise.all(calls.map(async (call) => {
                if (call.name === 'generate_image') {
                  const prompt = (call.args as any).prompt;
                  console.log("[GeminiLive] Generating image for prompt:", prompt);
                  setIsGeneratingImage(true);
                  try {
                    // Create a fresh instance to ensure it picks up the latest key if changed
                    const imageAi = new GoogleGenAI({ apiKey: getApiKey() });
                    const imageResponse = await imageAi.models.generateContent({
                      model: 'gemini-3.1-flash-image-preview',
                      contents: { parts: [{ text: prompt }] },
                      config: {
                        imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
                      }
                    });

                    let base64Image = '';
                    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
                      if (part.inlineData) {
                        base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        break;
                      }
                    }

                    if (base64Image) {
                      setCurrentImage(base64Image);
                      setMessages(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.role === 'ai') {
                          return [...prev.slice(0, -1), { ...last, image: base64Image }];
                        }
                        return [...prev, { role: 'ai', text: '', image: base64Image }];
                      });
                      return { id: call.id, name: call.name, response: { success: true, message: "Image generated and displayed to the user." } };
                    } else {
                      return { id: call.id, name: call.name, response: { success: false, message: "Failed to generate image." } };
                    }
                  } catch (e: any) {
                    console.error("[GeminiLive] Image generation error:", e);
                    return { id: call.id, name: call.name, response: { success: false, message: e.message } };
                  } finally {
                    setIsGeneratingImage(false);
                  }
                }
                return { id: call.id, name: call.name, response: { success: false, message: "Unknown function" } };
              }));

              sessionPromise.then(session => {
                session.sendToolResponse({ functionResponses: responses });
              });
            }

            // Extract AI text from standard parts
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.text) {
                  console.log("[GeminiLive] AI Text Response:", part.text);
                  // We rely on outputTranscript for cleaner text, but fallback to part.text if needed
                }
                if (part.inlineData && part.inlineData.data && playbackContextRef.current) {
                  if (playbackContextRef.current.state === 'suspended') {
                    playbackContextRef.current.resume();
                  }

                  const float32Data = pcm16Base64ToFloat32(part.inlineData.data);
                  const audioBuffer = playbackContextRef.current.createBuffer(1, float32Data.length, 24000);
                  audioBuffer.getChannelData(0).set(float32Data);

                  const source = playbackContextRef.current.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(playbackContextRef.current.destination);

                  const startTime = Math.max(playbackContextRef.current.currentTime, nextPlayTimeRef.current);
                  source.start(startTime);
                  nextPlayTimeRef.current = startTime + audioBuffer.duration;
                }
              }
            }

            // Extract transcriptions based on API structure
            // @ts-ignore - exploring undocumented properties
            const inputTranscript = message.serverContent?.inputAudioTranscription?.text || message.inputAudioTranscription?.text || message.serverContent?.clientContent?.parts?.[0]?.text;
            if (inputTranscript) {
              console.log("[GeminiLive] User Transcript:", inputTranscript);
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'user') {
                  return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + inputTranscript }];
                }
                return [...prev, { role: 'user', text: inputTranscript }];
              });
            }

            // @ts-ignore
            const outputTranscript = message.serverContent?.outputAudioTranscription?.text || message.outputAudioTranscription?.text;
            if (outputTranscript) {
              console.log("[GeminiLive] AI Transcript:", outputTranscript);
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'ai') {
                  return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + outputTranscript }];
                }
                return [...prev, { role: 'ai', text: outputTranscript }];
              });
            }

            if (message.serverContent?.interrupted) {
              console.log("[GeminiLive] Interrupted.");
              if (playbackContextRef.current) {
                playbackContextRef.current.close();
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                playbackContextRef.current = new AudioContextClass({ sampleRate: 24000 });
                nextPlayTimeRef.current = playbackContextRef.current.currentTime;
              }
            }
          },
          onclose: () => {
            console.log("[GeminiLive] WebSocket connection CLOSED");
            disconnect();
          },
          onerror: (error) => {
            console.error("[GeminiLive] WebSocket Error:", error);
            disconnect("Connection error. Please try again.");
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (error: any) {
      console.error("[GeminiLive] Failed to connect:", error);
      disconnect(`Error: ${error.message}`);
    }
  }, [disconnect]);

  const toggleMute = useCallback(() => {
    // Flip the ref immediately — the onaudioprocess reads this ref on every tick.
    const newMuted = !isMutedRef.current;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);

    // Also disable the OS-level track so the browser mic indicator updates
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
    }

    console.log(`[GeminiLive] Mic ${newMuted ? 'MUTED' : 'UNMUTED'}`);
    return newMuted;
  }, []);

  return {
    isConnected,
    isConnecting,
    status,
    messages,
    isSilent,
    isMuted,
    currentImage,
    isGeneratingImage,
    connect,
    disconnect,
    toggleMute
  };
}
