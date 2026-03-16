import { useState, useRef, useCallback } from 'react';

export type FacingMode = 'user' | 'environment';

export interface UseCameraOptions {
  onError?: (error: string) => void;
  onStart?: () => void;
  onStop?: () => void;
}

export function useCamera(options: UseCameraOptions = {}) {
  const { onError, onStart, onStop } = options;
  
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopVideo = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsVideoActive(false);
    setCameraError(null);
    onStop?.();
  }, [onStop]);

  const startVideo = useCallback(async (targetFacingMode: FacingMode = facingMode) => {
    setCameraError(null);
    
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 },
          facingMode: targetFacingMode,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        const videoElement = videoRef.current;
        videoElement.srcObject = stream;
        
        const playVideo = () => {
          videoElement.play().catch(err => {
            console.warn('[useCamera] video.play() failed:', err);
            const errorMsg = 'Camera started but video could not be displayed. Click the page and try again.';
            setCameraError(errorMsg);
            onError?.(errorMsg);
          });
        };

        if ('onloadedmetadata' in videoElement) {
          videoElement.onloadedmetadata = playVideo;
        } else {
          playVideo();
        }
      }

      streamRef.current = stream;
      setIsVideoActive(true);
      setFacingMode(targetFacingMode);
      onStart?.();
      
      return stream;
    } catch (err: any) {
      console.error('[useCamera] Failed to start video:', err);
      
      let errorMessage = 'Could not access camera';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another app. Please close other apps using the camera.';
      } else if (err.name === 'OverconstrainedError') {
        // Try fallback without facing mode constraint
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 15 },
            }
          });
          
          if (videoRef.current) {
            const videoElement = videoRef.current;
            videoElement.srcObject = fallbackStream;
            const playVideo = () => {
              videoElement.play().catch(() => {
                const msg = 'Fallback camera started but video could not be displayed.';
                setCameraError(msg);
                onError?.(msg);
              });
            };
            if ('onloadedmetadata' in videoElement) {
              videoElement.onloadedmetadata = playVideo;
            } else {
              playVideo();
            }
          }
          
          streamRef.current = fallbackStream;
          setIsVideoActive(true);
          setCameraError(null);
          onStart?.();
          return fallbackStream;
        } catch (fallbackErr) {
          errorMessage = 'Could not access any camera on this device.';
        }
      }
      
      setCameraError(errorMessage);
      onError?.(errorMessage);
      throw err;
    }
  }, [facingMode, onError, onStart]);

  const toggleVideo = useCallback(async () => {
    if (isVideoActive) {
      stopVideo();
    } else {
      await startVideo();
    }
  }, [isVideoActive, startVideo, stopVideo]);

  const switchCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    
    if (isVideoActive) {
      // Camera is active, switch it
      await startVideo(newFacingMode);
    } else {
      // Just update the mode for next time
      setFacingMode(newFacingMode);
    }
    
    return newFacingMode;
  }, [facingMode, isVideoActive, startVideo]);

  const getVideoElement = useCallback(() => videoRef.current, []);

  return {
    // State
    isVideoActive,
    cameraError,
    facingMode,
    
    // Refs
    videoRef,
    streamRef,
    
    // Actions
    startVideo,
    stopVideo,
    toggleVideo,
    switchCamera,
    getVideoElement,
    setCameraError,
  };
}
