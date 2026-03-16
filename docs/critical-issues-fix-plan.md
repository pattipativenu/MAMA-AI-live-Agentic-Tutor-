# Critical Issues Fix Plan

## Executive Summary

Three critical UX issues have been identified in Mama AI Tutor Mode:

| Priority | Issue | Impact |
|----------|-------|--------|
| **P0** | Audio Interruption on Mobile | AI hears itself, causing mid-sentence cutoffs |
| **P0** | Unanswered Prompts | AI asks questions but doesn't wait for responses |
| **P1** | Image/Whiteboard Sync | Whiteboard writes while images are being viewed |

---

## Issue I: Audio Interruption on Mobile

### Root Cause
The AI hears its own audio output through the microphone, triggering the Live API's interruption mechanism.

### Solution: AI-Speaking Mute Gate

Implement a client-side audio gate that **physically mutes the microphone** when AI is actively speaking.

```typescript
// In useGeminiLive.ts
const isAiSpeakingRef = useRef(false);
const AI_SPEAKING_COOLDOWN = 800; // ms to keep mic muted after AI stops

// In audio processor:
processor.onaudioprocess = (e) => {
  // CRITICAL: Discard audio if AI is speaking (prevents echo interruption)
  if (isAiSpeakingRef.current) {
    return; // Don't send any audio to Gemini
  }
  // ... normal audio transmission
};

// When receiving AI audio:
if (message.serverContent?.modelTurn?.parts) {
  isAiSpeakingRef.current = true;
  // Reset cooldown timer
  if (aiSpeakingTimeoutRef.current) {
    clearTimeout(aiSpeakingTimeoutRef.current);
  }
  aiSpeakingTimeoutRef.current = setTimeout(() => {
    isAiSpeakingRef.current = false;
  }, AI_SPEAKING_COOLDOWN);
}
```

---

## Issue II: Interactivity - Unanswered Prompts

### Root Cause
The LLM has no native mechanism to "pause" generation mid-stream. Once it starts generating, it continues until the turn is complete.

### Solution: Function-Based Pause Gate

Use **function calling** as a hard stop mechanism.

#### Step 1: Add Pause Function

```typescript
const pauseForResponseDeclaration: FunctionDeclaration = {
  name: "pause_for_response",
  description: `CRITICAL: Call this function IMMEDIATELY after asking any question. 
  This PAUSES the AI until the user responds. DO NOT speak after calling this.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      question_asked: {
        type: Type.STRING,
        description: "The exact question just asked"
      }
    },
    required: ["question_asked"]
  }
};
```

#### Step 2: Handle Pause in onmessage

```typescript
if (call.name === 'pause_for_response') {
  setStatus('waiting');
  isWaitingForResponseRef.current = true;
  
  return { 
    id: call.id, 
    name: call.name, 
    response: { 
      status: 'PAUSED',
      message: 'AI is waiting for user response'
    } 
  };
}
```

#### Step 3: Resume on User Speech

```typescript
const inputTranscript = message.serverContent?.inputAudioTranscription?.text;
if (inputTranscript && isWaitingForResponseRef.current) {
  isWaitingForResponseRef.current = false;
  setStatus('listening');
}
```

---

## Issue III: Image/Whiteboard Sync

### Root Cause
`show_media()` and `add_whiteboard_step()` can happen simultaneously. The whiteboard continues receiving steps while the user is viewing an image.

### Solution: Whiteboard Step Queue

Queue whiteboard steps when media is focused, only releasing them when `hide_media()` is called.

```typescript
// New state in useGeminiLive.ts
const whiteboardQueueRef = useRef<Array<WhiteboardStep>>([]);
const isMediaFocusedRef = useRef(false);

// When add_whiteboard_step is called:
if (isMediaFocusedRef.current) {
  // Queue the step instead of showing immediately
  whiteboardQueueRef.current.push(newStep);
  return { 
    id: call.id, 
    name: call.name, 
    response: { 
      result: 'Step queued - will appear when image is closed'
    } 
  };
}

// When hide_media() is called:
if (call.name === 'hide_media') {
  setIsMediaFocused(false);
  isMediaFocusedRef.current = false;
  
  // Release queued whiteboard steps
  const queuedSteps = whiteboardQueueRef.current;
  whiteboardQueueRef.current = [];
  
  // Add all queued steps to whiteboard
  queuedSteps.forEach(step => {
    setWhiteboardState(prev => ({
      ...prev,
      steps: [...prev.steps, step]
    }));
  });
  
  return { id: call.id, name: call.name, response: { result: 'Media closed' } };
}
```

---

## Implementation Priority

1. **Issue I (Audio)** - Highest priority, affects basic usability
2. **Issue II (Prompts)** - High priority, affects interactivity
3. **Issue III (Whiteboard)** - Medium priority, UX polish

---

## Files to Modify

1. `src/hooks/useGeminiLive.ts` - Core audio and function handling
2. `src/pages/study/TutorChat.tsx` - System prompt updates for pause function
3. `src/components/whiteboard/` - Queue handling for steps
