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

  // Auto-scroll to the currently active (typing) step
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
    <div className="w-full h-full flex flex-col">
      {/* Problem Header */}
      <div className="flex items-center gap-3 px-1 mb-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <Calculator size={20} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Solving
          </p>
          <h3 className="text-base font-bold text-zinc-800 leading-tight truncate">
            {problemTitle}
          </h3>
        </div>
        {steps.length > 0 && (
          <div className="text-xs font-medium text-zinc-400 bg-zinc-100 px-2.5 py-1 rounded-full shrink-0">
            {Math.max(1, Math.min(currentStepIndex + 1, steps.length))} / {steps.length}
          </div>
        )}
      </div>

      {/* Scrollable Steps Container */}
      <div className="relative flex-1 min-h-0">
        {/* Scroll Up Button */}
        <button
          onClick={scrollUp}
          className="absolute top-0 left-1/2 -translate-x-1/2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center text-zinc-400 hover:text-amber-600 transition-colors"
        >
          <ChevronUp size={18} />
        </button>

        {/* Steps List */}
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto px-1 py-2 space-y-4 scrollbar-hide"
          style={{ scrollBehavior: 'smooth' }}
        >
          {steps.map((step, index) => (
            <div
              key={step.id}
              ref={el => { stepRefs.current[index] = el; }}
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

          {/* Spacer */}
          <div className="h-8" />
        </div>

        {/* Scroll Down Button */}
        <button
          onClick={scrollDown}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center text-zinc-400 hover:text-amber-600 transition-colors"
        >
          <ChevronDown size={18} />
        </button>

        {/* Gradient fades */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#faf9f5] to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#faf9f5] to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
