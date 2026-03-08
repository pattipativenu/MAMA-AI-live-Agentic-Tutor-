import { GoogleGenAI } from '@google/genai';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

// Initialize the SDK using the Vite environment variable
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

export interface VideoGenerationOptions {
  age?: string;
  theme?: string;
  aspectRatio?: '16:9' | '9:16'; // 9:16 for mobile portrait
  resolution?: '720p' | '1080p';
}

// ── Per-theme aesthetic finishing ────────────────────────────────────────────

const VIDEO_THEME_AESTHETICS: Record<string, string> = {
  realistic:
    'Photorealistic render with scientific accuracy. Neutral gradient or contextual real-world backdrop. Natural cinematic colour grade — warm highlights, cool shadows, subtle film grain.',
  space:
    'Cinematic deep-space aesthetic with neon energy particles, glowing orbital paths, and volumetric light shafts cutting through a dark cosmic backdrop. Vibrant blues, cyans, and purples.',
  anime:
    'Vibrant cel-shaded anime style with expressive motion lines, speed streaks, and a warm inviting colour palette. Soft bokeh environment, Studio Ghibli-inspired warmth.',
  historical:
    'Sepia-toned vintage film style. Warm amber tones, aged parchment textures, and a slightly desaturated palette that evokes a scholarly historical document.',
  action:
    'High-contrast comic-book aesthetic. Bold thick outlines, explosive speed lines, impact-star bursts, and dramatic directional lighting that screams kinetic energy.',
};

// ── Prompt builder (Veo guide: 5-part formula, 100–150 words, 8-second map) ──

/**
 * Builds a Veo-optimised video prompt following the official prompting guide:
 *  1. Shot Composition  — camera angle, distance, movement
 *  2. Subject Details   — scientific accuracy, colour, texture
 *  3. Action Sequence   — explicit 8-second play-by-play
 *  4. Setting           — minimal, contextual, never distracting
 *  5. Aesthetics & Mood — colour grade, theme style, satisfying resolution
 *
 * Target length: ~100–150 words.
 * No dialogue, no voiceover, no text overlays.
 */
function buildVideoPrompt(concept: string, age: string, theme?: string): string {
  const audienceNote = age
    ? `Calibrated for a ${age} student — visually engaging and clear without being oversimplified.`
    : 'Visually clear and appropriately detailed for high-school students.';

  const aesthetic =
    (theme && VIDEO_THEME_AESTHETICS[theme]) ?? VIDEO_THEME_AESTHETICS.realistic;

  return `
An 8-second silent educational animation demonstrating: "${concept}".

SHOT COMPOSITION: Opens (0–2 s) with a clean wide establishing shot that immediately frames all key elements of ${concept}. Camera slowly pushes in, building focus on the central subject.

SUBJECT DETAILS: ${concept} depicted with scientific accuracy — vibrant colour-coded components, crisp edges, and clear spatial relationships between all interacting parts. Every element visually distinct.

ACTION SEQUENCE (2–6 s): The core physical process within "${concept}" unfolds through a smooth, deliberate sequence. Motion blur, flow lines, and particle effects highlight direction of movement, energy transfer, or transformation. Cause and effect are unmistakable.

SETTING: Clean, minimal environment. ${audienceNote}

AESTHETICS & MOOD (6–8 s): ${aesthetic} Final frames show the concept's key outcome with a satisfying visual resolution — gentle pull-back or slow-motion freeze that encapsulates the core insight.

CRITICAL: No dialogue. No voiceover. No text overlays. No captions. Silent visual animation only.
  `.trim();
}

/**
 * Generates video using Veo 3 (video-only — no native audio track).
 * NOTE: This is an async operation that requires polling.
 * Returns Firebase Storage URL when complete.
 */
export async function generateEducationalVideo(
  concept: string,
  userId: string,
  sessionId: string,
  options: VideoGenerationOptions = {}
): Promise<string> {
  const {
    age = '',
    theme = 'realistic',
    aspectRatio = '9:16', // Mobile portrait for Mama AI
  } = options;

  const prompt = buildVideoPrompt(concept, age, theme);
  console.log(`[VideoGen] Starting Veo generation for: ${concept}`);

  // Start video generation — veo-3-generate produces video without native audio
  const operation = await ai.models.generateVideos({
    model: 'veo-3-generate',
    prompt,
    config: {
      aspectRatio,
      personGeneration: 'ALLOW_ADULT'
    }
  });

  // Poll for completion (this takes 30-60 seconds typically)
  let completedOperation = operation;
  console.log(`[VideoGen] Polling operation: ${operation.name}`);
  while (!completedOperation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    // According to JS docs: await ai.operations.getVideosOperation({ operation });
    completedOperation = (await ai.operations.getVideosOperation({
      operation: completedOperation as any
    })) as typeof operation;
  }

  // Get the video data
  const generatedVideo = completedOperation.response?.generatedVideos?.[0];
  if (!generatedVideo?.video?.uri) {
    throw new Error('Video generation failed - no video URI in response');
  }

  console.log(`[VideoGen] Download video from URI: ${generatedVideo.video.uri}`);

  // Download video bytes by fetching the URI directly (Google GenAI URI)
  const videoResponse = await fetch(generatedVideo.video.uri);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video from URI: ${videoResponse.statusText}`);
  }
  const videoBlob = await videoResponse.blob();

  // Upload to Firebase Storage for permanent storage
  const videoRef = ref(storage, `users/${userId}/sessions/${sessionId}/videos/${Date.now()}.mp4`);
  await uploadBytes(videoRef, videoBlob);
  const downloadUrl = await getDownloadURL(videoRef);

  console.log(`[VideoGen] Video uploaded to storage: ${downloadUrl}`);
  return downloadUrl;
}

/**
 * Firestore-based polling version for Generation Queue
 * This version updates Firestore status and can be polled by the UI
 */
export async function startVideoGenerationJob(
  concept: string,
  userId: string,
  sessionId: string,
  slideId: string,
  options: VideoGenerationOptions = {}
): Promise<void> {
  const jobRef = doc(db, 'users', userId, 'sessions', sessionId, 'videoJobs', slideId);

  try {
    await setDoc(jobRef, {
      status: 'generating',
      concept,
      startedAt: Date.now()
    });

    const videoUrl = await generateEducationalVideo(concept, userId, sessionId, options);

    await setDoc(jobRef, {
      status: 'complete',
      videoUrl,
      completedAt: Date.now()
    }, { merge: true });

  } catch (error) {
    console.error(`[VideoGen] Job failed for concept: ${concept}`, error);
    await setDoc(jobRef, {
      status: 'failed',
      error: (error as Error).message,
      failedAt: Date.now()
    }, { merge: true });
    throw error;
  }
}
