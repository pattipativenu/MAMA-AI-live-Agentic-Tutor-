/**
 * whiteboardParser.ts - Parse AI text stream for whiteboard markers
 * 
 * NEW SIMPLIFIED FORMAT:
 * [[WB:Problem Title]]
 * [[MATH:LaTeX formula]]
 * [[EXPLAIN:Explanation text]]
 * [[END]]
 * 
 * Also supports legacy format for backward compatibility
 */

import { WhiteboardStep, ParsedWhiteboardContent, WB_MARKERS } from '../types/whiteboard';

/**
 * Extract content between start marker and end delimiter
 */
function extractMarkerContent(text: string, startMarker: string, endDelimiter: string = ']]'): string | null {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) return null;
  
  const contentStart = startIndex + startMarker.length;
  const endIndex = text.indexOf(endDelimiter, contentStart);
  if (endIndex === -1) return null;
  
  return text.slice(contentStart, endIndex).trim();
}

/**
 * Detect whiteboard start with title
 * Supports both new format [[WB:Title]] and legacy [[WB_START:Title]]
 */
export function detectWhiteboardStart(text: string): { detected: boolean; title: string | null } {
  // Try new format first
  let title = extractMarkerContent(text, WB_MARKERS.START);
  if (title) {
    return { detected: true, title };
  }
  
  // Try legacy format
  title = extractMarkerContent(text, WB_MARKERS.LEGACY_START);
  if (title) {
    return { detected: true, title };
  }
  
  return { detected: false, title: null };
}

/**
 * Detect whiteboard end
 * Supports both [[END]] and legacy [[WB_END]]
 */
export function detectWhiteboardEnd(text: string): boolean {
  return text.includes(WB_MARKERS.END) || 
         text.includes(WB_MARKERS.LEGACY_END);
}

/**
 * Extract all math/explain pairs from text
 * Returns array of steps found
 */
function extractSteps(text: string): Array<{ math: string; explanation: string }> | null {
  const steps: Array<{ math: string; explanation: string }> = [];
  
  // Find all [[MATH:...]] markers
  let searchPos = 0;
  while (true) {
    const mathContent = extractMarkerContent(text.slice(searchPos), WB_MARKERS.MATH_START);
    if (!mathContent) break;
    
    // Find position after this math marker
    const mathStartIndex = text.indexOf(WB_MARKERS.MATH_START, searchPos);
    const mathEndIndex = text.indexOf(']]', mathStartIndex) + 2;
    
    // Look for [[EXPLAIN:...]] after this math
    const remainingText = text.slice(mathEndIndex);
    const explainContent = extractMarkerContent(remainingText, WB_MARKERS.EXPLAIN_START);
    
    steps.push({
      math: mathContent,
      explanation: explainContent || ''
    });
    
    searchPos = mathEndIndex;
    if (searchPos >= text.length) break;
  }
  
  return steps.length > 0 ? steps : null;
}

/**
 * Parse a single step from text
 * Returns the LAST complete step found (most recent)
 */
export function parseStep(text: string, stepIndex: number): WhiteboardStep | null {
  // Extract all steps
  const steps = extractSteps(text);
  if (!steps || steps.length === 0) return null;
  
  // Return the last (most recent) step
  const lastStep = steps[steps.length - 1];
  
  return {
    id: `step-${stepIndex}-${Date.now()}`,
    math: lastStep.math,
    explanation: lastStep.explanation,
    decode: '', // Simplified format doesn't require decode
    status: 'pending',
  };
}

/**
 * Main parser function - processes AI text chunk
 */
export function parseWhiteboardChunk(
  text: string, 
  currentState: { isActive: boolean; stepsCount: number }
): ParsedWhiteboardContent {
  const result: ParsedWhiteboardContent = {
    isWhiteboardStart: false,
    isWhiteboardEnd: false,
    problemTitle: null,
    newStep: null,
    displayText: text,
  };
  
  // Check for whiteboard start
  const startDetection = detectWhiteboardStart(text);
  if (startDetection.detected) {
    result.isWhiteboardStart = true;
    result.problemTitle = startDetection.title;
    
    // Remove start marker from display text
    const newMarkerIdx = text.indexOf(WB_MARKERS.START);
    const legacyMarkerIdx = text.indexOf(WB_MARKERS.LEGACY_START);
    
    if (newMarkerIdx !== -1) {
      const endIdx = text.indexOf(']]', newMarkerIdx);
      if (endIdx !== -1) {
        result.displayText = text.slice(0, newMarkerIdx) + text.slice(endIdx + 2);
      }
    } else if (legacyMarkerIdx !== -1) {
      const endIdx = text.indexOf(']]', legacyMarkerIdx);
      if (endIdx !== -1) {
        result.displayText = text.slice(0, legacyMarkerIdx) + text.slice(endIdx + 2);
      }
    }
  }
  
  // Check for whiteboard end
  if (detectWhiteboardEnd(text)) {
    result.isWhiteboardEnd = true;
    // Remove end marker from display text
    result.displayText = result.displayText
      .replace(WB_MARKERS.END, '')
      .replace(WB_MARKERS.LEGACY_END, '');
  }
  
  // Check for new step - but only if we have math markers
  const steps = extractSteps(text);
  if (steps && steps.length > currentState.stepsCount) {
    // We have a new step
    const newStepData = steps[currentState.stepsCount]; // Get the next step in sequence
    if (newStepData) {
      result.newStep = {
        id: `step-${currentState.stepsCount}-${Date.now()}`,
        math: newStepData.math,
        explanation: newStepData.explanation,
        decode: '',
        status: 'pending',
      };
    }
    
    // Remove all markers from display text
    result.displayText = cleanWhiteboardMarkers(result.displayText);
  }
  
  return result;
}

/**
 * Clean text by removing all whiteboard markers for display
 */
export function cleanWhiteboardMarkers(text: string): string {
  if (!text) return '';
  
  return text
    // New format markers
    .replace(/\[\[WB:[^\]]+\]\]/g, '')
    .replace(/\[\[MATH:[^\]]+\]\]/g, '')
    .replace(/\[\[EXPLAIN:[^\]]+\]\]/g, '')
    .replace(/\[\[END\]\]/g, '')
    // Legacy format markers
    .replace(/\[\[WB_START:[^\]]+\]\]/g, '')
    .replace(/\[\[WB_END\]\]/g, '')
    .replace(/\[\[STEP\]\]/g, '')
    .replace(/<math>.*?<\/math>/gs, '')
    .replace(/<explain>.*?<\/explain>/gs, '')
    .replace(/<decode>.*?<\/decode>/gs, '')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generate a readable text version of a step for chat history
 */
export function stepToChatMessage(step: WhiteboardStep, stepNumber: number): string {
  let message = `Step ${stepNumber}: ${step.math}\n\n`;
  if (step.explanation) {
    message += `${step.explanation}\n\n`;
  }
  if (step.decode) {
    message += `${step.decode}`;
  }
  return message.trim();
}
