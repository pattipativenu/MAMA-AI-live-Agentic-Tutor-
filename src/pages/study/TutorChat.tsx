import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, X, ArrowLeft, Mic, MicOff, Loader2, Send, Zap, BookOpen, Sparkles, ChevronLeft, ChevronRight, Image as ImageIcon, Volume2, Play, Pause, Video, VideoOff } from 'lucide-react';
import { useTextbookParser, TextbookChapter } from '../../hooks/useTextbookParser';
import { useProfile } from '../../hooks/useProfile';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleGenAI } from '@google/genai';
import { useGeminiLive, GeneratedMedia } from '../../hooks/useGeminiLive';
import { useSessions, SessionMessage } from '../../hooks/useSessions';
import { WhiteboardView } from '../../components/whiteboard';
import { playModeEntrySound } from '../../utils/sound';

type ContentPart = { type: 'text'; text: string } | { type: 'image'; url: string };

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    imageUrl?: string;
}

interface Subsection {
    num: string;
    title: string;
}

/** Personalized greeting messages for the chapter overview */
function buildGreeting(name: string, chapterTitle: string): string {
    const firstName = name?.split(' ')[0] || 'there';
    const options = [
        `Hey ${firstName}! 👋 Ready to explore **${chapterTitle}**? It's a really fascinating chapter — hit the button below to jump in!`,
        `Welcome back, ${firstName}! Today we're unlocking **${chapterTitle}**. Let's do a full walkthrough together — hit the button to start!`,
        `Hi ${firstName}! Great choice — **${chapterTitle}** is one of those chapters that makes everything click. Hit the Voice Session button to jump in with me!`,
        `Hey ${firstName}! Let's make **${chapterTitle}** super clear today. Hit the button below and let's start the conversation! 🎯`,
    ];
    return options[Math.floor(Math.random() * options.length)];
}

/** Build learning style specific instructions */
function buildLearningStyleInstructions(learningStyle: string, hobbies: string[]): string {
    const hobbyList = hobbies?.length > 0 ? hobbies.join(', ') : 'general interests';
    // Normalize to lowercase so stored values ('visual', 'auditory', etc.) match map keys
    const normalized = (learningStyle || 'visual').toLowerCase();

    const styleMap: Record<string, string> = {
        'visual': `
    - Use diagrams, charts, and visual descriptions frequently
    - Describe concepts using spatial relationships and visual metaphors
    - When explaining, paint a mental picture: "Imagine you can see..."`,
        'auditory': `
    - Use rhythmic patterns, mnemonics, and verbal explanations
    - Encourage the student to repeat concepts aloud
    - Use sound-based analogies and verbal walkthroughs`,
        'kinesthetic': `
    - Use hands-on examples, physical analogies, and movement-based explanations
    - Connect concepts to real-world physical activities
    - Suggest experiments or physical demonstrations`,
        'reading/writing': `
    - Provide structured written explanations with clear headings
    - Encourage note-taking and written summaries
    - Use lists, bullet points, and written definitions`,
        'all': `
    - ADAPTIVE STYLE: You decide which teaching method works best for each concept.
    - Visual concepts (geometry, diagrams, processes) → use visual descriptions and whiteboard.
    - Verbal/logical concepts (proofs, reasoning) → use clear verbal walkthroughs and mnemonics.
    - Hands-on concepts (experiments, forces) → use physical analogies and activities.
    - Mix styles freely — choose whatever will make the concept click for this student.`
    };

    return `
    <learning_style_instructions>
      <style>${normalized}</style>
      <hobbies>${hobbyList}</hobbies>
      <instructions>
        ${styleMap[normalized] || styleMap['visual']}
        - Connect examples to the student's hobbies: ${hobbyList}
        - Use analogies from their interests to explain complex concepts
      </instructions>
    </learning_style_instructions>`;
}

/** Build theme-specific visual instructions */
function buildThemeInstructions(theme: string): string {
    const themeMap: Record<string, { description: string; style: string }> = {
        'realistic': {
            description: 'Real-world, photorealistic educational diagrams',
            style: 'Clean, professional, textbook-style visuals with realistic representations'
        },
        'space': {
            description: 'Space and cosmic themed visuals',
            style: 'Dark backgrounds with stars, nebulae, futuristic tech aesthetics'
        },
        'anime': {
            description: 'Anime and manga style educational illustrations',
            style: 'Clean lines, expressive characters, vibrant colors, Japanese animation style'
        },
        'historical': {
            description: 'Historical and classical themed visuals',
            style: 'Vintage, classical art style, parchment textures, historical accuracy'
        },
        'action': {
            description: 'Action and adventure themed visuals',
            style: 'Dynamic angles, high energy, comic book style, dramatic lighting'
        }
    };

    const selected = themeMap[theme] || themeMap['realistic'];
    
    return `
    <visual_theme>
      <theme>${theme || 'realistic'}</theme>
      <description>${selected.description}</description>
      <style>${selected.style}</style>
      <image_generation_rule>When generating images, ALWAYS use this visual theme: ${selected.style}</image_generation_rule>
    </visual_theme>`;
}

/** Build image format instructions - always 9:16 for mobile */
function buildImageFormatInstructions(): string {
    return `
    <image_format>
      <aspect_ratio>MANDATORY: 9:16 Portrait (tall, vertical)</aspect_ratio>
      <instruction>CRITICAL: ALL images MUST be generated in 9:16 portrait format. 
      - Width: 9 units, Height: 16 units (tall rectangle)
      - NEVER generate landscape (16:9) images
      - NEVER generate square images
      - ALWAYS tall vertical format optimized for mobile phones
      - Text and diagrams must be large and readable on phone screens
      - This is a HARD REQUIREMENT - no exceptions</instruction>
      <penalty>If you generate 16:9 or square images, the user cannot see them properly on their phone.</penalty>
    </image_format>
    <image_series_rule>
      IMAGE SERIES: When introducing or explaining any topic, automatically call generate_image
      2–4 times in sequence, each with a DIFFERENT perspective on the same concept:
        • Call 1 — Overview/big-picture: the full concept in context
        • Call 2 — Close-up/detail: zoom into the key mechanism or structure
        • Call 3 — Real-world application: where this appears in the real world
        • Call 4 (optional) — Comparison/process: contrasting states or step-by-step sequence
      Each prompt must be self-contained and visually distinct. Do NOT generate the same image twice.
    </image_series_rule>`;
}

/** Build whiteboard mode instructions for formula explanations */
function buildWhiteboardInstructions(): string {
    return `
INTERACTIVE WHITEBOARD - TEACH LIKE A REAL TEACHER:

You have 3 whiteboard functions. Use them to write step-by-step on the student's screen, exactly like a teacher at a physical whiteboard.

═══ FUNCTIONS ═══

1. add_whiteboard_step({ title?, math, explanation })
   → Adds ONE step. The formula appears on screen and the explanation types out character by character.
   → First call only: include "title" (e.g. "Symmetric Relations Proof")
   → PAUSE after each step — ask a question, check understanding, wait for response
   → Then add the next step based on their answer

2. highlight_whiteboard_step({ stepIndex })
   → Highlights a specific step and scrolls the whiteboard to it
   → Use when saying "As we wrote earlier..." or "Look back at step 1..."
   → stepIndex is 0-based: first step = 0, second = 1, etc.

3. clear_whiteboard()
   → Clears all steps. Use when starting a completely new problem.

═══ FORMATTING RULES ═══
1. When writing a question on the board, start the explanation text with "QUESTION: ".
2. When answering or solving it, start the explanation text with "ANSWER: " or "SOLUTION: ".
3. KEEP MATH SHORT. The student is on a mobile phone screen. Use LaTeX \\\\ to break long equations into multiple logical lines so it does not overflow horizontally.
4. Do NOT leave dangling brackets \`)\]}\` on new lines by themselves.

═══ INTERACTIVE TEACHING FLOW ═══

Step 1: Write the problem with add_whiteboard_step
Step 2: PAUSE — ask the student: "Do you know the formula for X?"
Step 3: IF they know → "Great! Let's write it." → add_whiteboard_step with next step
         IF they don't know → Explain verbally → then add_whiteboard_step with the formula
Step 4: Highlight earlier steps when referring back → highlight_whiteboard_step(0)
Step 5: Continue until solution is complete

═══ EXAMPLES ═══

EXAMPLE A — (A+B)² problem:
  add_whiteboard_step({ title: "(A+B)² Problem", math: "(A+B)^2", explanation: "We need to expand this expression" })
  [PAUSE] "Do you know the formula for (A+B)²?"
  [Student knows] → add_whiteboard_step({ math: "(A+B)^2 = A^2 + 2AB + B^2", explanation: "The expansion formula" })
  [Student applies] → add_whiteboard_step({ math: "A^2 + 2AB + B^2", explanation: "Expanded form" })

EXAMPLE B — Symmetric relations proof:
  add_whiteboard_step({ title: "Symmetric Relations", math: "(L_1, L_2) \\in R \\Rightarrow L_1 \\perp L_2", explanation: "If pair L1,L2 is in R, then L1 is perpendicular to L2" })
  [PAUSE] "Now, if L1 ⊥ L2, what can we say about L2 and L1?"
  [Continue based on response]
  add_whiteboard_step({ math: "L_1 \\perp L_2 \\Rightarrow L_2 \\perp L_1", explanation: "Perpendicularity is symmetric" })
  highlight_whiteboard_step({ stepIndex: 0 })  ← refer back to step 1
  add_whiteboard_step({ math: "(L_2, L_1) \\in R", explanation: "Therefore R is symmetric ✓" })

EXAMPLE C — Chemistry equation:
  add_whiteboard_step({ title: "Water Electrolysis", math: "2H_2O \\rightarrow 2H_2 + O_2", explanation: "Water splits into hydrogen and oxygen" })
  [PAUSE] "What is the formula of water?"
  add_whiteboard_step({ math: "H_2O", explanation: "Two hydrogen atoms + one oxygen atom" })

═══ LATEX REFERENCE ═══
\\frac{a}{b}  \\sqrt{x}  x^{2}  x_{1}  \\pm  \\therefore  \\forall  \\in  \\notin
\\Rightarrow  \\perp  \\cap  \\cup  \\rightarrow  \\leftrightarrow  \\approx  \\neq

RULES:
1. NEVER add all steps at once — ONE step per function call
2. ALWAYS pause between steps to ask questions
3. Use highlight_whiteboard_step to refer back to earlier work
4. The student CANNOT see math unless you call add_whiteboard_step

═══ WHITEBOARD ANNOUNCEMENT ═══

Before calling add_whiteboard_step for the FIRST time on any topic, you MUST first say out loud
something like "Let me explain this on the whiteboard" or "Let me draw this out for you on the
whiteboard" — then immediately call add_whiteboard_step. Never silently open the whiteboard
without verbally announcing it first.

═══ WHITEBOARD + MEDIA INTEGRATION ═══

You also have two media tools: show_media(mediaIndex) and hide_media().
When you have already generated images or videos and are explaining on the whiteboard:
• Use show_media(-1) to pull up the most recently generated image/video mid-explanation.
  Example: "Let me show you the diagram we just created..." → call show_media(-1) → explain verbally → call hide_media().
• After showing and explaining the visual, call hide_media() to close it and return to the whiteboard.
• Never leave show_media open indefinitely — always follow it with hide_media() once explained.`;
}


/** Build interactive pause instructions for page references */
function buildInteractivePauseInstructions(): string {
    return `
    <interactive_references>
      <rule>When referencing a specific page or figure in the textbook, ALWAYS:</rule>
      <steps>
        1. Say: "If you look at page [PAGE_NUMBER] in your textbook..."
        2. Describe what they'll see: "You'll see Figure [X.X] which shows..."
        3. PAUSE and ask: "Are you on that page now? Can you see the figure?"
        4. STOP GENERATING AUDIO AND TEXT. WAIT for user confirmation (they'll say "yes" or "I'm there")
        5. Only continue after they confirm: "Great! Now notice how..."
      </steps>
      <example>
        ❌ BAD: "If you look at page 257, you'll see the diagram of electric fields which shows..."
        ✅ GOOD: "If you look at page 257 in your textbook, you'll see Figure 8.2 which shows the electric field lines. Are you on that page now? Can you see Figure 8.2?"
        [Wait for user to say "Yes" or "I'm there"]
        "Great! Now notice how the field lines curve around the charges..."
      </example>
      <voice_tone>Use a patient, encouraging tone. Give them time to find the page.</voice_tone>
    </interactive_references>
    <interactive_pauses>
      <rule>CRITICAL: Whenever you ask the user ANY question, you MUST STOP GENERATING IMMEDIATELY.</rule>
      <rule>NEVER answer your own question. NEVER say 'That's right!' or 'Exactly!' until the user has ACTUALLY spoken.</rule>
      <rule>Give the student time to think and speak. Do not rush them.</rule>
    </interactive_pauses>`;
}

/** Build page number extraction instructions */
function buildPageNumberInstructions(chapterText: string): string {
    // Try to extract actual page numbers from chapter text
    const pageMatches = chapterText.match(/page\s+(\d+)/gi);
    const pages = pageMatches ? [...new Set(pageMatches.map(p => p.match(/\d+/)?.[0]))].slice(0, 5) : [];
    
    return `
    <page_number_rules>
      <rule>ALWAYS use the ACTUAL PRINTED PAGE NUMBERS found physically written in the textbook content.</rule>
      <rule>WARNING: The text contains markers like "--- PAGE 9 ---". These are just absolute PDF file indices, NOT the printed page numbers! IGNORE the PDF markers.</rule>
      <rule>Look at the actual text surrounding the content to find the real printed page number (e.g., if you see the number "26" at the top or bottom of the text on that page, that is the real page number!).</rule>
      <rule>When the chapter text mentions a figure or diagram, note the printed page number where it appears.</rule>
      ${pages.length > 0 ? `<example_pages>Pages mentioned in this chapter: ${pages.join(', ')}</example_pages>` : ''}
      <instruction>Look for patterns like "Page 257", "on page 258", or floating numbers at the page boundaries in the source text and use those exact printed numbers when referring students to the textbook.</instruction>
    </page_number_rules>`;
}

type ScreenMode = 'overview' | 'chat';

export default function TutorChat() {
    const { bookId, chapterIndex } = useParams<{ bookId: string; chapterIndex: string }>();
    const navigate = useNavigate();
    const { profile } = useProfile();
    const { currentUser } = useAuth();
    const { textbooks, loadTextbooks, fetchChapterContent } = useTextbookParser();
    const { saveSession } = useSessions();

    // Content state
    const [chapterContent, setChapterContent] = useState<string | null>(null);
    const [answersContent, setAnswersContent] = useState<string | null>(null);
    const [chapterMetadata, setChapterMetadata] = useState<TextbookChapter | null>(null);
    const [subsections, setSubsections] = useState<Subsection[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Screen mode
    const [screenMode, setScreenMode] = useState<ScreenMode>('overview');
    const [focusTopic, setFocusTopic] = useState<string | null>(null);

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([]);



    // Voice mode with selected voice from profile
    const {
        isConnected,
        isConnecting,
        isMuted,
        status,
        statusDisplay,
        currentImage,
        generatedMedia,
        isGeneratingImage,
        whiteboardState,
        connect,
        disconnect,
        toggleMute,
        sendClientMessage,
        startVideoCapture,
        stopVideoCapture,
        completeWhiteboardStep,
        isMediaFocused,
        hideMedia,
    } = useGeminiLive(
        'tutor',
        (msgs, media) => {
            // Save to Firestore as tutor mode (now includes generated media)
            saveSession('tutor', msgs, undefined, undefined, media);
            
            // Also sync to chat messages so user sees conversation when returning to chat
            if (msgs.length > 0) {
                const chatMsgs: ChatMessage[] = msgs.map(m => ({
                    role: m.role === 'ai' ? 'model' : 'user',
                    text: m.text
                }));
                setMessages(chatMsgs);
            }
        },
        profile?.voiceName || 'Victoria'
    );

    const [voiceMode, setVoiceMode] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<GeneratedMedia | null>(null);
    const [isPlayingVideo, setIsPlayingVideo] = useState(false);
    const mediaGalleryRef = useRef<HTMLDivElement>(null);
    const prevMediaLengthRef = useRef(0);

    // Auto-scroll and auto-expand new images when autoAdvanceCarousel is enabled
    useEffect(() => {
        const autoAdvance = profile?.autoAdvanceCarousel ?? true;
        
        // Check if new media was added
        if (generatedMedia.length > prevMediaLengthRef.current) {
            const newMedia = generatedMedia[generatedMedia.length - 1];
            
            // Auto-scroll to media gallery
            if (mediaGalleryRef.current) {
                mediaGalleryRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            
            // Auto-expand the new media if auto-advance is enabled
            if (autoAdvance && voiceMode) {
                // Small delay to let the thumbnail render first
                const timer = setTimeout(() => {
                    setSelectedMedia(newMedia);
                }, 500);
                return () => clearTimeout(timer);
            }
        }
        
        prevMediaLengthRef.current = generatedMedia.length;
    }, [generatedMedia, profile?.autoAdvanceCarousel, voiceMode]);
    


    // Book data
    useEffect(() => {
        if (textbooks.length === 0) loadTextbooks(currentUser?.uid);
    }, [textbooks.length, loadTextbooks, currentUser?.uid]);

    // Load chapter content
    useEffect(() => {
        const book = textbooks.find(b => b.id === bookId);
        if (!book) return;

        const idx = parseInt(chapterIndex || '0', 10);
        const ch = book.chapters.find(c => c.index === idx);
        if (!ch) { setError('Chapter not found.'); return; }

        setChapterMetadata(ch);

        const load = async () => {
            try {
                if (!currentUser?.uid) {
                    throw new Error('User not authenticated. Please log in again.');
                }

                const text = await fetchChapterContent(ch.storagePath, book.id, ch.index, currentUser.uid);
                if (!text) throw new Error('Could not retrieve chapter text.');
                setChapterContent(text);

                setSubsections(ch.subsections || []);

                if (ch.answersStoragePath) {
                    try {
                        const ans = await fetchChapterContent(ch.answersStoragePath, book.id, ch.index, currentUser.uid);
                        if (ans) setAnswersContent(ans);
                    } catch (e) {
                        console.warn('[TutorChat] Failed to load answers:', e);
                    }
                }
            } catch (e: any) {
                console.error('[TutorChat] Failed to load chapter:', e);
                setError(e.message || 'Failed to load chapter content.');
            }
        };

        if (!chapterContent) load();
    }, [textbooks, bookId, chapterIndex, currentUser?.uid, fetchChapterContent, chapterContent]);

    // Cleanup on unmount - stop video stream and disconnect
    useEffect(() => {
        return () => {
            stopVideo();
            disconnect();
        };
    }, []);


    // Auto-exit voice mode if connection drops unexpectedly mid-session
    useEffect(() => {
        if (voiceMode && !isConnecting && !isConnected) {
            setVoiceMode(false);
        }
    }, [voiceMode, isConnecting, isConnected]);

    // Build system instruction for Gemini
    const buildSystemInstruction = useCallback((topicFocus: string | null) => {
        const chapterName = chapterMetadata?.title.replace(/^Chapter\s+\d+[:\-]?\s*/i, '') || '';
        const firstName = profile?.name?.split(' ')[0] || 'Student';
        const hobbies = profile?.hobbies || [];
        const learningStyle = profile?.learningStyle || 'Visual';
        const theme = profile?.theme || 'realistic';
        const autoAdvance = profile?.autoAdvanceCarousel ?? true;
        const language = profile?.language || 'English';

        return `
<system_instruction>
  <identity>
    <role>Warm, encouraging Private Academic Tutor</role>
    <name>Mama AI</name>
  </identity>

  <student_profile>
    <name>${firstName}</name>
    <preferred_language>${language}</preferred_language>
    <grade>${profile?.age || 'High School'}</grade>
    ${buildLearningStyleInstructions(learningStyle, hobbies)}
    ${buildThemeInstructions(theme)}
    ${buildImageFormatInstructions()}
    ${buildWhiteboardInstructions()}
    <auto_advance_carousel>${autoAdvance ? 'ENABLED' : 'DISABLED'}</auto_advance_carousel>
  </student_profile>

  <chapter_context>
    <chapter_name>${chapterName}</chapter_name>
    ${topicFocus ? `<current_focus_topic>${topicFocus}</current_focus_topic>` : ''}
  </chapter_context>

  <source_material>
    <chapter_text>
${chapterContent ? chapterContent.substring(0, 15000) : ''}
    </chapter_text>
${answersContent ? `    <answers_reference>
      <!-- PRIVATE: Official answers. Use to verify, guide, NEVER reveal directly. -->
${answersContent.substring(0, 5000)}
    </answers_reference>` : ''}
  </source_material>

  <capabilities>
    <capability>The student can share photos of their handwritten work, diagrams, or problems using their camera. When they share an image, review it carefully and provide specific, constructive feedback.</capability>
    <capability>You can generate visual aids (images/videos) to help explain concepts. Use these when visual explanations would be helpful.</capability>
  </capabilities>

  ${buildPageNumberInstructions(chapterContent || '')}
  ${buildInteractivePauseInstructions()}

  <rules>
    <rule>Be warm, encouraging, and personal — use the student's name "${firstName}" occasionally (2-3 times per conversation).</rule>
    <rule>ONLY teach from the <source_material> provided. If topic is outside this chapter, redirect gently.</rule>
    <rule>When a student asks for an answer — NEVER reveal it. Guide them step-by-step until they figure it out.</rule>
    <rule>When referencing a diagram or figure, mention the ACTUAL page number from the textbook so the student can open the book. E.g., "If you flip to page 257 in your textbook, you'll see Figure 8.2 — it makes this much clearer!"</rule>
    <rule>For Physics/Math/Chemistry: always show formulas step by step. Never skip steps.</rule>
    <rule>After explaining a concept, briefly check understanding with a short quiz question.</rule>
    <rule>Reply in simple, conversational language. Avoid heavy jargon unless teaching it with definition.</rule>
    <rule>Use supportive phrases like "Great question!", "You're on the right track!", "Let me break that down."</rule>
    <rule>Respond in the student's <preferred_language>.</rule>
    <rule>ONLY use the student's hobbies (${hobbies.join(', ') || 'general interests'}) for COMPLEX or DIFFICULT concepts that need analogies. For simple concepts, explain directly without hobby references. Use hobbies sparingly — at most once per explanation, only when it genuinely helps understanding.</rule>
    <rule>When generating images, ALWAYS apply the visual theme: ${theme}. Images MUST be in 9:16 portrait format for mobile viewing.</rule>
    <rule>${autoAdvance ? 'When you generate images, present them one at a time, explain each fully, then automatically move to the next.' : 'When you generate images, present them all at once and let the user click through them manually.'}</rule>
    <rule>VIDEO RULE: Automatically generate one video per topic. Only generate a second video for the same topic if the student explicitly requests it (e.g. "show me another video", "animate that differently"). Never auto-generate more than one video per concept.</rule>
    <rule>WHITEBOARD + MEDIA: When on the whiteboard and you have previously generated images or videos, use show_media(-1) to briefly pull up the most relevant visual mid-explanation, explain it, then call hide_media() to return to the whiteboard. ${autoAdvance ? 'Auto-advance is ON: manage the transition yourself — show the visual, explain it, then call hide_media() before continuing.' : 'Auto-advance is OFF: wait for the student to indicate they are done viewing before calling hide_media().'}</rule>
    <rule>When referencing textbook pages, ALWAYS pause and ask if the student has found the page before continuing.</rule>
    ${topicFocus ? `<rule>The student has chosen to focus on "${topicFocus}" — start by giving a clear, friendly introduction to this specific topic.</rule>` : ''}
  </rules>
</system_instruction>`.trim();
    }, [chapterContent, answersContent, chapterMetadata, profile]);

    // Enter conversation mode
    const enterChat = useCallback((topic: string | null = null) => {
        if (!chapterContent || !chapterMetadata) return;
        setFocusTopic(topic);
        setScreenMode('chat');

        const chapterName = chapterMetadata.title.replace(/^Chapter\s+\d+[:\-]?\s*/i, '');
        const firstName = profile?.name?.split(' ')[0] || 'there';

        const greeting = topic
            ? `Hi ${firstName}! Let's dive into **${topic}** from Chapter ${chapterMetadata.index}. I'll walk you through this clearly — feel free to ask me anything as we go. Ready? 🚀`
            : `Hi ${firstName}! I've just reviewed **${chapterName}** for you. Ask me anything — I'll explain every concept, guide you through problems step by step, and if there's a helpful diagram in the textbook I'll point you to the exact page. Let's go! 📖`;

        setMessages([{ role: 'model', text: greeting }]);
    }, [chapterContent, chapterMetadata, profile]);


    // Toggle voice mode
    const handleVoiceToggle = async () => {
        if (!voiceMode) {
            setVoiceMode(true);
            try {
                await connect(buildSystemInstruction(focusTopic), undefined, null,
                    isVideoActive ? videoRef.current : null
                );
            } catch (e: any) {
                // Connection failed (e.g. mic denied) — exit voice mode
                setVoiceMode(false);
            }
        } else {
            disconnect();
            stopVideo();
            setVoiceMode(false);
        }
    };

    // Update connection when toggling camera during voice session
    const handleVideoToggleDuringVoice = async () => {
        if (isVideoActive) {
            // Stop stream and frame capture without touching the Live API connection
            stopVideo();
        } else {
            // Start stream first, then attach vision to the existing session
            await startVideo();
            if (isConnected && voiceMode && videoRef.current) {
                // Attach video frame capture to the live session directly - no disconnect needed
                startVideoCapture(videoRef.current);
            }
        }
    };

    // Live camera streaming state (like Lab mode)
    const [isVideoActive, setIsVideoActive] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Stop live camera stream
    const stopVideo = () => {
        stopVideoCapture();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsVideoActive(false);
        setCameraError(null);
    };

    // Start live camera stream
    const startVideo = async () => {
        setCameraError(null);
        try {
            const isMobile = /iphone|ipad|android/i.test(navigator.userAgent);
            const primaryConstraints: MediaStreamConstraints = isMobile
                ? { video: { facingMode: 'environment' } }
                : { video: true };

            let stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);

            if (videoRef.current) {
                const videoElement = videoRef.current;
                videoElement.srcObject = stream;
                const playVideo = () => {
                    videoElement.play().catch(err => {
                        console.warn('[TutorChat] video.play() failed:', err);
                        setCameraError('Camera started but video could not be displayed. Click the page and toggle the camera again.');
                    });
                };
                if ('onloadedmetadata' in videoElement) {
                    videoElement.onloadedmetadata = playVideo;
                } else {
                    playVideo();
                }
            }

            streamRef.current = stream;
            setIsVideoActive(true);
        } catch (err: any) {
            console.error("Failed to start camera:", err);

            if (err.name === 'OverconstrainedError') {
                // Retry with a very simple constraint set
                try {
                    const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    if (videoRef.current) {
                        const videoElement = videoRef.current;
                        videoElement.srcObject = fallbackStream;
                        const playVideo = () => {
                            videoElement.play().catch(playErr => {
                                console.warn('[TutorChat] fallback video.play() failed:', playErr);
                                setCameraError('Fallback camera started but video could not be displayed.');
                            });
                        };
                        if ('onloadedmetadata' in videoElement) {
                            videoElement.onloadedmetadata = playVideo;
                        } else {
                            playVideo();
                        }
                    }
                    streamRef.current = fallbackStream;
                    setIsVideoActive(true);
                    setCameraError(null);
                    return;
                } catch (fallbackErr) {
                    console.error('[TutorChat] Fallback camera failed:', fallbackErr);
                }
            }

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setCameraError('Camera permission denied. Please allow camera access.');
            } else if (err.name === 'NotFoundError') {
                setCameraError('No camera found on this device.');
            } else {
                setCameraError('Could not access camera.');
            }
        }
    };

    // Toggle live camera
    const toggleVideo = () => {
        if (isVideoActive) {
            stopVideo();
        } else {
            startVideo();
        }
    };



    // Strip "Chapter N:" prefix helper
    const chapterDisplayName = chapterMetadata?.title.replace(/^Chapter\s+\d+[:\-]?\s*/i, '') || '';

    // ── Error ──────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-full p-6 text-center">
                <h2 className="text-xl font-bold mb-2 text-red-600">Error</h2>
                <p className="text-zinc-500 mb-4">{error}</p>
                <button onClick={() => navigate(-1)} className="text-amber-600 font-bold underline">Go Back</button>
            </div>
        );
    }

    // ── Loading ────────────────────────────────────────────────────────────
    if (!chapterContent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh p-6 bg-[rgb(250,249,245)]">
                <Loader2 className="animate-spin text-amber-500 mb-4" size={40} />
                <h2 className="text-lg font-bold text-zinc-700">Loading Chapter...</h2>
                <p className="text-sm font-medium text-zinc-400 mt-2 text-center max-w-xs">
                    Setting up your personalised tutor session.
                </p>
            </div>
        );
    }

    // ── OVERVIEW SCREEN ─────────────────────────────────────────────────────
    if (screenMode === 'overview') {
        const greeting = buildGreeting(profile?.name || '', chapterDisplayName);

        return (
            <div className="flex flex-col h-dvh bg-[rgb(250,249,245)] text-zinc-900 absolute inset-0 z-50">
                {/* Header */}
                <div className="bg-white border-b border-zinc-200 px-4 py-3 safe-area-pt shadow-sm flex items-center gap-3 sticky top-0 z-10">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 hover:bg-zinc-200 transition-colors shrink-0"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-sm font-bold text-zinc-900">
                            Chapter {chapterMetadata?.index}
                        </h1>
                        <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide leading-tight">
                            {chapterDisplayName}
                        </p>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto pb-32">
                    {/* Greeting card */}
                    <div className="px-4 pt-5 pb-2">
                        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                                    <Sparkles size={20} className="text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm leading-relaxed text-zinc-800">
                                        {greeting.split('**').map((part, i) =>
                                            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Subsection list */}
                    {subsections.length > 0 && (
                        <div className="px-4 pt-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 ml-1">
                                Topics in this chapter
                            </p>
                            <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden">
                                {subsections.map((sub, idx) => (
                                    <div
                                        key={sub.num}
                                        className={`flex items-center gap-3 px-4 py-3 ${idx !== subsections.length - 1 ? 'border-b border-zinc-100' : ''
                                            }`}
                                    >
                                        <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 shrink-0 min-w-[38px] text-center">
                                            {sub.num}
                                        </span>
                                        <span className="text-sm font-medium text-zinc-700">
                                            {sub.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom CTA */}
                <div className="absolute bottom-0 left-0 right-0 safe-area-pb bg-linear-to-t from-[rgb(250,249,245)] via-[rgb(250,249,245)] to-transparent pt-6 pb-5 px-4">
                    <button
                        onClick={() => { 
                            playModeEntrySound();
                            enterChat(null); 
                            handleVoiceToggle(); 
                        }}
                        className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-bold text-base py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2.5 transition-all mb-2"
                    >
                        <Mic size={22} />
                        Let's Talk — Start Voice Session
                    </button>
                    <button
                        onClick={() => enterChat(null)}
                        className="w-full bg-white border border-zinc-200 hover:border-amber-300 text-zinc-700 font-semibold text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all"
                    >
                        <Zap size={16} className="text-amber-500" />
                        Start with Text Chat Instead
                    </button>
                </div>
            </div>
        );
    }

    // ── FULL-SCREEN VOICE MODE ────────────────────────────────────────────────
    if (voiceMode) {
        // Check if we have content to display (image or active generation)
        const hasVisualContent = currentImage || isGeneratingImage || generatedMedia.length > 0;
        
        return (
            <div className="flex flex-col h-dvh bg-[rgb(250,249,245)] text-zinc-900 overflow-hidden absolute inset-0 z-50">
                {/* Header with Status */}
                <div className="absolute top-0 inset-x-0 z-30 px-4 pt-4 pb-2 bg-white/90 backdrop-blur-md border-b border-zinc-200">
                    <div className="flex items-center justify-between mb-2">
                        <button onClick={() => { disconnect(); stopVideo(); setVoiceMode(false); }} className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-colors">
                            <ArrowLeft size={18} className="text-zinc-600" />
                        </button>
                        
                        {/* Status text moved to header */}
                        <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                            isMuted 
                                ? 'bg-zinc-100 text-zinc-500' 
                                : statusDisplay.color === 'green'
                                    ? 'bg-green-100 text-green-700'
                                    : statusDisplay.color === 'purple'
                                        ? 'bg-purple-100 text-purple-700'
                                        : statusDisplay.color === 'blue'
                                            ? 'bg-blue-100 text-blue-700'
                                            : statusDisplay.color === 'orange'
                                                ? 'bg-orange-100 text-orange-700'
                                                : 'bg-amber-100 text-amber-700'
                        }`}>
                            {isMuted ? 'Muted' : statusDisplay.text}
                        </div>
                        
                        <div className="w-10"></div>
                    </div>
                    
                    {/* Chapter info - full width, no truncation issues */}
                    <div className="text-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Chapter {chapterMetadata?.index}</span>
                        <h2 className="text-sm font-bold text-amber-600 uppercase tracking-wide mt-0.5 leading-tight">
                            {focusTopic || chapterDisplayName}
                        </h2>
                    </div>
                </div>

                {/* Main Visual Area */}
                <main className="flex-1 relative flex items-center justify-center overflow-hidden pt-28 pb-4">
                    {/* Live Video Feed (when camera is active) */}
                    <div className={`absolute inset-0 z-20 transition-opacity duration-500 ${isVideoActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                        {/* Live indicator */}
                        {isVideoActive && (
                            <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-2 shadow-lg">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                <span className="text-xs font-bold uppercase tracking-wide">Live</span>
                            </div>
                        )}
                    </div>

                    {/* Camera Error */}
                    {cameraError && (
                        <div className="absolute top-20 left-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium shadow-md z-30 text-center">
                            {cameraError}
                        </div>
                    )}

                    <div className="relative flex flex-col items-center justify-center z-10 w-full h-full px-4">
                        {isConnected ? (
                            <>
                                {/* PRIORITY 1: Whiteboard for formula explanations (hidden when show_media is active) */}
                                {(whiteboardState.isActive || whiteboardState.steps.length > 0) && !isMediaFocused ? (
                                    <div className="w-full h-full max-w-[400px]">
                                        <WhiteboardView
                                            whiteboardState={whiteboardState}
                                            onStepComplete={completeWhiteboardStep}
                                        />
                                    </div>
                                ) :
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
                                        {/* Back to Whiteboard button — shown when media was called from whiteboard */}
                                        {isMediaFocused && whiteboardState.steps.length > 0 && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); hideMedia(); }}
                                                className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold text-amber-700 border border-amber-200 shadow-sm"
                                            >
                                                <ChevronLeft size={14} /> Back to Whiteboard
                                            </button>
                                        )}
                                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4">
                                            <p className="text-white text-sm font-medium flex items-center gap-2">
                                                <ImageIcon size={16} />
                                                Tap to expand
                                            </p>
                                        </div>
                                    </div>
                                ) : isGeneratingImage ? (
                                    /* Show loading state when generating */
                                    <div className="flex flex-col items-center justify-center">
                                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${
                                            statusDisplay.color === 'purple' ? 'bg-purple-500' : 'bg-amber-500'
                                        }`}>
                                            <Loader2 size={40} className="text-white animate-spin" />
                                        </div>
                                        <p className="text-lg font-bold text-zinc-700">{statusDisplay.text}</p>
                                    </div>
                                ) : (
                                    /* No visual - show mic in center */
                                    <>
                                        {/* Status indicator with dynamic color */}
                                        <div className={`absolute w-48 h-48 rounded-full animate-ping ${statusDisplay.color === 'green' ? 'bg-green-500/10' : statusDisplay.color === 'blue' ? 'bg-blue-500/10' : statusDisplay.color === 'orange' ? 'bg-orange-500/10' : 'bg-amber-500/10'}`} />
                                        <div className={`absolute w-64 h-64 rounded-full animate-pulse ${statusDisplay.color === 'green' ? 'bg-green-500/5' : statusDisplay.color === 'blue' ? 'bg-blue-500/5' : statusDisplay.color === 'orange' ? 'bg-orange-500/5' : 'bg-amber-500/5'}`} />
                                        
                                        {/* Main mic indicator */}
                                        <div className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
                                            isMuted 
                                                ? 'bg-zinc-200 text-zinc-500 shadow-zinc-200/50' 
                                                : statusDisplay.color === 'green'
                                                    ? 'bg-green-500 text-white shadow-green-500/50 scale-110'
                                                    : statusDisplay.color === 'blue'
                                                        ? 'bg-blue-500 text-white shadow-blue-500/50'
                                                        : statusDisplay.color === 'orange'
                                                            ? 'bg-orange-500 text-white shadow-orange-500/50'
                                                            : 'bg-amber-500 text-white shadow-amber-500/50'
                                        }`}>
                                            {isMuted ? <MicOff size={48} /> : <Mic size={48} />}
                                        </div>
                                        
                                        {/* Status text below mic */}
                                        <p className={`mt-8 text-xl font-bold tracking-wide transition-colors duration-300 text-center px-4 ${
                                            statusDisplay.color === 'green' ? 'text-green-600' : 
                                            statusDisplay.color === 'blue' ? 'text-blue-600' :
                                            statusDisplay.color === 'orange' ? 'text-orange-600' :
                                            'text-zinc-900'
                                        }`}>
                                            {statusDisplay.text}
                                        </p>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-amber-600">
                                <Loader2 size={48} className="animate-spin" />
                                <p className="text-lg font-medium animate-pulse">Connecting to Mama AI...</p>
                            </div>
                        )}
                    </div>
                </main>

                {/* Media Gallery Bar - Above Bottom Controls */}
                {generatedMedia.length > 0 && (
                    <div ref={mediaGalleryRef} className="bg-white border-t border-zinc-200 px-4 py-3 z-20">
                        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider shrink-0 bg-zinc-100 px-2 py-1 rounded-lg">
                                Generated ({generatedMedia.length})
                            </span>
                            {generatedMedia.map((media, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedMedia(media)}
                                    className={`shrink-0 relative rounded-xl overflow-hidden border-2 transition-all ${
                                        selectedMedia?.url === media.url 
                                            ? 'border-amber-500 ring-2 ring-amber-200' 
                                            : 'border-zinc-200 hover:border-amber-300'
                                    }`}
                                    style={{ width: '56px', height: '56px' }}
                                >
                                    {media.type === 'image' ? (
                                        <img 
                                            src={media.url} 
                                            alt={`Generated ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                            <Play size={16} className="text-white" />
                                        </div>
                                    )}
                                    {selectedMedia?.url === media.url && (
                                        <div className="absolute inset-0 bg-amber-500/20" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}


                {/* Bottom Control Bar */}
                <div className="bg-white border-t border-zinc-200 p-6 pb-8 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between max-w-sm mx-auto">
                        {/* Live Camera Toggle */}
                        <button 
                            onClick={handleVideoToggleDuringVoice}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-colors ${
                                isVideoActive 
                                    ? 'bg-red-100 border-red-300' 
                                    : 'bg-zinc-50 border-zinc-200 group-hover:bg-zinc-100'
                            }`}>
                                {isVideoActive ? <Video size={24} className="text-red-600" /> : <VideoOff size={24} className="text-zinc-600" />}
                            </div>
                            <span className={`text-xs font-medium ${isVideoActive ? 'text-red-600' : 'text-zinc-500'}`}>
                                {isVideoActive ? 'Live' : 'Camera'}
                            </span>
                        </button>

                        {/* Mic Button */}
                        <button onClick={toggleMute} className="flex flex-col items-center gap-2 group">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${
                                isConnected 
                                    ? isMuted 
                                        ? 'bg-zinc-100 border-zinc-300 text-zinc-500' 
                                        : statusDisplay.color === 'green'
                                            ? 'bg-green-500 border-green-400 text-white shadow-green-500/30 scale-110'
                                            : statusDisplay.color === 'purple'
                                                ? 'bg-purple-500 border-purple-400 text-white shadow-purple-500/30'
                                                : statusDisplay.color === 'blue'
                                                    ? 'bg-blue-500 border-blue-400 text-white shadow-blue-500/30'
                                                    : statusDisplay.color === 'orange'
                                                        ? 'bg-orange-500 border-orange-400 text-white shadow-orange-500/30'
                                                        : 'bg-amber-500 border-amber-400 text-white shadow-amber-500/30 scale-110'
                                    : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                            }`}>
                                {isConnected && !isMuted ? <Mic size={28} /> : <MicOff size={28} />}
                            </div>
                            <span className={`text-xs font-medium ${
                                isConnected && !isMuted 
                                    ? statusDisplay.color === 'green' ? 'text-green-600' : 
                                      statusDisplay.color === 'purple' ? 'text-purple-600' :
                                      statusDisplay.color === 'blue' ? 'text-blue-600' :
                                      statusDisplay.color === 'orange' ? 'text-orange-600' :
                                      'text-amber-600'
                                    : 'text-zinc-500'
                            }`}>Mic</span>
                        </button>

                        {/* End Session Button */}
                        <button onClick={() => { 
                            disconnect(); 
                            stopVideo();
                            setVoiceMode(false); 
                            // Check if there's actual conversation (more than just greeting)
                            // Messages synced from voice mode don't include greeting
                            if (messages.length <= 1) {
                                // No real conversation, go back to overview
                                setScreenMode('overview');
                            } else {
                                // Show conversation history
                                setScreenMode('chat');
                            }
                        }} className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center border border-red-100 group-hover:bg-red-100 transition-colors">
                                <X size={24} className="text-red-500" />
                            </div>
                            <span className="text-xs font-medium text-red-500">End Session</span>
                        </button>
                    </div>
                </div>

                {/* Media Fullscreen Modal */}
                {selectedMedia && (
                    <div 
                        className="fixed inset-0 z-50 bg-black/95 flex flex-col"
                        onClick={() => {
                            setSelectedMedia(null);
                            setIsPlayingVideo(false);
                        }}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
                            <div className="flex items-center gap-2">
                                {selectedMedia.type === 'image' ? (
                                    <ImageIcon size={20} className="text-white/70" />
                                ) : (
                                    <Play size={20} className="text-white/70" />
                                )}
                                <span className="text-white/70 text-sm font-medium">
                                    {selectedMedia.type === 'image' ? 'Visual Aid' : 'Video Explanation'}
                                </span>
                            </div>
                            <button 
                                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMedia(null);
                                    setIsPlayingVideo(false);
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Media Content - 9:16 Aspect Ratio for Mobile */}
                        <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                            <div className="relative w-full max-w-[380px] mx-auto">
                                {selectedMedia.type === 'image' ? (
                                    <div className="relative rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl" style={{ aspectRatio: '9/16', maxHeight: '80vh' }}>
                                        <img 
                                            src={selectedMedia.url} 
                                            alt="Full size" 
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="relative rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl" style={{ aspectRatio: '9/16', maxHeight: '80vh' }}>
                                        <video 
                                            src={selectedMedia.url}
                                            controls
                                            autoPlay={isPlayingVideo}
                                            className="w-full h-full object-contain"
                                            onPlay={() => setIsPlayingVideo(true)}
                                            onPause={() => setIsPlayingVideo(false)}
                                        />
                                        {!isPlayingVideo && (
                                            <button 
                                                className="absolute inset-0 flex items-center justify-center bg-black/40"
                                                onClick={() => setIsPlayingVideo(true)}
                                            >
                                                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                                                    <Play size={32} className="text-zinc-900 ml-1" />
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Navigation Arrows */}
                                {generatedMedia.length > 1 && (
                                    <>
                                        <button
                                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const currentIdx = generatedMedia.findIndex(m => m.url === selectedMedia.url);
                                                const prevIdx = currentIdx > 0 ? currentIdx - 1 : generatedMedia.length - 1;
                                                setSelectedMedia(generatedMedia[prevIdx]);
                                                setIsPlayingVideo(false);
                                            }}
                                        >
                                            <ChevronLeft size={24} />
                                        </button>
                                        <button
                                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const currentIdx = generatedMedia.findIndex(m => m.url === selectedMedia.url);
                                                const nextIdx = currentIdx < generatedMedia.length - 1 ? currentIdx + 1 : 0;
                                                setSelectedMedia(generatedMedia[nextIdx]);
                                                setIsPlayingVideo(false);
                                            }}
                                        >
                                            <ChevronRight size={24} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Caption / Info */}
                        <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
                            {selectedMedia.prompt && (
                                <p className="text-white/80 text-sm text-center max-w-md mx-auto line-clamp-2">
                                    {selectedMedia.prompt}
                                </p>
                            )}
                            <p className="text-white/40 text-xs text-center mt-2">
                                {generatedMedia.findIndex(m => m.url === selectedMedia.url) + 1} of {generatedMedia.length}
                                {selectedMedia.type === 'video' && ' • Video'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── TEXT CONVERSATION SCREEN ────────────────────────────────────────────
    return (
        <div className="flex flex-col h-dvh bg-zinc-50 text-zinc-900 absolute inset-0 z-50">
            {/* Header */}
            <div className="bg-white/90 backdrop-blur-md border-b border-zinc-200 px-4 py-3 safe-area-pt shadow-sm flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setScreenMode('overview')}
                        className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 hover:bg-zinc-200 transition-colors shrink-0"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-sm font-bold text-zinc-900 truncate">
                            Conversation History
                        </h1>
                        <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide truncate">
                            Chapter {chapterMetadata?.index} • {chapterDisplayName}
                        </p>
                    </div>
                </div>
            </div>

            {/* Generated Media Gallery - Shows images/videos from voice session */}
            {generatedMedia.length > 0 && (
                <div className="bg-white border-b border-zinc-200 px-4 py-3">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                        Generated Visuals ({generatedMedia.length})
                    </p>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                        {generatedMedia.map((media, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedMedia(media)}
                                className="shrink-0 relative rounded-xl overflow-hidden border-2 border-zinc-200 hover:border-amber-400 transition-all"
                                style={{ width: '80px', height: '80px' }}
                            >
                                {media.type === 'image' ? (
                                    <img 
                                        src={media.url} 
                                        alt={`Generated ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                        <Play size={20} className="text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-6 scrollbar-hide flex flex-col gap-4">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && (
                            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mr-2 mt-1">
                                <Sparkles size={14} className="text-amber-600" />
                            </div>
                        )}
                        <div className={`max-w-[82%] rounded-3xl px-5 py-3.5 shadow-sm text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-amber-500 text-white rounded-tr-sm'
                                : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm'
                            }`}>
                            {/* Image attachment */}
                            {msg.imageUrl && (
                                <div className="mb-2 rounded-xl overflow-hidden border border-white/30">
                                    <img 
                                        src={msg.imageUrl} 
                                        alt="Shared" 
                                        className="max-w-full max-h-40 object-cover"
                                    />
                                </div>
                            )}
                            {/* Text content */}
                            {msg.text.split('**').map((part, idx) =>
                                idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input bar - Voice Session Re-entry Only */}
            <div className="bg-white border-t border-zinc-200 p-3 sm:p-4 safe-area-pb">
                <button
                    onClick={() => {
                        playModeEntrySound();
                        handleVoiceToggle();
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                >
                    <Mic size={20} />
                    Resume Voice Session
                </button>
            </div>

            {/* Media Fullscreen Modal */}
            {selectedMedia && (
                <div 
                    className="fixed inset-0 z-50 bg-black/95 flex flex-col"
                    onClick={() => {
                        setSelectedMedia(null);
                        setIsPlayingVideo(false);
                    }}
                >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
                        <div className="flex items-center gap-2">
                            {selectedMedia.type === 'image' ? (
                                <ImageIcon size={20} className="text-white/70" />
                            ) : (
                                <Play size={20} className="text-white/70" />
                            )}
                            <span className="text-white/70 text-sm font-medium">
                                {selectedMedia.type === 'image' ? 'Visual Aid' : 'Video Explanation'}
                            </span>
                        </div>
                        <button 
                            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMedia(null);
                                setIsPlayingVideo(false);
                            }}
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Media Content - 9:16 Aspect Ratio for Mobile */}
                    <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="relative w-full max-w-[380px] mx-auto">
                            {selectedMedia.type === 'image' ? (
                                <div className="relative rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl" style={{ aspectRatio: '9/16', maxHeight: '80vh' }}>
                                    <img 
                                        src={selectedMedia.url} 
                                        alt="Full size" 
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="relative rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl" style={{ aspectRatio: '9/16', maxHeight: '80vh' }}>
                                    <video 
                                        src={selectedMedia.url}
                                        controls
                                        autoPlay={isPlayingVideo}
                                        className="w-full h-full object-contain"
                                        onPlay={() => setIsPlayingVideo(true)}
                                        onPause={() => setIsPlayingVideo(false)}
                                    />
                                    {!isPlayingVideo && (
                                        <button 
                                            className="absolute inset-0 flex items-center justify-center bg-black/40"
                                            onClick={() => setIsPlayingVideo(true)}
                                        >
                                            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                                                <Play size={32} className="text-zinc-900 ml-1" />
                                            </div>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Navigation Arrows */}
                            {generatedMedia.length > 1 && (
                                <>
                                    <button
                                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const currentIdx = generatedMedia.findIndex(m => m.url === selectedMedia.url);
                                            const prevIdx = currentIdx > 0 ? currentIdx - 1 : generatedMedia.length - 1;
                                            setSelectedMedia(generatedMedia[prevIdx]);
                                            setIsPlayingVideo(false);
                                        }}
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button
                                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const currentIdx = generatedMedia.findIndex(m => m.url === selectedMedia.url);
                                            const nextIdx = currentIdx < generatedMedia.length - 1 ? currentIdx + 1 : 0;
                                            setSelectedMedia(generatedMedia[nextIdx]);
                                            setIsPlayingVideo(false);
                                        }}
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Caption / Info */}
                    <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
                        {selectedMedia.prompt && (
                            <p className="text-white/80 text-sm text-center max-w-md mx-auto line-clamp-2">
                                {selectedMedia.prompt}
                            </p>
                        )}
                        <p className="text-white/40 text-xs text-center mt-2">
                            {generatedMedia.findIndex(m => m.url === selectedMedia.url) + 1} of {generatedMedia.length}
                            {selectedMedia.type === 'video' && ' • Video'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
