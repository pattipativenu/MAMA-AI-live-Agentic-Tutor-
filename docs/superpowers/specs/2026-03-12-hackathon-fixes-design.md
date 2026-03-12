# Hackathon Readiness: 6 Targeted Fixes
**Date**: 2026-03-12
**Status**: Approved
**Scope**: Lab mode, Exam mode, Session history

---

## Overview

Six small, targeted fixes to make the Mama AI app fully functional for hackathon demo. No rewrites — all changes are surgical.

---

## Fix 1 — Google Search (Lab Mode Only)

**Problem**: Gemini cannot identify specific real-world objects (e.g., a specific brooch) because it has no web search access. It falls back to training-data guesses.

**Solution**: Add `{ googleSearch: {} }` as a second tool in `useGeminiLive.ts` when `mode === 'lab'`. Add a system instruction hint that search should be a last resort only.

**Files**:
- `src/hooks/useGeminiLive.ts` — conditional tool in `ai.live.connect()` config
- `src/pages/lab/Entry.tsx` — add search guidance to system instruction

**Constraint**: Exam and tutor modes are NOT affected. Search only in lab.

---

## Fix 2 — Exam Mode Video Black Screen

**Problem**: `<video ref={videoRef}>` is conditionally rendered with `{isVideoActive && ...}`. When `startVideo()` is called, `isVideoActive` is still `false`, so the element isn't in the DOM, `videoRef.current` is `null`, and `srcObject` is never set. Camera turns on physically but shows nothing.

**Solution**: Always render the `<video>` element. Use `opacity-0 pointer-events-none` to hide it (same pattern as lab mode). This ensures `videoRef.current` is always valid.

**Files**:
- `src/pages/exam/Entry.tsx` — change conditional render to opacity-based visibility

---

## Fix 3 — Session History: AI Messages Truncated

**Problem**: The `outputAudioTranscription` handler has a duplicate-detection condition: `(now - lastAiMessageRef.timestamp < 1000)`. Since transcript chunks arrive every 50–200ms, this drops almost all chunks after the first. AI messages in session history appear as just the first few words.

**Solution**: Remove the time-based condition. Keep only the text-overlap checks (which handle true duplicates). Chunks within 3 seconds are already appended to the same message via the `updateMessages` logic.

**Files**:
- `src/hooks/useGeminiLive.ts` — lines 1133–1136

---

## Fix 4 — Remove Loading Screen, Navigate Home on End

**Problem**: After ending a session, both lab and exam modes navigate to `/summary?sessionId=...`. The Summary page waits up to 10 seconds for Firestore; if save is slow or fails, it shows "Session data could not be loaded." This creates a poor UX.

**Solution**: Navigate to `'/'` (home) directly. The save continues in the background. Sessions appear in the Sessions tab via Firestore real-time subscription once written.

**Files**:
- `src/pages/lab/Entry.tsx` — `handleEndSession()`
- `src/pages/exam/Entry.tsx` — `handleEndExam()`

---

## Fix 5 — Periodic Auto-Save Every 2 Minutes

**Problem**: Sessions only save on `disconnect()`. If the connection drops unexpectedly, the full session is lost.

**Solution**:
1. Add `force?: boolean` param to `saveSession()` in `useSessions.ts` — when `true`, skip duplicate detection (allowing re-saves of the same session).
2. Add a `useEffect` in both `lab/Entry.tsx` and `exam/Entry.tsx` that runs a 2-minute `setInterval` while `isConnected`. Each tick calls `saveSession(..., true)` to upsert the current state.

**Files**:
- `src/hooks/useSessions.ts` — add `force` param
- `src/pages/lab/Entry.tsx` — 2-min interval useEffect
- `src/pages/exam/Entry.tsx` — 2-min interval useEffect

---

## Fix 6 — Exam Textbook Selector (Re-enable)

**Problem**: The subject/chapter selector is fully implemented but never triggered — `showTextbookSelector` is initialized to `false` and no UI button sets it to `true`.

**Solution**: Change initial state to `true`. The selector appears as a setup step when entering Exam mode. The "Skip" button (already implemented) allows bypassing it for a general exam.

**Files**:
- `src/pages/exam/Entry.tsx` — one line change in `useState`

---

## Implementation Order

1. Fix 3 (AI message history) — foundational, affects session quality
2. Fix 2 (Exam video) — quick win, unblocks testing
3. Fix 1 (Google Search) — lab mode enhancement
4. Fix 4 (Navigate home) — removes confusing UX
5. Fix 5 (Periodic save) — reliability improvement
6. Fix 6 (Textbook selector) — feature re-enable

---

## Non-Goals

- No changes to tutor mode session saving
- No changes to Summary page (it stays for future use, just not navigated to by default)
- No changes to Sessions list page
- No Firebase Storage rule changes
