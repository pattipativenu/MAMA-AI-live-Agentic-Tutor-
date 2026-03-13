/**
 * mediaCache.ts — Per-user media cache with topic-based lookup
 * 
 * Caching Strategy:
 * - Per-user cache (not global) to prevent inappropriate content mixing
 * - Topic-based lookup using MD5 hash of chapterId + topicName
 * - Auto-expiry after 18 months
 * - Max 1 auto-generated video per topic (user can request more manually)
 * 
 * Cache Key Format: md5(chapterId + '|' + normalizedTopicName)
 */

import { doc, getDoc, setDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

// 18 months in milliseconds
const CACHE_EXPIRY_MS = 18 * 30 * 24 * 60 * 60 * 1000;

export interface CachedMedia {
  cacheKey: string;
  userId: string;
  topicName: string;
  chapterId?: string;
  concept: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  storagePath: string;
  prompt: string;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

/**
 * Normalize topic name for consistent cache keys
 * Removes extra whitespace, lowercase, removes punctuation
 */
function normalizeTopicName(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ');     // Collapse multiple spaces
}

/**
 * Generate cache key from chapter and topic
 * Uses simple hash (not MD5 for browser compatibility, but deterministic)
 */
function generateCacheKey(chapterId: string | undefined, topicName: string): string {
  const normalizedTopic = normalizeTopicName(topicName);
  const keyString = chapterId ? `${chapterId}|${normalizedTopic}` : normalizedTopic;
  
  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < keyString.length; i++) {
    hash = ((hash << 5) + hash) + keyString.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if media exists in cache for a given topic
 * Also checks expiry and updates access stats
 */
export async function checkMediaCache(
  userId: string,
  topicName: string,
  chapterId?: string,
  mediaType: 'image' | 'video' = 'video'
): Promise<CachedMedia | null> {
  const cacheKey = generateCacheKey(chapterId, topicName);
  const cacheRef = doc(db, 'users', userId, 'mediaCache', cacheKey);
  
  try {
    const snap = await getDoc(cacheRef);
    if (!snap.exists()) {
      console.log(`[MediaCache] Cache miss for key: ${cacheKey}`);
      return null;
    }
    
    const cached = snap.data() as CachedMedia;
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      console.log(`[MediaCache] Cache expired for key: ${cacheKey}`);
      await deleteCachedMedia(userId, cacheKey, cached.storagePath);
      return null;
    }
    
    // Update access stats
    await setDoc(cacheRef, {
      accessCount: (cached.accessCount || 0) + 1,
      lastAccessedAt: Date.now()
    }, { merge: true });
    
    console.log(`[MediaCache] Cache hit for key: ${cacheKey}, url: ${cached.mediaUrl}`);
    return cached;
    
  } catch (error) {
    console.error('[MediaCache] Error checking cache:', error);
    return null;
  }
}

/**
 * Store newly generated media in cache
 */
export async function storeMediaInCache(
  userId: string,
  topicName: string,
  concept: string,
  mediaType: 'image' | 'video',
  mediaUrl: string,
  storagePath: string,
  prompt: string,
  chapterId?: string
): Promise<CachedMedia> {
  const cacheKey = generateCacheKey(chapterId, topicName);
  const cacheRef = doc(db, 'users', userId, 'mediaCache', cacheKey);
  
  const cacheEntry: CachedMedia = {
    cacheKey,
    userId,
    topicName: normalizeTopicName(topicName),
    concept,
    mediaType,
    mediaUrl,
    storagePath,
    prompt,
    createdAt: Date.now(),
    expiresAt: Date.now() + CACHE_EXPIRY_MS,
    accessCount: 1,
    lastAccessedAt: Date.now()
  };
  
  // Only add chapterId if it's defined (Firestore rejects undefined values)
  if (chapterId !== undefined && chapterId !== null) {
    (cacheEntry as any).chapterId = chapterId;
  }
  
  try {
    await setDoc(cacheRef, cacheEntry);
    console.log(`[MediaCache] Stored media with key: ${cacheKey}`);
    return cacheEntry;
  } catch (error) {
    console.error('[MediaCache] Error storing in cache:', error);
    throw error;
  }
}

/**
 * Delete cached media (cleanup on expiry or error)
 */
export async function deleteCachedMedia(
  userId: string,
  cacheKey: string,
  storagePath: string
): Promise<void> {
  try {
    // Delete from Storage
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    
    // Delete from Firestore
    const cacheRef = doc(db, 'users', userId, 'mediaCache', cacheKey);
    await deleteDoc(cacheRef);
    
    console.log(`[MediaCache] Deleted cached media: ${cacheKey}`);
  } catch (error) {
    console.error('[MediaCache] Error deleting cached media:', error);
    // Don't throw - cleanup errors shouldn't break functionality
  }
}

/**
 * Cleanup expired cache entries for a user
 * Call this periodically (e.g., on app startup)
 */
export async function cleanupExpiredCache(userId: string): Promise<number> {
  try {
    const cacheRef = collection(db, 'users', userId, 'mediaCache');
    const q = query(cacheRef, where('expiresAt', '<', Date.now()));
    const snap = await getDocs(q);
    
    let deletedCount = 0;
    for (const doc of snap.docs) {
      const data = doc.data() as CachedMedia;
      await deleteCachedMedia(userId, doc.id, data.storagePath);
      deletedCount++;
    }
    
    console.log(`[MediaCache] Cleaned up ${deletedCount} expired entries`);
    return deletedCount;
  } catch (error) {
    console.error('[MediaCache] Error cleaning up cache:', error);
    return 0;
  }
}

/**
 * Get cache statistics for a user
 */
export async function getCacheStats(userId: string): Promise<{
  totalItems: number;
  videoCount: number;
  imageCount: number;
  oldestItem: number | null;
  totalAccessCount: number;
}> {
  try {
    const cacheRef = collection(db, 'users', userId, 'mediaCache');
    const snap = await getDocs(cacheRef);
    
    let videoCount = 0;
    let imageCount = 0;
    let oldestItem: number | null = null;
    let totalAccessCount = 0;
    
    snap.docs.forEach(doc => {
      const data = doc.data() as CachedMedia;
      if (data.mediaType === 'video') videoCount++;
      if (data.mediaType === 'image') imageCount++;
      if (!oldestItem || data.createdAt < oldestItem) oldestItem = data.createdAt;
      totalAccessCount += data.accessCount || 0;
    });
    
    return {
      totalItems: snap.docs.length,
      videoCount,
      imageCount,
      oldestItem,
      totalAccessCount
    };
  } catch (error) {
    console.error('[MediaCache] Error getting stats:', error);
    return {
      totalItems: 0,
      videoCount: 0,
      imageCount: 0,
      oldestItem: null,
      totalAccessCount: 0
    };
  }
}

/**
 * Check if we should skip auto-generation for this concept
 * Returns true if:
 * - Concept is too short (< 5 chars)
 * - Concept looks like a chapter title (contains chapter-like words)
 * - Already cached
 */
export async function shouldSkipAutoGeneration(
  userId: string,
  concept: string,
  chapterId?: string
): Promise<{ skip: boolean; reason: string; cached?: CachedMedia }> {
  // Skip short concepts
  if (concept.length < 5) {
    return { skip: true, reason: 'Concept too short' };
  }
  
  // Skip chapter titles
  const chapterWords = ['chapter', 'introduction', 'overview', 'summary', 'contents', 'index'];
  const normalizedConcept = concept.toLowerCase();
  if (chapterWords.some(word => normalizedConcept.includes(word))) {
    return { skip: true, reason: 'Chapter title or introduction' };
  }
  
  // Check cache
  const cached = await checkMediaCache(userId, concept, chapterId, 'video');
  if (cached) {
    return { skip: true, reason: 'Already cached', cached };
  }
  
  return { skip: false, reason: 'Proceed with generation' };
}

export { generateCacheKey, normalizeTopicName };
