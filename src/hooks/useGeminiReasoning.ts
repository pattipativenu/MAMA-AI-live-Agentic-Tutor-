import { useState, useCallback } from 'react';
import { GoogleGenAI, Type, Schema } from '@google/genai';

interface EvaluationResponse {
    correct: string[];
    missing: string[];
    incorrect: string[];
    hooks: string[];
}

export function useGeminiReasoning() {
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const evaluateTranscript = useCallback(async (transcript: string): Promise<EvaluationResponse | null> => {
        setIsEvaluating(true);
        setError(null);

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error("API Key is missing.");

            const ai = new GoogleGenAI({ apiKey });

            const responseSchema: Schema = {
                type: Type.OBJECT,
                properties: {
                    correct: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Concepts the student understood correctly."
                    },
                    missing: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Important concepts the student failed to mention."
                    },
                    incorrect: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Concepts the student got wrong."
                    },
                    hooks: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "3-5 memorable, visual hooks (analogies or mnemonic images) that will act as mental anchors for the student to remember the missing or incorrect concepts."
                    }
                },
                required: ["correct", "missing", "incorrect", "hooks"]
            };

            const systemInstruction = `
<system_instruction>
  <identity>
    <role>Expert Pedagogical Evaluator</role>
    <task>Analyze student transcripts, identify knowledge gaps, and generate memory hooks.</task>
  </identity>

  <rules>
    <rule>You must evaluate the student's understanding based strictly on the provided transcript.</rule>
    <rule>You must output your evaluation EXCLUSIVELY in valid JSON format according to the requested schema. No conversational filler text.</rule>
  </rules>
  
  <output_requirements>
    <memory_hooks>Generate 3-5 memorable, visual hooks (analogies or mnemonic images) that will act as mental anchors for the student to remember the concepts they missed or got incorrect.</memory_hooks>
  </output_requirements>
</system_instruction>
`.trim();

            // Attempt primary model first
            let response;
            try {
                response = await ai.models.generateContent({
                    model: 'gemini-3-pro-preview',
                    contents: [{ role: 'user', parts: [{ text: transcript }] }],
                    config: {
                        systemInstruction: systemInstruction,
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                        temperature: 0.2
                    }
                });
            } catch (e: any) {
                console.warn("[useGeminiReasoning] Primary model failed, falling back to gemini-2.5-pro...", e);
                response = await ai.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: [{ role: 'user', parts: [{ text: transcript }] }],
                    config: {
                        systemInstruction: systemInstruction,
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                        temperature: 0.2
                    }
                });
            }

            if (response && response.text) {
                return JSON.parse(response.text) as EvaluationResponse;
            }
            throw new Error("Empty response from AI");

        } catch (err: any) {
            console.error("[useGeminiReasoning] Error evaluating transcript:", err);
            setError(err.message || "Failed to evaluate student understanding.");
            return null;
        } finally {
            setIsEvaluating(false);
        }
    }, []);

    return { evaluateTranscript, isEvaluating, error };
}
