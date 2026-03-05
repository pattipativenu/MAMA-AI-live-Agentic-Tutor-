---
name: Mama AI Development
description: Core capabilities, system prompts, and technical architecture rules for developing the Mama AI project.
---

# Mama AI Development Skill

This skill contains the comprehensive rules and system prompt instructions for developing Mama AI, a multimodal AI tutoring application designed for the Google Live Agent Challenge.

## 1. Project Overview
Mama AI is a voice-first, mobile AI tutoring app. It relies on a "Do → See → Understand → Verify" loop, heavily featuring the Gemini Live API for real-time interaction and Nano Banana Pro for rich visual storytelling.

## 2. Technical Stack Rules
- **Reasoning/Evaluation:** MUST use `Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)`.
- **Live Voice & Vision:** MUST use `Gemini 2.5 Pro (Live API)`.
- **Image Generation:** MUST use `Nano Banana Pro` (exclusively).
- **Video Generation:** MUST use `Google Veo` (≤8 seconds).
- **Architecture:** The app uses Firebase/Firestore for session storage and Google Cloud Run for the backend. (Note: Currently waiting on user clarification regarding React Native vs. React Web).

## 3. Core Agent Skills & Prompts

### Skill A: Live Audiovisual Perception & Verification
- **Model:** Gemini 2.5 Pro (Live API)
- **Instruction:** You are receiving a real-time camera feed. Acknowledge items as soon as you see them. Do not wait for the student to speak. If interrupted, stop speaking immediately and adjust.

### Skill B: Real-Time Error Detection
- **Model:** Gemini 2.5 Pro (Live API)
- **Instruction:** Monitor the physical state of the experiment against the expected state. If the student deviates (e.g., pours too much), INTERRUPT IMMEDIATELY with a gentle, urgent correction.

### Skill C: Deep Pedagogical Evaluation
- **Model:** Gemini 3.1 Pro / 3.1 Flash (Fallback: Gemini 3 Pro / 3 Flash)
- **Instruction:** Analyze the student's transcript. Output structured JSON: `correct`, `missing`, `incorrect`, and generate 3-5 memorable, visual `hooks` acting as mental anchors.

### Skill D: Multimodal Interleaved Storyteller
- **Models:** Nano Banana Pro, Google Veo, Gemini 3.1 Pro (Fallback: Gemini 3 Pro)
- **Instruction:** Act as a Creative Director. Based on the Hooks, design a 4-slide sequence:
  1. Image (Realistic diagram) + 5s TTS
  2. Image (Real-world analogy) + 5s TTS
  3. Video (8s animation) + 8s TTS
  4. Image (Themed illustration) + 6s TTS

### Skill E: Dynamic Context-Aware Quizzing
- **Model:** Gemini 3.1 Pro (Fallback: Gemini 3 Pro)
- **Instruction:** Generate 2 rapid-fire oral quiz questions testing the immediate retention of the freshly generated Hooks. Offer visual-based hints if the student struggles.
