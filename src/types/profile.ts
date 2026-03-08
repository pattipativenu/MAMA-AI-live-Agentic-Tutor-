/**
 * Canonical UserProfile type — single source of truth.
 * Imported by: AuthContext, useProfile, dataStore, Settings, lab/Entry, exam/Entry, TutorChat
 */
export interface UserProfile {
  name: string;
  gender: string;
  age: string;
  hobbies: string[];
  learningStyle: string;
  language?: string;
  theme?: 'realistic' | 'space' | 'anime' | 'historical' | 'action';
  voiceSpeed?: 'slow' | 'normal' | 'fast';
  autoAdvanceCarousel?: boolean;
}

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  gender: '',
  age: '',
  hobbies: [],
  learningStyle: '',
  language: 'English',
  theme: 'realistic',
  voiceSpeed: 'normal',
  autoAdvanceCarousel: true,
};
