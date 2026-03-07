import { useState } from 'react';

export interface UserProfile {
  name: string;
  gender: string;
  age: string;
  hobbies: string[];
  learningStyle: string;
  password?: string;
  theme?: 'realistic' | 'space' | 'anime' | 'historical' | 'action';
  voiceSpeed?: 'slow' | 'normal' | 'fast';
  autoAdvanceCarousel?: boolean;
}

const DEFAULT_PROFILE: UserProfile = { name: '', gender: '', age: '', hobbies: [], learningStyle: '', password: '', theme: 'realistic', voiceSpeed: 'normal', autoAdvanceCarousel: true };

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('mama_ai_profile');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  });

  const saveProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
    localStorage.setItem('mama_ai_profile', JSON.stringify(newProfile));
  };

  return { profile, saveProfile };
}
