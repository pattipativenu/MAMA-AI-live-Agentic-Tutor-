/**
 * videoGen.ts — Educational video generation with caching integration
 * 
 * Uses Veo 3 (veo-3.0-generate-001) for 8-second silent diagram/equation animations
 * Integrates with mediaCache.ts for per-user topic-based caching
 * 
 * Key Features:
 * - 9:16 portrait aspect ratio (mobile-optimized)
 * - Silent animations (no audio; Gemini narrates via Live API)
 * - 8-second duration
 * - Automatic caching
 * - Firestore-based async job management
 */

import { GoogleGenAI } from '@google/genai';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, onSnapshot, collection, query, where, orderBy, getDocs, Unsubscribe } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { 
  checkMediaCache, 
  storeMediaInCache, 
  shouldSkipAutoGeneration,
  CachedMedia 
} from './mediaCache';

// Initialize the SDK
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

// Veo 3 model for silent 2D/3D diagram animations (Gemini narrates via Live API)
const VEO_MODEL = 'veo-3.0-generate-001';

export interface VideoGenerationOptions {
  age?: string;
  theme?: 'realistic' | 'space' | 'anime' | 'historical' | 'action';
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  personGeneration?: 'DONT_ALLOW' | 'ALLOW_ADULT';
}

// ── Theme aesthetics for Veo 2 ───────────────────────────────────────────────

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

// ── Prompt builder (Veo 2 optimized) ─────────────────────────────────────────

/**
 * Builds a Veo-2-optimised video prompt following best practices:
 * - 100–150 words
 * - 5-part formula: Shot, Subject, Action, Setting, Aesthetics
 * - 8-second timeline mapping (0-2s, 2-6s, 6-8s)
 * - No dialogue, no text overlays
 */
function buildVideoPrompt(concept: string, age: string = '', theme: string = 'realistic'): string {
  const audienceNote = age
    ? `Calibrated for a ${age} student — visually engaging and clear without being oversimplified.`
    : 'Visually clear and appropriately detailed for high-school students.';

  const aesthetic = VIDEO_THEME_AESTHETICS[theme] ?? VIDEO_THEME_AESTHETICS.realistic;

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

export interface VideoJob {
  id: string;
  userId: string;
  sessionId: string;
  concept: string;
  topicName?: string;
  chapterId?: string;
  status: 'pending' | 'checking_cache' | 'generating' | 'uploading' | 'completed' | 'failed' | 'skipped';
  videoUrl?: string;
  cached?: boolean;
  storagePath?: string;
  error?: string;
  skipReason?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// ── Main video generation function ───────────────────────────────────────────

/**
 * Generates video using Veo 2 with caching integration
 * 
 * Flow:
 * 1. Check cache first (return cached if hit)
 * 2. Check if should skip (short concepts, chapter titles)
 * 3. Generate using Veo 2
 * 4. Upload to Cloud Storage
 * 5. Store in cache
 * 6. Return URL
 * 
 * This is a synchronous function that takes 30-60 seconds.
 * For async usage, use startVideoGenerationJob() with Firestore polling.
 */
export async function generateEducationalVideo(
  concept: string,
  userId: string,
  sessionId: string,
  options: VideoGenerationOptions = {}
): Promise<{ url: string; cached: boolean; storagePath: string }> {
  const {
    age = '',
    theme = 'realistic',
    aspectRatio = '9:16',
    personGeneration = 'ALLOW_ADULT'
  } = options;

  // Check cache first
  const cached = await checkMediaCache(userId, concept, undefined, 'video');
  if (cached) {
    console.log(`[VideoGen] Cache hit for: ${concept}`);
    return {
      url: cached.mediaUrl,
      cached: true,
      storagePath: cached.storagePath
    };
  }

  const prompt = buildVideoPrompt(concept, age, theme);
  console.log(`[VideoGen] Starting Veo 3 generation for: ${concept}`);
  console.log(`[VideoGen] Prompt length: ${prompt.length} chars`);

  try {
    // Check if Veo 3 is available (skip if not)
    console.log(`[VideoGen] Checking Veo 3 availability...`);
    
    // Start video generation with Veo 3 (silent; Gemini narrates via Live API)
    let operation;
    try {
      operation = await ai.models.generateVideos({
        model: VEO_MODEL,
        prompt,
        config: {
          aspectRatio,
          personGeneration,
          generateAudio: false
        }
      });
    } catch (veoError: any) {
      if (veoError.message?.includes('404') || veoError.message?.includes('not found')) {
        console.error('[VideoGen] Veo 3 model not found (404). Your project may not have access to Veo 3 yet.');
        console.error('[VideoGen] To enable Veo 3:');
        console.error('  1. Go to Google Cloud Console > Vertex AI > Models');
        console.error('  2. Search for "Veo 3" and request access');
        console.error('  3. Approval typically takes 1-3 business days');
        throw new Error('Veo 3 not available. Please request access in Google Cloud Console or use image generation instead.');
      }
      throw veoError;
    }

    // Poll for completion
    let completedOperation = operation;
    console.log(`[VideoGen] Polling operation: ${operation.name}`);
    
    let pollCount = 0;
    const maxPolls = 30; // 5 minutes max (10s * 30)
    
    while (!completedOperation.done && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second intervals
      
      completedOperation = (await ai.operations.getVideosOperation({
        operation: completedOperation as any
      })) as typeof operation;
      
      pollCount++;
      console.log(`[VideoGen] Poll ${pollCount}, done: ${completedOperation.done}`);
    }

    if (!completedOperation.done) {
      throw new Error('Video generation timed out after 5 minutes');
    }

    // Extract video
    const generatedVideo = completedOperation.response?.generatedVideos?.[0];
    if (!generatedVideo?.video?.uri) {
      throw new Error('Video generation failed - no video URI in response');
    }

    console.log(`[VideoGen] Video ready, downloading from: ${generatedVideo.video.uri}`);

    // Download video (URI may require API key for Google API URLs)
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const videoUri = generatedVideo.video.uri;
    const downloadUrlWithKey = videoUri.includes('generativelanguage.googleapis.com') && apiKey
      ? `${videoUri}${videoUri.includes('?') ? '&' : '?'}key=${apiKey}`
      : videoUri;
    const videoResponse = await fetch(downloadUrlWithKey);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }
    
    const videoBlob = await videoResponse.blob();
    console.log(`[VideoGen] Downloaded ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);

    // Upload to Firebase Storage
    const timestamp = Date.now();
    const storagePath = `users/${userId}/generated/videos/${timestamp}.mp4`;
    const videoRef = ref(storage, storagePath);
    
    await uploadBytes(videoRef, videoBlob, {
      contentType: 'video/mp4',
      customMetadata: {
        concept: concept.substring(0, 100),
        userId,
        sessionId
      }
    });
    
    const downloadUrl = await getDownloadURL(videoRef);
    console.log(`[VideoGen] Uploaded to: ${downloadUrl}`);

    // Store in cache
    await storeMediaInCache(
      userId,
      concept,
      concept,
      'video',
      downloadUrl,
      storagePath,
      prompt
    );

    return {
      url: downloadUrl,
      cached: false,
      storagePath
    };

  } catch (error) {
    console.error('[VideoGen] Generation failed:', error);
    throw error;
  }
}

// ── Firestore-based async job management ─────────────────────────────────────

/**
 * Start an async video generation job with Firestore tracking
 * Use this for "fire and forget" pattern where AI continues speaking
 * 
 * @param legacySlideId - Deprecated, kept for backward compatibility
 */
export async function startVideoGenerationJob(
  concept: string,
  userId: string,
  sessionId: string,
  legacySlideId?: string,
  options: VideoGenerationOptions & { topicName?: string; chapterId?: string } = {}
): Promise<string> {
  // Handle both old and new signatures
  const actualOptions = typeof legacySlideId === 'object' ? legacySlideId : options;
  const { topicName, chapterId, ...videoOptions } = actualOptions;
  const jobId = legacySlideId && typeof legacySlideId === 'string' 
    ? legacySlideId 
    : `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const jobRef = doc(db, 'videoJobs', jobId);
  
  // Build job document - filter out undefined values for Firestore
  const jobData: Partial<VideoJob> = {
    id: jobId,
    userId,
    sessionId,
    concept,
    topicName: topicName || concept,
    status: 'pending',
    createdAt: Date.now()
  };
  
  // Only add chapterId if it's defined (Firestore rejects undefined values)
  if (chapterId !== undefined && chapterId !== null) {
    jobData.chapterId = chapterId;
  }
  
  // Create job document
  await setDoc(jobRef, jobData as VideoJob);

  // Start generation in background
  (async () => {
    try {
      // Check if should skip
      const skipCheck = await shouldSkipAutoGeneration(userId, concept, chapterId);
      if (skipCheck.skip) {
        await setDoc(jobRef, {
          status: 'skipped',
          skipReason: skipCheck.reason,
          completedAt: Date.now()
        }, { merge: true });
        console.log(`[VideoGen] Job ${jobId} skipped: ${skipCheck.reason}`);
        return;
      }

      // Check cache
      await setDoc(jobRef, { status: 'checking_cache' }, { merge: true });
      
      if (skipCheck.cached) {
        await setDoc(jobRef, {
          status: 'completed',
          videoUrl: skipCheck.cached.mediaUrl,
          cached: true,
          completedAt: Date.now()
        }, { merge: true });
        console.log(`[VideoGen] Job ${jobId} completed from cache`);
        return;
      }

      // Generate
      await setDoc(jobRef, { status: 'generating', startedAt: Date.now() }, { merge: true });
      
      const result = await generateEducationalVideo(concept, userId, sessionId, videoOptions);
      
      // Update with result
      await setDoc(jobRef, {
        status: 'completed',
        videoUrl: result.url,
        cached: result.cached,
        storagePath: result.storagePath,
        completedAt: Date.now()
      }, { merge: true });
      
      console.log(`[VideoGen] Job ${jobId} completed successfully`);
      
    } catch (error) {
      console.error(`[VideoGen] Job ${jobId} failed:`, error);
      await setDoc(jobRef, {
        status: 'failed',
        error: (error as Error).message,
        completedAt: Date.now()
      }, { merge: true });
    }
  })();

  return jobId;
}

/**
 * Subscribe to video job updates (real-time)
 * Use this in UI to show "video ready" when generation completes
 */
export function subscribeToVideoJobs(
  userId: string,
  sessionId: string,
  onUpdate: (jobs: VideoJob[]) => void
): Unsubscribe {
  const jobsRef = collection(db, 'videoJobs');
  const q = query(
    jobsRef,
    where('userId', '==', userId),
    where('sessionId', '==', sessionId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const jobs = snapshot.docs.map(doc => doc.data() as VideoJob);
    console.log(`[VideoGen] Jobs updated: ${jobs.length} jobs`);
    onUpdate(jobs);
  }, (error) => {
    console.error('[VideoGen] Subscription error:', error);
  });
}

/**
 * Get all completed videos for a session
 */
export async function getSessionVideos(userId: string, sessionId: string): Promise<VideoJob[]> {
  try {
    const jobsRef = collection(db, 'videoJobs');
    const q = query(
      jobsRef,
      where('userId', '==', userId),
      where('sessionId', '==', sessionId),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as VideoJob);
  } catch (error) {
    console.error('[VideoGen] Error getting session videos:', error);
    return [];
  }
}

/**
 * Quick check if a topic has a cached video
 */
export async function getCachedVideoUrl(
  userId: string,
  topicName: string,
  chapterId?: string
): Promise<string | null> {
  const cached = await checkMediaCache(userId, topicName, chapterId, 'video');
  return cached?.mediaUrl || null;
}
