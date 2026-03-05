import { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

export interface SessionMessage {
  role: 'user' | 'ai';
  text: string;
  image?: string;
}

export interface SavedSession {
  id: string;
  date: number;
  mode: 'lab' | 'exam';
  summary: string;
  messages: SessionMessage[];
}

export function useSessions() {
  const [sessions, setSessions] = useState<SavedSession[]>(() => {
    const saved = localStorage.getItem('mama_ai_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  const getApiKey = () => {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
    return import.meta.env.VITE_GEMINI_API_KEY;
  };

  const saveSession = async (mode: 'lab' | 'exam', rawMessages: SessionMessage[]) => {
    // Filter out empty messages
    const validMessages = rawMessages.filter(m => m.text.trim() !== '' || m.image);
    if (validMessages.length === 0) return;

    const apiKey = getApiKey();
    let finalMessages = [...validMessages];
    let summary = "Session on " + new Date().toLocaleDateString();

    if (apiKey) {
      try {
         const ai = new GoogleGenAI({ apiKey });
         const transcript = validMessages.map(m => `${m.role}: ${m.text}`).join('\n');
         
         const response = await ai.models.generateContent({
           model: 'gemini-3-flash-preview',
           contents: `You are an editor. I will give you a raw, messy voice transcript between a 'user' and an 'ai'.
           1. Fix any small grammar errors or speech-to-text glitches.
           2. Structure it properly so it's easy to read.
           3. Generate a short 3-5 word summary title for the session.
           
           Transcript:
           ${transcript}`,
           config: {
             responseMimeType: "application/json",
             responseSchema: {
               type: Type.OBJECT,
               properties: {
                 summary: { type: Type.STRING },
                 messages: {
                   type: Type.ARRAY,
                   items: {
                     type: Type.OBJECT,
                     properties: {
                       role: { type: Type.STRING, description: "'user' or 'ai'" },
                       text: { type: Type.STRING }
                     },
                     required: ["role", "text"]
                   }
                 }
               },
               required: ["summary", "messages"]
             }
           }
         });

         const cleanedData = JSON.parse(response.text || "{}");
         if (cleanedData.summary && cleanedData.messages) {
           summary = cleanedData.summary;
           
           // Heuristic to merge images back into the cleaned messages
           const originalAiMsgsWithImages = validMessages.filter(m => m.role === 'ai' && m.image);
           const cleanAiMsgs = cleanedData.messages.filter((m: any) => m.role === 'ai');
           
           finalMessages = cleanedData.messages.map((cleanMsg: any) => {
             let image;
             if (cleanMsg.role === 'ai') {
                const aiIndex = cleanAiMsgs.indexOf(cleanMsg);
                if (originalAiMsgsWithImages[aiIndex]) {
                    image = originalAiMsgsWithImages[aiIndex].image;
                }
             }
             return {
               role: cleanMsg.role,
               text: cleanMsg.text,
               image
             };
           });
         }
      } catch(e) {
        console.error("Failed to clean up session transcript", e);
      }
    }

    const newSession: SavedSession = {
      id: Date.now().toString(),
      date: Date.now(),
      mode,
      summary,
      messages: finalMessages
    };

    const updated = [newSession, ...sessions];
    setSessions(updated);
    localStorage.setItem('mama_ai_sessions', JSON.stringify(updated));
  };

  return { sessions, saveSession };
}
