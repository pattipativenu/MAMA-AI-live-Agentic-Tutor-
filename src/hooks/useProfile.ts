import { useState } from 'react';

export interface UserProfile {
  name: string;
  gender: string;
  age: string;
  hobbies: string[];
  learningStyle: string;
  password?: string;
}

const DEFAULT_PROFILE: UserProfile = { name: '', gender: '', age: '', hobbies: [], learningStyle: '', password: '' };

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
