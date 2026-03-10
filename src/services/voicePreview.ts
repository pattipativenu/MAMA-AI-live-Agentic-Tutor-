/**
 * voicePreview.ts - Service for generating voice preview samples
 * Uses Gemini TTS API to generate short audio clips for voice selection
 * 
 * CRITICAL: Gemini TTS returns RAW PCM audio (16-bit signed little-endian, 24kHz, mono)
 * Browsers cannot play PCM directly - MUST convert to WAV format!
 */
import { GoogleGenAI } from '@google/genai';
import { GeminiVoice, VOICE_NAME_MAP, VoiceOption } from '../types/profile';

// Cache for voice previews
const previewCache: Record<string, string> = {};

/**
 * Generate preview text for a specific voice
 * Format: "Hi [username], I'm [persona name], your [role]. I'll help you learn in a way that works best for you."
 */
function generatePreviewText(voice: VoiceOption, userName: string = 'there'): string {
  const name = userName?.split(' ')[0] || 'there';
  return `Hi ${name}! I'm ${voice.personaName}, your ${voice.role}. I'll help you learn in a way that works best for you.`;
}

/**
 * Convert PCM16 LE (Little Endian) data to WAV format for browser playback
 * Gemini TTS outputs: 24kHz, 16-bit signed PCM, mono, little-endian
 */
function pcm16ToWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  // Create WAV header buffer (44 bytes)
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  let offset = 0;

  // ChunkID "RIFF" (4 bytes)
  writeString(view, offset, 'RIFF');
  offset += 4;

  // ChunkSize (4 bytes)
  view.setUint32(offset, fileSize, true);
  offset += 4;

  // Format "WAVE" (4 bytes)
  writeString(view, offset, 'WAVE');
  offset += 4;

  // Subchunk1ID "fmt " (4 bytes)
  writeString(view, offset, 'fmt ');
  offset += 4;

  // Subchunk1Size (4 bytes) - 16 for PCM
  view.setUint32(offset, 16, true);
  offset += 4;

  // AudioFormat (2 bytes) - 1 for PCM
  view.setUint16(offset, 1, true);
  offset += 2;

  // NumChannels (2 bytes)
  view.setUint16(offset, numChannels, true);
  offset += 2;

  // SampleRate (4 bytes)
  view.setUint32(offset, sampleRate, true);
  offset += 4;

  // ByteRate (4 bytes)
  view.setUint32(offset, byteRate, true);
  offset += 4;

  // BlockAlign (2 bytes)
  view.setUint16(offset, blockAlign, true);
  offset += 2;

  // BitsPerSample (2 bytes)
  view.setUint16(offset, bitsPerSample, true);
  offset += 2;

  // Subchunk2ID "data" (4 bytes)
  writeString(view, offset, 'data');
  offset += 4;

  // Subchunk2Size (4 bytes)
  view.setUint32(offset, dataSize, true);

  // Combine header and PCM data
  const wavBuffer = new Uint8Array(44 + dataSize);
  wavBuffer.set(new Uint8Array(header), 0);
  wavBuffer.set(pcmData, 44);

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Write a string to a DataView at the specified offset
 */
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * Generate a voice preview URL for the given voice
 */
export async function generateVoicePreview(
  voiceId: GeminiVoice, 
  voiceOptions: VoiceOption[],
  userName?: string
): Promise<string> {
  // Return cached preview if available
  if (previewCache[voiceId]) {
    return previewCache[voiceId];
  }

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('API Key is missing');
  }

  // Get voice details
  const voice = voiceOptions.find(v => v.id === voiceId);
  if (!voice) {
    throw new Error(`Voice ${voiceId} not found`);
  }

  // Get the actual Gemini API voice name
  const geminiVoiceName = VOICE_NAME_MAP[voiceId];

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Generate personalized preview text
    const previewText = generatePreviewText(voice, userName);
    
    // Call Gemini TTS API
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ role: 'user', parts: [{ text: previewText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: geminiVoiceName
            }
          }
        }
      }
    });

    // Extract PCM audio data
    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    
    if (!inlineData || !inlineData.data) {
      throw new Error('No audio data received from API');
    }

    const pcmData = base64ToUint8Array(inlineData.data);
    
    console.log(`[VoicePreview] Generated preview for ${voiceId} (${geminiVoiceName}): ${pcmData.length} bytes`);
    
    // Convert PCM to WAV
    const wavBlob = pcm16ToWav(pcmData, 24000);
    const url = URL.createObjectURL(wavBlob);
    
    // Cache the URL
    previewCache[voiceId] = url;
    return url;
    
  } catch (error: any) {
    console.error(`[VoicePreview] Failed to generate preview for ${voiceId}:`, error);
    
    if (error.message?.includes('429') || error.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (error.message?.includes('404') || error.status === 404) {
      throw new Error('Voice not found. Please check your API access.');
    }
    
    throw error;
  }
}

/**
 * Play a voice preview
 */
export async function playVoicePreview(
  voiceId: GeminiVoice,
  voiceOptions: VoiceOption[],
  userName?: string
): Promise<HTMLAudioElement> {
  const audioUrl = await generateVoicePreview(voiceId, voiceOptions, userName);
  const audio = new Audio(audioUrl);
  
  return new Promise((resolve, reject) => {
    audio.oncanplaythrough = () => {
      audio.play().then(() => resolve(audio)).catch(reject);
    };
    
    audio.onerror = () => {
      reject(new Error('Failed to load audio'));
    };
    
    audio.src = audioUrl;
    audio.load();
  });
}

/**
 * Clear the preview cache
 */
export function clearVoicePreviewCache(): void {
  Object.values(previewCache).forEach(url => URL.revokeObjectURL(url));
  Object.keys(previewCache).forEach(key => delete previewCache[key]);
}
