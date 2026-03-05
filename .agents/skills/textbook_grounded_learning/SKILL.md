---
name: Textbook Grounded Learning
description: Production-grade multimodal RAG tutor using uploaded STEM PDFs as the immutable source of truth, grounded via Vertex AI and hierarchical chapter navigation.
---

# Textbook Grounded Learning Skill

This skill enables Mama AI to act as a zero-hallucination private tutor grounded exclusively in the student's uploaded textbooks. It supports STEM subjects (Biology, Physics, Chemistry, Math) and provides interactive, chapter-specific guided learning.

## 1. Revised Architecture (Google AI Studio — No Vertex AI Required)

```
USER uploads PDF (mobile browser)
    │
    ▼
pdfjs-dist (client-side, no backend)
    → Extracts full plain text from the PDF
    │
    ▼
Gemini 3.1 Flash (Google AI Studio API)
    → Parses the extracted text into structured JSON:
       [{chapterIndex, title, summary, content}]
    │
    ▼
Firestore (mama-ai-487817)
    → Stores: {bookId, title, subject, chapters[]}
    │
    ▼
USER taps a Chapter
    │
    ▼
Gemini 3.1 Pro — Long-Context Grounding
    System Prompt: "You are a tutor. Your ONLY knowledge source is
    the text below. Do NOT use any external knowledge. Cite the
    section when you answer."
    [Chapter text injected here — up to 1M tokens context window]
    │
    ▼
Multimodal Output
    ├── Text / Voice response (grounded in chapter)
    ├── Nano Banana Pro 2 → Concept diagram (if visual needed)
    └── Google Veo → Procedural video (if temporal process)
```

## 2. PDF Ingestion Pipeline (Client-Side Only)

### Step 1: Text Extraction (pdfjs-dist)
- Load the uploaded PDF file in the browser using `pdfjs-dist`.
- Extract all page text sequentially into a single string.
- No server round-trip needed for this step.

### Step 2: Chapter Detection (Gemini 3.1 Flash)
Send the full extracted text to Gemini 3.1 Flash with this system instruction:

```
You are a textbook parser. Given the following raw text from a PDF textbook,
identify all chapters and major sections. Return ONLY a valid JSON array in
this exact format:
[
  {
    "chapterIndex": 1,
    "title": "Chapter Title",
    "summary": "One sentence summary",
    "content": "Full text of this chapter..."
  }
]
Do not include any explanation outside the JSON.
```

### Step 3: Subject & Grade Detection (Gemini 3.1 Flash)
In the same call, also infer:
- `subject`: "Physics" | "Chemistry" | "Biology" | "Math" | "Other STEM"
- `grade_level`: e.g., "Class 10", "High School", "Undergraduate"
- `language`: e.g., "English", "Spanish", "Hindi"

### Step 4: Firestore Storage
Save the structured result under:
```
/users/{userId}/textbooks/{bookId}/
  → title, subject, grade_level, language, uploadedAt
  → chapters[] (array of {chapterIndex, title, summary, content})
```

## 3. Chapter Tutoring — Grounding via Long Context

When the user opens a chapter, inject its `content` text directly into the
**Gemini 3.1 Pro system prompt**. This is the grounding mechanism — the model
can only answer based on what it finds in the injected text.

### Anti-Hallucination System Prompt Template:
```
You are Mama AI, a private tutor for the student.

YOUR EXCLUSIVE KNOWLEDGE SOURCE:
--- BEGIN TEXTBOOK CHAPTER ---
{chapterContent}
--- END TEXTBOOK CHAPTER ---

STRICT RULES:
1. ONLY answer using information from the chapter text above.
2. If the answer is not in the text, say: "This topic isn't covered in
   this chapter. Try checking the other chapters or your teacher."
3. Always cite where in the chapter you found the information
   (e.g., "As explained in the section on Newton's Second Law...").
4. For Math/Physics: retrieve formulas verbatim from the text.
   Never derive formulas from memory.
5. After each explanation, ask a follow-up question to test understanding.
```

## 4. Model Routing Rules

| Task                              | Primary Model       | Fallback           |
|----------------------------------|--------------------|--------------------|
| Chapter structure detection       | Gemini 3.1 Flash   | Gemini 3 Flash     |
| Subject / grade / language detect | Gemini 3.1 Flash   | Gemini 3 Flash     |
| Math / Physics step-by-step       | Gemini 3.1 Pro     | Gemini 3 Pro       |
| Biology / Chemistry concepts      | Gemini 3.1 Pro     | Gemini 3 Pro       |
| Voice interaction                 | Gemini 2.5 Pro     | N/A (required)     |
| Concept diagram generation        | Nano Banana Pro 2  | N/A                |
| Procedural video                  | Google Veo (≤8s)   | N/A                |

## 5. UI Navigation Structure

```
Bottom Nav: [ Home ] [ Sessions ] [ Books 📚 ] [ Settings ]

/books                → TextbookLibrary — Upload + list of books
                          Card per book: Subject icon, title, grade, # chapters
/books/:id            → TextbookDetail — Chapter tree
                          Chapter cards showing title + one-line summary
/books/:id/:chapter   → TutorChat — Full tutoring experience
                          Voice (Gemini 2.5 Pro Live) or text input
                          Chapter content injected as system context
```

## 6. Multilingual Support
- The agent understands questions in English, Spanish, Hindi, Mandarin, or Latin.
- Responses are in the student's **preferred language** (set in Settings profile).
- The textbook chapter content is always passed in its **original language**.
- Translation and response generation happen at the Gemini 3.1 Pro output step.

## 7. Key Constraints
- **API:** Google AI Studio Gemini API key (from `.env.local` → `GEMINI_API_KEY`).
- **GCP Project:** `mama-ai-487817` (`medguidanceai@gmail.com`).
- **No Backend Required** for PDF parsing — all extraction runs client-side via `pdfjs-dist`.
- **Security:** Firestore security rules must scope textbooks to the authenticated user's UID.
- **Context Limit:** If a chapter is extremely long (>800k tokens), split it into two halves and allow the user to choose "Part 1 / Part 2".

## 8. Dependencies to Install
```bash
npm install pdfjs-dist
```
No other new dependencies required — all AI calls use the existing `@google/genai` SDK.
