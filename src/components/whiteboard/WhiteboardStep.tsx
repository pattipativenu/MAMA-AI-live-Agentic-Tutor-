import { useState, useEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { Check, Volume2 } from 'lucide-react';

interface WhiteboardStepProps {
  stepNumber: number;
  math: string;
  explanation: string;
  decode: string;
  status: 'pending' | 'typing' | 'complete';
  onTypingComplete?: () => void;
  isCurrent: boolean;
  isHighlighted?: boolean;
}

const TYPING_SPEED_MS = 22; // ms per character

export default function WhiteboardStep({
  stepNumber,
  math,
  explanation,
  decode,
  status,
  onTypingComplete,
  isCurrent,
  isHighlighted = false,
}: WhiteboardStepProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [showDecode, setShowDecode] = useState(false);
  const hasCompleted = useRef(false);

  // Reset when status goes back to pending/typing
  useEffect(() => {
    if (status === 'pending') {
      setDisplayedText('');
      setShowDecode(false);
      hasCompleted.current = false;
    }
  }, [status]);

  // Instant display when already complete
  useEffect(() => {
    if (status === 'complete') {
      setDisplayedText(explanation);
      setShowDecode(true);
    }
  }, [status, explanation]);

  // Self-contained typewriter animation when typing starts
  useEffect(() => {
    if (status !== 'typing') return;

    hasCompleted.current = false;
    setDisplayedText('');
    setShowDecode(false);

    if (!explanation) {
      // Nothing to type — complete immediately
      hasCompleted.current = true;
      onTypingComplete?.();
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      index++;
      setDisplayedText(explanation.slice(0, index));

      if (index >= explanation.length) {
        clearInterval(interval);
        setShowDecode(true);
        if (!hasCompleted.current) {
          hasCompleted.current = true;
          onTypingComplete?.();
        }
      }
    }, TYPING_SPEED_MS);

    return () => clearInterval(interval);
  }, [status]); // Only re-run when status changes to 'typing'

  const getBorderColor = () => {
    if (isHighlighted) return 'border-amber-500 ring-4 ring-amber-200';
    if (status === 'complete') return 'border-zinc-200';
    if (status === 'typing') return 'border-amber-400 ring-2 ring-amber-100';
    return 'border-zinc-100';
  };

  const getBgColor = () => {
    if (isHighlighted) return 'bg-amber-50/60';
    if (status === 'complete') return 'bg-zinc-50/50';
    return 'bg-white';
  };

  const getOpacity = () => {
    if (status === 'pending') return 'opacity-40';
    return 'opacity-100';
  };

  const showMath = status !== 'pending';

  const renderMath = () => {
    if (!math) {
      return <span className="text-zinc-400 italic text-sm">Formula loading...</span>;
    }
    return <InlineMath math={math} errorColor="#dc2626" />;
  };

  return (
    <div
      className={`relative rounded-xl border-2 p-4 transition-all duration-300 ${getBorderColor()} ${getBgColor()} ${getOpacity()}`}
    >
      {/* Step number badge */}
      <div className="absolute -top-3 left-4 flex items-center gap-1.5">
        <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
          isHighlighted
            ? 'bg-amber-500 text-white'
            : status === 'complete'
              ? 'bg-green-100 text-green-700'
              : status === 'typing'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-zinc-100 text-zinc-500'
        }`}>
          {status === 'complete' && !isHighlighted ? (
            <Check size={12} />
          ) : status === 'typing' ? (
            <Volume2 size={12} className="animate-pulse" />
          ) : null}
          Step {stepNumber}
        </div>
      </div>

      <div className="mt-2 space-y-3">
        {/* Math formula */}
        <div className={`bg-white rounded-lg p-3 border transition-all duration-300 ${
          showMath ? 'border-zinc-200 opacity-100' : 'border-zinc-100 opacity-0'
        }`}>
          <div className="text-zinc-800 text-lg overflow-x-auto">
            {showMath ? renderMath() : <span className="text-zinc-300">...</span>}
          </div>
        </div>

        {/* Explanation text — typewriter */}
        {explanation && (
          <p className="text-zinc-600 text-sm leading-relaxed min-h-[1.5em]">
            {displayedText}
            {status === 'typing' && displayedText.length < explanation.length && (
              <span className="inline-block w-0.5 h-4 bg-amber-500 ml-0.5 animate-pulse" />
            )}
          </p>
        )}

        {/* Decode — appears after typing */}
        {decode && (
          <div className={`text-xs transition-all duration-500 ${
            showDecode ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            <span className="text-amber-600 font-semibold">💡 What this means: </span>
            <span className="text-zinc-500">{decode}</span>
          </div>
        )}
      </div>
    </div>
  );
}
