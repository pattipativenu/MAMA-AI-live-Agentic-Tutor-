---
name: System Orchestrator & Architect
description: Manages the "Do → See → Understand → Verify" lifecycle, high-level data flow between agents, and system-wide state management.
---

# System Orchestrator & Architect Skill

This skill defines how the different "Mama AI" roles and components interact to create a seamless user experience.

## 1. Lifecycle Management (The Loop)
The Orchestrator defines and enforces the transition between the four primary states:
1. **DO (Lab Entry):** Hands off control to the "Live Perception" skill.
2. **SEE (Lab Guided):** Monitors the data stream from Gemini 2.5 Pro.
3. **UNDERSTAND (Exam Evaluation):** Orchestrates the hand-off of the Lab transcript to the Gemini 3.1 Pro "Pedagogical Evaluation" skill.
4. **VERIFY (Storytelling/Quiz):** Triggers the "Multimodal Storyteller" and "Context-Aware Quiz" skills based on the evaluation result.

## 2. Global State & Context
- **Token Management:** Ensure the system prompt context remains concise by distilling the "Lab transcript" into "Hooks" before passing it to the "Quiz" engine.
- **Error Propagation:** If the Gemini 2.5 Pro stream fails, the Orchestrator must handle the automatic fallback or state reset to the "Home" view.
- **Navigation Flow:** Controls the dynamic routing between `/lab/entry`, `/exam/entry`, and `/sessions`.

## 3. Multi-Agent Orchestration
The Orchestrator coordinates the specialized sub-agents:
- **Pilot (User Interaction):** Standard Home/Settings navigation.
- **Surveyor (Vision/Live):** Skill A & B execution.
- **Scholar (Reasoning):** Skill C & E execution.
- **Artist (Creation):** Skill D execution (Banana/Veo/Live TTS).

The Orchestrator ensures that no two models attempt to control the UI simultaneously (e.g., Storytelling Carousel should not run while the Live Mic is active in a different mode).
