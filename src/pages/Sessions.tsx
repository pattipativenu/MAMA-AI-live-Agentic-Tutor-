import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  ChevronRight, 
  Image as ImageIcon, 
  Video, 
  MessageCircle, 
  Trash2,
  Pencil,
  X
} from 'lucide-react';
import { useSessions, SavedSession } from '../hooks/useSessions';
import { format } from 'date-fns';
import { MarkdownText, cleanSessionSummary } from '../utils/markdown';

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
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${style}`}>
      {label}
    </span>
  );
}

// Format date nicely
function formatSessionDate(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return format(date, 'MMM d, yyyy');
  }
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

interface SessionCardProps {
  session: SavedSession;
  onDelete: (session: SavedSession) => void | Promise<void>;
  key?: string;
}

// Session card component
function SessionCard({ session, onDelete }: SessionCardProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  
  const messageCount = session.messages?.length || 0;
  const hasMedia = session.mediaCount > 0;
  const hasWhiteboard = session.whiteboardUsed;
  
  return (
    <div 
      onClick={() => navigate(`/sessions/${session.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowDelete(false);
      }}
      className="relative bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group overflow-hidden"
    >
      {/* Decorative corner bubble (matches dashboard cards, amber only) */}
      <div className="pointer-events-none absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />

      {/* Delete button - appears on hover */}
      {isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDelete(true);
          }}
          className="absolute top-3 right-3 z-10 p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete session"
        >
          <Trash2 size={16} />
        </button>
      )}
      
      <div className="flex items-start justify-between gap-3 pr-8">
        <div className="flex-1 min-w-0">
          {/* Mode and Date */}
          <div className="flex items-center gap-2 mb-2">
            <ModeBadge mode={session.mode} />
            <span className="text-xs font-medium text-zinc-500">
              {formatSessionDate(session.date)}
            </span>
          </div>
          
          {/* Summary / Title - Clean */}
          <h3 className="text-base font-bold text-zinc-900 tracking-tight line-clamp-2 group-hover:text-amber-600 transition-colors">
            {cleanSessionSummary(session.summary)}
          </h3>
          
          {/* Topic if available */}
          {session.topic && session.topic !== session.summary && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
              {session.topic}
            </p>
          )}
          
          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <MessageCircle size={13} />
              <span>{messageCount} messages</span>
            </div>
            
            {hasMedia && (
              <div className="flex items-center gap-1 text-xs text-zinc-400">
                <ImageIcon size={13} />
                <span>{session.mediaCount} media</span>
              </div>
            )}
            
            {hasWhiteboard && (
              <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Pencil size={12} />
                <span>Whiteboard</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Arrow indicator */}
        <ChevronRight 
          size={20} 
          className="text-zinc-300 group-hover:text-amber-500 shrink-0 mt-1 transition-colors" 
        />
      </div>
      
      {/* Delete confirmation */}
      <DeleteConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => {
          onDelete(session);
          setShowDelete(false);
        }}
        sessionSummary={session.summary || 'this session'}
      />
    </div>
  );
}

export default function Sessions() {
  const navigate = useNavigate();
  const { sessions, deleteSession } = useSessions();
  
  console.log('[Sessions] Rendering with', sessions.length, 'sessions');

  const handleDelete = async (session: SavedSession) => {
    try {
      await deleteSession(session.id);
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session. Please try again.');
    }
  };

  // Group sessions by date
  const groupedSessions = sessions.reduce((groups, session) => {
    const date = new Date(session.date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let groupKey: string;
    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday';
    } else if (date.getFullYear() === today.getFullYear()) {
      groupKey = format(date, 'MMMM yyyy');
    } else {
      groupKey = format(date, 'yyyy');
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(session);
    return groups;
  }, {} as Record<string, SavedSession[]>);

  return (
    <div className="flex flex-col h-full bg-[#faf9f5] text-zinc-900">
      {/* Header */}
      <header className="shrink-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 py-4">
        <div className="flex items-center justify-center max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-zinc-900">My Study Notes</h1>
        </div>
      </header>

      {/* Sessions List */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {sessions.length === 0 ? (
            <div className="text-center bg-white border border-zinc-200 rounded-[32px] shadow-sm py-16 px-6 flex flex-col items-center mt-8">
              <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
                <Clock size={40} className="text-zinc-300" />
              </div>
              <p className="font-bold text-zinc-900 text-xl">No past sessions found</p>
              <p className="text-zinc-500 mt-2 font-medium max-w-[250px]">
                Start a Lab, Exam, or Tutor session to see your history here.
              </p>
              <button
                onClick={() => navigate('/')}
                className="mt-6 px-6 py-3 bg-amber-500 text-white font-bold rounded-full hover:bg-amber-600 transition-colors"
              >
                Start Learning
              </button>
            </div>
          ) : (
            (Object.entries(groupedSessions) as [string, SavedSession[]][]).map(([groupName, groupSessions]) => (
              <div key={groupName}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 px-1">
                  {groupName}
                </h2>
                <div className="space-y-3">
                  {groupSessions.map(session => (
                    <SessionCard 
                      key={session.id} 
                      session={session}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
