import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

export function useLiveAPI() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);

  const connect = useCallback(async (videoElement?: HTMLVideoElement | null) => {
    if (isConnected || isConnecting) return;
    setIsConnecting(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing Gemini API Key");
      
      const ai = new GoogleGenAI({ apiKey });

      // Setup audio capture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);

      // Setup playback
      playbackContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      nextPlayTimeRef.current = 0;

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: "You are a friendly, encouraging science teacher for kids. Guide them through experiments step-by-step. Keep answers short, enthusiastic, and easy to understand.",
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            processorRef.current!.onaudioprocess = (e) => {
              // We check a ref or state for mute, but since it's in a closure, 
              // we might need a ref for isMuted. For now, we'll just send silence if muted.
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              
              const buffer = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let i = 0; i < buffer.byteLength; i++) {
                binary += String.fromCharCode(buffer[i]);
              }
              const base64Data = btoa(binary);
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };

            source.connect(processorRef.current!);
            processorRef.current!.connect(audioContextRef.current!.destination);

            // Start video streaming if element provided
            if (videoElement) {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              videoIntervalRef.current = window.setInterval(() => {
                if (!videoElement.videoWidth) return;
                
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                ctx?.drawImage(videoElement, 0, 0);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                const base64Data = dataUrl.split(',')[1];
                
                sessionPromise.then(session => {
                  session.sendRealtimeInput({
                    media: { data: base64Data, mimeType: 'image/jpeg' }
                  });
                });
              }, 1000); // 1 frame per second
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && playbackContextRef.current) {
              const binaryString = atob(base64Audio);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768;
              }
              
              const audioBuffer = playbackContextRef.current.createBuffer(1, float32.length, 24000);
              audioBuffer.getChannelData(0).set(float32);
              
              const source = playbackContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(playbackContextRef.current.destination);
              
              const currentTime = playbackContextRef.current.currentTime;
              if (nextPlayTimeRef.current < currentTime) {
                nextPlayTimeRef.current = currentTime;
              }
              source.start(nextPlayTimeRef.current);
              nextPlayTimeRef.current += audioBuffer.duration;
            }
            
            if (message.serverContent?.interrupted && playbackContextRef.current) {
              // Handle interruption by suspending and recreating context or advancing time
              nextPlayTimeRef.current = playbackContextRef.current.currentTime;
            }
          },
          onclose: () => {
            disconnect();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            disconnect();
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error("Failed to connect to Live API:", err);
      setIsConnecting(false);
      disconnect();
    }
  }, [isConnected, isConnecting]);

  const disconnect = useCallback(() => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (sessionRef.current) {
      // Assuming session has a close method or we just drop it
      try { sessionRef.current.close?.(); } catch (e) {}
      sessionRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!audioTracks[0]?.enabled);
    }
  }, []);

  return {
    connect,
    disconnect,
    isConnected,
    isConnecting,
    isMuted,
    toggleMute
  };
}
