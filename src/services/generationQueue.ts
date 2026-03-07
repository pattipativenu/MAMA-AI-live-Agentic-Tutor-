import { db } from '../firebase';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { generateEducationalImage } from './imageGen';
import { startVideoGenerationJob } from './videoGen';
import { CarouselSlide } from '../hooks/useCarousel';
import { preBufferTTS } from './tts';

export interface GenerationJob {
  sessionId: string;
  theme: string;
  age: string;
  hooks: { term: string; description: string }[];
  status: 'pending' | 'generating' | 'complete' | 'failed';
  slides: CarouselSlide[];
}

/**
 * Initiates the background generation of media assets for a session.
 * For a hackathon, we trigger this from the client but manage State in Firestore
 * so the polling UI can listen to updates.
 */
export async function startGenerationQueue(
  userId: string,
  sessionId: string,
  hooks: { term: string; description: string }[],
  theme: string,
  age: string
) {
  const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);

  // 1. Initialize the job state in Firestore
  await setDoc(sessionRef, {
    generationJob: {
      status: 'generating',
      theme,
      age,
      slides: []
    }
  }, { merge: true });

  // 2. We kick off the generation promises in the background. 
  // The client doesn't await this function, it just listens to Firestore.
  (async () => {
    try {
      const slides: CarouselSlide[] = [];

      // Intro Slide (Text Only)
      const introText = `Let's review what we learned about ${hooks[0]?.term || 'this topic'} using some easy memory hooks!`;
      slides.push({
        id: 'intro',
        type: 'text',
        narrationText: introText,
        durationMs: await preBufferTTS(introText),
        fallbackText: 'Review Time!'
      });

      // Process each hook
      for (let i = 0; i < hooks.length; i++) {
        const hook = hooks[i];

        // --- 1. Generate Image (Nano Banana pipeline) ---
        let imageUrl = undefined;
        let isSkipped = false;
        try {
          imageUrl = await generateEducationalImage(hook.term, { theme, age });
        } catch (e) {
          console.error(`Failed to generate image for ${hook.term}`, e);
          isSkipped = true; // Fallback to text card
        }

        const narrationHtml = `${hook.term}! Remember: ${hook.description}`;
        slides.push({
          id: `hook-img-${i}`,
          type: 'image',
          url: imageUrl,
          narrationText: narrationHtml,
          durationMs: await preBufferTTS(narrationHtml),
          fallbackText: hook.term,
          skipped: isSkipped && !imageUrl
        });

        // --- 2. Start Video Generation (Veo) in Background ---
        const videoSlideId = `hook-video-${i}`;
        // Fire and forget (do not await) because Veo takes ~30-60 seconds. 
        // We write the job to Firestore, and the frontend Carousel can listen to it.
        startVideoGenerationJob(
          `${hook.term}: ${hook.description}`,
          userId,
          sessionId,
          videoSlideId,
          { age, theme, aspectRatio: '9:16', resolution: '720p' }
        ).catch(err => {
          console.warn(`[GenQueue] Background video job failed for ${hook.term}`, err);
        });

        // Add a placeholder slide to the carousel that will automatically upgrade to Video
        // when the UI Firestore listener detects the job is complete.
        slides.push({
          id: videoSlideId,
          type: 'video',
          url: undefined, // Will be populated by listener
          narrationText: `Let's watch how ${hook.term} works in action!`,
          durationMs: 8000,
          fallbackText: 'Generating video animation...'
        });
      }

      // 3. Mark Complete in Firestore
      await setDoc(sessionRef, {
        generationJob: {
          status: 'complete',
          slides
        }
      }, { merge: true });

    } catch (error) {
      console.error("Critical Generation Queue Failure:", error);
      await setDoc(sessionRef, {
        generationJob: {
          status: 'failed',
        }
      }, { merge: true });
    }
  })();
}

/**
 * Subscribe to video job updates
 * The UI (CarouselViewer) calls this to listen for background Veo completions.
 */
export function subscribeToVideoJobs(
  userId: string,
  sessionId: string,
  onUpdate: (slideId: string, videoUrl: string) => void
) {
  const { collection, onSnapshot: firestoreOnSnapshot } = require('firebase/firestore');

  const jobsRef = collection(db, 'users', userId, 'sessions', sessionId, 'videoJobs');

  return firestoreOnSnapshot(jobsRef, (snapshot: any) => {
    snapshot.docChanges().forEach((change: any) => {
      // Listen for newly added or modified jobs that are complete
      if (change.type === 'modified' || change.type === 'added') {
        const data = change.doc.data();
        if (data.status === 'complete' && data.videoUrl) {
          onUpdate(change.doc.id, data.videoUrl);
        }
      }
    });
  });
}
