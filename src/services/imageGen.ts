import { GoogleGenAI } from '@google/genai';

// Initialize the SDK using the Vite environment variable
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

/**
 * Enhanced prompt construction injecting the user's selected theme
 * and age/grade for pedagogical appropriateness.
 */
function buildImagePrompt(concept: string, theme: string, age: string): string {
  const themeStyles: Record<string, string> = {
    'realistic': 'highly realistic, photographic, extremely detailed diagram style',
    'space': 'futuristic sci-fi aesthetic, neon lights, deep space background, highly detailed',
    'anime': 'Studio Ghibli inspired anime style, vibrant colors, expressive shading',
    'historical': 'sepia-toned vintage sketchbook style, da Vinci notebook aesthetic, parchment background',
    'action': 'dynamic comic book action style, bold outlines, dramatic lighting'
  };

  const styleModifier = themeStyles[theme] || themeStyles['realistic'];
  const audienceContext = age ? `The diagram MUST be easy to understand for a student who is ${age}.` : '';

  return `
    Create an educational illustration demonstrating the scientific concept of: "${concept}".
    
    CRITICAL REQUIREMENTS:
    - Artistic Style: ${styleModifier}
    - ${audienceContext}
    - The image must clearly isolate the main conceptual subjects.
    - DO NOT include messy or illegible text natively in the generated image. Keep symbols clear.
    - Aspect Ratio: Wide (16:9) landscape format.
  `;
}

/**
 * Attempts to generate an image using a specific model name.
 */
async function attemptGeneration(modelName: string, prompt: string, resolution: string, aspectRatio: string): Promise<string> {
  console.log(`[ImageGen] Trying model: ${modelName}`);

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      // Note: The public Node SDK for GoogleGenAI passes these under generic config objects if supported by the model
      // We also send the prompt explicitly to define aspect ratios
    }
  });

  // Extract the base64 or URI depending on how the SDK parses the image response
  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData || p.fileData
  );

  if (imagePart?.inlineData?.data) {
    const mimeType = imagePart.inlineData.mimeType || 'image/png';
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
  } else if (imagePart?.fileData?.fileUri) {
    throw new Error(`Model returned a fileURI (${imagePart.fileData.fileUri}) rather than inline base64 data. We need base64 for direct browser rendering.`);
  }

  throw new Error(`Model ${modelName} returned successfully but contained no valid image data in parts array.`);
}

export interface ImageGenerationOptions {
  theme?: string;
  age?: string;
  resolution?: '512px' | '1K' | '2K' | '4K';
  aspectRatio?: string;
}

/**
 * Generates an educational image.
 * Primary: Nano Banana Pro (gemini-3-pro-image-preview)
 * Fallback: Nano Banana 2 (gemini-3.1-flash-image-preview)
 */
export async function generateEducationalImage(concept: string, options: ImageGenerationOptions = {}): Promise<string> {
  const {
    theme = 'realistic',
    age = '',
    resolution = '2K',
    aspectRatio = '16:9'
  } = options;
  const fullPrompt = buildImagePrompt(concept, theme, age);

  try {
    // Try Nano Banana Pro first
    return await attemptGeneration('gemini-3-pro-image-preview', fullPrompt, resolution, aspectRatio);
  } catch (proError) {
    console.warn(`[ImageGen] Nano Banana Pro failed. Falling back to Nano Banana 2...`, proError);
    try {
      // Fallback to Nano Banana 2
      return await attemptGeneration('gemini-3.1-flash-image-preview', fullPrompt, resolution, aspectRatio);
    } catch (error) {
      console.error(`[ImageGen] Both models failed. FINAL ERROR:`, error);
      throw new Error('Image generation pipeline failed. Please check your API usage limits.');
    }
  }
}
