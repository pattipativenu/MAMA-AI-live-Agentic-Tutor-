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
  resolution?: '720p' | '1080p' | '4k';
}

function buildVideoPrompt(concept: string, age: string): string {
  return `
    Educational animation demonstrating: "${concept}".
    ${age ? `Designed for a ${age} student to understand easily.` : ''}
    Clear visual demonstration, well-lit, photorealistic or high-quality 3D render.
    No text overlays. Focus entirely on the concept.
  `;
}

/**
 * Generates video using Veo 3.1
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
    aspectRatio = '9:16', // Mobile portrait for Mama AI
    resolution = '720p'
  } = options;

  const prompt = buildVideoPrompt(concept, age);
  console.log(`[VideoGen] Starting Veo generation for: ${concept}`);

  // Start video generation
  const operation = await ai.models.generateVideos({
    model: 'veo-3.1-generate-preview',
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
