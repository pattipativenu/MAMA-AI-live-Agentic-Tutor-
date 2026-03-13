/**
 * markdown.tsx - Enhanced markdown rendering with math support
 * Renders full markdown including headers, lists, bold, italic, and LaTeX math
 */
import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

/**
 * Parse and render markdown text with full formatting support
 * Handles headers, lists, bold, italic, inline code, and LaTeX math
 */
export function parseMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let listKey = 0;
  
  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="list-disc pl-5 space-y-1 my-3">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };
  
  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    
    // Handle empty lines
    if (!trimmed) {
      flushList();
      return;
    }
    
    // Handle horizontal rules
    if (/^---+$|^===+$|^\*\*\*+$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={`hr-${lineIndex}`} className="my-4 border-zinc-200" />);
      return;
    }
    
    // Handle headers
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    const h3Match = trimmed.match(/^###\s+(.+)$/);
    const h4Match = trimmed.match(/^####\s+(.+)$/);
    
    if (h1Match) {
      flushList();
      elements.push(
        <h1 key={`h1-${lineIndex}`} className="text-xl font-bold text-zinc-900 mt-6 mb-3">
          {renderInlineWithMath(h1Match[1], `h1-content-${lineIndex}`)}
        </h1>
      );
      return;
    }
    
    if (h2Match) {
      flushList();
      elements.push(
        <h2 key={`h2-${lineIndex}`} className="text-lg font-bold text-zinc-800 mt-5 mb-2">
          {renderInlineWithMath(h2Match[1], `h2-content-${lineIndex}`)}
        </h2>
      );
      return;
    }
    
    if (h3Match) {
      flushList();
      elements.push(
        <h3 key={`h3-${lineIndex}`} className="text-base font-bold text-zinc-800 mt-4 mb-2">
          {renderInlineWithMath(h3Match[1], `h3-content-${lineIndex}`)}
        </h3>
      );
      return;
    }
    
    if (h4Match) {
      flushList();
      elements.push(
        <h4 key={`h4-${lineIndex}`} className="text-sm font-bold text-zinc-700 mt-3 mb-1">
          {renderInlineWithMath(h4Match[1], `h4-content-${lineIndex}`)}
        </h4>
      );
      return;
    }
    
    // Handle list items (both * and -)
    const listMatch = trimmed.match(/^[\*\-]\s+(.+)$/);
    if (listMatch) {
      inList = true;
      listItems.push(
        <li key={`li-${lineIndex}`} className="text-sm text-zinc-700 leading-relaxed">
          {renderInlineWithMath(listMatch[1], `li-content-${lineIndex}`)}
        </li>
      );
      return;
    }
    
    // Handle numbered lists
    const numberedListMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedListMatch) {
      flushList();
      elements.push(
        <div key={`ol-${lineIndex}`} className="flex gap-2 text-sm text-zinc-700 my-1">
          <span className="font-medium text-zinc-500">{trimmed.match(/^(\d+)\./)?.[1]}.</span>
          <span>{renderInlineWithMath(numberedListMatch[1], `ol-content-${lineIndex}`)}</span>
        </div>
      );
      return;
    }
    
    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${lineIndex}`} className="text-sm text-zinc-700 leading-relaxed my-2">
        {renderInlineWithMath(trimmed, `p-content-${lineIndex}`)}
      </p>
    );
  });
  
  flushList();
  return elements;
}

/**
 * Render inline text with support for:
 * - Bold (**text**)
 * - Italic (*text* or _text_)
 * - Inline code (`code`)
 * - Inline math ($math$)
 * - Block math ($$math$$)
 */
function renderInlineWithMath(text: string, keyPrefix: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let index = 0;
  
  // Pattern to match block math first ($$...$$)
  const blockMathPattern = /\$\$([\s\S]*?)\$\$/g;
  
  // Pattern to match inline math ($...$) - matches content between single dollars
  const inlineMathPattern = /\$([^$]+?)\$/g;
  
  // Pattern to match bold (**text**)
  const boldPattern = /\*\*([^*]+)\*\*/g;
  
  // Pattern to match italic (*text* or _text_) - but not **
  const italicPattern = /(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)|_([^_]+)_/g;
  
  // Pattern to match inline code (`code`)
  const codePattern = /`([^`]+)`/g;
  
  // Find all special patterns and their positions
  const matches: Array<{
    type: 'blockMath' | 'inlineMath' | 'bold' | 'italic' | 'code';
    content: string;
    index: number;
    length: number;
  }> = [];
  
  let match;
  
  // Find block math
  while ((match = blockMathPattern.exec(text)) !== null) {
    matches.push({
      type: 'blockMath',
      content: match[1].trim(),
      index: match.index,
      length: match[0].length
    });
  }
  
  // Find inline math
  while ((match = inlineMathPattern.exec(text)) !== null) {
    // Check if it's not inside a block math we already found
    const isInsideBlock = matches.some(m => 
      m.type === 'blockMath' && 
      match.index >= m.index && 
      match.index < m.index + m.length
    );
    if (!isInsideBlock) {
      matches.push({
        type: 'inlineMath',
        content: match[1],
        index: match.index,
        length: match[0].length
      });
    }
  }
  
  // Find bold (but skip if inside math regions)
  while ((match = boldPattern.exec(text)) !== null) {
    const isInsideMath = matches.some(m => 
      (m.type === 'blockMath' || m.type === 'inlineMath') && 
      match.index >= m.index && 
      match.index < m.index + m.length
    );
    if (!isInsideMath) {
      matches.push({
        type: 'bold',
        content: match[1],
        index: match.index,
        length: match[0].length
      });
    }
  }
  
  // Find italic (but skip if inside math regions)
  while ((match = italicPattern.exec(text)) !== null) {
    const isInsideMath = matches.some(m => 
      (m.type === 'blockMath' || m.type === 'inlineMath') && 
      match.index >= m.index && 
      match.index < m.index + m.length
    );
    if (!isInsideMath) {
      matches.push({
        type: 'italic',
        content: match[1] || match[2],
        index: match.index,
        length: match[0].length
      });
    }
  }
  
  // Find code (but skip if inside math regions)
  while ((match = codePattern.exec(text)) !== null) {
    const isInsideMath = matches.some(m => 
      (m.type === 'blockMath' || m.type === 'inlineMath') && 
      match.index >= m.index && 
      match.index < m.index + m.length
    );
    if (!isInsideMath) {
      matches.push({
        type: 'code',
        content: match[1],
        index: match.index,
        length: match[0].length
      });
    }
  }
  
  // Sort matches by index
  matches.sort((a, b) => a.index - b.index);
  
  // Remove overlapping matches (keep the first one)
  const filteredMatches: typeof matches = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.index >= lastEnd) {
      filteredMatches.push(m);
      lastEnd = m.index + m.length;
    }
  }
  
  // Build the elements
  let lastIndex = 0;
  for (const m of filteredMatches) {
    // Add text before this match
    if (m.index > lastIndex) {
      elements.push(
        <span key={`${keyPrefix}-text-${index++}`}>
          {text.slice(lastIndex, m.index)}
        </span>
      );
    }
    
    // Add the matched element
    switch (m.type) {
      case 'blockMath':
        try {
          elements.push(
            <div key={`${keyPrefix}-blockmath-${index++}`} className="my-3 overflow-x-auto">
              <BlockMath math={cleanLatex(m.content)} />
            </div>
          );
        } catch (e) {
          elements.push(
            <span key={`${keyPrefix}-blockmath-error-${index++}`} className="font-mono text-xs bg-zinc-100 px-1 rounded">
              {m.content}
            </span>
          );
        }
        break;
        
      case 'inlineMath':
        try {
          elements.push(
            <span key={`${keyPrefix}-inlinemath-${index++}`}>
              <InlineMath math={cleanLatex(m.content)} />
            </span>
          );
        } catch (e) {
          elements.push(
            <span key={`${keyPrefix}-inlinemath-error-${index++}`} className="font-mono text-xs bg-zinc-100 px-1 rounded">
              {m.content}
            </span>
          );
        }
        break;
        
      case 'bold':
        elements.push(
          <strong key={`${keyPrefix}-bold-${index++}`} className="font-bold text-zinc-900">
            {m.content}
          </strong>
        );
        break;
        
      case 'italic':
        elements.push(
          <em key={`${keyPrefix}-italic-${index++}`} className="italic">
            {m.content}
          </em>
        );
        break;
        
      case 'code':
        elements.push(
          <code key={`${keyPrefix}-code-${index++}`} className="font-mono text-xs bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded">
            {m.content}
          </code>
        );
        break;
    }
    
    lastIndex = m.index + m.length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(
      <span key={`${keyPrefix}-text-end-${index++}`}>
        {text.slice(lastIndex)}
      </span>
    );
  }
  
  // If no matches, return the original text
  if (elements.length === 0) {
    elements.push(<span key={`${keyPrefix}-plain`}>{text}</span>);
  }
  
  return elements;
}

/**
 * Clean LaTeX content for KaTeX rendering
 */
function cleanLatex(latex: string): string {
  return latex
    .trim()
    .replace(/^>\s*/, '')          // Remove leading >
    .replace(/\\displaystyle\s*/g, '');  // Remove \displaystyle
}

/**
 * Enhanced React component to render markdown with math support
 */
interface MarkdownTextProps {
  text: string;
  className?: string;
}

export function MarkdownText({ text, className = '' }: MarkdownTextProps): React.ReactElement {
  const parsed = parseMarkdown(text);
  
  return (
    <div className={`markdown-content ${className}`}>
      {parsed}
    </div>
  );
}

/**
 * Legacy: Parse markdown bold syntax (**text**) - kept for backwards compatibility
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
    .replace(/\$\$[\s\S]*?\$\$/g, '') // Remove block math
    .replace(/\$[^$]*?\$/g, '') // Remove inline math
    .trim();
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
    /initiating\s+a\swarm\swelcome/i,
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
