import { useState, useEffect, useRef } from 'react';

export interface CarouselSlide {
  id: string;
  type: 'image' | 'video' | 'text';
  url?: string;
  fallbackText?: string;
  narrationText: string;
  durationMs: number; // Mock audio duration
  skipped?: boolean;
}

export function useCarousel(slides: CarouselSlide[], autoAdvance: boolean = true) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0.0 to 1.0

  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const playheadRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());

  const currentSlide = slides[currentIndex];

  useEffect(() => {
    // Reset when slide changes
    playheadRef.current = 0;
    setProgress(0);
    lastUpdateRef.current = Date.now();
  }, [currentIndex]);

  useEffect(() => {
    if (!isPlaying) {
      if (progressInterval.current) clearInterval(progressInterval.current);
      return;
    }

    lastUpdateRef.current = Date.now();

    progressInterval.current = setInterval(() => {
      const now = Date.now();
      const dt = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      if (!currentSlide || currentSlide.skipped) return;

      playheadRef.current += dt;
      let newProgress = playheadRef.current / currentSlide.durationMs;
      
      if (newProgress >= 1) {
        newProgress = 1;
        setProgress(1);
        if (progressInterval.current) clearInterval(progressInterval.current);
        
        if (autoAdvance) {
          if (currentIndex < slides.length - 1) {
            setCurrentIndex(i => i + 1);
          } else {
            setIsPlaying(false); // Finished all slides
          }
        } else {
           setIsPlaying(false); // Pause at end of slide if auto-advance is off
        }
      } else {
        setProgress(newProgress);
      }
    }, 50); // 20fps updates for smooth progress bar

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [isPlaying, currentIndex, autoAdvance, currentSlide]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(i => i + 1);
      setIsPlaying(true);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setIsPlaying(true);
    }
  };

  return {
    currentIndex,
    currentSlide,
    isPlaying,
    progress,
    togglePlay,
    nextSlide,
    prevSlide,
    isFinished: currentIndex === slides.length - 1 && progress >= 1,
  };
}
