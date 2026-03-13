// Assuming we will use standard Web Speech API for the MVP prototype 
// to avoid blocking the user with complex Cloud TTS auth,
// but structurally this service handles all TTS requests.
// 
// For a production app, this would wrap the Google Cloud Text-to-Speech API.

export async function preBufferTTS(text: string, voiceSpeed: 'slow' | 'normal' | 'fast' = 'normal'): Promise<number> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      console.warn("Speech synthesis not supported in this browser.");
      resolve(4000); // Mock 4 second duration
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to find a natural-sounding female voice (Aoede equivalent)
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha") || v.name.includes("Female"));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Set voice speed
    switch (voiceSpeed) {
      case 'slow': utterance.rate = 0.85; break;
      case 'fast': utterance.rate = 1.15; break;
      default: utterance.rate = 1.0; break;
    }

    const startTime = Date.now();
    utterance.volume = 0; // Mute it for the pre-buffer step just to get timing

    utterance.onend = () => {
      const durationMs = Date.now() - startTime;
      resolve(durationMs);
    };

    utterance.onerror = () => {
      resolve(4000); // Mock duration on error
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Actively speaks the text (used during the carousel playback)
 */
export function playTTS(text: string, voiceSpeed: 'slow' | 'normal' | 'fast' = 'normal') {
  if (!window.speechSynthesis) return;
  
  window.speechSynthesis.cancel(); // Stop any current speech
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha") || v.name.includes("Female"));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  switch (voiceSpeed) {
    case 'slow': utterance.rate = 0.85; break;
    case 'fast': utterance.rate = 1.15; break;
    default: utterance.rate = 1.0; break;
  }
  
  window.speechSynthesis.speak(utterance);
}

export function stopTTS() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
