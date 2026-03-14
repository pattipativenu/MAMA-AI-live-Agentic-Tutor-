/**
 * Diagram Extractor - Extracts, analyzes, and indexes diagrams from PDF textbooks
 * 
 * Uses page rendering + Gemini Vision bounding box detection (not XObject extraction)
 * to properly capture vector-based diagrams with labels and text overlays.
 */

import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI, Type } from '@google/genai';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';

// Configure PDF.js worker to use CDN to avoid Vite/Cloud Run .mjs MIME type issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || '';
};

/**
 * Bounding box coordinates (normalized 0-1)
 */
export interface BoundingBox {
  ymin: number; // Top
  xmin: number; // Left
  ymax: number; // Bottom
  xmax: number; // Right
}

/**
 * Raw diagram detection from Gemini Vision
 */
export interface DiagramDetection {
  boundingBox: BoundingBox;
  figureLabel: string;      // e.g., "FIGURE 9.25", "Fig. 1.2"
  figureNumber: string;     // e.g., "9.25", "1.2"
  caption: string;          // e.g., "A refracting telescope"
  concept: string;
  keyElements: string[];
}

/**
 * Processed diagram ready for storage
 */
export interface ProcessedDiagram {
  id: string;               // e.g., "book123-ch9-fig9.25"
  bookId: string;
  chapterIndex: number;
  pageNumber: number;
  figureNumber: string;     // "9.25"
  figureLabel: string;      // "FIGURE 9.25"
  caption: string;          // "A refracting telescope"
  subsection: string;       // e.g., "9.9.2"
  imageBase64: string;      // Cropped diagram image
  imageUrl?: string;        // Firebase Storage URL (after upload)
  concept: string;
  keywords: string[];
  keyElements: string[];
  description: string;
  educationalImportance: string;
  commonMisconceptions: string[];
  prerequisites: string[];
  embeddingText: string;    // For text-embedding-004
  embedding: number[];      // Vector embedding for search
}

/**
 * Render a PDF page to canvas at specified scale
 * This captures vector graphics, text labels, and diagrams as pixels
 */
export async function renderPageToCanvas(
  pdfPage: pdfjsLib.PDFPageProxy,
  scale: number = 2.0
): Promise<HTMLCanvasElement> {
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await pdfPage.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas as any
  }).promise;

  return canvas;
}

/**
 * Detect diagrams on a rendered page using Gemini Vision
 * Returns bounding boxes and metadata for each diagram found
 */
export async function detectDiagramsOnPage(
  pageCanvas: HTMLCanvasElement,
  pageNumber: number
): Promise<DiagramDetection[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No Gemini API key found');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Convert canvas to base64 PNG
  const imageBase64 = pageCanvas.toDataURL('image/png').split(',')[1];

  console.log(`[DiagramExtractor] Detecting diagrams on page ${pageNumber}...`);

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64
          }
        },
        {
          text: `
Analyze this textbook page (Page ${pageNumber}). Find ALL diagrams, figures, charts, illustrations, and schematic drawings.

For each diagram found, extract:

1. BOUNDING BOX: Coordinates [ymin, xmin, ymax, xmax] as ratios from 0 to 1
   - ymin: top edge (0 = top of page, 1 = bottom)
   - xmin: left edge (0 = left of page, 1 = right)
   - ymax: bottom edge
   - xmax: right edge

2. FIGURE LABEL: The exact label as printed (e.g., "FIGURE 9.25", "Fig. 1.2", "Figure 3")

3. FIGURE NUMBER: Just the number (e.g., "9.25", "1.2", "3")

4. CAPTION: The descriptive text after the figure label
   IMPORTANT: Separate the figure label from the caption text.
   Example: "FIGURE 9.25 A refracting telescope."
   - figureLabel: "FIGURE 9.25"
   - caption: "A refracting telescope."

5. CONCEPT: The main physics/chemistry/biology concept illustrated

6. KEY ELEMENTS: Array of visible components and labels (e.g., ["Objective lens", "f₀", "Light rays", "Eyepiece"])

Return ONLY a JSON array of diagrams. If no diagrams, return empty array [].

Example response format:
[
  {
    "boundingBox": {"ymin": 0.15, "xmin": 0.05, "ymax": 0.65, "xmax": 0.95},
    "figureLabel": "FIGURE 9.25",
    "figureNumber": "9.25",
    "caption": "A refracting telescope.",
    "concept": "Refracting telescope optical system",
    "keyElements": ["Objective lens O", "Eyepiece E", "Focal length f₀", "Focal length fₑ", "Light rays", "Principal axis"]
  }
]
`
        }
      ]
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          diagrams: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                boundingBox: {
                  type: Type.OBJECT,
                  properties: {
                    ymin: { type: Type.NUMBER },
                    xmin: { type: Type.NUMBER },
                    ymax: { type: Type.NUMBER },
                    xmax: { type: Type.NUMBER }
                  },
                  required: ['ymin', 'xmin', 'ymax', 'xmax']
                },
                figureLabel: { type: Type.STRING },
                figureNumber: { type: Type.STRING },
                caption: { type: Type.STRING },
                concept: { type: Type.STRING },
                keyElements: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ['boundingBox', 'figureLabel', 'figureNumber', 'caption', 'concept']
            }
          }
        },
        required: ['diagrams']
      }
    }
  });

  const result = JSON.parse(response.text || '{"diagrams": []}');
  const diagrams = result.diagrams || [];

  console.log(`[DiagramExtractor] Found ${diagrams.length} diagrams on page ${pageNumber}`);
  diagrams.forEach((d: DiagramDetection) => {
    console.log(`  - ${d.figureLabel}: ${d.caption}`);
  });

  return diagrams;
}

/**
 * Crop a diagram from the rendered page using bounding box coordinates
 * Adds padding to ensure labels aren't cut off
 */
export function cropDiagramFromPage(
  pageCanvas: HTMLCanvasElement,
  boundingBox: BoundingBox,
  padding: number = 0.05  // 5% padding
): string {
  const canvasWidth = pageCanvas.width;
  const canvasHeight = pageCanvas.height;

  // Convert normalized coordinates to pixels with padding
  const x = Math.max(0, (boundingBox.xmin - padding) * canvasWidth);
  const y = Math.max(0, (boundingBox.ymin - padding) * canvasHeight);
  const width = Math.min(
    canvasWidth - x,
    (boundingBox.xmax - boundingBox.xmin + 2 * padding) * canvasWidth
  );
  const height = Math.min(
    canvasHeight - y,
    (boundingBox.ymax - boundingBox.ymin + 2 * padding) * canvasHeight
  );

  // Create crop canvas
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.ceil(width);
  cropCanvas.height = Math.ceil(height);

  const ctx = cropCanvas.getContext('2d')!;
  ctx.drawImage(
    pageCanvas,
    Math.floor(x), Math.floor(y), Math.floor(width), Math.floor(height),
    0, 0, Math.ceil(width), Math.ceil(height)
  );

  // Return as base64 PNG
  return cropCanvas.toDataURL('image/png').split(',')[1];
}

/**
 * Deep analysis of a diagram using Gemini Vision
 * Extracts concepts, keywords, and educational metadata
 */
export async function analyzeDiagramDeep(
  diagramImageBase64: string,
  figureLabel: string,
  caption: string
): Promise<{
  description: string;
  concept: string;
  keywords: string[];
  educationalImportance: string;
  commonMisconceptions: string[];
  prerequisites: string[];
  embeddingText: string;
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No Gemini API key found');
  }

  const ai = new GoogleGenAI({ apiKey });

  console.log(`[DiagramExtractor] Analyzing ${figureLabel}...`);

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: diagramImageBase64
          }
        },
        {
          text: `
You are an expert STEM educator analyzing a textbook diagram for Indian students (Class 9-12, NCERT/CBSE curriculum).

Figure: "${figureLabel}"
Caption: "${caption}"

Analyze this diagram and provide:

1. DESCRIPTION (2-3 sentences): Detailed description of what the diagram shows

2. CONCEPT: The core physics/chemistry/biology concept illustrated

3. KEYWORDS (5-10 terms): Searchable keywords for finding this diagram
   Include: concept name, components, related formulas, alternative names

4. EDUCATIONAL_IMPORTANCE: Why this diagram matters for student learning

5. COMMON_MISCONCEPTIONS (2-3 items): What students often misunderstand

6. PREREQUISITES (2-3 items): What concepts should be understood first

7. EMBEDDING_TEXT: A comprehensive paragraph combining all of the above for semantic search

Return as JSON.
`
        }
      ]
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          concept: { type: Type.STRING },
          keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          educationalImportance: { type: Type.STRING },
          commonMisconceptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          prerequisites: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          embeddingText: { type: Type.STRING }
        },
        required: ['description', 'concept', 'keywords', 'educationalImportance', 'embeddingText']
      }
    }
  });

  const analysis = JSON.parse(response.text || '{}');

  console.log(`[DiagramExtractor] Analysis complete for ${figureLabel}`);
  console.log(`  Concept: ${analysis.concept}`);
  console.log(`  Keywords: ${analysis.keywords?.join(', ')}`);

  return {
    description: analysis.description || '',
    concept: analysis.concept || '',
    keywords: analysis.keywords || [],
    educationalImportance: analysis.educationalImportance || '',
    commonMisconceptions: analysis.commonMisconceptions || [],
    prerequisites: analysis.prerequisites || [],
    embeddingText: analysis.embeddingText || ''
  };
}

/**
 * Generate multimodal embedding for semantic search
 */
export async function generateEmbedding(text: string, imageBase64?: string): Promise<number[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No Gemini API key found');
  }

  const ai = new GoogleGenAI({ apiKey });

  const contents: any = imageBase64 ? {
    parts: [
      { text },
      { inlineData: { mimeType: 'image/png', data: imageBase64 } }
    ]
  } : text;

  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: contents
  });

  return result.embeddings[0].values;
}

/**
 * Upload diagram image to Firebase Storage
 */
export async function uploadDiagramImage(
  diagramId: string,
  userId: string,
  imageBase64: string
): Promise<string> {
  const storagePath = `users/${userId}/diagrams/${diagramId}.png`;
  const storageRef = ref(storage, storagePath);

  console.log(`[DiagramExtractor] Uploading ${diagramId} to Storage...`);

  await uploadString(storageRef, imageBase64, 'base64');
  const imageUrl = await getDownloadURL(storageRef);

  console.log(`[DiagramExtractor] Uploaded: ${imageUrl}`);

  return imageUrl;
}

/**
 * Store diagram metadata in Firestore with figure number tracking
 */
export async function storeDiagramMetadata(
  diagram: ProcessedDiagram,
  userId: string
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'diagrams', diagram.id);

  console.log(`[DiagramExtractor] Storing metadata for ${diagram.id}...`);

  await setDoc(docRef, {
    // IDs
    id: diagram.id,
    bookId: diagram.bookId,
    chapterIndex: diagram.chapterIndex,

    // Figure reference (CRITICAL for textbook navigation)
    figureNumber: diagram.figureNumber,
    figureLabel: diagram.figureLabel,
    pageNumber: diagram.pageNumber,
    subsection: diagram.subsection,

    // Content
    caption: diagram.caption,
    imageUrl: diagram.imageUrl,

    // AI Analysis
    concept: diagram.concept,
    keywords: diagram.keywords,
    keyElements: diagram.keyElements,
    description: diagram.description,
    educationalImportance: diagram.educationalImportance,
    commonMisconceptions: diagram.commonMisconceptions,
    prerequisites: diagram.prerequisites,

    // Search
    embedding: diagram.embedding,
    embeddingText: diagram.embeddingText,

    // Metadata
    createdAt: Date.now()
  });

  console.log(`[DiagramExtractor] Stored: ${diagram.figureLabel} (${diagram.pageNumber})`);
}

/**
 * Process all diagrams from a PDF chapter
 * Main entry point for diagram extraction pipeline
 */
export async function extractDiagramsFromChapter(
  chapterPdfFile: File,
  bookId: string,
  chapterIndex: number,
  userId: string,
  options: {
    scale?: number;
    onProgress?: (pageNum: number, totalPages: number, status: string) => void;
  } = {}
): Promise<ProcessedDiagram[]> {
  const { scale = 2.0, onProgress } = options;

  console.log(`[DiagramExtractor] Starting extraction for Chapter ${chapterIndex}`);

  const arrayBuffer = await chapterPdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const processedDiagrams: ProcessedDiagram[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(pageNum, pdf.numPages, `Rendering page ${pageNum}...`);

    const page = await pdf.getPage(pageNum);
    const canvas = await renderPageToCanvas(page, scale);

    onProgress?.(pageNum, pdf.numPages, `Detecting diagrams...`);

    // Detect diagrams on this page
    const detections = await detectDiagramsOnPage(canvas, pageNum);

    if (detections.length === 0) {
      console.log(`[DiagramExtractor] No diagrams on page ${pageNum}`);
      continue;
    }

    // Process each detected diagram
    for (let i = 0; i < detections.length; i++) {
      const detection = detections[i];
      onProgress?.(pageNum, pdf.numPages, `Analyzing ${detection.figureLabel}...`);

      // Crop diagram image
      const diagramImageBase64 = cropDiagramFromPage(canvas, detection.boundingBox);

      // Deep analysis
      const analysis = await analyzeDiagramDeep(
        diagramImageBase64,
        detection.figureLabel,
        detection.caption
      );

      // Generate embedding for search
      onProgress?.(pageNum, pdf.numPages, `Creating embedding...`);
      const embedding = await generateEmbedding(analysis.embeddingText, diagramImageBase64);

      // Create processed diagram object
      const diagramId = `${bookId}-ch${chapterIndex}-${detection.figureNumber.replace(/\./g, '_')}`;

      const processedDiagram: ProcessedDiagram = {
        id: diagramId,
        bookId: bookId,
        chapterIndex: chapterIndex,
        pageNumber: pageNum,
        figureNumber: detection.figureNumber,
        figureLabel: detection.figureLabel,
        caption: detection.caption,
        subsection: '', // Will be filled later from TOC
        imageBase64: diagramImageBase64,
        concept: analysis.concept,
        keywords: [...analysis.keywords, ...detection.keyElements],
        keyElements: detection.keyElements,
        description: analysis.description,
        educationalImportance: analysis.educationalImportance,
        commonMisconceptions: analysis.commonMisconceptions,
        prerequisites: analysis.prerequisites,
        embeddingText: analysis.embeddingText,
        embedding: embedding
      };

      // Upload to Firebase
      onProgress?.(pageNum, pdf.numPages, `Uploading ${detection.figureLabel}...`);
      processedDiagram.imageUrl = await uploadDiagramImage(diagramId, userId, diagramImageBase64);

      // Store metadata
      await storeDiagramMetadata(processedDiagram, userId);

      processedDiagrams.push(processedDiagram);
    }
  }

  console.log(`[DiagramExtractor] Complete! Processed ${processedDiagrams.length} diagrams`);

  return processedDiagrams;
}

/**
 * Calculate cosine similarity between two embeddings
 * Used for finding relevant diagrams
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default {
  renderPageToCanvas,
  detectDiagramsOnPage,
  cropDiagramFromPage,
  analyzeDiagramDeep,
  generateEmbedding,
  uploadDiagramImage,
  storeDiagramMetadata,
  extractDiagramsFromChapter,
  cosineSimilarity
};
