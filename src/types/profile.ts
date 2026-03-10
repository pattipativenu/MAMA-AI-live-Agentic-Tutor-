/**
 * Canonical UserProfile type — single source of truth.
 * Imported by: AuthContext, useProfile, dataStore, Settings, lab/Entry, exam/Entry, TutorChat
 */

// Available voices for Gemini Live API
// Each voice has a persona name that's easy to pronounce
export type GeminiVoice = 
  | 'Victoria'   // Female - Warm, friendly (was Aoede)
  | 'Max'        // Male - Clear, professional (was Puck)
  | 'James'      // Male - Deep, authoritative (was Charon)
  | 'Emma'       // Female - Young, energetic (was Kore)
  | 'Daniel'     // Male - Strong, bold (was Fenrir)
  | 'Sophia';    // Female - Gentle, calm (was Autonoe)

export interface VoiceOption {
  id: GeminiVoice;
  label: string;
  personaName: string;  // What the voice calls itself
  description: string;
  role: string;         // What role they play (tutor, coach, etc.)
  gender: 'female' | 'male';
}

export const GEMINI_VOICES: VoiceOption[] = [
  { 
    id: 'Victoria', 
    label: 'Victoria', 
    personaName: 'Victoria',
    description: 'Warm, friendly female voice',
    role: 'personal tutor',
    gender: 'female'
  },
  { 
    id: 'Max', 
    label: 'Max', 
    personaName: 'Max',
    description: 'Clear, professional male voice',
    role: 'learning coach',
    gender: 'male'
  },
  { 
    id: 'James', 
    label: 'James', 
    personaName: 'James',
    description: 'Deep, authoritative male voice',
    role: 'study guide',
    gender: 'male'
  },
  { 
    id: 'Emma', 
    label: 'Emma', 
    personaName: 'Emma',
    description: 'Young, energetic female voice',
    role: 'study buddy',
    gender: 'female'
  },
  { 
    id: 'Daniel', 
    label: 'Daniel', 
    personaName: 'Daniel',
    description: 'Strong, bold male voice',
    role: 'academic mentor',
    gender: 'male'
  },
  { 
    id: 'Sophia', 
    label: 'Sophia', 
    personaName: 'Sophia',
    description: 'Gentle, calm female voice',
    role: 'learning companion',
    gender: 'female'
  },
];

// Map our simple names back to Gemini API voice names
export const VOICE_NAME_MAP: Record<GeminiVoice, string> = {
  'Victoria': 'Aoede',
  'Max': 'Puck',
  'James': 'Charon',
  'Emma': 'Kore',
  'Daniel': 'Fenrir',
  'Sophia': 'Autonoe',
};

export interface UserProfile {
  name: string;
  gender: string;
  age: string;
  hobbies: string[];
  learningStyle: string;
  language?: string;
  theme?: 'realistic' | 'space' | 'anime' | 'historical' | 'action';
  voiceSpeed?: 'slow' | 'normal' | 'fast';
  voiceName?: GeminiVoice;
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
  voiceName: 'Victoria',
  autoAdvanceCarousel: true,
};
