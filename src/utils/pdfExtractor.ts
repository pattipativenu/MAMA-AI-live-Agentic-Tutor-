import * as pdfjsLib from 'pdfjs-dist';

// Point the worker at the CDN to avoid Vite/Cloud Run .mjs MIME type issues in production
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Extracts all text from a PDF File object.
 * Runs entirely client-side — no server round-trip.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pageTexts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
            .map((item: any) => ('str' in item ? item.str : ''))
            .join(' ');
        // Inject page markers so Gemini can accurately reference diagrams by page number
        pageTexts.push(`\n--- PAGE ${i} ---\n${pageText}`);
    }

    return pageTexts.join('\n');
}
