import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  Clock, 
  Calendar, 
  MessageCircle, 
  User, 
  Bot,
  Trash2,
  Pencil,
  Image as ImageIcon,
  Video,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToSession } from '../services/dataStore';
import { SavedSession, SessionMessage } from '../hooks/useSessions';
import { format } from 'date-fns';
import MediaLightbox from '../components/MediaLightbox';
import { MarkdownText, cleanSessionSummary } from '../utils/markdown';

// Message bubble component with WhatsApp-style styling
interface MessageBubbleProps {
  message: SessionMessage;
  onImageClick?: (imageUrl: string) => void;
  onVideoClick?: (videoUrl: string) => void;
}

function MessageBubble({ message, onImageClick, onVideoClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isWhiteboard = message.whiteboardStep || message.text.includes('[Whiteboard]');
  
  // Clean up display text - remove [Whiteboard] prefix for cleaner display
  const displayText = isWhiteboard 
    ? message.text.replace(/^\[Whiteboard\]\s*/, '')
    : message.text;
  
  return (
    <div 
      className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Sender label */}
        <div 
          className={`flex items-center gap-1.5 mb-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
        >
          {isUser ? (
            <>
              <User size={12} className="text-green-500" />
              <span className="text-xs font-semibold text-green-500 uppercase tracking-wide">
                You
              </span>
            </>
          ) : (
            <>
              <Bot size={12} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-500 uppercase tracking-wide">
                MAMA AI
              </span>
            </>
          )}
        </div>
        
        {/* Whiteboard badge */}
        {isWhiteboard && (
          <div className="flex items-center gap-1 text-xs text-amber-600 mb-1.5">
            <Pencil size={12} />
            <span className="font-medium">Wrote on whiteboard</span>
          </div>
        )}
        
        {/* Message bubble */}
        <div 
          className={`
            relative px-4 py-3 rounded-2xl
            ${isUser 
              ? 'bg-white border border-zinc-200 rounded-tr-sm' 
              : isWhiteboard
                ? 'bg-amber-50 border border-amber-200 rounded-tl-sm'
                : 'bg-white border border-amber-200 rounded-tl-sm'
            }
            shadow-sm
          `}
        >
          {/* Message text - NO BACKGROUND COLOR, with markdown bold support */}
          <div className="text-[15px] leading-relaxed text-zinc-800 whitespace-pre-wrap">
            <MarkdownText text={displayText} />
          </div>
          
          {/* Whiteboard math display */}
          {message.whiteboardStep?.math && (
            <div className="mt-2 p-2 bg-white rounded-lg border border-amber-200 font-mono text-sm text-zinc-700">
              {message.whiteboardStep.math}
            </div>
          )}
          
          {/* Clickable Image */}
          {message.image && (
            <div 
              className="mt-3 rounded-xl overflow-hidden border border-zinc-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onImageClick?.(message.image!)}
            >
              <img 
                src={message.image} 
                alt="Visual aid" 
                className="w-full h-auto max-h-64 object-cover"
              />
              <div className="flex items-center justify-center gap-1 py-1.5 bg-zinc-50 text-xs text-zinc-500">
                <ImageIcon size={12} />
                <span>Click to view</span>
              </div>
            </div>
          )}
          
          {/* Clickable Video */}
          {message.video && (
            <div 
              className="mt-3 rounded-xl overflow-hidden border border-zinc-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onVideoClick?.(message.video!)}
            >
              <video 
                src={message.video}
                className="w-full h-auto max-h-64"
              />
              <div className="flex items-center justify-center gap-1 py-1.5 bg-zinc-50 text-xs text-zinc-500">
                <Video size={12} />
                <span>Click to play</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// First speaker indicator component
interface FirstSpeakerIndicatorProps {
  speaker: 'user' | 'ai';
  timestamp?: number;
}

function FirstSpeakerIndicator({ speaker, timestamp }: FirstSpeakerIndicatorProps) {
  const isUser = speaker === 'user';
  
  return (
    <div className="flex justify-center my-6">
      <div 
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium
          ${isUser 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-amber-50 text-amber-700 border border-amber-200'
          }
        `}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
        <span>
          {isUser ? 'You started this conversation' : 'MAMA AI initiated this session'}
          {timestamp && (
            <span className="ml-1 opacity-75">
              at {format(new Date(timestamp), 'h:mm a')}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

// Mode badge component
function ModeBadge({ mode }: { mode: string }) {
  const styles = {
    lab: 'bg-teal-50 text-teal-600 border-teal-200',
    exam: 'bg-amber-50 text-amber-600 border-amber-200',
    tutor: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  };
  
  const labels = {
    lab: 'Lab Mode',
    exam: 'Exam Mode',
    tutor: 'Tutor Mode',
  };
  
  const style = styles[mode as keyof typeof styles] || styles.tutor;
  const label = labels[mode as keyof typeof labels] || 'Study Session';
  
  return (
    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${style}`}>
      {label}
    </span>
  );
}

// Whiteboard summary section
function WhiteboardSection({ messages }: { messages: SessionMessage[] }) {
  const whiteboardMessages = messages.filter(m => m.whiteboardStep);
  
  if (whiteboardMessages.length === 0) return null;
  
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-amber-100 rounded-lg">
          <Pencil size={16} className="text-amber-600" />
        </div>
        <h3 className="font-bold text-amber-900">Whiteboard Activity</h3>
        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
          {whiteboardMessages.length} steps
        </span>
      </div>
      
      <div className="space-y-2">
        {whiteboardMessages.slice(0, 3).map((msg, idx) => (
          <div key={idx} className="bg-white rounded-lg p-3 border border-amber-100">
            <p className="text-sm text-zinc-700">{msg.whiteboardStep?.explanation}</p>
            {msg.whiteboardStep?.math && (
              <code className="block mt-1.5 text-xs font-mono text-zinc-500 bg-zinc-50 px-2 py-1 rounded">
                {msg.whiteboardStep.math.length > 50 
                  ? msg.whiteboardStep.math.slice(0, 50) + '...'
                  : msg.whiteboardStep.math
                }
              </code>
            )}
          </div>
        ))}
        {whiteboardMessages.length > 3 && (
          <p className="text-xs text-amber-600 text-center">
            +{whiteboardMessages.length - 3} more steps
          </p>
        )}
      </div>
    </div>
  );
}

// Delete confirmation modal
function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  sessionSummary 
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
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-zinc-100 text-zinc-700 font-semibold rounded-xl hover:bg-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SessionDetail() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { currentUser } = useAuth();
  
  const [session, setSession] = useState<SavedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{url: string, type: 'image' | 'video'} | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  
  // Collect all media URLs
  const allMedia = useMemo(() => {
    if (!session) return [];
    const media: {url: string, type: 'image' | 'video'}[] = [];
    session.messages.forEach(m => {
      if (m.image) media.push({ url: m.image, type: 'image' });
      if (m.video) media.push({ url: m.video, type: 'video' });
    });
    return media;
  }, [session]);
  
  // Subscribe to session
  useEffect(() => {
    if (!currentUser?.uid || !sessionId) return;
    
    const unsubscribe = subscribeToSession(currentUser.uid, sessionId, (sessionData) => {
      setSession(sessionData);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [currentUser, sessionId]);
  
  // Scroll to bottom on load
  useEffect(() => {
    if (chatContainerRef.current && session) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [session?.messages.length]);
  
  // Handle media clicks
  const handleImageClick = (imageUrl: string) => {
    const index = allMedia.findIndex(m => m.url === imageUrl);
    setCurrentMediaIndex(index >= 0 ? index : 0);
    setLightboxMedia({ url: imageUrl, type: 'image' });
    setLightboxOpen(true);
  };
  
  const handleVideoClick = (videoUrl: string) => {
    const index = allMedia.findIndex(m => m.url === videoUrl);
    setCurrentMediaIndex(index >= 0 ? index : 0);
    setLightboxMedia({ url: videoUrl, type: 'video' });
    setLightboxOpen(true);
  };
  
  const handleNextMedia = () => {
    if (currentMediaIndex < allMedia.length - 1) {
      const nextIndex = currentMediaIndex + 1;
      setCurrentMediaIndex(nextIndex);
      setLightboxMedia(allMedia[nextIndex]);
    }
  };
  
  const handlePrevMedia = () => {
    if (currentMediaIndex > 0) {
      const prevIndex = currentMediaIndex - 1;
      setCurrentMediaIndex(prevIndex);
      setLightboxMedia(allMedia[prevIndex]);
    }
  };
  
  // Handle resume session
  const handleResume = () => {
    if (!session) return;
    const mode = session.mode || 'tutor';
    navigate(`/${mode}/entry?resumeId=${session.id}&action=resume`);
  };
  
  // Handle delete
  const handleDelete = async () => {
    if (!session || !currentUser) return;
    
    try {
      const { deleteSessionFromDb } = await import('../services/dataStore');
      await deleteSessionFromDb(currentUser.uid, session.id);
      navigate('/sessions');
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session. Please try again.');
    }
  };
  
  // Format date
  const formatSessionDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy • h:mm a');
    }
  };
  
  // Get first speaker
  const getFirstSpeaker = (): 'user' | 'ai' | null => {
    if (!session?.messages?.length) return null;
    const firstMsg = session.messages[0];
    return firstMsg?.role === 'user' ? 'user' : 'ai';
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#faf9f5] text-zinc-900">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 bg-white">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-zinc-600" />
          </button>
          <div className="w-10" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 bg-zinc-200 rounded-full mb-4" />
            <div className="w-32 h-4 bg-zinc-200 rounded" />
          </div>
        </div>
      </div>
    );
  }
  
  // Not found state
  if (!session) {
    return (
      <div className="flex flex-col min-h-screen bg-[#faf9f5] text-zinc-900">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 bg-white">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-zinc-600" />
          </button>
          <div className="w-10" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <MessageCircle size={48} className="text-zinc-300 mb-4" />
          <h2 className="text-xl font-bold text-zinc-800 mb-2">Session Not Found</h2>
          <p className="text-zinc-500 mb-6">This session may have been deleted or doesn't exist.</p>
          <button 
            onClick={() => navigate('/sessions')}
            className="px-6 py-3 bg-amber-500 text-white font-semibold rounded-full hover:bg-amber-600 transition-colors"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }
  
  const firstSpeaker = getFirstSpeaker();
  const messageCount = session.messages?.length || 0;
  
  return (
    <div className="flex flex-col min-h-screen bg-[#faf9f5] text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-zinc-200 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <button 
            onClick={() => navigate('/sessions')} 
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-zinc-600" />
          </button>
          
          <div className="flex-1 px-4 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ModeBadge mode={session.mode} />
              {session.whiteboardUsed && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Pencil size={10} />
                  Whiteboard
                </span>
              )}
            </div>
            <h1 className="text-base font-bold text-zinc-900 truncate">
              {cleanSessionSummary(session.summary)}
            </h1>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Calendar size={12} />
              <span>{formatSessionDate(session.date)}</span>
              <span className="mx-1">•</span>
              <MessageCircle size={12} />
              <span>{messageCount} messages</span>
            </div>
          </div>
          
          {/* Delete button */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            title="Delete session"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>
      
      {/* Chat Container */}
      <main 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {/* Whiteboard summary section */}
        {session.whiteboardUsed && <WhiteboardSection messages={session.messages} />}
        
        {/* First Speaker Indicator */}
        {firstSpeaker && (
          <FirstSpeakerIndicator 
            speaker={firstSpeaker} 
            timestamp={session.messages[0]?.timestamp || session.date}
          />
        )}
        
        {/* Messages */}
        {session.messages?.map((message, index) => (
          <MessageBubble 
            key={index} 
            message={message}
            onImageClick={handleImageClick}
            onVideoClick={handleVideoClick}
          />
        ))}
        
        {/* Session end indicator */}
        <div className="flex justify-center my-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 text-zinc-500 text-xs">
            <Clock size={12} />
            <span>Session ended</span>
          </div>
        </div>
      </main>
      
      {/* Resume Action Bar */}
      <footer className="sticky bottom-0 z-20 bg-white border-t border-zinc-200 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleResume}
          className="w-full flex items-center justify-center gap-3 bg-teal-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-teal-700 active:scale-[0.98] transition-all shadow-md"
        >
          <Play size={20} fill="currentColor" />
          Resume Session
        </button>
        <p className="text-center text-xs text-zinc-400 mt-2">
          Continue where you left off with MAMA AI
        </p>
      </footer>
      
      {/* Media Lightbox */}
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
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        sessionSummary={session.summary || 'this session'}
      />
    </div>
  );
}
