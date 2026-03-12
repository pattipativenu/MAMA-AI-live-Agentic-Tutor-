# Hackathon Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 6 targeted fixes across lab mode, exam mode, and session saving to make Mama AI demo-ready.

**Architecture:** All changes are surgical edits to existing files — no new files needed. The 6 fixes are ordered by dependency: session history fix first (foundational), then UI fixes (exam video, Google Search), then navigation/UX changes (navigate home, auto-save), finally feature re-enable (textbook selector).

**Tech Stack:** React 18, TypeScript, Vite, Firebase Firestore, `@google/genai` Live API

---

## Chunk 1: Session History — Fix AI Message Truncation

### Task 1: Remove time-gate from AI message deduplication

**Files:**
- Modify: `src/hooks/useGeminiLive.ts:1130–1148`

**Context:** `outputAudioTranscription` arrives in rapid bursts (50–200ms apart). The current `isDuplicate` check includes `(now - lastAiMessageRef.current?.timestamp < 1000)` which marks every chunk after the first as a duplicate. This causes AI messages in session history to contain only the first few words. The text-overlap checks (conditions 1 & 2) are sufficient.

- [ ] **Step 1.1: Open `src/hooks/useGeminiLive.ts` and find lines 1130–1148**

Look for this block in the `outputAudioTranscription` handler:
```typescript
const isDuplicate = recentText && (
  recentText.includes(cleanText) ||
  cleanText.includes(recentText) ||
  (now - (lastAiMessageRef.current?.timestamp || 0) < 1000)
);
```

- [ ] **Step 1.2: Remove the third condition**

Change to:
```typescript
const isDuplicate = recentText && (
  recentText.includes(cleanText) ||
  cleanText.includes(recentText)
);
```

- [ ] **Step 1.3: Verify dev server still starts cleanly**

```bash
# Check for TypeScript errors
cd /Users/admin/Downloads/Projects/mama-ai
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 1.4: Commit**

```bash
git add src/hooks/useGeminiLive.ts
git commit -m "fix: stop dropping AI transcript chunks — remove 1s time-gate from isDuplicate check"
```

---

## Chunk 2: Exam Mode Video — Fix Black Screen

### Task 2: Always render `<video>` element in exam mode

**Files:**
- Modify: `src/pages/exam/Entry.tsx:524–534`

**Context:** The `<video ref={videoRef}>` is inside `{isVideoActive && (...)}`. When `startVideo()` is called, `isVideoActive` is still `false`, so the element isn't in the DOM and `videoRef.current` is `null`. `videoElement.srcObject = stream` silently fails. Fix: always keep the element in DOM, use opacity to show/hide (identical to the lab mode pattern at `lab/Entry.tsx:308`).

- [ ] **Step 2.1: Open `src/pages/exam/Entry.tsx` and find lines 523–534**

Look for this exact block:
```jsx
{/* Live Video Feed (when camera is active) */}
{isVideoActive && (
  <div className="absolute inset-0">
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
    />
  </div>
)}
```

- [ ] **Step 2.2: Replace with always-rendered element using opacity**

```jsx
{/* Live Video Feed — always in DOM so videoRef is valid when startVideo() sets srcObject */}
<div className={`absolute inset-0 transition-opacity duration-300 ${isVideoActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
  <video
    ref={videoRef}
    autoPlay
    playsInline
    muted
    className="w-full h-full object-cover"
  />
</div>
```

- [ ] **Step 2.3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2.4: Commit**

```bash
git add src/pages/exam/Entry.tsx
git commit -m "fix: exam mode video black screen — always render video element in DOM"
```

---

## Chunk 3: Google Search — Lab Mode Only

### Task 3a: Add Google Search tool conditionally in useGeminiLive

**Files:**
- Modify: `src/hooks/useGeminiLive.ts:506`

**Context:** The tools array is at line 506 inside `ai.live.connect()`. Adding `{ googleSearch: {} }` as a second object in the array enables web search. Must be conditional on `mode === 'lab'` — exam/tutor modes stay unchanged.

- [ ] **Step 3a.1: Open `src/hooks/useGeminiLive.ts` and find line 506**

Look for:
```typescript
tools: [{ functionDeclarations: [addWhiteboardStepDeclaration, highlightWhiteboardStepDeclaration, clearWhiteboardDeclaration, generateImageDeclaration, generateVideoDeclaration, showMediaDeclaration, hideMediaDeclaration] }],
```

- [ ] **Step 3a.2: Add conditional Google Search tool**

Replace with:
```typescript
tools: [
  { functionDeclarations: [addWhiteboardStepDeclaration, highlightWhiteboardStepDeclaration, clearWhiteboardDeclaration, generateImageDeclaration, generateVideoDeclaration, showMediaDeclaration, hideMediaDeclaration] },
  ...(mode === 'lab' ? [{ googleSearch: {} }] : []),
],
```

### Task 3b: Add search guidance to lab system instruction

**Files:**
- Modify: `src/pages/lab/Entry.tsx:31–44` (the `CRITICAL RULES` section)

**Context:** Without a usage hint, Gemini may over-use Google Search for things it already knows. The instruction should make search a last resort.

- [ ] **Step 3b.1: Open `src/pages/lab/Entry.tsx` and find the CRITICAL RULES list (around line 32)**

Look for the numbered rules in the `getLabSystemInstruction` function.

- [ ] **Step 3b.2: Add rule 11 after the existing rule 10**

After `10. Keep responses conversational and concise`, add:
```
11. GOOGLE SEARCH (LAST RESORT ONLY): You have access to Google Search. Use it ONLY when you genuinely cannot answer from your training knowledge — for example, to identify a specific product name, brand, or obscure real-world object shown on camera. Never search for concepts, science facts, or anything you already know well.
```

- [ ] **Step 3c: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3d: Commit**

```bash
git add src/hooks/useGeminiLive.ts src/pages/lab/Entry.tsx
git commit -m "feat: add Google Search grounding in lab mode only (last-resort usage)"
```

---

## Chunk 4: Navigate Home on Session End

### Task 4: Change post-session navigation from /summary to /

**Files:**
- Modify: `src/pages/lab/Entry.tsx:279`
- Modify: `src/pages/exam/Entry.tsx:399`

**Context:** Currently both modes navigate to `/summary?sessionId=...` which shows a 10-second loading spinner. If the save is slow, it shows "Session data could not be loaded." The save runs async in background via `disconnect()` → `onSessionEnd` → `saveSession()`. Navigation should go straight home; sessions appear in the Sessions tab once Firestore receives the write.

- [ ] **Step 4.1: Fix lab mode — open `src/pages/lab/Entry.tsx` and find `handleEndSession` (~line 276)**

```typescript
const handleEndSession = () => {
  stopVideo();
  disconnect();
  navigate(`/summary?sessionId=${sessionIdRef.current}&mode=lab`);  // ← change this
};
```

Change to:
```typescript
const handleEndSession = () => {
  stopVideo();
  disconnect(); // triggers onSessionEnd → saveSession() runs in background
  navigate('/');
};
```

- [ ] **Step 4.2: Fix exam mode — open `src/pages/exam/Entry.tsx` and find `handleEndExam` (~line 397)**

```typescript
const handleEndExam = () => {
  disconnect(); // triggers saveSession callback
  navigate(`/summary?sessionId=${sessionIdRef.current}&mode=exam`);  // ← change this
};
```

Change to:
```typescript
const handleEndExam = () => {
  disconnect(); // triggers onSessionEnd → saveSession() runs in background
  navigate('/');
};
```

- [ ] **Step 4.3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4.4: Commit**

```bash
git add src/pages/lab/Entry.tsx src/pages/exam/Entry.tsx
git commit -m "ux: navigate home on session end instead of summary loading screen"
```

---

## Chunk 5: Periodic Auto-Save Every 2 Minutes

### Task 5a: Add `force` flag to `saveSession` in useSessions

**Files:**
- Modify: `src/hooks/useSessions.ts:178–209`

**Context:** The duplicate detection at line 206 blocks re-saving the same session because the first user message is identical. Mid-session auto-saves need to overwrite the same Firestore document with more content. A `force` flag bypasses the duplicate check.

- [ ] **Step 5a.1: Open `src/hooks/useSessions.ts` and find the `saveSession` signature (~line 178)**

```typescript
const saveSession = async (
  mode: 'lab' | 'exam' | 'tutor',
  rawMessages: SessionMessage[],
  sessionId?: string,
  evaluation?: SessionEvaluation,
  generatedMedia?: GeneratedMedia[]
): Promise<string | null> => {
```

- [ ] **Step 5a.2: Add `force` parameter**

```typescript
const saveSession = async (
  mode: 'lab' | 'exam' | 'tutor',
  rawMessages: SessionMessage[],
  sessionId?: string,
  evaluation?: SessionEvaluation,
  generatedMedia?: GeneratedMedia[],
  force = false
): Promise<string | null> => {
```

- [ ] **Step 5a.3: Update the duplicate check (~line 206) to respect `force`**

Find:
```typescript
// Check for duplicates
if (isDuplicateSession(mode, filteredMessages)) {
  console.log('[useSessions] Duplicate session detected, not saving');
  return null;
}
```

Change to:
```typescript
// Check for duplicates (skip if force=true, e.g. auto-save updating existing session)
if (!force && isDuplicateSession(mode, filteredMessages)) {
  console.log('[useSessions] Duplicate session detected, not saving');
  return null;
}
```

### Task 5b: Add 2-minute auto-save to lab mode

**Files:**
- Modify: `src/pages/lab/Entry.tsx`

**Context:** Lab Entry needs `messages` and `generatedMedia` from the hook — `messages` is already exported by useGeminiLive but not currently destructured in lab Entry. Add it to the destructuring, then add the interval useEffect.

- [ ] **Step 5b.1: Open `src/pages/lab/Entry.tsx` and find the `useGeminiLive` destructuring (~line 66)**

```typescript
const {
  isConnected, isConnecting, isSilent, isMuted,
  status,
  currentImage, isGeneratingImage,
  whiteboardState, completeWhiteboardStep,
  isMediaFocused, hideMedia,
  connect, disconnect, toggleMute,
  startVideoCapture, stopVideoCapture,
} = useGeminiLive(
```

- [ ] **Step 5b.2: Add `messages` and `generatedMedia` to destructuring**

```typescript
const {
  isConnected, isConnecting, isSilent, isMuted,
  status,
  messages, generatedMedia,
  currentImage, isGeneratingImage,
  whiteboardState, completeWhiteboardStep,
  isMediaFocused, hideMedia,
  connect, disconnect, toggleMute,
  startVideoCapture, stopVideoCapture,
} = useGeminiLive(
```

- [ ] **Step 5b.3: Add the auto-save useEffect after the existing useEffects (around line 87)**

Add this new useEffect:
```typescript
// Auto-save every 2 minutes while connected (in case of unexpected disconnect)
useEffect(() => {
  if (!isConnected) return;
  const id = setInterval(() => {
    if (messages.length > 0) {
      console.log('[Lab] Auto-saving session checkpoint...');
      saveSession('lab', messages, sessionIdRef.current, undefined, generatedMedia, true);
    }
  }, 2 * 60 * 1000); // 2 minutes
  return () => clearInterval(id);
}, [isConnected, messages, generatedMedia, saveSession]);
```

### Task 5c: Add 2-minute auto-save to exam mode

**Files:**
- Modify: `src/pages/exam/Entry.tsx`

**Context:** Exam Entry already destructures `messages` from useGeminiLive (line 126). Just need to add `generatedMedia` to the destructuring and add the interval.

- [ ] **Step 5c.1: Open `src/pages/exam/Entry.tsx` and find the `useGeminiLive` destructuring (~line 124)**

```typescript
  status,
  messages, currentImage, isGeneratingImage,
  whiteboardState, completeWhiteboardStep,
  isMediaFocused, hideMedia,
  connect, disconnect, toggleMute, sendClientMessage,
  startVideoCapture, stopVideoCapture,
} = useGeminiLive(
```

- [ ] **Step 5c.2: Add `generatedMedia` to destructuring**

```typescript
  status,
  messages, generatedMedia, currentImage, isGeneratingImage,
  whiteboardState, completeWhiteboardStep,
  isMediaFocused, hideMedia,
  connect, disconnect, toggleMute, sendClientMessage,
  startVideoCapture, stopVideoCapture,
} = useGeminiLive(
```

- [ ] **Step 5c.3: Add auto-save useEffect after existing useEffects (around line 194)**

```typescript
// Auto-save every 2 minutes while connected (in case of unexpected disconnect)
useEffect(() => {
  if (!isConnected) return;
  const id = setInterval(() => {
    if (messages.length > 0) {
      console.log('[Exam] Auto-saving session checkpoint...');
      saveSession('exam', messages, sessionIdRef.current, undefined, generatedMedia, true);
    }
  }, 2 * 60 * 1000); // 2 minutes
  return () => clearInterval(id);
}, [isConnected, messages, generatedMedia, saveSession]);
```

- [ ] **Step 5d: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5e: Commit**

```bash
git add src/hooks/useSessions.ts src/pages/lab/Entry.tsx src/pages/exam/Entry.tsx
git commit -m "feat: periodic auto-save every 2min during session + force flag in saveSession"
```

---

## Chunk 6: Exam Textbook Selector — Re-enable

### Task 6: Initialize textbook selector as shown on exam entry

**Files:**
- Modify: `src/pages/exam/Entry.tsx:111`

**Context:** The entire feature is already built: `TextbookSelector` component, `handleTextbookSelect()`, `handleSkipTextbook()`, and `examContext.chapterContent` injected into the system instruction (first 8,000 chars). It's just never triggered. Changing `useState(false)` to `useState(true)` makes the selector appear as a one-time setup step before the exam starts. Users can press "Skip" to run a general exam.

- [ ] **Step 6.1: Open `src/pages/exam/Entry.tsx` and find line 110–111**

```typescript
// Textbook selection state - DISABLED for direct entry like TutorChat
const [showTextbookSelector, setShowTextbookSelector] = useState(false);
```

- [ ] **Step 6.2: Enable by changing initial state and updating the comment**

```typescript
// Textbook selection state — shown on entry so students can choose subject/chapter
const [showTextbookSelector, setShowTextbookSelector] = useState(true);
```

- [ ] **Step 6.3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6.4: Commit**

```bash
git add src/pages/exam/Entry.tsx
git commit -m "feat: re-enable exam textbook selector — shows subject/chapter picker on entry"
```

---

## Chunk 7: Final Verification

### Task 7: Verify all changes on dev server

- [ ] **Step 7.1: Start dev server**

```bash
cd /Users/admin/Downloads/Projects/mama-ai
npm run dev -- --port 3001
```

- [ ] **Step 7.2: TypeScript full check**

```bash
npx tsc --noEmit
```
Expected: Zero errors.

- [ ] **Step 7.3: Check dev server console for build errors**

Expected: Only the pre-existing CSS `@import` PostCSS warning. No TypeScript compilation errors.

- [ ] **Step 7.4: Update MEMORY.md with session 5 changes**

Add to `/Users/admin/.claude/projects/-Users-admin-Downloads-Projects-mama-ai/memory/MEMORY.md`:

```markdown
## Session 5 Fixes
- Google Search: added to lab mode tools only (`mode === 'lab' ? [{ googleSearch: {} }] : []`)
  - System instruction rule 11: last-resort only for obscure object identification
- Exam video: fixed black screen — `<video>` always in DOM (opacity pattern, same as lab)
- AI message history: removed 1s time-gate from isDuplicate — was dropping rapid transcript chunks
- Navigation: lab/exam "End" now navigates to '/' instead of /summary
- Auto-save: 2-min interval in lab/exam; `force` flag in saveSession bypasses duplicate detection
- Exam textbook selector: re-enabled (`useState(true)`) — shows on entry, Skip button available
```

- [ ] **Step 7.5: Final commit**

```bash
git add /Users/admin/.claude/projects/-Users-admin-Downloads-Projects-mama-ai/memory/MEMORY.md
git commit -m "docs: update MEMORY.md with session 5 hackathon fixes"
```
