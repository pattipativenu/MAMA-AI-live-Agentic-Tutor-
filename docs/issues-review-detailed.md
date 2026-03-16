# Detailed Issues Review

## Issue 1: Video Generation Audio Problem

### Current State
- Using `veo-3.1-fast-generate-preview` model
- Prompt explicitly says "COMPLETELY SILENT" and "NO AUDIO TRACK WHATSOEVER"
- Yet audio is still being generated in the videos

### Root Cause Analysis
**Veo 3.1 Fast vs Veo 3 Standard:**
- The `veo-3.1-fast-generate-preview` model may have different audio behavior than expected
- Veo 3.x models can generate audio by default unless explicitly configured not to
- The prompt-based approach (telling it to be silent) is unreliable

### What I Found
Looking at `videoGen.ts` lines 206-214:
```typescript
operation = await ai.models.generateVideos({
  model: VEO_MODEL,
  prompt,
  config: {
    aspectRatio,
    numberOfVideos,
    durationSeconds,
  } as GenerateVideosConfig
});
```

**No audio configuration is being passed.** The `GenerateVideosConfig` type likely has an `audio` or `sound` option that's defaulting to `true`.

### Recommended Fix
Check if Veo 3.1 config supports audio disable (may need SDK documentation check):
```typescript
config: {
  aspectRatio,
  numberOfVideos,
  durationSeconds,
  // Possible options to try:
  audio: false,  // or
  sound: false,  // or  
  generateAudio: false, // depending on SDK
} as GenerateVideosConfig
```

If the SDK doesn't support audio disable, you may need to:
1. Post-process videos to strip audio (using ffmpeg or similar)
2. Switch to a different model that doesn't generate audio
3. Accept that Veo generates audio and mute it client-side (but this wastes bandwidth)

---

## Issue 2: Auto-Scroll Visuals & Main Screen Display

### Current State
- `autoAdvanceCarousel` setting exists in UserProfile (defaults to `true`)
- Toggle exists in Settings page (lines 496-514)
- Two different behaviors are conflated:
  1. **Carousel auto-advance** (slideshow timing)
  2. **Auto-expand new images** (opens images immediately when generated)

### Root Cause Analysis

**Problem A: Auto-expanding images interrupt whiteboard**
In `TutorChat.tsx` lines 489-513:
```typescript
// Auto-scroll and auto-expand new images when autoAdvanceCarousel is enabled
useEffect(() => {
    const autoAdvance = profile?.autoAdvanceCarousel ?? true;
    
    if (generatedMedia.length > prevMediaLengthRef.current) {
        const newMedia = generatedMedia[generatedMedia.length - 1];
        
        // Auto-scroll to media gallery
        if (mediaGalleryRef.current) {
            mediaGalleryRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        // Auto-expand the new media if auto-advance is enabled
        if (autoAdvance && voiceMode) {
            const timer = setTimeout(() => {
                setSelectedMedia(newMedia);  // ← THIS OPSES THE FULLSCREEN MODAL
            }, 500);
            return () => clearTimeout(timer);
        }
    }
    // ...
}, [generatedMedia, profile?.autoAdvanceCarousel, voiceMode]);
```

**Problem B: Images show on main screen when they should stay in gallery**
In `TutorChat.tsx` voice mode display logic (lines 1211-1224):
```typescript
/* PRIORITY 2: Current generated image (or show_media focus) */
currentImage ? (
    <div
        className="w-full max-w-[340px] h-[70%] relative rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-200 cursor-pointer"
        onClick={() => {
            const media = generatedMedia.find(m => m.url === currentImage);
            if (media) setSelectedMedia(media);
        }}
    >
        <img
            src={currentImage}
            alt="Generated visual"
            className="w-full h-full object-contain bg-black"
        />
```

The `currentImage` state is set in two places:
1. `generate_image` function handler (line 1044): Sets `currentImage` for non-tutor modes
2. `show_media` function handler (line 1204): Sets `currentImage` when AI calls the function

### The Flow Problem

Current behavior when AI generates an image:
1. `generate_image` is called → image generates in background
2. When complete, `setGeneratedMedia()` adds it to gallery
3. `useEffect` sees new media → if `autoAdvance` is true, calls `setSelectedMedia()` 
4. This opens the fullscreen modal AND/or displays on main screen
5. Meanwhile AI continues explaining on whiteboard
6. User sees both: image on main screen + whiteboard writing simultaneously

### Recommended Fixes

**Option 1: Remove auto-expand entirely (Simplest)**
Remove the `setSelectedMedia` call in the useEffect. Let images stay in gallery until user taps or AI calls `show_media`.

**Option 2: Fix the priority system**
Currently the display priority in voice mode is:
1. Whiteboard (if active)
2. `currentImage` (if set)
3. Default mic view

Change to:
1. Whiteboard (if active) ← don't allow currentImage to override
2. `currentImage` ONLY when `isMediaFocused` is true (AI called show_media)
3. Default mic view

**Option 3: Separate the concerns**
- Remove `autoAdvanceCarousel` setting entirely
- Always keep generated images in gallery
- Only show on main screen when `show_media()` is explicitly called
- Carousel in exam mode auto-advances based on narration timing (separate from this setting)

---

## Issue 3: Gemini Voices & Pause Handling

### Current State
- Voice selection exists in Settings (Victoria, Max, James, Emma, Daniel, Sophia)
- Voices map to Gemini API names via `VOICE_NAME_MAP`
- User reports hearing "two voices" and interruption issues when pausing

### Root Cause Analysis

**"Two Voices" Problem:**
I found the likely culprit in `generationQueue.ts` lines 47-105:

```typescript
// Intro Slide (Text Only)
const introText = `Let's review what we learned...`;
slides.push({
  id: 'intro',
  type: 'text',
  narrationText: introText,
  durationMs: await preBufferTTS(introText),  // ← Web Speech API TTS
  fallbackText: 'Review Time!'
});

// ... for each hook ...
const narrationHtml = `${hook.term}! Remember: ${hook.description}`;
slides.push({
  id: `hook-img-${i}`,
  type: 'image',
  narrationText: narrationHtml,
  durationMs: await preBufferTTS(narrationHtml),  // ← Web Speech API TTS
  // ...
});
```

**The Carousel uses browser's Web Speech API for narration** (`tts.ts` lines 50-70), NOT the Gemini Live voice.

When the Carousel plays:
1. **Voice 1**: Browser's Web Speech API (local TTS)
2. **Voice 2**: Gemini Live API voice (when user asks "Are you there?")

These are DIFFERENT voices, creating the "two voices" experience.

**Pause/Interruption Problem:**
In `useGeminiLive.ts`, when user interrupts:

```typescript
if (message.serverContent?.interrupted) {
  console.log("[GeminiLive] Interrupted - clearing audio queue.");
  setStatus('listening');
  currentAiTextRef.current = '';
  // ... reset playback time
}
```

But the `isAiSpeakingRef` mute gate was just added. If there's any timing issue where:
1. User interrupts
2. AI stops speaking
3. User asks "Are you there?"
4. `isAiSpeakingRef` is still `true` (cooldown hasn't expired)
5. User's voice gets muted/missed
6. AI doesn't respond
7. User asks again, AI finally hears

This creates the "disruption for one or two seconds" the user mentioned.

### Recommended Fixes

**Fix A: Unify voices in Carousel**
Replace Web Speech API with Gemini TTS API in the Carousel, using the same voice selected by the user.

In `CarouselViewer.tsx` or `useCarousel.ts`:
- Instead of `playTTS(slide.narrationText)`, call a function that:
  1. Calls Gemini TTS API with selected voice
  2. Gets PCM audio
  3. Converts to WAV (like voicePreview.ts does)
  4. Plays the audio
- Synchronize the carousel advancement with the actual audio duration

**Fix B: Ensure clean interrupt handling**
The recent fix adds:
```typescript
if (message.serverContent?.interrupted) {
  // ... existing code ...
  if (aiSpeakingCooldownRef.current) {
    window.clearTimeout(aiSpeakingCooldownRef.current);
    aiSpeakingCooldownRef.current = null;
  }
  isAiSpeakingRef.current = false;  // ← Immediately unmute mic
}
```

This should help, but test the timing carefully.

**Fix C: Consider removing Carousel narration audio entirely**
If unifying voices is complex, consider:
- Carousel shows visuals with text captions only
- No automatic narration
- Gemini Live voice explains when user asks or when returning to tutor mode
- Simpler, but less "polished" experience

---

## Summary Table

| Issue | Severity | Root Cause | Recommended Fix |
|-------|----------|------------|-----------------|
| 1. Video Audio | High | Veo 3.1 generates audio by default; no config to disable | Try SDK audio flags; may need post-processing |
| 2. Auto-scroll | Medium | `autoAdvanceCarousel` auto-expands images, interrupting whiteboard | Remove auto-expand; only show on `show_media()` |
| 3. Two Voices | High | Carousel uses Web Speech API, Live uses Gemini TTS | Unify to Gemini TTS in Carousel |
| 3. Pause Disruption | Medium | Mic mute gate timing on interrupt | Ensure `isAiSpeakingRef` clears immediately on interrupt |

---

## Questions for You

1. **Video Audio**: Do you want me to try adding `audio: false` to the Veo config, or do you have a preferred workaround?

2. **Auto-scroll**: Should I remove the auto-expand behavior entirely, or do you want a different approach?

3. **Two Voices**: For the Carousel, would you prefer:
   - A) Add Gemini TTS narration (matches Live voice)
   - B) Remove narration entirely (visuals only)
   - C) Keep current behavior (two different voices)

Let me know your preferences and I'll implement the fixes accordingly.
