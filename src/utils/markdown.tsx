/**
 * markdown.tsx - Simple markdown rendering utilities
 * Renders **bold** text as actual bold elements, removes *asterisks* from display
 */
import React from 'react';

/**
 * Parse markdown bold syntax (**text**) and return array of text/bold segments
 */
export function parseMarkdownBold(text: string): Array<{ type: 'text' | 'bold'; content: string }> {
  if (!text) return [];
  
  const segments: Array<{ type: 'text' | 'bold'; content: string }> = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before the bold
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }
    
    // Add the bold content (without the asterisks)
    segments.push({
      type: 'bold',
      content: match[1]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last bold
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }
  
  // If no matches, return the whole text
  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }
  
  return segments;
}

/**
 * Remove markdown syntax but preserve the text
 * Use when you want clean text without any formatting
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')  // Remove **
    .replace(/\*/g, '')    // Remove *
    .replace(/__/g, '')    // Remove __
    .replace(/_/g, '')     // Remove _
    .replace(/`/g, '')     // Remove `
    .trim();
}

/**
 * React component to render text with markdown bold support
 */
interface MarkdownTextProps {
  text: string;
  className?: string;
  boldClassName?: string;
}

export function MarkdownText({ text, className = '', boldClassName = 'font-bold' }: MarkdownTextProps): React.ReactElement {
  const segments = parseMarkdownBold(text);
  
  return (
    <span className={className}>
      {segments.map((segment, index) => (
        segment.type === 'bold' ? (
          <span key={index} className={boldClassName}>
            {segment.content}
          </span>
        ) : (
          <span key={index}>{segment.content}</span>
        )
      ))}
    </span>
  );
}

/**
 * Clean up session summary for display
 * - Strips markdown
 * - Truncates if needed
 * - Returns clean readable text
 */
export function cleanSessionSummary(text: string, maxLength: number = 60): string {
  if (!text) return 'Study Session';
  
  // First strip all markdown
  let clean = stripMarkdown(text);
  
  // Remove common system message prefixes
  const systemPrefixes = [
    /initiating\s+inquiry\s*&?\s*testing/i,
    /initiating\s+interaction\s*sequence/i,
    /confirming\s+chapter\s*details/i,
    /initiating\s+a\s+warm\s+welcome/i,
    /testing\s+connection/i,
    /establishing\s+role/i,
  ];
  
  // Check if it's a system message - if so, return a generic fallback
  const isSystem = systemPrefixes.some(pattern => pattern.test(clean));
  if (isSystem) {
    return 'Study Session';
  }
  
  // Truncate if too long
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength).trim() + '...';
  }
  
  return clean || 'Study Session';
}
