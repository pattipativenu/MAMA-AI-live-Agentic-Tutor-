import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Clock,
  Calendar,
  Pencil,
  Image as ImageIcon,
  Video,
  Trash2,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToSession, saveSessionToDb } from '../services/dataStore';
import { SavedSession, SessionMessage, GeneratedMedia } from '../hooks/useSessions';
import { format } from 'date-fns';
import MediaLightbox from '../components/MediaLightbox';
import { MarkdownText, cleanSessionSummary } from '../utils/markdown';
import { GoogleGenAI } from '@google/genai';
import { InlineMath, BlockMath } from 'react-katex';

// ── Helpers ────────────────────────────────────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

async function generateStudyNotes(session: SavedSession): Promise<string> {
  const whiteboardSteps = session.messages
    .filter(m => m.whiteboardStep)
    .map((m, i) => `Whiteboard Step ${i + 1}:\nExplanation: ${m.whiteboardStep!.explanation}\nFormula/Math: ${m.whiteboardStep!.math || 'N/A'}`)
    .join('\n\n');

  // Include the full chronological flow of the session for better context
  const fullConversation = session.messages
    .map(m => {
      let content = `[${m.role.toUpperCase()}]: `;
      if (m.text) content += m.text;
      if (m.whiteboardStep) content += ` (Added whiteboard step)`;
      if (m.image || m.video) content += ` (Generated visual aid)`;
      return content;
    })
    .join('\n');

  const mediaInfo = session.generatedMedia?.length
    ? `${session.generatedMedia.length} visual(s) generated: ${session.generatedMedia.map(m => m.caption || m.prompt || m.type).join(', ')}`
    : 'No visual media generated';

  const prompt = `You are an expert tutor creating comprehensive, perfectly formatted Study Notes for a student based on their tutoring session with Mama AI.

SESSION OVERVIEW:
- Mode: ${session.mode}
- Topic/Chapter: ${session.topic || session.summary || 'General Study Session'}
- Date: ${format(new Date(session.date), 'MMM d, yyyy')}
- Media Generated: ${mediaInfo}

WHITEBOARD CONTENT (CRITICAL):
${whiteboardSteps || 'No whiteboard used.'}

SESSION TIMELINE:
${fullConversation}

INSTRUCTIONS:
Create detailed, highly structured Study Notes in markdown. The student relies on these notes to review the material, so they must be complete and accurate, even if the spoken conversation was brief. Do NOT just say "we discussed X" — actually rewrite the content of X into the notes.

Include the following sections:
1. **Key Concepts** — thorough bullet points of the main ideas covered. Synthesize the timeline and whiteboard into clear factual statements.
2. **Deep Dive / Whiteboard Breakdown** — If the whiteboard was used (e.g. for Vector Algebra, Chemistry mechanisms, Math equations), provide a deeply detailed breakdown of the math/formulas used. Explain *what* the math means. Use LaTeX/KaTeX formatting for all math.
3. **Important Definitions & Formulas** — any specific equations or terms defined during the session.
4. **Quick Summary** — 3-4 sentences summarising the session's overall goal and outcome.
5. **Revision Tips** — 2-3 specific, actionable tips for the student to master this topic.

Write in a warm, encouraging, and highly academic student-facing voice. Use markdown formatting (headers, bold, lists, math blocks) extensively to make it readable. Make sure the notes stand on their own as a complete study guide.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{ parts: [{ text: prompt }] }]
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) {
    console.error('[SessionDetail] Failed to generate notes:', e);
    return '';
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/**
 * Renders a LaTeX math string using KaTeX.
 * Strips some common prefixes the AI adds (>, arrows) and decides between
 * block math (standalone line) vs. inline math.
 */
function MathRenderer({ math }: { math: string }) {
  // Clean up common artefacts from AI-generated LaTeX
  const cleaned = math
    .trim()
    .replace(/^>\s*/, '')          // remove leading >
    .replace(/\\displaystyle\s*/g, ''); // not needed for block

  // If the string contains newlines or is very long, use BlockMath
  const isBlock = cleaned.includes('\\\\') || cleaned.includes('\n') || cleaned.length > 60;

  try {
    return isBlock
      ? <BlockMath math={cleaned} />
      : <InlineMath math={cleaned} />;
  } catch {
    // If KaTeX can't parse it, show a readable fallback without LaTeX commands
    const readable = cleaned
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[{}]/g, '')
      .trim();
    return (
      <span className="font-mono text-sm text-zinc-600">{readable}</span>
    );
  }
}

/**
 * Renders text with inline LaTeX math ($...$) properly parsed
 */
function renderTextWithInlineMath(text: string) {
  if (!text) return null;
  
  // Split by inline math pattern $...$
  const parts = text.split(/(\$[^$]+\$)/g);
  
  return parts.map((part, index) => {
    // Check if this part is inline math (starts and ends with $)
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      const mathContent = part.slice(1, -1); // Remove the $ markers
      try {
        return <InlineMath key={index} math={mathContent} />;
      } catch (e) {
        // If KaTeX fails to render, show the raw text
        return <span key={index}>{part}</span>;
      }
    }
    return <span key={index}>{part}</span>;
  });
}

function ModeBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    lab: 'bg-teal-50 text-teal-600 border-teal-200',
    exam: 'bg-amber-50 text-amber-600 border-amber-200',
    tutor: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  };
  const labels: Record<string, string> = {
    lab: 'Lab Mode', exam: 'Exam Mode', tutor: 'Tutor Mode',
  };
  return (
    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${styles[mode] || styles.tutor}`}>
      {labels[mode] || 'Study Session'}
    </span>
  );
}

function WhiteboardSection({ messages }: { messages: SessionMessage[] }) {
  const [expanded, setExpanded] = useState(false);
  const steps = messages.filter(m => m.whiteboardStep);
  if (steps.length === 0) return null;

  const visible = expanded ? steps : steps.slice(0, 4);

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden mb-5">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200">
        <div className="p-1.5 bg-amber-100 rounded-lg">
          <Pencil size={15} className="text-amber-600" />
        </div>
        <h3 className="font-bold text-amber-900 flex-1">Whiteboard Activity</h3>
        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
          {steps.length} step{steps.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="px-4 py-3 space-y-4">
        {visible.map((msg, idx) => (
          <div key={idx} className="flex items-start gap-3">
            {/* Step number */}
            <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-200 text-amber-800 text-[11px] font-bold flex items-center justify-center">
              {idx + 1}
            </span>

            <div className="flex-1 min-w-0">
              {/* Explanation — with inline LaTeX math support */}
              {msg.whiteboardStep?.explanation && (
                <p className="text-sm text-zinc-700 leading-relaxed">
                  {renderTextWithInlineMath(msg.whiteboardStep.explanation)}
                </p>
              )}

              {/* Formula — in white box, auto-scaled to fit without scroll */}
              {msg.whiteboardStep?.math && (
                <div className="mt-2 bg-white rounded-xl border border-amber-100 px-3 py-3 w-full">
                  <div className="flex justify-center overflow-hidden">
                    <div style={{ 
                      fontSize: 'clamp(0.75rem, 2.8vw, 1.05rem)',
                      maxWidth: '100%',
                      lineHeight: 1.4
                    }}>
                      <MathRenderer math={msg.whiteboardStep.math} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {steps.length > 4 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-amber-600 font-medium py-1.5 hover:text-amber-700 transition-colors"
          >
            {expanded ? (
              <><ChevronUp size={16} /> Show less</>
            ) : (
              <><ChevronDown size={16} /> Show {steps.length - 4} more step{steps.length - 4 !== 1 ? 's' : ''}</>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

function MediaGallery({
  media,
  onImageClick,
  onVideoClick
}: {
  media: GeneratedMedia[];
  onImageClick: (url: string) => void;
  onVideoClick: (url: string) => void;
}) {
  if (media.length === 0) return null;

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon size={16} className="text-indigo-500" />
        <h3 className="font-bold text-zinc-800">Generated Media</h3>
        <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
          {media.length} item{media.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {media.map((item, idx) => (
          <div
            key={idx}
            className="relative rounded-xl overflow-hidden border border-zinc-200 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all shadow-sm aspect-[9/16]"
            onClick={() => item.type === 'image' ? onImageClick(item.url) : onVideoClick(item.url)}
          >
            {item.type === 'image' ? (
              <img
                src={item.url}
                alt={item.caption || 'Visual aid'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center">
                <Video size={28} className="text-white mb-1" />
                <span className="text-white text-xs font-medium">Tap to play</span>
              </div>
            )}
            {/* Caption overlay */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
              <p className="text-white text-[10px] font-medium truncate">
                {item.caption || item.prompt || (item.type === 'image' ? 'Image' : 'Video')}
              </p>
            </div>
            {/* Type badge */}
            <div className="absolute top-2 right-2">
              <span className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1">
                {item.type === 'image' ? <ImageIcon size={9} /> : <Video size={9} />}
                {item.type}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StudyNotes({
  session,
  userId,
}: {
  session: SavedSession;
  userId: string;
}) {
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const generatedRef = useRef(false);

  useEffect(() => {
    // Use cached notes if available
    if ((session as any).studyNotes) {
      setNotes((session as any).studyNotes);
      return;
    }
    // Only generate once
    if (generatedRef.current) return;
    generatedRef.current = true;

    setLoading(true);
    generateStudyNotes(session).then(async (generated) => {
      setNotes(generated);
      setLoading(false);
      // Cache in Firestore so we don't regenerate every visit
      if (generated) {
        try {
          await saveSessionToDb(userId, {
            ...session,
            studyNotes: generated,
          } as any);
        } catch (e) {
          console.warn('[SessionDetail] Could not cache study notes:', e);
        }
      }
    });
  }, [session, userId]);

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-violet-500" />
        <h3 className="font-bold text-zinc-800">Study Notes</h3>
        <span className="text-[10px] text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full font-medium border border-violet-100">
          AI Generated
        </span>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-violet-200 border-t-violet-500 animate-spin" />
              <Sparkles size={14} className="text-violet-500 absolute inset-0 m-auto" />
            </div>
            <p className="text-sm text-zinc-500 text-center">
              Mama AI is writing your study notes…
            </p>
          </div>
        </div>
      ) : notes ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
          <MarkdownText text={notes} />
        </div>
      ) : (
        <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-5 text-center">
          <Lightbulb size={28} className="text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">Study notes could not be generated for this session.</p>
        </div>
      )}
    </section>
  );
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  sessionSummary,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sessionSummary: string;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
          <Trash2 size={24} className="text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-center text-zinc-900 mb-2">Delete Session?</h3>
        <p className="text-sm text-zinc-500 text-center mb-6">
          Are you sure you want to delete "<span className="font-medium text-zinc-700">{cleanSessionSummary(sessionSummary, 40)}</span>"?
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-zinc-100 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-200 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SessionDetail() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { currentUser } = useAuth();

  const [session, setSession] = useState<SavedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  // Collect all media — prefer generatedMedia array, fallback to message-level images/videos
  const allMedia = useMemo((): GeneratedMedia[] => {
    if (!session) return [];
    if (session.generatedMedia && session.generatedMedia.length > 0) {
      return session.generatedMedia;
    }
    const media: GeneratedMedia[] = [];
    session.messages.forEach(m => {
      if (m.image) media.push({ type: 'image', url: m.image, timestamp: m.timestamp || session.date });
      if (m.video) media.push({ type: 'video', url: m.video, timestamp: m.timestamp || session.date });
    });
    return media;
  }, [session]);

  // Subscribe to session in real-time
  useEffect(() => {
    if (!currentUser?.uid || !sessionId) return;
    const unsubscribe = subscribeToSession(currentUser.uid, sessionId, (data) => {
      setSession(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser, sessionId]);

  const handleImageClick = useCallback((url: string) => {
    const idx = allMedia.findIndex(m => m.url === url);
    setCurrentMediaIndex(idx >= 0 ? idx : 0);
    setLightboxMedia({ url, type: 'image' });
    setLightboxOpen(true);
  }, [allMedia]);

  const handleVideoClick = useCallback((url: string) => {
    const idx = allMedia.findIndex(m => m.url === url);
    setCurrentMediaIndex(idx >= 0 ? idx : 0);
    setLightboxMedia({ url, type: 'video' });
    setLightboxOpen(true);
  }, [allMedia]);

  const handleNextMedia = () => {
    const next = currentMediaIndex + 1;
    if (next < allMedia.length) { setCurrentMediaIndex(next); setLightboxMedia(allMedia[next]); }
  };
  const handlePrevMedia = () => {
    const prev = currentMediaIndex - 1;
    if (prev >= 0) { setCurrentMediaIndex(prev); setLightboxMedia(allMedia[prev]); }
  };

  // handleResume removed as per user request to keep this purely as a history/notes view

  const handleDelete = async () => {
    if (!session || !currentUser) return;
    try {
      const { deleteSessionFromDb } = await import('../services/dataStore');
      await deleteSessionFromDb(currentUser.uid, session.id);
      navigate('/sessions');
    } catch {
      alert('Failed to delete session. Please try again.');
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts), today = new Date(), yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return `Today at ${format(d, 'h:mm a')}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${format(d, 'h:mm a')}`;
    return format(d, 'MMM d, yyyy • h:mm a');
  };

  // ── States ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#faf9f5]">
        <div className="p-4 border-b border-zinc-200 bg-white">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-100 rounded-full">
            <ArrowLeft size={24} className="text-zinc-600" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-zinc-200 rounded-full" />
            <div className="w-32 h-4 bg-zinc-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col min-h-screen bg-[#faf9f5]">
        <div className="p-4 border-b border-zinc-200 bg-white">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-100 rounded-full">
            <ArrowLeft size={24} className="text-zinc-600" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <BookOpen size={48} className="text-zinc-300 mb-4" />
          <h2 className="text-xl font-bold text-zinc-800 mb-2">Session Not Found</h2>
          <p className="text-zinc-500 mb-6">This session may have been deleted.</p>
          <button onClick={() => navigate('/sessions')} className="px-6 py-3 bg-amber-500 text-white font-semibold rounded-full">
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const whiteboardStepCount = session.messages.filter(m => m.whiteboardStep).length;

  return (
    <div className="flex flex-col h-full bg-[#faf9f5] text-zinc-900">
      {/* Header */}
      <header className="shrink-0 z-20 bg-white border-b border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/sessions')} className="p-2 hover:bg-zinc-100 rounded-full transition-colors flex-shrink-0">
            <ArrowLeft size={22} className="text-zinc-600" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <ModeBadge mode={session.mode} />
              {whiteboardStepCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Pencil size={9} /> {whiteboardStepCount} steps
                </span>
              )}
              {allMedia.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  <ImageIcon size={9} /> {allMedia.length} visuals
                </span>
              )}
            </div>
            <h1 className="text-sm font-bold text-zinc-900 truncate leading-tight">
              {cleanSessionSummary(session.summary)}
            </h1>
            <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-0.5">
              <Calendar size={10} />
              <span>{formatDate(session.date)}</span>
              <span className="mx-0.5">•</span>
              <Clock size={10} />
              <span>{session.messages.length} exchanges</span>
            </div>
          </div>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </header>

      {/* Content — Study Notes Layout */}
      <main className="flex-1 overflow-y-auto px-4 pt-5 pb-24">

        {/* 1. Whiteboard Activity (polished full view) */}
        {whiteboardStepCount > 0 && (
          <WhiteboardSection messages={session.messages} />
        )}

        {/* 2. Generated Media Gallery */}
        {allMedia.length > 0 && (
          <MediaGallery
            media={allMedia}
            onImageClick={handleImageClick}
            onVideoClick={handleVideoClick}
          />
        )}

        {/* 3. AI Study Notes (Gemini 3.1 Flash generated) */}
        <StudyNotes session={session} userId={currentUser!.uid} />

      </main>

      {/* Resume Bar removed as per user request to keep this purely as a history/notes view */}

      {/* Lightbox */}
      {lightboxOpen && lightboxMedia && (
        <MediaLightbox
          isOpen={lightboxOpen}
          mediaUrl={lightboxMedia.url}
          mediaType={lightboxMedia.type}
          onClose={() => setLightboxOpen(false)}
          onNext={currentMediaIndex < allMedia.length - 1 ? handleNextMedia : undefined}
          onPrev={currentMediaIndex > 0 ? handlePrevMedia : undefined}
          hasNext={currentMediaIndex < allMedia.length - 1}
          hasPrev={currentMediaIndex > 0}
        />
      )}

      {/* Delete Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        sessionSummary={session.summary || 'this session'}
      />
    </div>
  );
}
