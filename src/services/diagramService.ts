/**
 * Diagram Service - Search, retrieval, and multimodal tutoring with diagrams
 * 
 * Provides semantic search for diagrams and builds multimodal contexts
 * for Gemini tutoring sessions with figure number referencing.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { generateEmbedding, cosineSimilarity } from '../utils/diagramExtractor';
import type { ProcessedDiagram } from '../utils/diagramExtractor';

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || '';
};

/**
 * Search for relevant diagrams using semantic similarity
 * Returns diagrams sorted by relevance to the query
 */
export async function searchDiagrams(
  searchQuery: string,
  bookId: string,
  chapterIndex?: number,
  userId?: string,
  maxResults: number = 5
): Promise<Array<ProcessedDiagram & { similarity: number }>> {
  if (!userId) {
    console.warn('[DiagramService] No userId provided');
    return [];
  }

  console.log(`[DiagramService] Searching diagrams for: "${searchQuery}"`);

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(searchQuery);

  // Build Firestore query
  let diagramsQuery = query(
    collection(db, 'users', userId, 'diagrams'),
    where('bookId', '==', bookId)
  );

  if (chapterIndex !== undefined) {
    diagramsQuery = query(
      diagramsQuery,
      where('chapterIndex', '==', chapterIndex)
    );
  }

  // Fetch all diagrams for this book/chapter
  const snapshot = await getDocs(diagramsQuery);
  const diagrams = snapshot.docs.map(doc => doc.data() as ProcessedDiagram);

  console.log(`[DiagramService] Found ${diagrams.length} total diagrams`);

  // Calculate similarity for each diagram
  const scoredDiagrams = diagrams.map(diagram => ({
    ...diagram,
    similarity: cosineSimilarity(queryEmbedding, diagram.embedding || [])
  }));

  // Sort by similarity and return top results
  const results = scoredDiagrams
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);

  console.log(`[DiagramService] Top results:`);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.figureLabel} (score: ${r.similarity.toFixed(3)})`);
  });

  return results;
}

/**
 * Get a specific diagram by figure number
 * Useful when you know exactly which figure you need
 */
export async function getDiagramByFigureNumber(
  figureNumber: string,
  bookId: string,
  userId?: string
): Promise<ProcessedDiagram | null> {
  if (!userId) return null;

  const diagramsQuery = query(
    collection(db, 'users', userId, 'diagrams'),
    where('bookId', '==', bookId),
    where('figureNumber', '==', figureNumber)
  );

  const snapshot = await getDocs(diagramsQuery);
  if (snapshot.empty) return null;

  return snapshot.docs[0].data() as ProcessedDiagram;
}

/**
 * Get all diagrams for a specific page
 * Useful for showing all figures on a page
 */
export async function getDiagramsByPage(
  pageNumber: number,
  bookId: string,
  userId?: string
): Promise<ProcessedDiagram[]> {
  if (!userId) return [];

  const diagramsQuery = query(
    collection(db, 'users', userId, 'diagrams'),
    where('bookId', '==', bookId),
    where('pageNumber', '==', pageNumber)
  );

  const snapshot = await getDocs(diagramsQuery);
  return snapshot.docs.map(doc => doc.data() as ProcessedDiagram);
}

/**
 * Get diagrams for a subsection
 * Useful for showing related figures
 */
export async function getDiagramsBySubsection(
  subsection: string,
  bookId: string,
  userId?: string
): Promise<ProcessedDiagram[]> {
  if (!userId) return [];

  const diagramsQuery = query(
    collection(db, 'users', userId, 'diagrams'),
    where('bookId', '==', bookId),
    where('subsection', '==', subsection)
  );

  const snapshot = await getDocs(diagramsQuery);
  return snapshot.docs.map(doc => doc.data() as ProcessedDiagram);
}

/**
 * Fetch diagram image as base64 for multimodal prompts
 */
export async function fetchDiagramAsBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Build a multimodal tutoring prompt with diagrams
 * This is the core function for diagram-aware tutoring
 */
export async function buildMultimodalTutoringContext(
  userQuestion: string,
  chapterText: string,
  relevantDiagrams: Array<ProcessedDiagram & { similarity?: number }>,
  studentProfile: {
    name: string;
    age: string;
    learningStyle: string;
    language: string;
  }
): Promise<{ parts: any[]; systemInstruction: string }> {
  // Build system instruction with textbook reference
  const systemInstruction = `
You are Mama AI, a warm and encouraging physics/chemistry tutor.

STUDENT PROFILE:
• Name: ${studentProfile.name}
• Grade: ${studentProfile.age}
• Learning Style: ${studentProfile.learningStyle}
• Preferred Language: ${studentProfile.language}

YOUR ROLE:
Guide the student through concepts using their textbook diagrams. You MUST:
1. Reference specific figure numbers and page numbers
2. Tell the student exactly where to look in their physical book
3. Point out specific visual elements in diagrams
4. Wait for student confirmation before explaining

TEXTBOOK REFERENCE PROTOCOL:
• Always start by telling the student which figure to look at
• Include page number and figure number
• Ask "Have you found it?" before explaining
• Point to specific labels and components

INSTRUCTIONS:
• Be warm, encouraging, and personal
• Use the student's name occasionally
• Only teach from the provided textbook content
• Reference diagrams by figure number
• Explain what the student is seeing in the diagram
• Ask follow-up questions to check understanding
• Respond in ${studentProfile.language}
`;

  // Build parts array with text and images
  const parts: any[] = [];

  // Main context text
  let mainText = `CHAPTER TEXT:\n${chapterText}\n\n`;
  mainText += `STUDENT QUESTION: ${userQuestion}\n\n`;

  // Add diagram references
  if (relevantDiagrams.length > 0) {
    mainText += `RELEVANT TEXTBOOK DIAGRAMS:\n`;
    relevantDiagrams.forEach((diagram, index) => {
      mainText += `${index + 1}. ${diagram.figureLabel} (Page ${diagram.pageNumber}): ${diagram.caption}\n`;
      mainText += `   Concept: ${diagram.concept}\n`;
      mainText += `   Key elements: ${diagram.keyElements.join(', ')}\n\n`;
    });
  }

  mainText += `
TUTORING APPROACH:
1. First, tell the student exactly which figure to look at in their book
2. Ask "Have you found Figure X on page Y?"
3. Once confirmed, explain what they see in the diagram
4. Point out specific labels and components
5. Connect the visual to the concept
`;

  parts.push({ text: mainText });

  // Add diagram images with explicit labeling
  for (const diagram of relevantDiagrams.slice(0, 3)) {
    try {
      const imageBase64 = await fetchDiagramAsBase64(diagram.imageUrl!);
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: imageBase64
        }
      });
      parts.push({
        text: `\n[DIAGRAM: ${diagram.figureLabel} - Page ${diagram.pageNumber} - "${diagram.caption}"]\n`
      });
    } catch (error) {
      console.warn(`[DiagramService] Failed to load image for ${diagram.figureLabel}:`, error);
    }
  }

  return { parts, systemInstruction };
}

/**
 * Generate student guidance text for finding a diagram
 */
export function generateDiagramGuidance(
  diagram: ProcessedDiagram,
  bookTitle: string
): string {
  return `
📖 **Find this diagram in your ${bookTitle}:**

• **Figure:** ${diagram.figureLabel}
• **Page:** ${diagram.pageNumber}
• **Caption:** "${diagram.caption}"
${diagram.subsection ? `• **Section:** ${diagram.subsection}` : ''}

Please turn to page ${diagram.pageNumber} in your book and find ${diagram.figureLabel}.

Have you found it? Let me know when you're ready!
`;
}

/**
 * Generate an explanation of a diagram
 */
export function generateDiagramExplanation(
  diagram: ProcessedDiagram,
  includeElements: boolean = true
): string {
  let explanation = `
Looking at **${diagram.figureLabel}** - "${diagram.caption}"...

${diagram.description}

`;

  if (includeElements && diagram.keyElements.length > 0) {
    explanation += `**Key elements in the diagram:**\n`;
    diagram.keyElements.forEach(element => {
      explanation += `• ${element}\n`;
    });
    explanation += '\n';
  }

  explanation += `**Why this matters:** ${diagram.educationalImportance}`;

  return explanation;
}

/**
 * Generate enhanced 3D version of a diagram using Nano Banana
 */
export async function generateEnhanced3DDiagram(
  originalDiagram: ProcessedDiagram,
  studentAge: string
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  try {
    // Fetch original diagram
    const imageBase64 = await fetchDiagramAsBase64(originalDiagram.imageUrl!);

    // Build enhancement prompt
    const enhancementPrompt = `
Create a high-quality 3D rendered educational illustration based on this textbook diagram.

ORIGINAL CONCEPT: ${originalDiagram.concept}
CAPTION: ${originalDiagram.caption}
KEY ELEMENTS: ${originalDiagram.keyElements.join(', ')}

REQUIREMENTS:
• Create a realistic 3D visualization of the same concept
• Show all key components clearly
• Use accurate physics/scientific representation
• Style: Clean, educational, photorealistic 3D render
• Lighting: Soft studio lighting with clear shadows
• Background: Neutral gradient
• NO text labels in the image

STUDENT LEVEL: ${studentAge}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64
          }
        },
        { text: enhancementPrompt }
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    });

    // Extract generated image
    const generatedImage = response.candidates?.[0]?.content?.parts?.find(
      part => part.inlineData
    )?.inlineData?.data;

    return generatedImage || null;
  } catch (error) {
    console.error('[DiagramService] Failed to generate 3D diagram:', error);
    return null;
  }
}

/**
 * Generate video animation explaining a diagram
 */
export async function generateDiagramAnimation(
  originalDiagram: ProcessedDiagram,
  userId: string,
  sessionId: string
): Promise<{ videoUrl?: string; status: string; slideId?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { status: 'error' };

  try {
    // Build animation prompt with strict physics rules
    const videoPrompt = `
Educational animation: ${originalDiagram.concept}

BASED ON DIAGRAM: ${originalDiagram.figureLabel} - "${originalDiagram.caption}"

CRITICAL PHYSICS/SCIENCE RULES (must be accurate):
${originalDiagram.keyElements.map(e => `• ${e}`).join('\n')}

STRICT CONSTRAINTS:
• Maintain scientific accuracy
• Show processes step-by-step
• Use arrows to indicate direction
• No artistic distortion of physics laws
• Silent (no audio), no text overlays

ANIMATION STYLE:
• Clean, educational schematic animation
• 8 seconds duration
• 9:16 vertical format for mobile
• Smooth, clear movements
• Focus on the concept being illustrated
`;

    // Import video generation service
    const { startVideoGenerationJob } = await import('./videoGen');

    const slideId = `diagram-anim-${originalDiagram.id}-${Date.now()}`;
    await startVideoGenerationJob(
      videoPrompt,
      userId,
      sessionId,
      slideId,
      {
        theme: 'realistic',
        age: '',
        aspectRatio: '9:16'
      }
    );

    return { status: 'generating', slideId };
  } catch (error) {
    console.error('[DiagramService] Failed to generate animation:', error);
    return { status: 'error' };
  }
}

export default {
  searchDiagrams,
  getDiagramByFigureNumber,
  getDiagramsByPage,
  getDiagramsBySubsection,
  fetchDiagramAsBase64,
  buildMultimodalTutoringContext,
  generateDiagramGuidance,
  generateDiagramExplanation,
  generateEnhanced3DDiagram,
  generateDiagramAnimation
};
