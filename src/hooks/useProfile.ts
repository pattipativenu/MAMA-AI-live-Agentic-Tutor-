/**
 * useProfile.ts — Thin wrapper over AuthContext.
 * Profile data lives in Firestore (users/{uid}); zero localStorage.
 * Re-exports UserProfile + DEFAULT_PROFILE for backward-compat imports.
 */
export type { UserProfile } from '../types/profile';
export { DEFAULT_PROFILE } from '../types/profile';

import { useAuth } from '../contexts/AuthContext';
import { saveProfileToDb } from '../services/dataStore';
import { UserProfile, DEFAULT_PROFILE } from '../types/profile';

export function useProfile() {
  const { userProfile, currentUser, refreshProfile } = useAuth();

  const saveProfile = async (newProfile: UserProfile): Promise<void> => {
    if (!currentUser) {
      console.warn('[useProfile] Cannot save profile — no authenticated user.');
      return;
    }
    await saveProfileToDb(currentUser.uid, newProfile);
    await refreshProfile();
  };

  return {
    profile: (userProfile ?? DEFAULT_PROFILE) as UserProfile,
    saveProfile,
  };
}
