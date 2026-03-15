<div align="center">
<img width="1200" height="auto" alt="Mama AI Banner" src="./public/assets/Mama_ai_banner.png" />

# Mama AI: The Multimodal "Private Tutor"
**Built for the Google Gemini Live Agent Challenge**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![AI](https://img.shields.io/badge/AI-Gemini_3.1_Pro_%2B_Gemini_2.5-0B57D0)](https://ai.google.dev/)
[![Image](https://img.shields.io/badge/Image-Nano_Banana_2_(Gemini_3.1_Flash_Image)-4C1)](https://ai.google.dev/gemini-api/docs/image-generation)
[![Video](https://img.shields.io/badge/Video-Veo_3.1_Fast-8A2BE2)](https://deepmind.google/technologies/veo/)
[![Embedding](https://img.shields.io/badge/Embedding-Gemini_Embedding_2-FF6F00)](https://ai.google.dev/gemini-api/docs/embeddings)
[![Framework](https://img.shields.io/badge/Framework-React_%2B_Vite-646CFF)](https://vitejs.dev/)
[![Language](https://img.shields.io/badge/Language-TypeScript-3178C6)](https://www.typescriptlang.org/)
[![Backend](https://img.shields.io/badge/Backend-Firebase_(Auth%2FFirestore%2FStorage)-FFCA28)](https://firebase.google.com/)
[![Cloud Run](https://img.shields.io/badge/Cloud_Run-Deployed-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com/run)
[![Cloud Storage](https://img.shields.io/badge/Cloud_Storage-Media_Cache-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com/storage)

**☁️ Cloud Run URL**: [https://mama-ai-service-972465918951.us-central1.run.app](https://mama-ai-service-972465918951.us-central1.run.app)  
</div>

## 🌟 Overview

Mama AI is a **voice-first, multimodal AI tutor** that transforms how students learn STEM subjects. Built for the Google Gemini Live Agent Challenge, it goes far beyond traditional chatbots by offering:

- 🎙️ **Natural Voice Conversations** - Talk to Mama AI like a human tutor using the Gemini Live API
- 👁️ **Vision-Enabled Learning** - Show her your homework, diagrams, or experiments via camera
- 🎨 **Dynamic Visual Generation** - Auto-generates custom diagrams (Nano Banana pro 2) and animations (Veo 3.1) on demand
- 📚 **Textbook-Grounded RAG** - Upload your actual textbooks; Mama AI answers strictly from your materials

### Why Mama AI?

Traditional ed-tech forces students to type questions into a search box. Mama AI eliminates the keyboard entirely—students speak naturally, interrupt freely, and receive personalized visual explanations that bridge the gap between abstract concepts and real-world understanding.

### ⚡ At a Glance

| Category | What We Built |
|----------|---------------|
| **Challenge Category** | Live Agents 🗣️ (Audio/Vision) |
| **Core Tech** | Gemini Live API + Gemini 3.1 Pro + Firebase + Cloud Run |
| **Key Differentiator** | Textbook-grounded RAG for curriculum-aligned responses |
| **Visual Generation** | Nano Banana 2 (images) + Veo 3.1 Fast (videos) |
| **Learning Modes** | Lab → Tutor → Exam → Notes |
| **Storage** | Firestore (data) + Cloud Storage (media) |

## 🗺️ System Architecture Diagram

> **📋 Judge Note:** This section provides the **clear visual representation of the system** as required by the submission guidelines. It shows how **Gemini connects to the backend (Firebase), database (Firestore), and frontend (React)**.

### Architecture Overview

```mermaid
---
config:
  layout: elk
  look: neo
  theme: neo
---
flowchart TB

    %% -- USER & FRONTEND --
    subgraph Client["📱 Frontend (React + Vite)"]
        UI["🎛️ Mobile-First UI\n(Tailwind CSS)"]
        AudioVideoIO["🎤 Mic / 📷 Camera / 🔊 Speaker\nWebRTC & MediaDevices API"]
        Whiteboard["✍️ Interactive Whiteboard\nRendered via LaTeX"]
        MediaGallery["🖼️ Media Gallery\nDisplays Gen-AI Assets"]
    end

    %% -- REAL-TIME CORE --
    subgraph LiveCore["⚡ Real-Time Conversational Core"]
        LiveHook["🔌 useGeminiLive.ts\n(WebSocket Manager)"]
        LiveModel["🤖 Gemini Live API\nModel: gemini-2.5-flash-native-audio-preview-12-2025\nHandles: Voice, Vision, & Tool Calling"]
    end

    %% -- GENERATIVE TOOLS & AGENTS --
    subgraph GenAI["🎨 Generative AI Engines & Tools"]
        ImgModel["🖼️ Image Generation\nModel: gemini-3.1-flash-image-preview\n(Nano Banana 2) - 9:16 aspect"]
        VidModel["🎬 Video Generation\nModel: veo-3.1-fast-generate-preview\n(Veo 3.1 Fast) - 8s animations"]
        ReasoningModel["🧠 Reasoning & Summarization\nModel: gemini-3.1-pro-preview\n(Post-session Notes & Socratic Eval)"]
    end

    %% -- DATA INGESTION & PIPELINE --
    subgraph RAGPipeline["📚 Textbook Ingestion & Grounding Pipeline"]
        PDFExtract["📄 Client-Side Extractor\n(PDF.js / JSZip / EPUB.js)"]
        ParseModel["⚙️ Hierarchy Parser\nModel: gemini-3.1-flash-lite-preview\n(Extracts TOC & Metadata)"]
        EmbedModel["🔍 Diagram Extractor\nModel: gemini-embedding-2-preview\n(Vector Semantics)"]
    end

    %% -- BACKEND INFRASTRUCTURE --
    subgraph Backend["☁️ Google Firebase & Cloud Processing"]
        Auth["🔐 Firebase Auth\n(User Identification)"]
        Firestore["🔥 Cloud Firestore (NoSQL Database)\nStores: Profiles, Sessions, Parsed Chapters"]
        Storage["☁️ Cloud Storage (Blob Storage)\nStores: Images, Videos, PDFs, Diagrams"]
        CloudRun["🚀 Google Cloud Run\n(Production Hosting & Next.js/Vite Serving)"]
    end

    %% -- RELATIONSHIPS & DATA FLOW --
    User(("👩‍🎓 Student")) <--> |Speaks / Shows / Listens| AudioVideoIO
    User --> |Interacts| UI

    %% Client Operations
    UI -.-> |Manages| LiveHook
    AudioVideoIO -.-> |Raw PCM Audio / Video Frames| LiveHook
    Whiteboard -.-> |State updates from AI| UI
    MediaGallery -.-> |Fetches Gen-Media| UI

    %% Live Connection
    LiveHook <--> |Bidirectional WebSockets| LiveModel

    %% Live Tool Executions
    LiveModel -.-> |Function Call: generate_image| ImgModel
    LiveModel -.-> |Function Call: generate_video| VidModel
    LiveModel -.-> |Function Call: add_whiteboard_step| Whiteboard

    %% Processing & Storage
    LiveModel -.-> |Saves Session Transcripts| Firestore
    ImgModel -.-> |Saves generated PNGs| Storage
    VidModel -.-> |Saves generated MP4s| Storage
    ReasoningModel -.-> |Reads transcripts, Writes Notes| Firestore

    %% RAG Pipeline Flow
    User -.-> |Uploads ZIP/PDF/EPUB| PDFExtract
    PDFExtract -.-> |Sends Raw Text| ParseModel
    PDFExtract -.-> |Sends Diagrams| EmbedModel
    ParseModel -.-> |Saves structured chapters| Firestore
    EmbedModel -.-> |Saves diagram metadata| Storage 

    %% Backend integrations
    UI -.-> |Authenticates| Auth
    UI -.-> |Loads historical sessions| Firestore
    UI -.-> |Served by| CloudRun

    %% Styling Elements
    classDef client fill:#e3f2fd,stroke:#42a5f5,stroke-width:2px,color:#0b3b60,font-weight:bold
    classDef live fill:#fff3e0,stroke:#fb8c00,stroke-width:2px,color:#e65100,font-weight:bold
    classDef genai fill:#ede7f6,stroke:#7e57c2,stroke-width:2px,color:#311b92,font-weight:bold
    classDef rag fill:#e8f5e9,stroke:#43a047,stroke-width:2px,color:#1b5e20,font-weight:bold
    classDef backend fill:#fff8e1,stroke:#fbc02d,stroke-width:2px,color:#f57f17,font-weight:bold
    classDef user fill:#fce4ec,stroke:#ec407a,stroke-width:2px,color:#880e4f,font-weight:bold

    class Client client
    class LiveCore live
    class GenAI genai
    class RAGPipeline rag
    class Backend backend
    class User user
    
    style LiveModel fill:#FFD54F,stroke:#FF8F00,stroke-width:2px,color:#000
    style ImgModel fill:#CE93D8,stroke:#6A1B9A,stroke-width:2px,color:#000
    style VidModel fill:#9FA8DA,stroke:#283593,stroke-width:2px,color:#000
    
    %% Clickable Links
    click LiveModel "https://ai.google.dev/gemini-api/docs/live-api" "Gemini Live API Docs"
    click ImgModel "https://ai.google.dev/gemini-api/docs/image-generation" "Gemini Image Generation"
    click VidModel "https://ai.google.dev/gemini-api/docs/video" "Gemini Video Generation"
    click ReasoningModel "https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview" "Gemini Pro Docs"
    click ParseModel "https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite-preview" "Gemini Flash Lite Docs"
    click EmbedModel "https://ai.google.dev/gemini-api/docs/embeddings" "Gemini Embeddings Docs"
    click Auth "https://firebase.google.com/docs/auth" "Firebase Auth Docs"
    click Firestore "https://firebase.google.com/docs/firestore" "Firestore Docs"
    click Storage "https://firebase.google.com/docs/storage" "Cloud Storage Docs"
    click CloudRun "https://cloud.google.com/run" "Google Cloud Run Docs"
```

### Component Breakdown

| Layer | Components | Technology |
|-------|------------|------------|
| **Frontend** | Voice UI, Whiteboard, Media Gallery, Camera | React + Vite + Tailwind |
| **Live API** | Bidirectional Audio/Vision | `gemini-2.5-flash-native-audio-preview-12-2025` |
| **Image Gen** | Educational diagrams, themed visuals | `gemini-3.1-flash-image-preview` (Nano Banana 2) |
| **Video Gen** | 8-second concept animations | `veo-3.1-fast-generate-preview` |
| **Reasoning** | Study notes, evaluation, parsing | `gemini-3.1-pro-preview` + `gemini-3.1-flash-lite-preview` |
| **RAG** | Textbook embeddings, semantic search | `gemini-embedding-2-preview` |
| **Storage** | Sessions, media, user data | Cloud Firestore + Cloud Storage |

## ✨ Core Features & Learning Modes

### 🔬 Lab Mode — Hands-On Experiments

**What it does:** Real-time camera-guided lab experiments with safety monitoring using **`gemini-2.5-flash-native-audio-preview-12-2025`** Live API.

**How to Test:**
1. Navigate to **Lab Mode** from the home screen
2. Allow camera permissions when prompted
3. Point camera at your experiment setup
4. Speak naturally: "What equipment do I need?" or "Is this the correct procedure?"
5. **Expected:** Mama AI identifies equipment, guides steps, and interrupts if safety issues detected

---

### 📝 Exam Mode — Socratic Assessment

**What it does:** Active recall tutoring that uses your hobbies (football, cricket, gaming) to explain concepts via **`gemini-3.1-pro-preview`**. Never gives direct answers—guides you to discover them.

**How to Test:**
1. Select **Exam Mode** → Choose a topic
2. Answer Mama AI's questions verbally
3. When stuck, observe how she uses your favorite hobby to explain
4. **Example:** If you like football, she'll explain projectile motion using ball trajectories
5. **Expected:** Personalized hints that lead you to the answer, not give it directly

> **Note:** Uses same whiteboard, image generation, and video generation as Tutor Mode

---

### 📚 Tutor Mode — Textbook-Grounded Learning

**What it does:** Textbook-grounded RAG system. Upload PDFs → parsed by **`gemini-3.1-pro-preview`** → embedded with **`gemini-embedding-2-preview`** → stored in Firestore. Answers strictly from your uploaded materials, not generic internet sources.

**How to Test:**
1. Go to **Study** → Upload a PDF textbook
2. Wait for parsing (Gemini extracts TOC and diagrams)
3. Select a chapter → Start voice session
4. Ask: "Explain [topic from your textbook]"
5. **Expected:** Answers reference specific pages/sections from YOUR uploaded PDF, not generic internet knowledge

**Visual Tools Auto-Generated:**
| Tool | Trigger | Model Used |
|------|---------|------------|
| **Custom Diagrams** | Complex concepts | `gemini-3.1-flash-image-preview` (Nano Banana 2) |
| **Concept Animations** | Dynamic processes (osmosis, motion) | `veo-3.1-fast-generate-preview` |
| **Interactive Whiteboard** | Multi-step math problems | LaTeX rendering with step-by-step walkthrough |

All media cached in **Firebase Cloud Storage** for later review.

---

### 📝 My Study Notes — Session History

**What it does:** Auto-saves every session. Uses **`gemini-3.1-pro-preview`** to synthesize conversations, whiteboards, and mistakes into structured study guides.

**How to Test:**
1. Complete any voice session (Lab/Exam/Tutor)
2. Navigate to **My Notes** from bottom navigation
3. Select the session you just completed
4. **Expected:** Structured summary with:
   - Key concepts covered
   - Formulas explained
   - Whiteboard steps preserved
   - Generated images/videos accessible
   - Personalized revision tips

## 🤖 AI Models & Technologies

Mama AI leverages a sophisticated multi-model architecture to deliver a seamless, voice-first educational experience:

### 🎨 Image Generation
| Model | Purpose |
|-------|---------|
| `gemini-3.1-flash-image-preview` | **Nano Banana 2** - Primary model for generating educational diagrams, whiteboard visuals, and themed illustrations in 9:16 portrait format |
| `gemini-3-pro-image-preview` | **Nano Banana Pro** - Fallback model for image generation when primary model is unavailable |

### 🎬 Video Generation
| Model | Purpose |
|-------|---------|
| `veo-3.1-fast-generate-preview` | **Veo 3.1 Fast** - Generates silent 8-second educational animations (9:16 portrait) for explaining dynamic scientific phenomena |

### 🧠 Reasoning & Text Processing
| Model | Purpose |
|-------|---------|
| `gemini-3.1-pro-preview` | **Primary Reasoning** - Deep pedagogical evaluation, study notes generation, diagram analysis, and complex multi-step problem solving |
| `gemini-3-pro-preview` | **Fallback Reasoning** - Secondary model for reasoning tasks when 3.1 Pro is unavailable |
| `gemini-3.1-flash-lite-preview` | **Fast Processing** - Lightweight text tasks like session heading generation and textbook structure parsing |

### 🔍 Embeddings & RAG
| Model | Purpose |
|-------|---------|
| `gemini-embedding-2-preview` | **Vector Embeddings** - Powers the multimodal RAG system by creating embeddings for textbook text and diagrams, enabling semantic search and contextual retrieval |

### 🗣️ Voice Interaction (Live API)
| Model | Purpose |
|-------|---------|
| `gemini-2.5-flash-native-audio-preview-12-2025` | **Live Voice & Vision** - Enables real-time, bidirectional voice conversations with native audio output and vision capabilities for camera input |

---

## 🏗️ Tech Stack & Architecture

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | Component-based UI library |
| **TypeScript** | Type-safe development |
| **Vite** | Fast build tooling and dev server |
| **Tailwind CSS** | Utility-first styling |
| **Lucide React** | Icon library |
| **KaTeX** | Math formula rendering for whiteboard |

### Backend & Infrastructure
| Technology | Purpose |
|------------|---------|
| **Firebase Auth** | User authentication (email/password) |
| **Cloud Firestore** | Session storage, user profiles, textbook metadata, embeddings |
| **Firebase Cloud Storage** | Generated media (images/videos), PDF textbooks |
| **Google Cloud Run** | Containerized deployment |

### AI/ML Stack
| Technology | Purpose |
|------------|---------|
| **Google GenAI SDK** | Unified interface for all Gemini models |
| **Gemini Live API** | Real-time bidirectional voice + vision |
| **Gemini 3.1 Pro/Flash** | Reasoning, parsing, study notes |
| **Nano Banana 2** | Educational image generation |
| **Veo 3.1 Fast** | Concept animation videos |
| **Gemini Embedding 2** | Multimodal RAG vectorization |

---

## 📁 Project Structure

```
mama-ai/
├── public/                 # Static assets
│   └── assets/            # Images, banners
├── src/
│   ├── components/        # React components
│   │   ├── whiteboard/   # Interactive math whiteboard
│   │   └── Carousel/     # Visual story carousel
│   ├── contexts/         # React contexts (Auth)
│   ├── hooks/            # Custom React hooks
│   │   ├── useGeminiLive.ts       # Live API voice/vision
│   │   ├── useGeminiReasoning.ts  # Evaluation engine
│   │   ├── useTextbookParser.ts   # PDF parsing
│   │   └── useSessions.ts         # Session management
│   ├── pages/            # Route pages
│   │   ├── study/        # TutorChat, StudyLibrary
│   │   ├── exam/         # ExamEntry
│   │   ├── lab/          # LabEntry
│   │   └── SessionDetail.tsx      # Study notes view
│   ├── services/         # Business logic
│   │   ├── imageGen.ts           # Nano Banana integration
│   │   ├── videoGen.ts           # Veo 3.1 integration
│   │   ├── diagramService.ts     # Diagram enhancement
│   │   └── voicePreview.ts       # TTS previews
│   ├── utils/            # Utilities
│   │   ├── diagramExtractor.ts   # PDF diagram extraction
│   │   └── zipExtractor.ts       # ZIP/PDF parsing
│   └── firebase.ts       # Firebase configuration
├── .env.example          # Environment template
├── package.json
└── README.md
```

---

## 🚀 Getting Started (Reproducible Setup Guide)

> **📋 Judge Note:** This section provides **step-by-step reproducible instructions** for setting up and running Mama AI locally. Follow these steps exactly to recreate the project environment.

### Prerequisites

Before starting, ensure you have:

| Requirement | Version | How to Verify |
|-------------|---------|---------------|
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Google Account** | Any | Required for Firebase & Gemini API |
| **Git** | Any | `git --version` |

**Required Services:**
- [Google Cloud account](https://cloud.google.com/free) (free tier works)
- [Firebase project](https://console.firebase.google.com/)
- [Gemini API key](https://ai.google.dev/)

---

### Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/yourusername/mama-ai.git

# Navigate to project folder
cd mama-ai

# Install dependencies
npm install
```

**Expected output:** `added XXX packages in XXs`

---

### Step 2: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit with your credentials
nano .env.local  # or use any text editor
```

**Fill in these required values:**

```env
# ==========================================
# Google Gemini API (Required for AI features)
# Get key at: https://ai.google.dev/
# ==========================================
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# ==========================================
# Firebase Configuration (Required for backend)
# Get these from: https://console.firebase.google.com/project/_/settings/general/web
# ==========================================
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

### Step 3: Run the Development Server

```bash
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Open your browser:** Navigate to `http://localhost:5173`

---

### Step 4: Test Core Features Locally

Once the app is running, test these key features:

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| **Sign Up** | Create account with email | Account created in Firebase Auth |
| **Upload Textbook** | Go to Study → Upload PDF | PDF appears in library |
| **Voice Mode** | Start Tutor Mode → Click mic | Browser requests mic permission |
| **Image Generation** | Ask "Explain photosynthesis" | Image generates (~5-10s) |
| **Video Generation** | Ask "Show me osmosis" | Video job created, plays when ready |

---

### Step 5: Build for Production

```bash
# Create optimized production build
npm run build

# Output will be in /dist folder
ls -la dist/
```

**Expected:** `dist/` folder contains `index.html` and assets

---

## 🧪 Testing & Verification Checklist

> **📋 For Judges:** Use this checklist to verify the project runs correctly.

### Local Development Tests

```bash
# Run linter (should pass with no errors)
npm run lint

# Type check (should pass)
npx tsc --noEmit

# Build test (should complete without errors)
npm run build
```

### Feature Verification Tests

| Test | Steps | Success Criteria |
|------|-------|------------------|
| **✅ Gemini API Connection** | Start voice mode, speak "Hello" | AI responds with audio |
| **✅ Textbook Upload** | Upload a PDF, wait for parsing | TOC appears, chapters listed |
| **✅ Grounded Answers** | Ask question about uploaded chapter | Answer references textbook content |
| **✅ Image Generation** | Request diagram | 9:16 portrait image appears |
| **✅ Video Generation** | Request animation | 8-second video generates & plays |
| **✅ Whiteboard** | Ask math problem | LaTeX formulas render step-by-step |
| **✅ Session Persistence** | End session, go to My Notes | Session appears with summary |

### API Key Verification

If you encounter errors, verify your API keys:

```bash
# Test Gemini API key
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_GEMINI_API_KEY"

# Should return list of available models
```

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| `MODULE_NOT_FOUND` | Run `npm install` again |
| `Invalid API Key` | Check `.env.local` for typos |
| `Firebase permission denied` | Enable Firestore and Auth in Firebase Console |
| `Mic not working` | Use HTTPS (deployed) or `localhost` |
| `Build fails` | Ensure Node.js 18+: `node --version` |

---

## ☁️ Deployment

### Firebase Hosting (Frontend)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy --only hosting
```

### Cloud Run (Backend/API if needed)
```bash
gcloud builds submit --tag gcr.io/your-project/mama-ai
gcloud run deploy mama-ai-service --image gcr.io/your-project/mama-ai --platform managed
```

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with ❤️ for the Google Gemini Live Agent Challenge**
