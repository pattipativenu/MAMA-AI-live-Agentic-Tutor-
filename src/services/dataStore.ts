/**
 * dataStore.ts — Centralized Firestore data service.
 * All reads/writes for profiles, sessions, and session generation jobs go through here.
 * No localStorage is used anywhere in this file.
 * 
 * Also re-exports media cache functions for convenience.
 */
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types/profile';
import { SavedSession } from '../hooks/useSessions';

// ─────────────────────────────────────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────────────────────────────────────

export async function saveProfileToDb(uid: string, profile: UserProfile): Promise<void> {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, profile, { merge: true });
}

export async function fetchProfileFromDb(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Real-time subscription to all sessions for a user, ordered newest-first.
 * Returns an unsubscribe function.
 */
export function subscribeToSessions(
  uid: string,
  callback: (sessions: SavedSession[]) => void
): () => void {
  const ref = collection(db, 'users', uid, 'sessions');
  const q = query(ref, orderBy('date', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const sessions = snapshot.docs.map(
        (d) => ({ ...d.data(), id: d.id } as SavedSession)
      );
      console.log('[DataStore] Sessions updated:', sessions.length, 'sessions');
      callback(sessions);
    },
    (error) => {
      console.error('[DataStore] Sessions subscription error:', error);
    }
  );
}

/**
 * Write (or overwrite) a session document.
 */
export async function saveSessionToDb(uid: string, session: SavedSession): Promise<void> {
  try {
    console.log('[DataStore] Saving session to Firestore:', session.id, 'with', session.messages.length, 'messages');
    const ref = doc(db, 'users', uid, 'sessions', session.id);
    await setDoc(ref, session);
    console.log('[DataStore] Session saved successfully:', session.id);
  } catch (error) {
    console.error('[DataStore] Failed to save session:', error);
    throw error;
  }
}

/**
 * Fetch a single session by ID — used by the Summary screen.
 */
export async function getSessionById(
  uid: string,
  sessionId: string
): Promise<SavedSession | null> {
  const ref = doc(db, 'users', uid, 'sessions', sessionId);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as SavedSession) : null;
}

/**
 * Subscribe to a single session document — used by Summary for live updates
 * (e.g. waiting for generationJob.slides to populate).
 */
export function subscribeToSession(
  uid: string,
  sessionId: string,
  callback: (session: SavedSession | null) => void
): () => void {
  const ref = doc(db, 'users', uid, 'sessions', sessionId);
  return onSnapshot(
    ref,
    (snap) => {
      callback(snap.exists() ? ({ ...snap.data(), id: snap.id } as SavedSession) : null);
    },
    (error) => {
      console.error('[DataStore] Session subscription error:', error);
      callback(null);
    }
  );
}

/**
 * Permanently delete a session.
 */
export async function deleteSessionFromDb(uid: string, sessionId: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'sessions', sessionId);
  await deleteDoc(ref);
}
