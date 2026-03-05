# 🧠 MAMA AI — Complete Build Specification
### For Google AI Studio / Vibe Coder

---

> **HOW TO USE THIS DOCUMENT**
> This is a complete, self-contained build specification for Mama AI. Hand this entire document to Google AI Studio or your vibe coder and instruct them to follow it exactly, in the order written. Every section is intentional. Do not skip, reorder, or summarize any section.

---

## TABLE OF CONTENTS

1. [What Is Mama AI](#1-what-is-mama-ai)
2. [Platform and Scope](#2-platform-and-scope)
3. [What To Follow — Mandatory Rules](#3-what-to-follow--mandatory-rules)
4. [What NOT To Follow — Forbidden Patterns](#4-what-not-to-follow--forbidden-patterns)
5. [Tech Stack — Exact Specifications](#5-tech-stack--exact-specifications)
6. [Screen-by-Screen UI Specification](#6-screen-by-screen-ui-specification)
   - [Screen 1: Splash / Onboarding](#screen-1-splash--onboarding)
   - [Screen 2: Home Dashboard](#screen-2-home-dashboard)
   - [Screen 3: Lab Mode Entry](#screen-3-mode-selection--lab-mode-entry)
   - [Screen 4: Lab Mode Active Session (7 Phases)](#screen-4-lab-mode--active-session-7-phase-flow)
   - [Screen 5: Exam Mode Entry](#screen-5-mode-selection--exam-mode-entry)
   - [Screen 6: Exam Mode Active Session (9 Steps)](#screen-6-exam-mode--active-session-9-step-flow)
7. [The Theme System](#7-the-theme-system)
8. [The Auto-Advancing Carousel — Technical Specification](#8-the-auto-advancing-carousel--technical-specification)
9. [The Session Summary Screen](#9-the-session-summary-screen)
10. [Session Data Schema (Firestore)](#10-session-data-schema-firestore)
11. [Voice and Speech Specifications](#11-voice-and-speech-specifications)
12. [Error Handling and Edge Cases](#12-error-handling-and-edge-cases)
13. [Settings Screen](#13-settings-screen)
14. [Project Folder Structure](#14-project-folder-structure)
15. [Build Priority Order](#15-build-priority-order)
16. [Quality Bar — Do Not Ship Below This](#16-quality-bar--do-not-ship-below-this)

---

## 1. What Is Mama AI

Mama AI is a **voice-first, mobile-only AI tutoring application** designed for students in Classes 5 through 12. It acts as a real-time, intelligent tutor that listens, sees, speaks, and teaches — entirely through voice and live camera interaction. There is no heavy keyboard input. The student simply talks and shows things to the camera, and Mama AI guides, evaluates, explains, and tests them.

### Core Philosophy

> **Do → See → Understand → Verify**

Students learn by doing hands-on activities and experiments, then Mama AI immediately reinforces that learning through AI-generated visual explanations (images and short videos) delivered in a beautiful auto-advancing carousel with synchronized voice narration.

### The Two Primary Learning Modes

#### 🔬 Lab Mode
The student performs a real-world science experiment at home or in school. Mama AI watches through the camera in real time, gives step-by-step voice guidance, identifies what the student is doing, corrects mistakes, interprets results, and then generates a personalized visual explanation of the underlying science.

#### 📖 Exam Mode
The student practices answering exam questions out loud, or writes answers on paper and holds them to the camera. Mama AI evaluates the answer, identifies what is correct, what is missing, and what is wrong, then breaks the concept into 3–5 memorable "hooks," generates themed visual explanations, narrates them in a carousel, and ends with a quick oral quiz to verify retention.

---

## 2. Platform and Scope

**Build ONLY the mobile version.**

| Requirement | Detail |
|---|---|
| **Target platform** | Mobile only (iOS + Android via React Native / Expo) |
| **Orientation** | Portrait only |
| **Base screen width** | 390px – 430px |
| **Desktop layout** | ❌ Not required. Do not build one. |
| **Tablet layout** | ❌ Not required. Do not build one. |
| **Interaction model** | Voice-first. Tap is secondary. Keyboard is last resort. |
| **Minimum tap target** | 48 × 48px for all interactive elements |
| **Navigation pattern** | Bottom navigation bar + floating action buttons + full-screen modal overlays |

The interface should feel like a polished native mobile app, not a website. Every design decision must be made through the lens of: *"Will this work comfortably with one thumb on a phone?"*

---

## 3. What To Follow — Mandatory Rules

These rules are non-negotiable. Every single one must be followed throughout the entire build.

### 🤖 AI Model Rules

- **ALWAYS use Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash))** (the thinking/reasoning model) as the primary AI for **all reasoning tasks** — this includes:
  - Concept evaluation
  - Generating explanations
  - Creating concept hooks
  - Analyzing camera input and deciding what it means educationally
  - Deciding what visuals to generate and writing their prompts
  - Writing narration scripts for carousel slides
  - Composing quiz questions and evaluating quiz answers
  - Every task that requires intelligence must route through Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash))

- **Use Gemini 2.5 Pro (Live API) for all real-time voice interaction**, covering:
  - Speech-to-text (student speaking to the app)
  - Text-to-speech (Mama AI speaking back to the student)
  - Live camera vision processing during Lab Mode and Exam Mode sessions

- **Use the Google GenAI SDK** for all model calls. No third-party AI SDK or wrapper of any kind.

- **Use Nano Banana Pro exclusively for all image generation.** Every educational image, themed visual explanation, concept diagram, and memory hook illustration must go through Nano Banana Pro. No exceptions.

- **Use Google Veo for all video generation.** Short educational animations (maximum 8 seconds each) for all visual concepts.

### 🗄️ Infrastructure Rules

- **Use Firestore** as the primary database for all session data, student progress, generated content metadata, and conversation history.
- **Deploy all backend services on Google Cloud Run.**
- **Use Vertex AI** as the entry point for Gemini model calls wherever applicable.

### 🎙️ Voice and UX Rules

- The voice interaction must feel **natural and conversational.** Mama AI should never sound robotic. It should sound like a warm, encouraging, patient tutor.
- Every image and video generated must be **educationally relevant and tied directly to the concept being taught in that session.** No generic stock-style imagery.
- The carousel system must be **fully automatic.** The student does not tap to advance. Content auto-advances on a timer, synchronized with the narration audio.

---

## 4. What NOT To Follow — Forbidden Patterns

These are hard stops. Do not do any of the following under any circumstances.

| ❌ Forbidden | Why |
|---|---|
| Build a desktop or tablet layout | This is a mobile-only product |
| Use keyboard-heavy input as primary interaction | Voice is always primary |
| Use any AI model other than Gemini for reasoning or narration | Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) is the exclusive reasoning engine |
| Use any image generation service other than Nano Banana Pro | All images must come from Nano Banana Pro |
| Use any video generation service other than Google Veo | All video must come from Veo |
| Show raw API responses or JSON to the user | The UI is always clean and conversational |
| Make the carousel manually controllable by default | Auto-advance is always on; manual swipe is a secondary override only |
| Show a blank screen or spinner while waiting for Nano Banana Pro | Show an animated loading state with Mama AI's bridging voice narration |
| Store full video files in Firestore | Store only metadata and Cloud Storage URLs in Firestore |
| Use localStorage or sessionStorage as primary persistence | Firestore is always the source of truth |
| Skip the concept hooks system in Exam Mode | Every single Exam Mode session must produce 3–5 hooks before generating visuals |
| Have Mama AI say "I cannot do that" or "I am just an AI" | Mama AI is always in character as a tutor — never breaks character |
| Ship a broken or empty carousel state | Always handle video generation failure gracefully with image-only fallback |

---

## 5. Tech Stack — Exact Specifications

### Frontend
| Layer | Choice |
|---|---|
| Framework | React Native via **Expo** |
| Navigation | **Expo Router** |
| Styling | **NativeWind** or StyleSheet API |
| Default theme | Dark theme with warm amber/orange accent palette |
| Animations | **Lottie** for splash/loading, **Reanimated** for transitions |

### Backend
| Layer | Choice |
|---|---|
| Runtime | Node.js or Python |
| Platform | **Google Cloud Run** |
| API style | RESTful + WebSocket (for Gemini Live streaming) |

### AI Models
| Task | Model |
|---|---|
| All reasoning, evaluation, hook generation, narration scripting, quiz generation | **Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash))** (thinking model) |
| Real-time speech-to-text | **Gemini 2.5 Pro (Live API)** |
| Real-time text-to-speech | **Gemini 2.5 Pro (Live API)** |
| Live camera vision processing | **Gemini 2.5 Pro (Live API)** |
| All image generation | **Nano Banana Pro** |
| All short video generation (≤8 seconds) | **Google Veo** |

### Infrastructure
| Service | Purpose |
|---|---|
| **Firestore** | All session data, progress, content metadata |
| **Google Cloud Storage** | Generated images and video files |
| **Firebase Authentication** | Anonymous auth (MVP) + Google Sign-In (secondary) |
| **Google Cloud Run** | Backend service hosting |
| **Vertex AI** | Entry point for all Gemini API calls |

---

## 6. Screen-by-Screen UI Specification

---

### Screen 1: Splash / Onboarding

- Full-screen with the Mama AI logo (a warm, friendly character or logomark)
- Tagline displayed below the logo: **"Your Live Tutor. Always With You."**
- Single CTA button: **"Let's Start Learning"**
- Brief Lottie animation on the logo showing a voice wave or camera icon coming to life
- Transitions to Home Dashboard after button tap or 3-second auto-advance if already authenticated

---

### Screen 2: Home Dashboard

**Header:**
- Personalized greeting: *"Good morning, [Name]! What are we learning today?"*
- Small avatar or initial bubble in the top-right corner

**Mode Cards (two large, equal-width cards):**

| Card | Label | Icon | Accent Color |
|---|---|---|---|
| Left | Lab Mode | Beaker / Microscope | Teal |
| Right | Exam Mode | Book / Pencil | Amber |

Each card has a short one-line description below the label:
- Lab Mode: *"Guide me through an experiment"*
- Exam Mode: *"Test my knowledge on a topic"*

**Recent Sessions Section (below cards):**
- Title: "Recent Sessions"
- Shows last 3 sessions as horizontal scroll cards
- Each card shows: subject, topic, mode badge, score/stars, date

**Bottom Navigation:**
- Home | Sessions | Settings

---

### Screen 3: Mode Selection — Lab Mode Entry

- Full screen with mic icon pulsing in the center — mic is immediately active and listening
- On-screen prompt text: *"What experiment are we doing today? Just tell me."*
- Student speaks (example): *"I'm doing Benedict's test for sugar"*
- Mama AI responds verbally AND displays confirmation text on screen:
  *"Great! I'll guide you through the Benedict's Test for Reducing Sugars. Make sure you have your equipment ready. Let me check what you have."*
- Transitions automatically into the active Lab Mode session screen

---

### Screen 4: Lab Mode — Active Session (7-Phase Flow)

This is the most complex screen. Build each phase exactly as described.

---

#### 📦 Phase 1 — Equipment Check

**What happens:**
- Mama AI requests camera permission (if not already granted)
- The live camera feed occupies the **top 60% of the screen** as a rounded-corner viewfinder
- Mama AI speaks: *"Hold up all your materials so I can see them."*
- **Gemini 2.5 Pro (Live API)** processes the camera feed and identifies visible items
- Mama AI verbally confirms each item identified
- Example: *"I can see the test tube, the Bunsen burner, and the Benedict's solution. You're missing the water bath — can you get that?"*
- A **checklist overlay** appears on-screen showing each expected item with ✅ or ⬜ status
- Phase does not advance until all required items are confirmed OR student verbally overrides

**How it works technically:**
1. Frontend opens camera stream via Expo Camera
2. Camera frames are sent to Gemini 2.5 Pro (Live API) at regular intervals (every 2–3 seconds)
3. Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) receives the vision description and generates the equipment status JSON
4. The checklist overlay is rendered from this JSON
5. When all items are confirmed, Mama AI says "Great, you have everything!" and Phase 2 begins

---

#### 🧪 Phase 2 — Step-by-Step Guidance

**What happens:**
- Mama AI begins narrating the experiment step by step via Gemini 2.5 Pro (Live API) TTS
- Each step is shown as a card at the **bottom 30% of the screen** — text + icon
- Cards auto-advance as steps are completed (confirmed by voice or vision)
- Camera stays active the entire time — Gemini Vision is continuously watching
- Example exchange:
  - Mama AI: *"Now add 2ml of the food sample to the test tube. Hold it up so I can see."*
  - Student performs the step and holds it to the camera
  - Gemini Vision confirms: *"Perfect, that looks like the right amount."*
- Step cards show: step number, instruction text, a simple icon, and a ✅ when confirmed

**How it works technically:**
1. Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) generates the full ordered step list for the experiment at Phase 1 end
2. Steps are stored in the session document in Firestore
3. Each step has an expected visual confirmation description
4. Gemini 2.5 Pro (Live API) continuously processes camera frames and checks against the expected state
5. When the expected state is detected, the step is marked complete and the next step narration begins

---

#### ⚠️ Phase 3 — Real-Time Correction

**What happens:**
- This phase runs in parallel with Phase 2 — it is always active during the experiment
- If the student makes an error (wrong amount, wrong sequence, wrong technique), Mama AI **immediately interrupts** with a correction
- Correction is gentle, specific, and immediate
- Example: *"Stop! That's a bit too much — pour some out until you have about 2ml. The test tube should only be about one-quarter full."*
- After the correction, guidance resumes from the current step

**How it works technically:**
1. Every camera frame is analyzed by Gemini 2.5 Pro (Live API) + Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) in real time
2. A parallel "error detection" prompt runs alongside the step confirmation prompt
3. If an error state is detected with high confidence, the TTS system interrupts current audio, plays the correction, then resumes
4. Error events are logged to Firestore with a timestamp and description
5. Target latency for correction: **under 2.5 seconds** from error detection to audio output

---

#### 🔭 Phase 4 — Result Interpretation

**What happens:**
- At the final step of the experiment, Mama AI asks the student to display the result
- Example: *"Hold the test tube up clearly so I can see the colour."*
- Gemini Vision identifies and interprets the result (e.g., colour change, precipitate formed, temperature reading)
- Mama AI interprets verbally: *"The solution turned orange-red. That means the apple has a high level of reducing sugars. Excellent work!"*
- Result description is stored in Firestore under the session

**How it works technically:**
1. Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) receives the result-stage camera frame with a result-interpretation prompt
2. It returns a structured JSON: `{ result: string, interpretation: string, significance: string }`
3. Gemini 2.5 Pro (Live API) TTS reads the interpretation aloud
4. This JSON is stored in Firestore as `session.labResult`

---

#### 🌀 Phase 5 — Transition to Explanation Mode

**What happens:**
- Mama AI says: *"Let me show you what just happened scientifically. I'm creating some visuals for you — give me just a moment."*
- The live camera feed fades out with a smooth animation
- A **beautiful loading screen** appears — NOT a spinner. Use an animated scene (molecules floating, atoms swirling, particles dancing)
- While loading, Mama AI continues talking with a bridging narration that teaches the concept while the visuals generate
- Example bridge: *"Reducing sugars like glucose donate electrons to the copper ions in Benedict's solution. That's the chemistry behind the colour change you just saw."*
- This bridge narration fills the generation wait time — **the student is never sitting in silence**

**How it works technically:**
1. At Phase 4 completion, the backend immediately triggers three parallel generation jobs:
   - Nano Banana Pro: 2–3 image generation requests
   - Veo: 1–2 video generation requests
2. Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) generates the bridging narration text and carousel narration scripts simultaneously
3. Gemini 2.5 Pro (Live API) TTS converts the bridge narration to audio and begins playing it
4. The frontend polls Firestore for generation completion status
5. When all assets are ready, Firestore updates the session document and the frontend transitions to Phase 6

---

#### 🎠 Phase 6 — Auto-Advancing Visual Explanation (Carousel)

> See [Section 8](#8-the-auto-advancing-carousel--technical-specification) for the full carousel technical specification.

**What happens:**
- The carousel fills the full screen
- Slides auto-advance synchronized with Mama AI's narration
- Student watches and listens — no interaction required
- Slide sequence example (Benedict's Test):
  1. **Realistic diagram** (Nano Banana Pro): *"This is the standard lab setup for Benedict's Test..."*
  2. **Conceptual illustration** (Nano Banana Pro): *"Glucose and fructose are reducing sugars because they donate electrons to copper ions..."*
  3. **Short video ≤8s** (Veo): *"Watch how the colour shifts from blue to orange-red as the reaction completes..."*
  4. **Themed visual** in student's chosen theme (Nano Banana Pro): *"Imagine the sugar molecules as tiny asteroids colliding with Benedict's solution in deep space..."*
- Progress bar at the bottom shows total carousel progress
- Subtle pause button (‖) visible in the top-right corner — the only manual control

---

#### ❓ Phase 7 — Closing Quiz

**What happens:**
- After the carousel ends, a brief transition animation plays
- Mama AI poses one oral quiz question tied to the experiment
- Example: *"Quick check — if Benedict's solution turns green instead of orange, what does that tell you about the sugar level?"*
- Student answers by voice
- Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) evaluates the answer
- **If correct:** warm praise → session summary screen
- **If incorrect:** gentle correction → offer to re-explain → repeat the question once more → session summary screen
- Score from this quiz is stored in Firestore

---

### Screen 5: Mode Selection — Exam Mode Entry

- Voice input is active immediately upon screen load
- Mic icon pulses in center of screen
- On-screen prompt: *"What topic are you preparing for? Just tell me."*
- Student declares topic: *"I have an exam on Newton's Second Law of Motion"*
- Optional camera step: *"Want to show me your textbook or notes?"* — if yes, Gemini Vision reads the cover/chapter heading to confirm and enrich the topic context
- Mama AI confirms verbally: *"Perfect. Let's practice Newton's Second Law. I'll ask you a question and you tell me what you know."*
- Transitions into Exam Mode active session

---

### Screen 6: Exam Mode — Active Session (9-Step Flow)

---

#### Step 1 — User Intent Capture
- Gemini 2.5 Pro (Live API) captures the student's spoken topic declaration
- Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) extracts: `{ subject, topic, subtopics[], grade_level_guess }`
- This becomes the session context document in Firestore

---

#### Step 2 — Context Loading (Optional Camera)
- If the student shows a textbook, Gemini Vision reads:
  - Book title
  - Edition / publisher
  - Chapter heading
- This is appended to the session context to keep all explanations curriculum-aligned
- If no textbook is shown, Mama AI proceeds with the declared topic only

---

#### Step 3 — Question Asked
- Mama AI poses an open-ended question about the topic
- Tone: warm, conversational, non-intimidating
- Example: *"Tell me Newton's Second Law in your own words — don't worry about being perfect, just share what you know."*
- The question is displayed as subtitle text on screen below the animated Mama AI avatar

---

#### Step 4 — Student Answers

Two input modes are supported. Both produce the same downstream result (a text transcription):

| Mode | How It Works |
|---|---|
| **Voice answer** | Student speaks. Gemini 2.5 Pro (Live API) captures and transcribes in real time. |
| **Written answer** | Student writes on paper and holds it to the camera. Gemini Vision reads it via OCR and transcribes it. |

The student can switch between these modes at any time by tapping a small toggle button on screen.

---

#### Step 5 — Evaluation

- Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) (thinking mode) receives the transcribed answer and evaluates it across three dimensions:

```
{
  correct: [list of things the student got right],
  missing: [list of things a complete answer would include],
  incorrect: [list of factually wrong statements]
}
```

- Mama AI delivers feedback verbally in a warm, encouraging, constructive tone
- Example: *"Good core idea! You've got the basic concept — force causes acceleration. But you missed the relationship between mass and acceleration, and the formula F = ma. Let me show you those parts."*
- The three lists are also displayed as styled cards on screen (green for correct, amber for missing, red for incorrect)

---

#### Step 6 — Concept Hooks Generation

- Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) breaks the topic into **3–5 hooks** — short, memorable, visual, and testable statements
- These are the student's mental anchors for this concept
- Each hook is: short enough to memorize, visual enough to imagine, and testable in a quiz

**Example hooks for Newton's Second Law:**
> - Hook 1: *"Force is what causes a change in an object's motion."*
> - Hook 2: *"The formula is F = ma — force equals mass times acceleration."*
> - Hook 3: *"Double the force, double the acceleration — if mass stays the same."*
> - Hook 4: *"A heavier object needs more force to reach the same acceleration as a lighter one."*

- Each hook is displayed as a distinct card on screen (large text, warm accent color)
- Mama AI speaks each hook aloud with a brief pause between them for absorption
- Hooks are stored in Firestore under `session.hooks[]`

---

#### Step 7 — Visual Generation

- Mama AI says: *"Let me create some visuals to make these hooks stick. Give me a moment."*
- Backend triggers **three parallel generation tasks**:
  1. **Nano Banana Pro:** 2–3 educational images (concept diagram + real-world analogy + themed illustration)
  2. **Veo:** 1–2 short videos ≤8 seconds (animated visualization of the concept)
  3. **Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)):** narration scripts for each slide
- While generating: bridging narration from Mama AI continues (speaking about the hooks or asking a light follow-up question)
- The student is never in silence during generation

---

#### Step 8 — Auto-Advancing Carousel

> See [Section 8](#8-the-auto-advancing-carousel--technical-specification) for full technical specification.

Identical mechanics to Lab Mode Phase 6. Full screen, auto-advancing, synchronized narration, progress bar.

---

#### Step 9 — Follow-Up Quiz

- After the carousel, Mama AI poses **2–3 rapid-fire oral quiz questions**
- Questions are generated by Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) based on the hooks from this session
- Example questions for Newton's Second Law:
  - *"If mass is 5kg and force is 20N, what is the acceleration?"*
  - *"Which requires more force — pushing a bicycle or pushing a car to the same speed?"*
  - *"If you triple the force on an object, what happens to its acceleration?"*
- Each answer is evaluated by Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) in real time
- Scores are tallied and stored in Firestore
- Session ends with the summary screen

---

## 7. The Theme System

Every visual in both Lab Mode and Exam Mode is generated in one of five themes. The student selects their preferred theme once in Settings, and it applies automatically to all themed slides in the carousel.

### The Five Themes

| Theme | Description | Nano Banana Pro Style Prompt Keyword |
|---|---|---|
| **Realistic** | Scientific diagrams, textbook-style illustrations, photorealistic scenes | `"photorealistic educational diagram, textbook illustration style"` |
| **Space / Sci-Fi** | Concepts reimagined in outer space, with astronauts, planets, nebulae, futuristic tech | `"outer space sci-fi setting, NASA aesthetic, cosmos backdrop"` |
| **Anime** | Japanese animation art style — expressive characters, bold colors, dynamic visuals | `"anime illustration style, vibrant colors, expressive characters, Studio Ghibli inspired"` |
| **Historical** | Concepts placed in historical settings — ancient civilizations, medieval era, Victorian science labs | `"historical setting, Victorian era scientist, ancient civilization aesthetic"` |
| **Action / Adventure** | Superhero or action movie style — dramatic lighting, motion blur, epic framing | `"superhero comic book style, dramatic lighting, cinematic action framing"` |

### Image Prompt Construction Rules (Nano Banana Pro)

Every Nano Banana Pro prompt must include ALL of the following components:

1. **The concept** — what scientific or educational idea must be illustrated
2. **The theme** — the style descriptor from the table above
3. **Age appropriateness** — *"appropriate for students aged 10–18, safe for school"*
4. **Educational accuracy** — *"must visually represent the concept accurately, not just aesthetically"*
5. **Composition guidance** — e.g., *"clear labels, diagram-friendly layout, high contrast"*

**Example full prompt (Space theme, Benedict's Test):**
> *"An educational diagram showing reducing sugars donating electrons to copper ions causing a color change from blue to orange-red, reimagined in an outer space sci-fi setting with molecular structures as glowing asteroids colliding in a nebula, NASA aesthetic, accurate to the chemistry of Benedict's Test, appropriate for students aged 10-18, safe for school, clear and educational composition"*

---

## 8. The Auto-Advancing Carousel — Technical Specification

This is the most technically important component of the app. Build it with care.

### How It Works — Step by Step

**Step 1 — Pre-generation**
The backend generates all images (via Nano Banana Pro) and videos (via Veo) before the carousel begins. All media is uploaded to Google Cloud Storage. URLs are stored in Firestore under the session document.

**Step 2 — Slide list fetch**
The frontend fetches the ordered slide list from Firestore. Each slide object contains:

```json
{
  "slideId": "string",
  "type": "image | video",
  "url": "string (Cloud Storage URL)",
  "theme": "string",
  "narrationText": "string",
  "durationMs": "number",
  "order": "number"
}
```

**Step 3 — Audio pre-buffering**
The narration text for each slide is converted to audio using Gemini 2.5 Pro (Live API) TTS at session start and pre-buffered locally on the device. This ensures smooth, synchronized playback with zero gaps between slides.

**Step 4 — Carousel launch**
- Slide 1 appears on screen
- Slide 1 narration audio begins simultaneously
- The bottom progress bar begins filling (total progress across all slides — not per-slide)

**Step 5 — Auto-advance logic**
- When the narration audio for Slide N finishes, transition to Slide N+1
- If the audio finishes before the minimum display duration (2 seconds), wait until 2 seconds have passed before advancing
- Transition animation: smooth crossfade (300ms) or horizontal slide

**Step 6 — Continue until final slide**
- After the final slide's audio finishes, play a brief end animation
- Mama AI says: *"Great! Now let's do a quick check."*
- Screen transitions to the quiz phase

### Slide Ordering

Always follow this sequence:

| Order | Slide Type | Generator | Description |
|---|---|---|---|
| 1 | Image | Nano Banana Pro | Realistic concept diagram |
| 2 | Image | Nano Banana Pro | Real-world analogy illustration |
| 3 | Video (≤8s) | Google Veo | Animated process visualization |
| 4 | Image | Nano Banana Pro | Themed illustration (student's chosen theme) |

### Manual Controls

| Control | Description |
|---|---|
| **Pause/Resume button (‖)** | Small, top-right corner. Pauses both slide timer AND narration audio. Resume resumes both. This is the ONLY manual control by default. |
| **Swipe override** | Optional — if the student swipes left/right, the carousel advances/retreats one slide. Auto-advance continues from the new position. |

### Failure Handling

| Failure Scenario | Behavior |
|---|---|
| Video generation failed / timed out | Skip the video slide gracefully. Continue with image slides only. Never show an error state to the user. |
| Image generation failed for one slide | Show a styled text card with the narration text instead. Mama AI narration continues uninterrupted. |
| All generation failed | Fall back to a text-only carousel — each slide is a styled card showing one hook with Mama AI's narration. Never show a broken or empty carousel. |

---

## 9. The Session Summary Screen

Displayed after every session in both modes.

### Content

| Element | Details |
|---|---|
| **Subject + Topic** | Large, prominent at the top |
| **Mode badge** | "Lab Mode" or "Exam Mode" in a colored pill |
| **Date + Duration** | e.g., "Feb 26, 2026 · 12 minutes" |
| **Score / Rating** | Stars (1–5) or percentage, based on quiz performance |
| **Concept Hooks** | All 3–5 hooks from this session displayed as review cards — large text, warm accent colors |
| **Replay Visuals button** | Relaunches the carousel from this session |
| **Try Again button** | Starts a new session on the same topic |
| **Share button** | Generates a shareable summary card image (concept hooks + score + Mama AI branding) |

### Score Calculation

**Exam Mode:**
- 50% weight: completeness of the student's initial answer (based on the evaluation)
- 50% weight: accuracy of follow-up quiz answers

**Lab Mode:**
- 60% weight: accuracy of steps performed (based on Gemini Vision confirmation)
- 40% weight: accuracy of closing quiz answer

---

## 10. Session Data Schema (Firestore)

```
sessions/{sessionId}/
  userId:              string
  mode:                "lab" | "exam"
  subject:             string
  topic:               string
  startTime:           timestamp
  endTime:             timestamp
  durationSeconds:     number
  hooks:               string[]          // 3-5 items
  quizScore:           number            // 0-100
  
  carouselSlides: [
    {
      slideId:         string
      type:            "image" | "video"
      url:             string            // Cloud Storage URL
      theme:           string
      narrationText:   string
      durationMs:      number
      order:           number
    }
  ]
  
  // Lab Mode only
  labPhaseLog: {
    phase1_equipmentCheck:   { completedAt: timestamp, itemsFound: string[], itemsMissing: string[] }
    phase2_steps:            { steps: [{ stepId, instruction, confirmedAt, errorOccurred }] }
    phase3_corrections:      { corrections: [{ detectedAt, errorDescription, correctionGiven }] }
    phase4_result:           { result: string, interpretation: string, significance: string }
  }
  
  // Exam Mode only
  examAnswerTranscript:  string
  evaluationResult: {
    correct:           string[]
    missing:           string[]
    incorrect:         string[]
  }
  
  generationStatus:    "pending" | "generating" | "complete" | "failed"
  generatedAt:         timestamp
```

---

## 11. Voice and Speech Specifications

### Mama AI's Voice Persona

- **Tone:** Warm, clear, encouraging, patient
- **Never:** Robotic, monotone, clinical, condescending
- **Natural fillers:** Uses *"Alright..."*, *"Let me think..."*, *"Great question..."* to feel human
- **Pace:** Slightly slower than normal conversation — students need time to absorb
- **Personalization:** Uses the student's name occasionally (once per session maximum, at a natural moment)
- **Character:** Mama AI is always in character as a tutor. It never breaks character. It never says "I cannot do that" or "I am just an AI."

### Speech-to-Text Rules

- Mic is always active during sessions (no push-to-talk, no wake word during a session)
- Noise filtering must be applied — students may be in kitchens, classrooms, or outdoors
- If speech is unclear, Mama AI asks once: *"I didn't quite catch that — could you say it again?"*
- Never fails silently — if STT fails, Mama AI speaks the error aloud: *"I'm having trouble hearing you — let me try again."*
- Transcript is displayed in real time as subtitle text while the student speaks

### Text-to-Speech Rules

- All Mama AI narration is generated via Gemini 2.5 Pro (Live API) TTS
- Consistent voice settings across the entire session — never change voice mid-session
- Pre-buffer carousel narration before starting the carousel
- Carousel narration audio plays in perfect sync with slide display timing
- If TTS generation fails for a slide, display the narration text on screen as styled subtitles and continue

---

## 12. Error Handling and Edge Cases

| Scenario | Behavior |
|---|---|
| **Camera permission denied** | Show a friendly illustrated explainer screen. Offer a voice-only fallback for Exam Mode. Explain that Lab Mode requires camera and guide the user to device settings. |
| **Microphone permission denied** | Show a friendly explainer screen. Offer text input as a temporary fallback via an on-screen keyboard. |
| **Image generation fails (Nano Banana Pro timeout or error)** | Show a styled educational text card with the narration text. Mama AI narration continues uninterrupted. Never show a generic error state. |
| **Video generation fails (Veo timeout)** | Skip the video slide. Continue with image slides only. No error message shown to user. |
| **No internet connection** | Detect offline state before session starts. Show a friendly "You're offline" screen with an illustration. Do not allow session to start — all features require a live connection. |
| **Student silent for 10 seconds during a question** | Mama AI gently prompts: *"Take your time — whenever you're ready."* |
| **Student silent for 30 seconds** | Mama AI offers: *"Would you like a hint, or shall we try a different question?"* |
| **Gemini 2.5 Pro (Live API) connection drops mid-session** | Auto-reconnect attempt (up to 3 times). If reconnect fails, pause the session gracefully, show a "Reconnecting..." state, and resume from the last completed step when connection is restored. |
| **Camera feed unclear / too dark** | Mama AI says: *"I'm having trouble seeing clearly — can you move to a brighter area or hold the item closer?"* |
| **Student shows unrecognized object during equipment check** | Mama AI says: *"I see something I don't recognize — can you tell me what that is?"* |

---

## 13. Settings Screen

| Setting | Type | Options |
|---|---|---|
| **Visual Theme** | Single select with visual previews | Realistic, Space/Sci-Fi, Anime, Historical, Action/Adventure |
| **Voice Speed** | Slider | Slow / Normal / Fast |
| **Subject Focus** | Multi-select checkboxes | Science, Math, Physics, Chemistry, Biology, History, English |
| **Student Name** | Text input | Free text |
| **Grade / Class** | Picker | Class 5 through Class 12, College |
| **Study Reminders** | Toggle + Time Picker | On/Off + time of day |

---

## 14. Project Folder Structure

```
mama-ai/
│
├── mobile/                          ← Expo React Native app (ALL UI lives here)
│   ├── app/                         ← Expo Router pages
│   │   ├── index.tsx                ← Splash / Onboarding
│   │   ├── home.tsx                 ← Home Dashboard
│   │   ├── lab/
│   │   │   ├── entry.tsx            ← Lab Mode entry (topic declaration)
│   │   │   └── session.tsx          ← Lab Mode active session (all 7 phases)
│   │   ├── exam/
│   │   │   ├── entry.tsx            ← Exam Mode entry (topic declaration)
│   │   │   └── session.tsx          ← Exam Mode active session (all 9 steps)
│   │   ├── carousel/
│   │   │   └── viewer.tsx           ← Auto-advancing carousel screen
│   │   ├── summary/
│   │   │   └── index.tsx            ← Session summary screen
│   │   └── settings/
│   │       └── index.tsx            ← Settings screen
│   │
│   ├── components/                  ← Shared UI components
│   │   ├── CarouselSlide.tsx
│   │   ├── HookCard.tsx
│   │   ├── EquipmentChecklist.tsx
│   │   ├── StepCard.tsx
│   │   ├── EvaluationResult.tsx
│   │   ├── MamaAvatar.tsx           ← Animated Mama AI avatar / voice visualizer
│   │   └── ProgressBar.tsx
│   │
│   ├── hooks/                       ← Custom React hooks
│   │   ├── useGeminiLive.ts         ← WebSocket connection + STT + TTS
│   │   ├── useCarousel.ts           ← Carousel auto-advance logic
│   │   ├── useCamera.ts             ← Camera + vision frame sending
│   │   └── useSession.ts            ← Firestore session CRUD
│   │
│   ├── services/                    ← API call wrappers
│   │   ├── api.ts                   ← Backend API client
│   │   ├── firestore.ts             ← Firestore read/write helpers
│   │   └── storage.ts               ← Cloud Storage URL helpers
│   │
│   └── assets/                      ← Static assets (icons, Lottie files, fonts)
│
├── backend/                         ← Google Cloud Run service
│   ├── routes/
│   │   ├── session.js               ← Session create / update / fetch
│   │   ├── generate.js              ← Trigger Nano Banana Pro + Veo generation
│   │   └── gemini.js                ← Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) reasoning calls
│   │
│   ├── services/
│   │   ├── geminiLive.js            ← Gemini Live WebSocket manager
│   │   ├── geminiPro.js             ← Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) (thinking) call wrapper
│   │   ├── imageGen.js              ← Nano Banana Pro wrapper
│   │   ├── videoGen.js              ← Google Veo wrapper
│   │   ├── firestore.js             ← Firestore data layer
│   │   └── storage.js               ← Cloud Storage upload/download
│   │
│   ├── index.js                     ← Cloud Run entry point
│   ├── package.json
│   └── Dockerfile
│
└── docs/
    ├── architecture-diagram.png
    ├── api-spec.md
    └── env-setup.md
```

---

## 15. Build Priority Order

Build in this exact sequence. **Do not skip ahead or build out of order.**

| Priority | Step | What to Build | Done When... |
|---|---|---|---|
| 1 | **Firebase setup** | Firebase Auth (anonymous) + Firestore initial schema + Cloud Storage bucket | Can write and read a session document |
| 2 | **Home screen + Mode cards** | Static UI only — no AI yet | Home screen renders with Lab/Exam cards |
| 3 | **Gemini Live connection** | WebSocket setup, mic input, TTS output | Can say "Hello" and hear Mama AI respond in the app |
| 4 | **Exam Mode — basic voice Q&A** | Question → student speaks → Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) evaluates → feedback spoken back | Full Exam Steps 1–5 working end-to-end |
| 5 | **Hooks generation** | Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)) produces 3–5 hooks, display as cards on screen | Hooks appear as cards and are spoken by Mama AI |
| 6 | **Nano Banana Pro integration** | Generate one image per concept using the prompt construction rules | Image appears in the app without error |
| 7 | **Veo integration** | Generate one short video, display it in the app | Video plays without error |
| 8 | **Carousel component** | Auto-advancing, synchronized narration, progress bar, pause button | Full carousel works end-to-end with real generated content |
| 9 | **Lab Mode — camera vision flow** | All 7 phases: equipment check, step guidance, real-time correction, result interpretation | Full Lab Mode session works end-to-end |
| 10 | **Theme system** | Apply theme to Nano Banana Pro prompts; theme picker in Settings | Different themes produce visually distinct carousel images |
| 11 | **Session summary screen** | Score display, hooks review cards, replay + share buttons | Summary screen appears with correct data after every session |
| 12 | **End-to-end testing** | Full Lab Mode 7-phase flow + full Exam Mode 9-step flow tested repeatedly | Both flows complete without errors or broken states |
| 13 | **Polish** | Loading animations, voice bridging, error states, all edge cases | Every screen has a loading state, empty state, and error state |

---

## 16. Quality Bar — Do Not Ship Below This

These are the minimum standards. The app must meet every one of these before it is considered shippable.

| Requirement | Standard |
|---|---|
| **Voice response latency** | Under 1.5 seconds from student finishing speaking to Mama AI beginning to respond |
| **Carousel smoothness** | Never stutters, never shows a blank frame, never shows a broken image or video |
| **Image appropriateness** | All generated images are appropriate for students aged 10–18, safe for school |
| **Overall feel** | Feels like a premium, polished product — not a prototype or side project |
| **Loading states** | Every single screen has a designed loading state |
| **Empty states** | Every list or data view has a designed empty state |
| **Error states** | Every screen has a designed, friendly (non-technical) error state |
| **Character consistency** | Mama AI never breaks character. Never says "I cannot do that." Never says "I am just an AI." |
| **No silent failures** | Every failure — STT, TTS, image gen, video gen, network — is handled gracefully with either a fallback or a friendly spoken/on-screen message |
| **Carousel fallback** | If all media generation fails, a text-only carousel with hook cards still plays with narration |
| **Session persistence** | If the app is backgrounded mid-session and reopened, the session resumes from the last completed step |

---

> **Final Instruction to the Builder:**
>
> This document is the complete and authoritative specification for Mama AI. Build it exactly as described. Follow the Build Priority Order in Section 15 — start at Step 1 and work through each step in sequence. Do not ask for clarification unless a specific implementation detail is genuinely ambiguous and cannot be reasonably inferred from context. In all other cases, proceed with your best judgment aligned with the spirit and requirements of this document.
>
> The goal is a voice-first, camera-enabled AI tutoring app that feels magical to a student using it for the first time. Every decision should serve that goal.
