/**
 * Sound utility for playing notification sounds
 * Used when entering different modes (Lab, Exam, TutorChat)
 */

import { useEffect } from 'react';

let audioContext: AudioContext | null = null;

/**
 * Initialize audio context (must be called after user interaction)
 */
export function initAudioContext(): AudioContext | null {
  if (!audioContext && typeof window !== 'undefined') {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('[Sound] Failed to create AudioContext:', e);
    }
  }
  return audioContext;
}

/**
 * Play the mode entry notification sound
 * @returns Promise that resolves when sound starts playing
 */
export async function playModeEntrySound(): Promise<void> {
  try {
    // Try to use Audio element first (simpler)
    const audio = new Audio('/assets/universfield-system-notification-199277.mp3');
    audio.volume = 0.5; // 50% volume
    
    // Handle autoplay restrictions
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // Autoplay was prevented, ignore silently
        console.log('[Sound] Autoplay prevented, user interaction required');
      });
    }
  } catch (e) {
    console.warn('[Sound] Failed to play notification:', e);
  }
}

/**
 * Play sound with fallback for older browsers
 */
export function playNotification(): void {
  // Only play if user has interacted with the page
  if (typeof document !== 'undefined' && document.hasFocus()) {
    playModeEntrySound();
  }
}

/**
 * Hook to play sound on component mount
 * Usage: useModeEntrySound()
 */
export function useModeEntrySound() {
  useEffect(() => {
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      playModeEntrySound();
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);
}
