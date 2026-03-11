import { useState, useEffect, useRef } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { Volume2 } from 'lucide-react';

interface WhiteboardStepProps {
  stepNumber: number;
  math: string;
  explanation: string;
  decode: string;
  status: 'pending' | 'typing' | 'complete';
  onTypingComplete?: () => void;
  isCurrent: boolean;
  isHighlighted?: boolean;
  highlightedTerms?: string[]; // Terms to highlight in orange
}

// Natural typing speed - varies slightly for realistic effect
const getTypingDelay = () => {
  // Random delay between 15-35ms for natural variation
  return Math.floor(Math.random() * 20) + 15;
};

export default function WhiteboardStep({
  stepNumber,
  math,
  explanation,
  decode,
  status,
  onTypingComplete,
  isCurrent,
  isHighlighted = false,
  highlightedTerms = [],
}: WhiteboardStepProps) {
  const [displayedMath, setDisplayedMath] = useState('');
  const [displayedExplanation, setDisplayedExplanation] = useState('');
  const [showDecode, setShowDecode] = useState(false);
  const hasCompleted = useRef(false);
  const mathTypedRef = useRef(false);

  // Reset when status goes back to pending
  useEffect(() => {
    if (status === 'pending') {
      setDisplayedMath('');
      setDisplayedExplanation('');
      setShowDecode(false);
      hasCompleted.current = false;
      mathTypedRef.current = false;
    }
  }, [status]);

  // Instant display when already complete
  useEffect(() => {
    if (status === 'complete') {
      setDisplayedMath(math);
      setDisplayedExplanation(explanation);
      setShowDecode(true);
    }
  }, [status, math, explanation]);

  // Natural typing animation for math formula first, then explanation
  useEffect(() => {
    if (status !== 'typing') return;

    hasCompleted.current = false;
    mathTypedRef.current = false;
    setDisplayedMath('');
    setDisplayedExplanation('');
    setShowDecode(false);

    // Type math first, then explanation
    let mathIndex = 0;
    let explanationIndex = 0;
    
    const typeNextChar = () => {
      // Type math formula character by character
      if (!mathTypedRef.current && math) {
        if (mathIndex < math.length) {
          mathIndex++;
          setDisplayedMath(math.slice(0, mathIndex));
          setTimeout(typeNextChar, getTypingDelay());
          return;
        } else {
          mathTypedRef.current = true;
          // Small pause after math before starting explanation
          setTimeout(typeNextChar, 200);
          return;
        }
      }
      
      // Then type explanation
      if (explanation) {
        if (explanationIndex < explanation.length) {
          // Type words more naturally - sometimes 1 char, sometimes 2-3
          const chunkSize = Math.random() > 0.7 ? 2 : 1;
          explanationIndex = Math.min(explanationIndex + chunkSize, explanation.length);
          setDisplayedExplanation(explanation.slice(0, explanationIndex));
          setTimeout(typeNextChar, getTypingDelay());
          return;
        }
      }
      
      // Typing complete
      setShowDecode(true);
      if (!hasCompleted.current) {
        hasCompleted.current = true;
        onTypingComplete?.();
      }
    };

    // Start typing
    typeNextChar();

    return () => {
      // Cleanup handled by the recursive timeout pattern
    };
  }, [status, math, explanation]); // Re-run when status changes to 'typing'

  const renderMath = () => {
    if (!math) {
      return <span className="text-zinc-400 italic text-sm">Formula loading...</span>;
    }
    return <InlineMath math={displayedMath || math} errorColor="#dc2626" />;
  };

  // Render explanation with orange highlighting for key terms
  const renderExplanation = (text: string) => {
    if (!highlightedTerms || highlightedTerms.length === 0) {
      return text;
    }

    // Create a regex pattern that matches any of the highlighted terms
    const pattern = new RegExp(`(${highlightedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    
    const parts = text.split(pattern);
    return parts.map((part, i) => {
      const isHighlighted = highlightedTerms.some(term => 
        part.toLowerCase() === term.toLowerCase()
      );
      
      if (isHighlighted) {
        return (
          <span key={i} className="text-amber-600 font-semibold bg-amber-100/50 px-1 rounded">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Determine styling based on state
  const getContainerClasses = () => {
    const baseClasses = "relative transition-all duration-500 ease-out";
    
    if (isHighlighted) {
      return `${baseClasses} bg-amber-50/80 border-l-4 border-amber-500 pl-4 py-3 pr-3 rounded-r-xl`;
    }
    
    if (status === 'complete') {
      return `${baseClasses} border-l-2 border-zinc-200 pl-4 py-2 pr-3 opacity-70 hover:opacity-100 transition-opacity`;
    }
    
    if (status === 'typing') {
      return `${baseClasses} border-l-2 border-amber-400 pl-4 py-3 pr-3`;
    }
    
    return `${baseClasses} border-l-2 border-zinc-100 pl-4 py-2 pr-3 opacity-40`;
  };

  return (
    <div className={getContainerClasses()}>
      {/* Step indicator - small and subtle */}
      <div className="absolute -left-2.5 top-3 flex items-center justify-center">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
          isHighlighted
            ? 'bg-amber-500 text-white scale-110 shadow-md'
            : status === 'complete'
              ? 'bg-zinc-200 text-zinc-500'
              : status === 'typing'
                ? 'bg-amber-400 text-white animate-pulse'
                : 'bg-zinc-100 text-zinc-300'
        }`}>
          {status === 'typing' ? (
            <Volume2 size={10} className="animate-pulse" />
          ) : (
            stepNumber
          )}
        </div>
      </div>

      <div className="space-y-2">
        {/* Math formula - appears as if being written */}
        {math && (
          <div className={`text-zinc-800 text-lg overflow-x-auto transition-opacity duration-300 ${
            displayedMath || status === 'complete' ? 'opacity-100' : 'opacity-0'
          }`}>
            {renderMath()}
            {status === 'typing' && displayedMath.length < math.length && (
              <span className="inline-block w-0.5 h-5 bg-amber-500 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}

        {/* Explanation text - typewriter style with natural flow and orange highlighting */}
        {explanation && (
          <p className="text-zinc-600 text-sm leading-relaxed">
            {renderExplanation(displayedExplanation)}
            {status === 'typing' && displayedExplanation.length < explanation.length && (
              <span className="inline-block w-0.5 h-4 bg-amber-500 ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        )}

        {/* Decode/Note - appears after typing with subtle animation */}
        {decode && (
          <div className={`text-xs transition-all duration-500 ${
            showDecode ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            <span className="text-amber-600 font-semibold">Note: </span>
            <span className="text-zinc-500">{decode}</span>
          </div>
        )}
      </div>

      {/* Highlight overlay for referenced steps */}
      {isHighlighted && (
        <div className="absolute inset-0 bg-amber-100/20 rounded-r-xl animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
