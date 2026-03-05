import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, Mic } from 'lucide-react';
import { useTextbookParser, TextbookChapter } from '../../hooks/useTextbookParser';
import { useProfile } from '../../hooks/useProfile';
import { GoogleGenAI, Type } from '@google/genai';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export default function TutorChat() {
    const { bookId, chapterIndex } = useParams<{ bookId: string, chapterIndex: string }>();
    const navigate = useNavigate();
    const { profile } = useProfile();
    const { textbooks, loadTextbooks, fetchChapterContent } = useTextbookParser();

    const [chapterContent, setChapterContent] = useState<string | null>(null);
    const [chapterMetadata, setChapterMetadata] = useState<TextbookChapter | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputStr, setInputStr] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);

    // Initialize book data
    useEffect(() => {
        if (textbooks.length === 0) {
            loadTextbooks(profile?.uid);
        }
    }, [textbooks.length, loadTextbooks, profile?.uid]);

    // Load chapter content from Firebase Storage / localStorage
    useEffect(() => {
        const book = textbooks.find(b => b.id === bookId);
        if (!book) return;

        const idx = parseInt(chapterIndex || '0', 10);
        const ch = book.chapters.find(c => c.index === idx);
        if (!ch) {
            setError("Chapter not found.");
            return;
        }

        setChapterMetadata(ch);

        const loadContent = async () => {
            try {
                const text = await fetchChapterContent(ch.storagePath, book.id, ch.index, profile?.uid);
                if (!text) throw new Error("Could not retrieve chapter text.");
                setChapterContent(text);

                // Initial AI greeting
                setMessages([{
                    role: 'model',
                    text: `Hi! I'm your tutor for **${ch.title}**. I've read the chapter. What would you like to know, or should we start with a quick overview?`
                }]);
            } catch (e: any) {
                setError(e.message || "Failed to load chapter content.");
            }
        };

        if (!chapterContent) {
            loadContent();
        }
    }, [textbooks, bookId, chapterIndex, profile?.uid, fetchChapterContent, chapterContent]);

    // Scroll to bottom on new message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!inputStr.trim() || !chapterContent || isTyping) return;

        const userMsg = inputStr.trim();
        setInputStr('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsTyping(true);

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setMessages(prev => [...prev, { role: 'model', text: "API Key missing." }]);
            setIsTyping(false);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });

            const systemInstruction = `
You are a private tutor for an eager student.

STUDENT PROFILE:
Preferred Language: ${profile?.language || 'English'}
Learning Style: ${profile?.learningStyle || 'Visual'}
Age/Grade: ${profile?.age || 'Unknown'}

YOUR EXCLUSIVE KNOWLEDGE SOURCE:
--- BEGIN CHAPTER TEXT ---
${chapterContent}
--- END CHAPTER TEXT ---

STRICT RULES:
1. ONLY answer using information from the chapter text above.
2. If the user asks something NOT in the chapter, say: "This topic isn't covered in this chapter. Let's focus on the chapter material."
3. Always cite where in the chapter you found the info.
4. For Math/Physics: Use formulas exactly as written in the text. Provide step-by-step guidance.
5. Provide your answers in the student's Preferred Language.
      `.trim();

            const chatSession = ai.chats.create({
                model: 'gemini-3.1-pro-preview', // Deep reasoning model
                config: {
                    systemInstruction,
                    temperature: 0.2, // Low temperature for factual grounding
                }
            });

            // Send chat history to maintain context
            const history = messages.slice(1); // skip initial greeting
            for (const m of history) {
                await chatSession.sendMessage({ message: m.text }); // Warm up history. Simplification for hackathon.
            }

            const result = await chatSession.sendMessage({ message: userMsg });

            setMessages(prev => [...prev, { role: 'model', text: result.text || '' }]);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error while thinking." }]);
        } finally {
            setIsTyping(false);
        }
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-full p-6 text-center">
                <h2 className="text-xl font-bold mb-2 text-red-600">Error</h2>
                <p className="text-zinc-500 mb-4">{error}</p>
                <button onClick={() => navigate(-1)} className="text-amber-600 font-bold underline">Go Back</button>
            </div>
        );
    }

    if (!chapterContent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh p-6 bg-[rgb(250,249,245)]">
                <Loader2 className="animate-spin text-amber-500 mb-4" size={40} />
                <h2 className="text-lg font-bold text-zinc-700">Loading Chapter...</h2>
                <p className="text-sm font-medium text-zinc-400 mt-2 text-center max-w-xs">
                    Fetching content from Cloud Storage and setting up the tutor brain.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-dvh bg-zinc-50 text-zinc-900 absolute inset-0 z-50">
            {/* Header */}
            <div className="bg-white/90 backdrop-blur-md border-b border-zinc-200 px-4 py-3 safe-area-pt shadow-sm flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 hover:bg-zinc-200 transition-colors shrink-0"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="min-w-0 pr-4">
                        <h1 className="text-sm font-bold truncate">Chapter {chapterMetadata?.index} Tutor</h1>
                        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider truncate">
                            {chapterMetadata?.title}
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-6 scrollbar-hide flex flex-col gap-6">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-3xl px-5 py-3.5 shadow-sm text-sm sm:text-base leading-relaxed ${msg.role === 'user'
                                ? 'bg-amber-500 text-white rounded-tr-sm'
                                : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm'
                            }`}>
                            {/* Very simple markdown bold parsing for the text to improve readability */}
                            {msg.text.split('**').map((part, index) =>
                                index % 2 === 1 ? <strong key={index}>{part}</strong> : part
                            )}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-zinc-200 rounded-3xl rounded-tl-sm px-5 py-4 shadow-sm flex gap-1.5 items-center">
                            <div className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={bottomRef} className="h-2 shrink-0" />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-zinc-200 p-3 sm:p-4 safe-area-pb">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-end gap-2 max-w-3xl mx-auto relative"
                >
                    <button
                        type="button"
                        className="w-12 h-12 flex items-center justify-center shrink-0 bg-zinc-100 rounded-full text-zinc-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                        <Mic size={22} />
                    </button>

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
                            placeholder="Ask a question..."
                            className="flex-1 max-h-32 min-h-[48px] bg-transparent border-none focus:outline-none focus:ring-0 px-4 py-3.5 resize-none text-sm font-medium"
                            rows={1}
                        />
                        <button
                            type="submit"
                            disabled={!inputStr.trim() || isTyping}
                            className="mr-2 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-50 disabled:bg-zinc-300 transition-colors"
                        >
                            <Send size={18} className="translate-x-[1px]" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
