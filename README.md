<div align="center">
<img width="1200" height="auto" alt="Mama AI Banner" src="./public/assets/Mama_ai_banner.png" />

# Mama AI: The Multimodal "Private Tutor"
**Built for the Google Gemini Live Agent Challenge**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![AI](https://img.shields.io/badge/AI-Gemini_Live_%2B_Gemini_3.1-0B57D0)](https://ai.google.dev/)
[![Image](https://img.shields.io/badge/Image-Nano_Banana_2_(Gemini_3.1_Flash_Image)-4C1)](https://ai.google.dev/gemini-api/docs/image-generation)
[![Video](https://img.shields.io/badge/Video-Veo_3_(silent_9%3A16)-8A2BE2)](https://deepmind.google/technologies/veo/)
[![Framework](https://img.shields.io/badge/Framework-React_%2B_Vite-646CFF)](https://vitejs.dev/)
[![Language](https://img.shields.io/badge/Language-TypeScript-3178C6)](https://www.typescriptlang.org/)
[![Backend](https://img.shields.io/badge/Backend-Firebase_(Auth%2FFirestore%2FStorage)-FFCA28)](https://firebase.google.com/)

**Server URL (Cloud Run / deploy)**: `<SET_ME_AFTER_DEPLOY>`  
**Local dev**: `http://localhost:3000`
</div>

## 🌟 Overview
Mama AI is not a generic input, typing input, output text chatbot. It is a multi-modal learning companion designed specifically for students. It moves far beyond the text box paradigm by allowing students to converse naturally with an AI tutor that can see, hear, respond, and generate dynamic visual diagrams or instructional videos (via Google Veo) on the fly to explain complex components.

The application is built on a responsive, mobile-first React architecture, making it feel like a native app where the student's camera, microphone, and touchscreen are the primary input modalities.

## 🗺️ System Diagram (Mermaid)

```mermaid
flowchart TB
  User((Student))
  MobileUI["MobileFirst UI (React+Vite)"]
  User --> MobileUI

  subgraph Modes["Learning Modes"]
    LabMode["Lab Mode"]
    ExamMode["Exam Mode"]
    TutorMode["Tutor Mode"]
  end

  MobileUI --> LabMode
  MobileUI --> ExamMode
  MobileUI --> TutorMode

  subgraph Live["Realtime Audio & Vision (Gemini Live API)"]
    useGeminiLive["useGeminiLive"]
    LiveModelLabExam["gemini-2.5-flash-native-audio-latest\n(Lab/Exam)"]
    LiveModelTutor["gemini-2.5-flash-native-audio-preview-12-2025\n(Tutor)"]
    Mic["Mic Audio (PCM16 16kHz)"]
    Cam["Camera Frames (JPEG 1fps)"]
    LiveOut["Audio Out (PCM 24kHz)\n+ Transcripts"]
  end

  LabMode --> useGeminiLive
  ExamMode --> useGeminiLive
  TutorMode --> useGeminiLive

  useGeminiLive --> LiveModelLabExam
  useGeminiLive --> LiveModelTutor
  Mic --> useGeminiLive
  Cam --> useGeminiLive
  useGeminiLive --> LiveOut

  subgraph Tools["Live Tools & Media"]
    Whiteboard["Whiteboard Tool Calls\n(add_step/highlight/clear)"]
    ImgTool["generate_image"]
    VidTool["generate_video"]
    ImgGen["Image Generation\n(gemini-3.1-flash-image-preview)"]
    VidGen["Video Generation\n(veo-3.0-generate-001,\ngenerateAudio=false,\naspectRatio=9:16)"]
  end

  useGeminiLive --> Whiteboard
  useGeminiLive --> ImgTool
  useGeminiLive --> VidTool
  ImgTool --> ImgGen
  VidTool --> VidGen

  subgraph Firebase["Firebase"]
    Auth["Auth"]
    Firestore["Firestore\nsessions/videoJobs/mediaCache"]
    Storage["Storage\ntextbooks/images/videos"]
  end

  useGeminiLive --> Auth
  useGeminiLive --> Firestore
  ImgGen --> Storage
  VidGen --> Storage
  VidGen --> Firestore

  subgraph Reasoning["Reasoning & Text"]
    TutorText["TutorChat Text\n(gemini-3.1-pro-preview)"]
    Eval["useGeminiReasoning\n(gemini-3.1-pro-preview\nfallback gemini-3-pro-preview)"]
    Cleanup["useSessions_cleanup\n(gemini-3.1-pro-preview)"]
    TextbookParse["useTextbookParser\n(gemini-3.1-flash-lite-preview)"]
    DiagramExtract["diagramExtractor\n(gemini-3.1-pro-preview\n+ text-embedding-004)"]
  end

  TutorMode --> TutorText
  ExamMode --> Eval
  LiveOut --> Cleanup
  TutorMode --> TextbookParse
  TutorMode --> DiagramExtract
  TextbookParse --> Firestore
  DiagramExtract --> Storage
```

```

## ✨ Core Features & Learning Modes

### 🔬 1. Lab Mode (Live Bidi-Streaming)
This is the heart of the "Beyond Text" experience. Utilizing the **Gemini Multimodal Live API (native audio)** via WebSockets, Lab Mode allows for natural, low-latency, bidirectional voice conversations.
- **Barge-in Support:** Students can interrupt Mama AI mid-sentence if they don't understand something.
- **Visual Context:** Students can toggle the camera to show Mama AI their physical homework, a science experiment array, or math equations on paper. The AI processes these video frames in real-time.
- **Dynamic Visual & Video Aids:** If Mama AI needs to explain a geometric shape or a physics vector, she automatically triggers a `generate_image` tool call to draw a custom diagram. She can also utilize **Google Veo** to generate instructional video clips on the fly to visually demonstrate complex, moving scientific principles natively on the student's screen.

### 📚 2. Textbook Grounded Learning
To completely eliminate AI hallucinations, we built a zero-BS "Textbook Grounded" feature.
- Students can seamlessly upload **PDFs or EPUBs** of their actual school textbooks.
- **Client-Side Extraction:** The app uses `pdfjs-dist` and `epubjs` to natively extract clean text from the book right in the browser.
- **Smart Chunking:** It sends a sample to Gemini 3.1 Flash to detect metadata (Subject, Grade Level).
- **Grounded Chat:** When a student opens a specific chapter, they enter a specialized chat where a strict system prompt forces **Gemini 3.1 Pro** to answer questions *only* using information found in that exact text chapter.

### ⚙️ 3. Personalized Student Profiles
Mama AI dynamically adjusts her teaching style based on the student's profile.
- She knows the student's age, grade, and gender.
- **Activity Grounding:** If the student's favorite hobby is "Basketball", Mama AI will automatically explain Physics projectile motion using basketball analogies.

## 🏗️ Technology Stack

- **Frontend Framework:** React 18, React Router DOM, Vite
- **Styling:** Tailwind CSS (Vanilla CSS approach for custom animations)
- **AI Integration:** 
  - `@google/genai` SDK
  - Live API (native audio) for real-time voice + vision frames.
  - REST API (`gemini-3.1-pro-preview`) for reasoning and grounded tutoring.
  - Image generation (`gemini-3.1-flash-image-preview`) for on-the-fly diagrams (9:16 portrait).
  - Video generation (**Veo 3**, silent 9:16) for instructional animations.
- **Backend / Database:** Google Firebase (Firestore, Storage, Auth)
- **Document Parsing:** `pdfjs-dist` (PDFs) and `epubjs` (EPUBs)

## 🚀 Run locally

**Prerequisites:** Node.js v18+

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Set your Environment Variables in `.env.local`:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here

   # Firebase Config (Required for Textbook Feature)
   VITE_FIREBASE_API_KEY=your_key
   VITE_FIREBASE_AUTH_DOMAIN=your_domain
   VITE_FIREBASE_PROJECT_ID=your_id
   VITE_FIREBASE_STORAGE_BUCKET=your_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender
   VITE_FIREBASE_APP_ID=your_app_id
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the app on your mobile device (on the same network) or simulate a mobile viewport in your desktop browser. Ensure you grant Microphone and Camera permissions when entering Lab Mode!
