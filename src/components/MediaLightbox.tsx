import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface MediaLightboxProps {
  isOpen: boolean;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export default function MediaLightbox({
  isOpen,
  mediaUrl,
  mediaType,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: MediaLightboxProps) {
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowRight' && hasNext && onNext) {
      onNext();
    } else if (e.key === 'ArrowLeft' && hasPrev && onPrev) {
      onPrev();
    }
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = mediaType === 'image' ? 'image.png' : 'video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
      >
        <X size={24} />
      </button>

      {/* Download button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
        }}
        className="absolute top-4 right-16 z-10 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
      >
        <Download size={24} />
      </button>

      {/* Previous button */}
      {hasPrev && onPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {/* Next button */}
      {hasNext && onNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Media content */}
      <div 
        className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaType === 'image' ? (
          <img
            src={mediaUrl}
            alt="Full size"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        ) : (
          <video
            src={mediaUrl}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] rounded-lg"
          />
        )}
      </div>

      {/* Hint text */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
        Press ESC to close • Use arrow keys to navigate
      </div>
    </div>
  );
}
