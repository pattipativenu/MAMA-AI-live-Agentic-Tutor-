/**
 * videoGen.ts — Educational video generation with caching integration
 * 
 * Uses Veo 3.1 Fast (veo-3.1-fast-generate-preview) for 8-second silent diagram/equation animations
 * Integrates with mediaCache.ts for per-user topic-based caching
 * 
 * Key Features:
 * - 9:16 portrait aspect ratio (mobile-optimized)
 * - Silent animations (no audio; Gemini narrates via Live API)
 * - 8-second duration
 * - Automatic caching
 * - Firestore-based async job management
 */

import { GoogleGenAI, type GenerateVideosConfig } from '@google/genai';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, onSnapshot, collection, query, where, orderBy, getDocs, Unsubscribe } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { 
  checkMediaCache, 
  storeMediaInCache, 
  shouldSkipAutoGeneration,
  CachedMedia 
} from './mediaCache';

// Initialize the SDK with v1beta API version
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
  httpOptions: { apiVersion: 'v1beta' }
});

// Veo 3.1 Fast model for silent 2D/3D diagram animations (Gemini narrates via Live API)
const VEO_MODEL = 'veo-3.1-fast-generate-preview';

export interface VideoGenerationOptions {
  age?: string;
  theme?: 'realistic' | 'space' | 'anime' | 'historical' | 'action';
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p' | '4k';
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
  subject?: string;
  numberOfVideos?: number;
  durationSeconds?: number;
  visualStyle?: 'diagram-only' | 'real-world-only' | 'transformation';
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
 * - Highlights transformation from real world to theoretical diagram
 * - No dialogue, no text overlays
 */
function buildVideoPrompt(concept: string, age: string = '', theme: string = 'realistic', subject: string = 'Science', visualStyle: string = 'diagram-only'): string {
  const audienceNote = age
    ? `Calibrated for a ${age} student — visually engaging and clear without being oversimplified.`
    : 'Visually clear and appropriately detailed for high-school students.';

  const aesthetic = VIDEO_THEME_AESTHETICS[theme] ?? VIDEO_THEME_AESTHETICS.realistic;

  // Diagram-only prompt (matches textbook diagrams)
  if (visualStyle === 'diagram-only') {
    return `
An 8-second COMPLETELY SILENT educational animation demonstrating: "${concept}" for a ${subject} class.

CINEMATIC DIRECTION (CRITICAL):
• FRAME 1 (IMMEDIATE VISIBILITY): From the very first millisecond, the ENTIRE diagram must be fully rendered. All elements, objects, rays, dimensions, labels, and axes are already present and perfectly visible. Do NOT 'assemble', 'draw in', or 'fade in' elements over time. Start the video with the complete scene already established.
• MOTION & ACTION: The core phenomenon (${concept}) is actively occurring throughout the 8 seconds. Show continuous, clear relationships through motion (e.g., energy transferring, particles colliding, waves propagating) happening within the fully established diagram.
• SHOT COMPOSITION: Clean, minimal abstract textbook diagram. Professional academic visualization. Static camera or very slow, steady dolly shot. No zooming or panning to reveal things (everything is already in frame).

SUBJECT DETAILS: THIS IS THE MOST IMPORTANT PART. The visual content must be unambiguously strong, deeply informative, and perfectly structure the core scientific principles of "${concept}". It is not just an illustration; it is a rigorous theoretical diagram showing the concept intricately with perfectly labeled parts, arrows, and scientific annotations. What the student sees must fundamentally explain how "${concept}" actually works. ${audienceNote}
SETTING: Clean, minimal academic background - neutral gradient or subtle grid.
AESTHETICS: ${aesthetic}

CRITICAL RULE: Absolutely NO AUDIO TRACK WHATSOEVER. No sound effects. No background music. No ambient noise. No dialogue. No voiceover. Pure silent visual diagram animation only.
    `.trim();
  }

  // Real-world only prompt
  if (visualStyle === 'real-world-only') {
    return `
An 8-second COMPLETELY SILENT educational animation demonstrating: "${concept}" for a ${subject} class.

CINEMATIC DIRECTION (CRITICAL):
• FRAME 1 (IMMEDIATE VISIBILITY): From the very first millisecond, the ENTIRE real-world scene must be fully established and completely visible. Do NOT 'build', 'gather', or fade elements in over time. The environment, lighting, and all subject objects are perfectly present on frame 1.
• MOTION & ACTION: The core physical phenomenon (${concept}) is actively happening. Show clear, continuous natural motion (e.g., water flowing, objects falling, chemical reactions occurring) in real-time within the fully established scene.
• SHOT COMPOSITION: Highly relatable, tangible REAL-WORLD example of ${concept} in everyday life. Locked-off camera or cinematic slow tracking shot.

SUBJECT DETAILS: THIS IS THE MOST IMPORTANT PART. The visual content must be unambiguously strong, deeply informative, and present a photorealistic, tangible real-world scenario where "${concept}" naturally and powerfully occurs. Do not be vague or generic. Every physical detail must be scientifically and proportionally accurate, visually explaining the exact principles of "${concept}" through a strong, robust re-enactment of the phenomena. ${audienceNote}
SETTING: Familiar real-world environment where students would encounter this concept.
AESTHETICS: ${aesthetic}

CRITICAL RULE: Absolutely NO AUDIO TRACK WHATSOEVER. No sound effects. No background music. No ambient noise. No dialogue. No voiceover. Pure silent visual demonstration only.
    `.trim();
  }

  // Transformation prompt (default/fallback - real-world morphing to diagram)
  return `
An 8-second COMPLETELY SILENT educational animation demonstrating: "${concept}" for a ${subject} class.

CINEMATIC DIRECTION (CRITICAL):
• FRAME 1 (IMMEDIATE VISIBILITY): From the very first millisecond, the highly relatable, tangible REAL-WORLD example of ${concept} must be fully established and completely visible. No fading in or building scene elements.
• SECONDS 0-4 (REAL-WORLD ACTION): The concept happens in physical form, clearly demonstrating the phenomena in a photorealistic environment.
• SECONDS 4-8 (MORPHING TRANSFORMATION): The real-world scene actively and smoothly morphs and transforms into a clean, abstract textbook diagram with labels and theoretical arrows to explain the underlying science. The transformation itself is the visual focus, ending with a fully formed diagram.
• SHOT COMPOSITION: Static, locked-off camera focusing entirely on the subject and the morphing transition.

SUBJECT DETAILS: THIS IS THE MOST IMPORTANT PART. The visual content must be unambiguously strong, deeply informative, and rigorously detailed. The subject matter (${subject}) must be scientifically and theoretically accurate in both its highly detailed real-world physical form, AND its subsequent perfectly labeled, mathematically accurate abstract diagram form. Every element must be visually striking and purposefully explain the core science behind "${concept}". ${audienceNote}
SETTING: Starts grounded real-world, then transitions into a clean, minimal abstract academic environment.
AESTHETICS: ${aesthetic}

CRITICAL AUDIO RULE: Absolutely NO AUDIO TRACK WHATSOEVER. No sound effects. No background music. No ambient noise. No dialogue. No voiceover. No text overlays. No captions. Silent visual animation only.
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
 * Generates video using Veo 3.1 Fast with caching integration
 * 
 * Flow:
 * 1. Check cache first (return cached if hit)
 * 2. Check if should skip (short concepts, chapter titles)
 * 3. Generate using Veo 3.1 Fast
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
    subject = 'Science',
    numberOfVideos = 1,
    durationSeconds = 8,
    visualStyle = 'diagram-only',
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

  const prompt = buildVideoPrompt(concept, age, theme, subject, visualStyle);
  console.log(`[VideoGen] Starting Veo 3.1 Fast generation for: ${concept}`);
  console.log(`[VideoGen] Prompt length: ${prompt.length} chars`);

  try {
    // Start video generation with Veo 3.1 Fast (silent; Gemini narrates via Live API)
    console.log(`[VideoGen] Calling Veo API with model: ${VEO_MODEL}`);
    
    let operation;
    try {
      // Official JS SDK call: ai.models.generateVideos({ model, prompt, config })
      // Reference: https://ai.google.dev/gemini-api/docs/video
      operation = await ai.models.generateVideos({
        model: VEO_MODEL,
        prompt,
        config: {
          aspectRatio,
          numberOfVideos,
          durationSeconds,
        } as GenerateVideosConfig
      });
      
      console.log(`[VideoGen] Operation started: ${operation.name}`);
    } catch (veoError: any) {
      console.error('[VideoGen] Veo API error:', veoError);
      if (veoError.message?.includes('404') || veoError.message?.includes('not found')) {
        console.error('[VideoGen] Veo 3.1 model not found (404). Your API key may not have access to Veo 3.1 yet.');
        console.error('[VideoGen] To enable Veo 3.1:');
        console.error('  1. Go to Google AI Studio (https://aistudio.google.com/)');
        console.error('  2. Navigate to API keys and ensure Veo access is enabled');
        console.error('  3. Or use Google Cloud Console > Vertex AI > Models');
        throw new Error('Veo 3.1 not available. Please check your API key has Veo access or use image generation instead.');
      }
      throw veoError;
    }

    // Poll for completion (following Python SDK pattern)
    let completedOperation = operation;
    let pollCount = 0;
    const maxPolls = 60; // 10 minutes max (10s * 60) - Veo can take time
    
    console.log(`[VideoGen] Waiting for video generation...`);
    
    while (!completedOperation.done && pollCount < maxPolls) {
      console.log(`[VideoGen] Video has not been generated yet. Check again in 10 seconds... (poll ${pollCount + 1}/${maxPolls})`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second intervals
      
      // CORRECT polling method per official Gemini API JS SDK docs:
      // https://ai.google.dev/gemini-api/docs/video (JavaScript section)
      // Must use getVideosOperation(), NOT operations.get()
      completedOperation = await ai.operations.getVideosOperation({
        operation: completedOperation
      });
      
      pollCount++;
    }

    if (!completedOperation.done) {
      throw new Error('Video generation timed out after 10 minutes');
    }

    // Check for errors
    if (completedOperation.error) {
      throw new Error(`Video generation failed: ${completedOperation.error.message || 'Unknown error'}`);
    }

    // Extract video from result.
    // Official JS SDK: operation.response.generatedVideos[0].video
    // Reference: https://ai.google.dev/gemini-api/docs/video
    const response = (completedOperation as any).response;
    if (!response) {
      console.error('[VideoGen] No response on completed operation. Full operation:', JSON.stringify(completedOperation, null, 2));
      throw new Error('Video generation failed — operation completed but response is empty');
    }

    const generatedVideos = response.generatedVideos;
    if (!generatedVideos || generatedVideos.length === 0) {
      console.error('[VideoGen] response.generatedVideos empty. Full response:', JSON.stringify(response, null, 2));
      throw new Error('No videos were generated — operation succeeded but returned no video data');
    }

    const generatedVideo = generatedVideos[0];
    console.log(`[VideoGen] Video generated successfully: ${generatedVideo.video?.uri || 'no uri'}`);

    // Get the video file object
    const videoFile = generatedVideo.video;
    if (!videoFile) {
      throw new Error('Video file not found in generation result');
    }

    // Download the video
    let videoBlob: Blob;
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const videoUri = videoFile.uri;
      if (!videoUri) {
        throw new Error('Video URI not available');
      }
      
      // Fetch via URI with API key
      const downloadUrlWithKey = videoUri.includes('generativelanguage.googleapis.com') && apiKey
        ? `${videoUri}${videoUri.includes('?') ? '&' : '?'}key=${apiKey}`
        : videoUri;
        
      console.log(`[VideoGen] Downloading from: ${downloadUrlWithKey.substring(0, 100)}...`);
      
      const videoResponse = await fetch(downloadUrlWithKey);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.statusText}`);
      }
      
      videoBlob = await videoResponse.blob();
    } catch (downloadError) {
      console.error('[VideoGen] Download error:', downloadError);
      throw new Error('Failed to download generated video');
    }
    
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
    console.log(`[VideoGen] Uploaded to Firebase Storage: ${downloadUrl}`);

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
  // Querying only by sessionId completely prevents the need for a complex Firestore composite index
  const q = query(
    jobsRef,
    where('sessionId', '==', sessionId)
  );

  return onSnapshot(q, (snapshot) => {
    let jobs = snapshot.docs.map(doc => doc.data() as VideoJob);
    // Filter by userId and sort client-side to avoid Index errors
    jobs = jobs
      .filter(job => job.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
      
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
    // Querying only by sessionId completely prevents the need for a complex Firestore composite index
    const q = query(
      jobsRef,
      where('sessionId', '==', sessionId)
    );
    
    const snap = await getDocs(q);
    let jobs = snap.docs.map(doc => doc.data() as VideoJob);
    
    // Filter and sort client-side
    jobs = jobs
      .filter(job => job.userId === userId && job.status === 'completed')
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
      
    return jobs;
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
