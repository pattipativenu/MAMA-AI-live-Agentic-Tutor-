import React from 'react';
import { Sparkles } from 'lucide-react';

interface ThinkingIndicatorProps {
  isVisible: boolean;
  text?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ 
  isVisible, 
  text = 'Thinking' 
}) => {
  if (!isVisible) return null;

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-50/90 backdrop-blur-sm rounded-full border border-amber-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Sparkles size={16} className="text-amber-500 animate-pulse" />
      <span className="text-sm font-semibold text-amber-700">{text}</span>
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
    </div>
  );
};

export default ThinkingIndicator;
