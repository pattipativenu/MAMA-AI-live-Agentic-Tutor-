/**
 * sessionHeading.ts — Smart heading generation for sessions using Gemini 3
 * Generates contextual headings based on mode and conversation content
 */

import { GoogleGenAI, Type } from '@google/genai';
import { SessionMessage } from '../hooks/useSessions';

export interface HeadingResult {
  heading: string;
  topic: string;
}

/**
 * Generate a smart heading for a session based on mode and conversation
 * 
 * Mode-specific rules:
 * - Tutor: Extract chapter name (e.g., "Dual Nature of Radiation and Matter")
 * - Exam: Identify user's intention + topic (e.g., "Quick Recap: Semiconductor Physics")
 * - Lab: Identify specific experiment name (e.g., "Benedict's Test for Reducing Sugars")
 */
export async function generateSessionHeading(
  mode: 'tutor' | 'exam' | 'lab',
  messages: SessionMessage[]
): Promise<HeadingResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[sessionHeading] No API key available');
    return getFallbackHeading(mode, messages);
  }

  // Filter to only user and ai messages (not system)
  const conversationMessages = messages.filter(m => m.role !== 'system');
  if (conversationMessages.length === 0) {
    return getFallbackHeading(mode, messages);
  }

  // Build conversation transcript
  const transcript = conversationMessages
    .map(m => `${m.role.toUpperCase()}: ${m.text}`)
    .join('\n\n');

  try {
    const ai = new GoogleGenAI({ apiKey });

    const modeInstructions = {
      tutor: `You are analyzing a tutoring session transcript.
Extract the specific chapter name being discussed (e.g., "Dual Nature of Radiation and Matter", "Electrostatic Potential", "Chemical Bonding").
If no clear chapter is identified, use the topic being discussed.

Rules:
- Chapter names should be exact and specific
- Remove any markdown, asterisks, or formatting
- Keep it natural and readable
- Maximum 8 words`,

      exam: `You are analyzing an exam practice session transcript.
Identify:
1. The user's intention (Quick Recap / Revision / Preparation / Practice Test / Full Exam)
2. The topic being tested (e.g., "Semiconductor Physics", "Organic Chemistry", "Calculus")

Rules:
- Format: "[Intention]: [Topic]"
- Be specific about the topic
- Remove any markdown, asterisks, or formatting
- Maximum 8 words total`,

      lab: `You are analyzing a lab experiment session transcript.
Identify the specific experiment name (e.g., "Benedict's Test for Reducing Sugars", "Pendulum Oscillation", "Ohm's Law Verification", "Acid-Base Titration").

Rules:
- Use proper experiment names
- Include the specific test/technique if mentioned
- Remove any markdown, asterisks, or formatting
- Maximum 8 words`
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: `${modeInstructions[mode]}

CONVERSATION TRANSCRIPT:
${transcript}

Generate a concise, natural heading that accurately describes what this session was about.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            heading: { 
              type: Type.STRING,
              description: 'The main heading/title for this session'
            },
            topic: { 
              type: Type.STRING,
              description: 'The specific topic, chapter, or experiment name extracted'
            }
          },
          required: ['heading', 'topic'],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    
    if (result.heading && result.topic) {
      // Clean up any remaining markdown
      return {
        heading: cleanMarkdown(result.heading),
        topic: cleanMarkdown(result.topic),
      };
    }
  } catch (error) {
    console.error('[sessionHeading] Failed to generate heading:', error);
  }

  return getFallbackHeading(mode, messages);
}

/**
 * Clean markdown formatting from text
 */
function cleanMarkdown(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\*\*/g, '')  // Remove **
    .replace(/\*/g, '')   // Remove *
    .replace(/__/g, '')  // Remove __
    .replace(/_/g, '')   // Remove _
    .replace(/`/g, '')   // Remove `
    .replace(/#{1,6}\s?/g, '')  // Remove heading markers
    .replace(/\[|\]/g, '')  // Remove [ and ]
    .trim();
}

/**
 * Get a fallback heading when AI generation fails
 */
function getFallbackHeading(
  mode: 'tutor' | 'exam' | 'lab',
  messages: SessionMessage[]
): HeadingResult {
  const userMessages = messages.filter(m => m.role === 'user');
  const firstUserText = userMessages[0]?.text || '';
  
  // Try to extract a topic from first user message
  const topic = firstUserText
    .replace(/\*\*/g, '')
    .split('.')[0]  // First sentence
    .slice(0, 50);  // Max 50 chars

  const modeLabels = {
    tutor: 'Tutoring Session',
    exam: 'Exam Practice',
    lab: 'Lab Experiment',
  };

  return {
    heading: topic || modeLabels[mode],
    topic: topic || 'General Topic',
  };
}

/**
 * Check if a message is a system/internal message that shouldn't be displayed
 */
export function isSystemMessage(text: string): boolean {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  
  const systemPatterns = [
    /\*\*initiating\s+inquiry/i,
    /\*\*initiating\s+interaction/i,
    /\*\*initiating\s+a\s+warm\s+welcome/i,
    /\*\*confirming\s+chapter/i,
    /\*\*confirming\s+details/i,
    /\*\*testing/i,
    /initiating\s+inquiry\s*&?\s*testing/i,
    /initiating\s+interaction\s*sequence/i,
    /testing\s+connection/i,
    /establishing\s+role/i,
    /i've\s+established/i,
    /i\s+have\s+determined/i,
    /confirming\s+chapter\s*details/i,
    /i've\s+registered/i,
    /i've\s+gathered/i,
    /my\s+primary\s+focus/i,
  ];

  // Check if it starts with common system message patterns
  const startsWithSystem = 
    lowerText.startsWith('**initiating') ||
    lowerText.startsWith('**confirming') ||
    lowerText.startsWith('**testing');
  
  if (startsWithSystem) return true;
  
  return systemPatterns.some(pattern => pattern.test(lowerText));
}

/**
 * Filter out system messages from conversation
 */
export function filterSystemMessages(messages: SessionMessage[]): SessionMessage[] {
  return messages.filter(m => {
    // Keep user messages
    if (m.role === 'user') return true;
    
    // Filter AI messages that match system patterns
    if (m.role === 'ai' && isSystemMessage(m.text)) return false;
    
    // Filter explicitly marked system messages
    if (m.isSystemMessage) return false;
    
    return true;
  });
}

/**
 * Check if session has actual user communication
 */
export function hasUserCommunication(messages: SessionMessage[]): boolean {
  const nonSystemMessages = filterSystemMessages(messages);
  const userMessages = nonSystemMessages.filter(m => m.role === 'user');
  const aiMessages = nonSystemMessages.filter(m => m.role === 'ai');

  // Primary: has user speech (transcription arrived)
  if (userMessages.some(m => m.text.trim().length > 0)) return true;

  // Fallback 1: AI spoke 4+ times = real session definitely happened
  // (Gemini inputAudioTranscription may have failed but conversation was real)
  if (aiMessages.length >= 4) return true;
  
  // Fallback 2: AI sent a massive block of text (often happens when AI transcriptions get merged)
  if (aiMessages.some(m => m.text.length > 200)) return true;
  
  // Fallback 3: Media or whiteboard was generated/used (indicates real interaction)
  if (countMedia(messages) > 0 || hasWhiteboardUsage(messages)) return true;

  return false;
}

/**
 * Count media in session
 */
export function countMedia(messages: SessionMessage[]): number {
  return messages.filter(m => m.image || m.video).length;
}

/**
 * Check if whiteboard was used in session
 */
export function hasWhiteboardUsage(messages: SessionMessage[]): boolean {
  return messages.some(m => m.whiteboardStep || m.text.includes('[Whiteboard]'));
}
