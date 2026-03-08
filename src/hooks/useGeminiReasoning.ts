import { useState, useCallback } from 'react';
import { GoogleGenAI, Type, Schema } from '@google/genai';

export interface ConceptHook {
  term: string;
  description: string;
}

export interface EvaluationResponse {
  correct: string[];
  missing: string[];
  incorrect: string[];
  hooks: ConceptHook[];
}

export function useGeminiReasoning() {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluateTranscript = useCallback(async (transcript: string): Promise<EvaluationResponse | null> => {
    setIsEvaluating(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API Key is missing.');

      const ai = new GoogleGenAI({ apiKey });

      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          correct: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Concepts the student understood correctly.',
          },
          missing: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Important concepts the student failed to mention.',
          },
          incorrect: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Concepts the student got wrong.',
          },
          hooks: {
            type: Type.ARRAY,
            description:
              '3-5 memorable, visual hooks (analogies or mnemonic images) as memory anchors for missed/incorrect concepts.',
            items: {
              type: Type.OBJECT,
              properties: {
                term: {
                  type: Type.STRING,
                  description: 'Short capitalized keyword or acronym (e.g. "ACID", "NEWTON").',
                },
                description: {
                  type: Type.STRING,
                  description: 'One-sentence mnemonic or vivid analogy for the term.',
                },
              },
              required: ['term', 'description'],
            },
          },
        },
        required: ['correct', 'missing', 'incorrect', 'hooks'],
      };

      const systemInstruction = `
<system_instruction>
  <identity>
    <role>Expert Pedagogical Evaluator</role>
    <task>Analyze student transcripts, identify knowledge gaps, and generate memory hooks.</task>
  </identity>

  <rules>
    <rule>Evaluate the student's understanding strictly from the provided transcript.</rule>
    <rule>Output EXCLUSIVELY valid JSON matching the requested schema. No conversational filler.</rule>
  </rules>

  <output_requirements>
    <memory_hooks>
      Generate 3-5 memorable, visual hooks (analogies or mnemonic images) as mental anchors for
      concepts the student missed or got wrong. Each hook must have a short "term" keyword and a
      concise "description" mnemonic or analogy.
    </memory_hooks>
  </output_requirements>
</system_instruction>`.trim();

      // Primary: gemini-3.1-pro-preview  |  Fallback: gemini-3-pro-preview
      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [{ role: 'user', parts: [{ text: transcript }] }],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
          },
        });
      } catch (e: any) {
        console.warn('[useGeminiReasoning] Primary model failed, falling back to gemini-3-pro-preview...', e);
        response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: [{ role: 'user', parts: [{ text: transcript }] }],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
          },
        });
      }

      if (response?.text) {
        return JSON.parse(response.text) as EvaluationResponse;
      }
      throw new Error('Empty response from AI');
    } catch (err: any) {
      console.error('[useGeminiReasoning] Error evaluating transcript:', err);
      setError(err.message || 'Failed to evaluate student understanding.');
      return null;
    } finally {
      setIsEvaluating(false);
    }
  }, []);

  return { evaluateTranscript, isEvaluating, error };
}
