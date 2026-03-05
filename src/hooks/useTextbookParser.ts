import { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';

export interface TextbookChapter {
    index: number;
    title: string;
    summary: string;
    storagePath: string; // Firebase Storage path to the .txt file
}

export interface Textbook {
    id: string;
    title: string;
    subject: 'Physics' | 'Chemistry' | 'Biology' | 'Math' | 'Other STEM';
    gradeLevel: string;
    language: string;
    numChapters: number;
    uploadedAt: number;
    chapters: TextbookChapter[];
}

const getApiKey = () => {
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
    return import.meta.env.VITE_GEMINI_API_KEY || '';
};

export function useTextbookParser() {
    const [isParsing, setIsParsing] = useState(false);
    const [parseProgress, setParseProgress] = useState('');
    const [textbooks, setTextbooks] = useState<Textbook[]>([]);
    const [isLoadingBooks, setIsLoadingBooks] = useState(false);

    /**
     * Load all books for the user from Firestore.
     * Uses localStorage as fallback if not authenticated.
     */
    const loadTextbooks = useCallback(async (userId?: string) => {
        setIsLoadingBooks(true);
        if (userId && db) {
            try {
                const col = collection(db, 'users', userId, 'textbooks');
                const snapshot = await getDocs(col);
                const books = snapshot.docs.map(d => d.data() as Textbook);
                setTextbooks(books.sort((a, b) => b.uploadedAt - a.uploadedAt));
            } catch (e) {
                console.error('Error loading textbooks from Firestore:', e);
                // Fall back to localStorage
                const saved = localStorage.getItem('mama_textbooks');
                if (saved) setTextbooks(JSON.parse(saved));
            }
        } else {
            const saved = localStorage.getItem('mama_textbooks');
            if (saved) setTextbooks(JSON.parse(saved));
        }
        setIsLoadingBooks(false);
    }, []);

    /**
     * Parse a PDF file into a structured Textbook with chapters.
     * 1. Uses pdfjs-dist to extract text (already done by caller).
     * 2. Sends to Gemini 3.1 Flash to detect chapters + metadata.
     * 3. Saves each chapter .txt to Firebase Storage.
     * 4. Saves metadata to Firestore.
     */
    const parseAndSave = useCallback(async (
        rawText: string,
        fileName: string,
        userId?: string,
        preParsedChapters?: any[]
    ): Promise<Textbook | null> => {
        const apiKey = getApiKey();
        if (!apiKey) {
            alert('No Gemini API key found. Check your .env.local file.');
            return null;
        }

        setIsParsing(true);
        setParseProgress('Analyzing book metadata with Mama AI...');

        try {
            const ai = new GoogleGenAI({ apiKey });

            // Limit text to first 500k chars to fit in flash context
            const truncated = rawText.slice(0, 500000);

            // If we already have the chapters natively (like from an EPUB), 
            // we just need Gemini to categorize the BOOK (Subject, Grade Level, etc.).
            const hasChapters = preParsedChapters && preParsedChapters.length > 0;

            const promptText = hasChapters
                ? `You are a textbook metadata parser. I have already extracted the chapters. 
Given the following sample text from the book:
1. Detect the subject (one of: Physics, Chemistry, Biology, Math, Other STEM).
2. Detect the grade level (e.g., "Class 8", "High School", "Undergraduate").
3. Detect the language (e.g., "English", "Spanish", "Hindi").
4. For the textbook title, use the filename hint: "${fileName}".

Return ONLY valid JSON with no extra text:
{
  "title": "string",
  "subject": "Physics|Chemistry|Biology|Math|Other STEM",
  "gradeLevel": "string",
  "language": "string",
  "chapters": []
}

RAW SAMPLE TEXT:
${truncated}`
                : `You are a textbook parser. Given the following raw text from a PDF textbook:
1. Identify all chapters or major sections.
2. Detect the subject (one of: Physics, Chemistry, Biology, Math, Other STEM).
3. Detect the grade level (e.g., "Class 8", "High School", "Undergraduate").
4. Detect the language (e.g., "English", "Spanish", "Hindi").
5. For the textbook title, use the filename hint: "${fileName}".

Return ONLY valid JSON with no extra text:
{
  "title": "string",
  "subject": "Physics|Chemistry|Biology|Math|Other STEM",
  "gradeLevel": "string",
  "language": "string",
  "chapters": [
    { "index": 0, "title": "string", "summary": "one sentence", "content": "full chapter text..." }
  ]
}

RAW TEXT:
${truncated}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-preview',
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: promptText }]
                    }
                ],
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            subject: { type: Type.STRING },
                            gradeLevel: { type: Type.STRING },
                            language: { type: Type.STRING },
                            chapters: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        index: { type: Type.INTEGER },
                                        title: { type: Type.STRING },
                                        summary: { type: Type.STRING },
                                        content: { type: Type.STRING },
                                    },
                                    required: ['index', 'title', 'summary', 'content'],
                                },
                            },
                        },
                        required: ['title', 'subject', 'gradeLevel', 'language', 'chapters'],
                    },
                },
            });

            const parsed = JSON.parse(response.text || '{}');

            // If we had pre-parsed chapters, use those instead of Gemini's.
            const finalChaptersData = hasChapters ? preParsedChapters : parsed.chapters;

            if (!finalChaptersData || finalChaptersData.length === 0) {
                throw new Error('No chapters detected. The file may not have clear chapter structure.');
            }

            const bookId = `book_${Date.now()}`;
            const chapters: TextbookChapter[] = [];

            // Upload each chapter's content to Firebase Storage (or localStorage fallback)
            for (let i = 0; i < finalChaptersData.length; i++) {
                const ch = finalChaptersData[i];
                setParseProgress(`Saving chapter ${i + 1} of ${finalChaptersData.length}...`);
                const storagePath = `users/${userId || 'anonymous'}/books/${bookId}/chapter-${ch.index}.txt`;

                if (userId && storage) {
                    try {
                        const storageRef = ref(storage, storagePath);
                        await uploadString(storageRef, ch.content);
                    } catch (e) {
                        // Fallback: store full content in localStorage for this chapter
                        localStorage.setItem(`mama_chapter_${bookId}_${ch.index}`, ch.content);
                    }
                } else {
                    localStorage.setItem(`mama_chapter_${bookId}_${ch.index}`, ch.content);
                }

                chapters.push({
                    index: ch.index,
                    title: ch.title,
                    summary: ch.summary,
                    storagePath,
                });
            }

            const textbook: Textbook = {
                id: bookId,
                title: parsed.title || fileName,
                subject: parsed.subject,
                gradeLevel: parsed.gradeLevel,
                language: parsed.language,
                numChapters: chapters.length,
                uploadedAt: Date.now(),
                chapters,
            };

            setParseProgress('Saving to your library...');

            // Save metadata to Firestore or localStorage
            if (userId && db) {
                try {
                    await setDoc(doc(db, 'users', userId, 'textbooks', bookId), textbook);
                } catch (e) {
                    console.error('Firestore save error:', e);
                    const existing = JSON.parse(localStorage.getItem('mama_textbooks') || '[]');
                    localStorage.setItem('mama_textbooks', JSON.stringify([textbook, ...existing]));
                }
            } else {
                const existing = JSON.parse(localStorage.getItem('mama_textbooks') || '[]');
                localStorage.setItem('mama_textbooks', JSON.stringify([textbook, ...existing]));
            }

            setTextbooks(prev => [textbook, ...prev]);
            return textbook;

        } catch (err: any) {
            console.error('Failed to parse textbook:', err);
            setParseProgress(`Error: ${err.message}`);
            return null;
        } finally {
            setIsParsing(false);
            setParseProgress('');
        }
    }, []);

    /**
     * Fetch a single chapter's content from Firebase Storage or localStorage.
     */
    const fetchChapterContent = useCallback(async (
        storagePath: string,
        bookId: string,
        chapterIndex: number,
        userId?: string
    ): Promise<string> => {
        if (userId && storage) {
            try {
                const storageRef = ref(storage, storagePath);
                const url = await getDownloadURL(storageRef);
                const res = await fetch(url);
                return await res.text();
            } catch (e) {
                console.error('Storage fetch failed, falling back to localStorage:', e);
            }
        }
        return localStorage.getItem(`mama_chapter_${bookId}_${chapterIndex}`) || '';
    }, []);

    /**
     * Delete a textbook and all its chapter files.
     */
    const deleteTextbook = useCallback(async (bookId: string, userId?: string) => {
        if (userId && db) {
            try {
                await deleteDoc(doc(db, 'users', userId, 'textbooks', bookId));
            } catch (e) {
                console.error('Firestore delete error:', e);
            }
        }
        // Clean localStorage entries
        const existing: Textbook[] = JSON.parse(localStorage.getItem('mama_textbooks') || '[]');
        localStorage.setItem('mama_textbooks', JSON.stringify(existing.filter(b => b.id !== bookId)));
        setTextbooks(prev => prev.filter(b => b.id !== bookId));
    }, []);

    return {
        textbooks,
        isParsing,
        parseProgress,
        isLoadingBooks,
        loadTextbooks,
        parseAndSave,
        fetchChapterContent,
        deleteTextbook,
    };
}
