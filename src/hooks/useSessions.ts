/**
 * useSessions.ts — Firestore-backed session store.
 * 
 * Key behaviors:
 * - Saves EXACT speech-to-text (no AI cleaning/modification)
 * - Filters out system/internal messages
 * - Only saves sessions with actual user communication
 * - Generates smart headings using Gemini 3
 * - Deduplicates sessions
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeToSessions,
  saveSessionToDb,
  deleteSessionFromDb,
} from '../services/dataStore';
import { CarouselSlide } from './useCarousel';
import { 
  generateSessionHeading, 
  filterSystemMessages, 
  hasUserCommunication,
  countMedia,
  hasWhiteboardUsage,
} from '../services/sessionHeading';

export interface SessionMessage {
  role: 'user' | 'ai' | 'system';
  text: string;
  image?: string;
  video?: string;
  timestamp?: number;
  whiteboardStep?: {
    math: string;
    explanation: string;
  };
  isSystemMessage?: boolean;
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
  mode: 'lab' | 'exam' | 'tutor';
  summary: string;
  topic?: string;
  messages: SessionMessage[];
  hasUserCommunication: boolean;
  whiteboardUsed?: boolean;
  mediaCount: number;
  evaluation?: SessionEvaluation;
  generationJob?: GenerationJob;
  generatedMedia?: GeneratedMedia[]; // NEW: Store generated images/videos
}

// Re-export GeneratedMedia for convenience
export interface GeneratedMedia {
  type: 'image' | 'video';
  url: string;
  prompt?: string;
  timestamp: number;
  caption?: string;
}

export function useSessions() {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const recentSessionIdsRef = useRef<Set<string>>(new Set());

  // Real-time Firestore subscription — refreshes automatically on any write
  useEffect(() => {
    if (!currentUser) {
      setSessions([]);
      return;
    }
    
    const unsubscribe = subscribeToSessions(currentUser.uid, (allSessions) => {
      // Filter: Only show sessions with user communication
      const validSessions = allSessions.filter(s => s.hasUserCommunication !== false);
      
      // Sort by date (newest first)
      validSessions.sort((a, b) => b.date - a.date);
      
      // Deduplicate by content similarity
      const dedupedSessions = deduplicateSessions(validSessions);
      
      console.log('[useSessions] Sessions updated:', dedupedSessions.length, 'sessions');
      setSessions(dedupedSessions);
      
      // Track recent IDs for duplicate detection during save
      recentSessionIdsRef.current = new Set(dedupedSessions.slice(0, 10).map(s => s.id));
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  /**
   * Deduplicate sessions based on session ID
   * FIXED: Previously used mode + first message content which caused different sessions
   * with the same greeting (e.g., "Hi") to be incorrectly deduplicated.
   * Now uses unique session ID to ensure all distinct sessions are preserved.
   */
  const deduplicateSessions = (sessionList: SavedSession[]): SavedSession[] => {
    const seen = new Map<string, SavedSession>();
    
    for (const session of sessionList) {
      // FIX: Use session ID as the unique key instead of message content
      // This prevents sessions with similar greetings from being incorrectly merged
      const key = session.id;
      
      if (!seen.has(key)) {
        seen.set(key, session);
      } else {
        // If same ID exists, keep the one with more messages (more complete session)
        const existing = seen.get(key)!;
        if (session.messages.length > existing.messages.length) {
          seen.set(key, session);
        }
      }
    }
    
    return Array.from(seen.values());
  };

  /**
   * Check if this would be a duplicate of a very recent session (within last 2 minutes)
   * FIXED: Now only considers it a duplicate if it's the same session ID or 
   * happened extremely recently (prevents accidental double-saves)
   */
  const isDuplicateSession = (
    mode: 'lab' | 'exam' | 'tutor',
    messages: SessionMessage[]
  ): boolean => {
    const now = Date.now();
    
    // Only check the most recent 3 sessions
    for (const session of sessions.slice(0, 3)) {
      // If a session with the same ID exists, it's a duplicate
      // Or if a session happened within the last 2 minutes with same mode
      const isRecent = (now - session.date) < 2 * 60 * 1000; // 2 minutes
      if (session.mode === mode && isRecent) {
        // Check if first message is identical (strong indicator of duplicate)
        const sessionFirstMsg = session.messages.find(m => m.role === 'user')?.text || '';
        const newFirstMsg = messages.find(m => m.role === 'user')?.text || '';
        if (sessionFirstMsg === newFirstMsg && sessionFirstMsg.length > 0) {
          console.log('[useSessions] Duplicate detected: same mode, recent, identical first message');
          return true;
        }
      }
    }
    
    return false;
  };

  /**
   * Save a session with exact speech-to-text, proper filtering, and smart heading
   * NEW: Now includes generatedMedia (images/videos) in the saved session
   */
  const saveSession = async (
    mode: 'lab' | 'exam' | 'tutor',
    rawMessages: SessionMessage[],
    sessionId?: string,
    evaluation?: SessionEvaluation,
    generatedMedia?: GeneratedMedia[],
    force = false
  ): Promise<string | null> => {
    console.log('[useSessions] saveSession called with', rawMessages.length, 'messages, mode:', mode);
    
    // Add timestamps to messages that don't have them
    const now = Date.now();
    const messagesWithTimestamps = rawMessages.map((m, idx) => ({
      ...m,
      timestamp: m.timestamp || now - (rawMessages.length - idx) * 1000,
    }));
    
    // Filter out system/internal messages
    const filteredMessages = filterSystemMessages(messagesWithTimestamps);
    console.log('[useSessions] Messages after filtering:', filteredMessages.length);
    
    // Check if there's actual user communication
    const hasCommunication = hasUserCommunication(filteredMessages);
    if (!hasCommunication) {
      console.log('[useSessions] No user communication found, not saving session');
      return null;
    }
    
    // Check for duplicates (skip if force=true, e.g. auto-save updating existing session)
    if (!force && isDuplicateSession(mode, filteredMessages)) {
      console.log('[useSessions] Duplicate session detected, not saving');
      return null;
    }
    
    const id = sessionId ?? Date.now().toString();
    
    // Count media
    const mediaCount = countMedia(filteredMessages);

    // Check whiteboard usage
    const whiteboardUsed = hasWhiteboardUsage(filteredMessages);

    // Generate initial placeholder summary
    const firstUserText = filteredMessages.find(m => m.role === 'user')?.text || '';
    let summary = firstUserText.slice(0, 60) + (firstUserText.length > 60 ? '...' : '');

    // CRITICAL: Strip base64 data URIs from messages to prevent exceeding
    // Firestore's 1MB document size limit. Images should already be uploaded
    // to Firebase Storage (returning a URL), but strip any remaining data URIs
    // as a safety net.
    const sanitizedMessages = filteredMessages.map(m => ({
      ...m,
      // Keep Storage URLs, strip data URIs
      image: m.image?.startsWith('data:') ? undefined : m.image,
    }));

    // Also sanitize generatedMedia - strip data URIs from images
    const sanitizedMedia = generatedMedia?.map(m => {
      if (m.type === 'image' && m.url.startsWith('data:')) {
        console.warn('[useSessions] Stripping data URI from generatedMedia (image not uploaded to Storage)');
        return { ...m, url: '' }; // Empty URL signals upload failure
      }
      return m;
    }).filter(m => m.url.length > 0); // Remove items with empty URLs

    // Create session object
    const session: SavedSession = {
      id,
      date: now,
      mode,
      summary,
      messages: sanitizedMessages,
      hasUserCommunication: true,
      whiteboardUsed,
      mediaCount,
      ...(evaluation ? { evaluation } : {}),
      ...(sanitizedMedia && sanitizedMedia.length > 0 ? { generatedMedia: sanitizedMedia } : {}),
    };

    // Save to Firestore
    if (currentUser) {
      console.log('[useSessions] Saving session:', id);
      try {
        await saveSessionToDb(currentUser.uid, session);
      } catch (error: any) {
        console.error('[useSessions] SAVE FAILED:', error);
        // If document is still too large, retry without media
        if (error.message?.includes('maximum allowed size') || error.code === 'resource-exhausted') {
          console.warn('[useSessions] Retrying save without media...');
          const liteSession: SavedSession = {
            ...session,
            messages: session.messages.map(m => ({ ...m, image: undefined, video: undefined })),
            generatedMedia: undefined,
          };
          try {
            await saveSessionToDb(currentUser.uid, liteSession);
            console.log('[useSessions] Saved lite session (without media)');
          } catch (retryErr) {
            console.error('[useSessions] Lite save also failed:', retryErr);
          }
        }
      }

      // Generate smart heading asynchronously (don't block)
      generateSmartHeading(currentUser.uid, session);
    } else {
      console.warn('[useSessions] No current user, session not saved');
    }

    return id;
  };

  /**
   * Generate and update smart heading using Gemini 3
   */
  const generateSmartHeading = async (uid: string, session: SavedSession) => {
    try {
      const result = await generateSessionHeading(session.mode, session.messages);
      
      const updatedSession: SavedSession = {
        ...session,
        summary: result.heading,
        topic: result.topic,
      };
      
      await saveSessionToDb(uid, updatedSession);
      console.log('[useSessions] Updated heading:', result.heading);
    } catch (error) {
      console.error('[useSessions] Failed to generate heading:', error);
    }
  };

  /**
   * Delete a session
   */
  const deleteSession = async (sessionId: string): Promise<void> => {
    if (!currentUser) {
      console.warn('[useSessions] No current user, cannot delete');
      return;
    }
    
    try {
      await deleteSessionFromDb(currentUser.uid, sessionId);
      console.log('[useSessions] Deleted session:', sessionId);
    } catch (error) {
      console.error('[useSessions] Failed to delete session:', error);
      throw error;
    }
  };

  return { 
    sessions, 
    saveSession, 
    deleteSession,
  };
}
