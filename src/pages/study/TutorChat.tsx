import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, X, ArrowLeft, Mic, MicOff, Loader2, Send, Zap, BookOpen, Sparkles } from 'lucide-react';
import { useTextbookParser, TextbookChapter } from '../../hooks/useTextbookParser';
import { useProfile } from '../../hooks/useProfile';
import { GoogleGenAI } from '@google/genai';
import { useGeminiLive } from '../../hooks/useGeminiLive';
import { useSessions } from '../../hooks/useSessions';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

interface Subsection {
    num: string;   // e.g. "1.1"
    title: string; // e.g. "Introduction"
}

// Note: Subsections are now passed cleanly from the ZipExtractor TOC.

/** Personalized greeting messages for the chapter overview */
function buildGreeting(name: string, chapterTitle: string): string {
    const firstName = name?.split(' ')[0] || 'there';
    const options = [
        `Hey ${firstName}! 👋 Ready to explore **${chapterTitle}**? It's a really fascinating chapter — tap any topic below or hit the button to jump in!`,
        `Welcome back, ${firstName}! Today we're unlocking **${chapterTitle}**. Tap a topic below to zoom into what interests you, or let's do a full walkthrough together!`,
        `Hi ${firstName}! Great choice — **${chapterTitle}** is one of those chapters that makes everything click. Pick something below or start fresh with me!`,
        `Hey ${firstName}! Let's make **${chapterTitle}** super clear today. You can jump to any subsection or we can start from scratch — you decide! 🎯`,
    ];
    return options[Math.floor(Math.random() * options.length)];
}

type ScreenMode = 'overview' | 'chat';

export default function TutorChat() {
    const { bookId, chapterIndex } = useParams<{ bookId: string; chapterIndex: string }>();
    const navigate = useNavigate();
    const { profile } = useProfile();
    const { textbooks, loadTextbooks, fetchChapterContent } = useTextbookParser();
    const { saveSession } = useSessions();

    // Content state
    const [chapterContent, setChapterContent] = useState<string | null>(null);
    const [answersContent, setAnswersContent] = useState<string | null>(null);
    const [chapterMetadata, setChapterMetadata] = useState<TextbookChapter | null>(null);
    const [subsections, setSubsections] = useState<Subsection[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Screen mode: 'overview' shows greeting + subsection list; 'chat' shows conversation
    const [screenMode, setScreenMode] = useState<ScreenMode>('overview');
    const [focusTopic, setFocusTopic] = useState<string | null>(null); // subsection user tapped

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputStr, setInputStr] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Voice (Gemini Live)
    const { isConnected, isConnecting, isMuted, status, connect, disconnect, toggleMute } =
        useGeminiLive((msgs) => saveSession('lab', msgs));
    const [voiceMode, setVoiceMode] = useState(false);

    // Book data
    useEffect(() => {
        if (textbooks.length === 0) loadTextbooks(profile?.uid);
    }, [textbooks.length, loadTextbooks, profile?.uid]);

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
                const text = await fetchChapterContent(ch.storagePath, book.id, ch.index, profile?.uid);
                if (!text) throw new Error('Could not retrieve chapter text.');
                setChapterContent(text);

                // Use authoritative TOC subsections
                setSubsections(ch.subsections || []);

                // Silently load answers
                if (ch.answersStoragePath) {
                    try {
                        const ans = await fetchChapterContent(ch.answersStoragePath, book.id, ch.index, profile?.uid);
                        if (ans) setAnswersContent(ans);
                    } catch { /* non-fatal */ }
                } else {
                    const localAns = localStorage.getItem(`mama_answers_${book.id}_${ch.index}`);
                    if (localAns) setAnswersContent(localAns);
                }
            } catch (e: any) {
                setError(e.message || 'Failed to load chapter content.');
            }
        };

        if (!chapterContent) load();
    }, [textbooks, bookId, chapterIndex, profile?.uid, fetchChapterContent, chapterContent]);

    // Scroll to bottom in chat mode
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Build system instruction for Gemini
    const buildSystemInstruction = useCallback((topicFocus: string | null) => {
        const chapterName = chapterMetadata?.title.replace(/^Chapter\s+\d+[:\-]?\s*/i, '') || '';
        return `
<system_instruction>
  <identity>
    <role>Warm, encouraging Private Academic Tutor</role>
    <name>Mama AI</name>
  </identity>

  <student_profile>
    <name>${profile?.name || 'Student'}</name>
    <preferred_language>${profile?.language || 'English'}</preferred_language>
    <learning_style>${profile?.learningStyle || 'Visual'}</learning_style>
    <grade>${profile?.age || 'High School'}</grade>
  </student_profile>

  <chapter_context>
    <chapter_name>${chapterName}</chapter_name>
    ${topicFocus ? `<current_focus_topic>${topicFocus}</current_focus_topic>` : ''}
  </chapter_context>

  <source_material>
    <chapter_text>
${chapterContent}
    </chapter_text>
${answersContent ? `    <answers_reference>
      <!-- PRIVATE: Official answers. Use to verify, guide, NEVER reveal directly. -->
${answersContent}
    </answers_reference>` : ''}
  </source_material>

  <rules>
    <rule>Be warm, encouraging, and personal — use the student's name occasionally.</rule>
    <rule>ONLY teach from the <source_material> provided. If topic is outside this chapter, redirect gently.</rule>
    <rule>When a student asks for an answer — NEVER reveal it. Guide them step-by-step until they figure it out.</rule>
    <rule>When referencing a diagram or figure, mention the page number from the chapter text so the student can open the book. E.g., "If you flip to page 14 in your textbook, you'll see the diagram of Electric Field Lines — it makes this much clearer!"</rule>
    <rule>For Physics/Math/Chemistry: always show formulas step by step. Never skip steps.</rule>
    <rule>After explaining a concept, briefly check understanding with a short quiz question.</rule>
    <rule>Reply in simple, conversational language. Avoid heavy jargon unless teaching it with definition.</rule>
    <rule>Use supportive phrases like "Great question!", "You're on the right track!", "Let me break that down."</rule>
    <rule>Respond in the student's <preferred_language>.</rule>
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

    // Send chat message
    const handleSend = async () => {
        if (!inputStr.trim() || !chapterContent || isTyping) return;
        const userMsg = inputStr.trim();
        setInputStr('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsTyping(true);

        try {
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
            const chatSession = ai.chats.create({
                model: 'gemini-3-pro-preview',
                config: {
                    systemInstruction: buildSystemInstruction(focusTopic),
                    temperature: 0.3,
                }
            });

            // Re-send history to maintain context
            const history = messages.slice(1);
            for (const m of history) {
                await chatSession.sendMessage({ message: m.text });
            }

            const result = await chatSession.sendMessage({ message: userMsg });
            setMessages(prev => [...prev, { role: 'model', text: result.text || '' }]);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I ran into an error. Please try again!' }]);
        } finally {
            setIsTyping(false);
        }
    };

    // Toggle voice mode
    const handleVoiceToggle = async () => {
        if (!voiceMode) {
            setVoiceMode(true);
            await connect(buildSystemInstruction(focusTopic));
        } else {
            disconnect();
            setVoiceMode(false);
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
                    <div className="min-w-0">
                        {/* "Chapter 1" bold */}
                        <h1 className="text-sm font-bold text-zinc-900">
                            Chapter {chapterMetadata?.index}
                        </h1>
                        {/* Chapter title below, smaller */}
                        <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide truncate">
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

                    {/* Subsection list — static display only, NOT clickable */}
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
                                        {/* Section number */}
                                        <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 shrink-0 min-w-[38px] text-center">
                                            {sub.num}
                                        </span>
                                        {/* Section title */}
                                        <span className="text-sm font-medium text-zinc-700">
                                            {sub.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Chapter info strip */}
                    <div className="px-4 pt-4">
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium px-1">
                            <BookOpen size={13} />
                            <span>
                                {chapterMetadata?.subsectionRange
                                    ? `Subsections ${chapterMetadata.subsectionRange}`
                                    : `Chapter ${chapterMetadata?.index}`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bottom CTA — sticky */}
                <div className="absolute bottom-0 left-0 right-0 safe-area-pb bg-linear-to-t from-[rgb(250,249,245)] via-[rgb(250,249,245)] to-transparent pt-6 pb-5 px-4">
                    {/* Voice CTA */}
                    <button
                        onClick={() => { enterChat(null); handleVoiceToggle(); }}
                        className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-bold text-base py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2.5 transition-all mb-2"
                    >
                        <Mic size={22} />
                        Let's Talk — Start Voice Session
                    </button>
                    {/* Text chat CTA */}
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

    // ── FULL-SCREEN VOICE MODE (Matches Lab Phase UI) ───────────────────────
    if (voiceMode) {
        return (
            <div className="flex flex-col h-dvh bg-[rgb(250,249,245)] text-zinc-900 overflow-hidden absolute inset-0 z-50">
                {/* Header (replaces Lab Phase / Equipment Check) */}
                <div className="absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-zinc-200">
                    <button onClick={() => setVoiceMode(false)} className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-colors">
                        <ArrowLeft size={18} className="text-zinc-600" />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Chapter {chapterMetadata?.index}</span>
                        <span className="text-sm font-bold text-amber-600 uppercase tracking-wide bg-amber-50 px-3 py-1 rounded-full mt-1 border border-amber-100 truncate max-w-[200px]">
                            {focusTopic || chapterDisplayName}
                        </span>
                    </div>
                    <div className="w-10"></div> {/* Spacer for alignment */}
                </div>

                {/* Main Visual Area */}
                <main className="flex-1 relative flex items-center justify-center overflow-hidden p-6 pt-24">
                    <div className="relative flex flex-col items-center justify-center z-10">
                        {isConnected ? (
                            <>
                                <div className="absolute w-48 h-48 bg-amber-500/10 rounded-full animate-ping" />
                                <div className="absolute w-64 h-64 bg-amber-500/5 rounded-full animate-pulse" />
                                <div className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-colors ${isMuted ? 'bg-zinc-200 text-zinc-500 shadow-zinc-200/50' : 'bg-amber-500 text-white shadow-amber-500/50'}`}>
                                    {isMuted ? <MicOff size={48} /> : <Mic size={48} />}
                                </div>
                                <p className="mt-8 text-xl font-bold text-zinc-900 tracking-wide">
                                    {isMuted ? 'Muted' : "I'm listening..."}
                                </p>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-amber-600">
                                <Loader2 size={48} className="animate-spin" />
                                <p className="text-lg font-medium animate-pulse">Connecting to Mama AI...</p>
                            </div>
                        )}
                    </div>
                </main>

                {/* Bottom Control Bar */}
                <div className="bg-white border-t border-zinc-200 p-6 pb-8 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between max-w-sm mx-auto">
                        {/* Camera Button / Photo Upload */}
                        <button className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-200 group-hover:bg-zinc-100 transition-colors">
                                <Camera size={24} className="text-zinc-600" />
                            </div>
                            <span className="text-xs font-medium text-zinc-500">Photo</span>
                        </button>

                        {/* Mic Button */}
                        <button onClick={toggleMute} className="flex flex-col items-center gap-2 group">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${isConnected ? (isMuted ? 'bg-zinc-100 border-zinc-300 text-zinc-500' : 'bg-amber-500 border-amber-400 text-white shadow-amber-500/30 scale-110') : 'bg-zinc-50 border-zinc-200 text-zinc-600'}`}>
                                {isConnected && !isMuted ? <Mic size={28} /> : <MicOff size={28} />}
                            </div>
                            <span className={`text-xs font-medium ${isConnected && !isMuted ? 'text-amber-600' : 'text-zinc-500'}`}>Mic</span>
                        </button>

                        {/* End Session Button */}
                        <button onClick={() => { disconnect(); setVoiceMode(false); }} className="flex flex-col items-center gap-2 group">
                            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center border border-red-100 group-hover:bg-red-100 transition-colors">
                                <X size={24} className="text-red-500" />
                            </div>
                            <span className="text-xs font-medium text-red-500">End Session</span>
                        </button>
                    </div>
                </div>
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
                            Chapter {chapterMetadata?.index}
                        </h1>
                        <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide truncate">
                            {focusTopic || chapterDisplayName}
                        </p>
                    </div>
                </div>
            </div>

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
                            {msg.text.split('**').map((part, idx) =>
                                idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mr-2">
                            <Sparkles size={14} className="text-amber-600" />
                        </div>
                        <div className="bg-white border border-zinc-200 rounded-3xl rounded-tl-sm px-5 py-4 shadow-sm flex gap-1.5 items-center">
                            <div className="w-2 h-2 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={bottomRef} className="h-2 shrink-0" />
            </div>

            {/* Input bar */}
            <div className="bg-white border-t border-zinc-200 p-3 sm:p-4 safe-area-pb">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-end gap-2 max-w-3xl mx-auto"
                >
                    <div className="flex-1 bg-zinc-100 border border-zinc-200 rounded-3xl overflow-hidden focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all flex items-center">
                        <textarea
                            value={inputStr}
                            onChange={(e) => setInputStr(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask anything about this chapter…"
                            className="flex-1 max-h-28 min-h-[48px] bg-transparent border-none focus:outline-none focus:ring-0 px-4 py-3.5 resize-none text-sm font-medium"
                            rows={1}
                        />
                        <button
                            type="submit"
                            disabled={!inputStr.trim() || isTyping}
                            className="mr-2 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-50 disabled:bg-zinc-300 transition-colors"
                        >
                            <Send size={18} className="translate-x-px" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
