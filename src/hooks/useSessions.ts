/**
 * useSessions.ts — Firestore-backed session store.
 * Zero localStorage. Uses onSnapshot for real-time sync.
 * Imported by: ExamEntry, LabEntry, Summary, TutorChat, Sessions page.
 */
import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToSessions,
  saveSessionToDb,
} from '../services/dataStore';
import { CarouselSlide } from './useCarousel';

export interface SessionMessage {
  role: 'user' | 'ai';
  text: string;
  image?: string;
}

export interface ConceptHook {
  term: string;
  description: string;
}

export interface SessionEvaluation {
  correct: string[];
  missing: string[];
  incorrect: string[];
  hooks: ConceptHook[];
}

export interface GenerationJob {
  status: 'pending' | 'generating' | 'complete' | 'failed';
  slides?: CarouselSlide[];
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface SavedSession {
  id: string;
  date: number;
  mode: 'lab' | 'exam';
  summary: string;
  messages: SessionMessage[];
  evaluation?: SessionEvaluation;
  generationJob?: GenerationJob;
}

export function useSessions() {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<SavedSession[]>([]);

  // Real-time Firestore subscription — refreshes automatically on any write
  useEffect(() => {
    if (!currentUser) {
      setSessions([]);
      return;
    }
    const unsubscribe = subscribeToSessions(currentUser.uid, setSessions);
    return () => unsubscribe();
  }, [currentUser]);

  /**
   * Clean up the raw transcript with Gemini flash, then persist to Firestore.
   * @param sessionId  Pre-generated stable ID (from ExamEntry / LabEntry). If
   *                   omitted a new timestamp-based ID is used.
   */
  const saveSession = async (
    mode: 'lab' | 'exam',
    rawMessages: SessionMessage[],
    sessionId?: string,
    evaluation?: SessionEvaluation
  ): Promise<string> => {
    const validMessages = rawMessages.filter(m => m.text.trim() !== '' || m.image);
    const id = sessionId ?? Date.now().toString();

    let finalMessages = [...validMessages];
    let summary = 'Session on ' + new Date().toLocaleDateString();

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey && validMessages.length > 0) {
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
            responseMimeType: 'application/json',
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
                      text: { type: Type.STRING },
                    },
                    required: ['role', 'text'],
                  },
                },
              },
              required: ['summary', 'messages'],
            },
          },
        });

        const cleaned = JSON.parse(response.text || '{}');
        if (cleaned.summary && cleaned.messages) {
          summary = cleaned.summary;

          // Merge AI-generated images back (Gemini transcript cleanup strips them)
          const originalAiImgs = validMessages.filter(m => m.role === 'ai' && m.image);
          const cleanAiMsgs = cleaned.messages.filter((m: any) => m.role === 'ai');

          finalMessages = cleaned.messages.map((cleanMsg: any) => {
            let image: string | undefined;
            if (cleanMsg.role === 'ai') {
              const aiIdx = cleanAiMsgs.indexOf(cleanMsg);
              if (originalAiImgs[aiIdx]) image = originalAiImgs[aiIdx].image;
            }
            return { role: cleanMsg.role as 'user' | 'ai', text: cleanMsg.text, image };
          });
        }
      } catch (e) {
        console.error('[useSessions] Failed to clean transcript:', e);
      }
    }

    const newSession: SavedSession = {
      id,
      date: Date.now(),
      mode,
      summary,
      messages: finalMessages,
      ...(evaluation ? { evaluation } : {}),
    };

    if (currentUser) {
      await saveSessionToDb(currentUser.uid, newSession);
    }

    return id;
  };

  return { sessions, saveSession };
}
