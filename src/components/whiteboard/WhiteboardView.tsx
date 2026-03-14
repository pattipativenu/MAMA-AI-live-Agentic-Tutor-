import { useRef, useEffect, useCallback } from 'react';
import { WhiteboardState } from '../../types/whiteboard';
import WhiteboardStep from './WhiteboardStep';
import { Calculator, ChevronUp, ChevronDown } from 'lucide-react';

interface WhiteboardViewProps {
  whiteboardState: WhiteboardState;
  onStepComplete: (stepIndex: number) => void;
}

export default function WhiteboardView({ whiteboardState, onStepComplete }: WhiteboardViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { isActive, problemTitle, steps, currentStepIndex, highlightedStepIndex } = whiteboardState;

  const handleStepComplete = useCallback((index: number) => {
    onStepComplete(index);
  }, [onStepComplete]);

  // Auto-scroll to the currently active (typing) step or highlighted step
  useEffect(() => {
    const targetIndex = highlightedStepIndex ?? currentStepIndex;
    const el = stepRefs.current[targetIndex];
    if (el && scrollContainerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStepIndex, highlightedStepIndex]);

  const scrollUp = () => {
    scrollContainerRef.current?.scrollBy({ top: -200, behavior: 'smooth' });
  };

  const scrollDown = () => {
    scrollContainerRef.current?.scrollBy({ top: 200, behavior: 'smooth' });
  };

  if (!isActive && steps.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#faf9f5]">
      {/* Scrollable Steps Container - Natural flow like a notebook */}
      <div className="relative flex-1 min-h-0">
        {/* Scroll Up Button */}
        {steps.length > 3 && (
          <button
            onClick={scrollUp}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full shadow-sm flex items-center justify-center text-zinc-400 hover:text-amber-600 transition-colors border border-zinc-200/50"
          >
            <ChevronUp size={16} />
          </button>
        )}

        {/* Steps List - Notebook-like styling */}
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto px-4 py-4 space-y-1 scrollbar-hide"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* Top spacing */}
          <div className="h-2" />
          
          {steps.map((step, index) => (
            <div
              key={step.id}
              ref={el => { stepRefs.current[index] = el; }}
              className="py-2"
            >
              <WhiteboardStep
                stepNumber={index + 1}
                math={step.math}
                explanation={step.explanation}
                decode={step.decode}
                status={step.status}
                isCurrent={index === currentStepIndex}
                isHighlighted={index === highlightedStepIndex}
                onTypingComplete={() => handleStepComplete(index)}
              />
            </div>
          ))}

          {/* Bottom spacing for comfortable scrolling */}
          <div className="h-8" />
        </div>

        {/* Scroll Down Button */}
        {steps.length > 3 && (
          <button
            onClick={scrollDown}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full shadow-sm flex items-center justify-center text-zinc-400 hover:text-amber-600 transition-colors border border-zinc-200/50"
          >
            <ChevronDown size={16} />
          </button>
        )}

        {/* Gradient fades for scroll indication */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#faf9f5] to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#faf9f5] to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
