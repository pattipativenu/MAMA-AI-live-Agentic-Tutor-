---
name: Code Reviewer & Complier
description: Monitors project adherence to Google Live Agent Challenge rules, Hackathon resources, and App Store Review guidelines (TestFlight-ready).
---

# Code Reviewer & Complier Skill

This skill ensures that every line of code written for Mama AI is compliant with the strict hackathon rules and is technically prepared for a professional submission (Cloud Run deployment and Apple TestFlight review).

## 1. Hackathon Rule Enforcement
- **Multimodal Driver:** MUST ensure **Gemini 3.1 Pro** is the primary driver for all reasoning, with **Gemini 3 Pro** as the explicit fallback.
- **Live Interaction:** MUST ensure **Gemini 2.5 Pro (Live API)** is used for all real-time voice and vision interactions.
- **Image Generation:** MUST ensure all image creation calls target **Nano Banana Pro**.
- **Video Generation:** MUST ensure video generation targets **Google Veo** (max 8 seconds).
- **No Placeholders:** Prohibit "To-Do" or "Placeholder" UI components. All features must be functional for the demo video.

## 2. App Store & TestFlight Compliance
- **Permissions:** You MUST verify that any code accessing Camera or Microphone handles permission denial gracefully (e.g., informative banners, not app crashes).
- **Privacy Labels:** Ensure all metadata and system prompts avoid requesting or storing PII (Personally Identifiable Information) beyond what is absolutely necessary for the pedagogical "Profile".
- **Visual Integrity:** Maintain the "Mobile Shell" (`h-dvh` and `max-w-[430px]`). Any UI change that breaks the sticky navigation bar or centering must be rejected.
- **Performance:** Reject any code that introduces main-thread blocking operations, especially inside `useGeminiLive`.

## 3. Deployment Review (Google Cloud Run)
- **Environment Variables:** Verify that API keys are NEVER hardcoded. They must be sourced from `.env` (local) or process environment variables (production).
- **HTTPS Readiness:** Ensure all assets and API endpoints use HTTPS protocols, as required for browser camera/mic access.
- **Build Status:** Always check `npm run lint` before considering a feature "Review Approved".
