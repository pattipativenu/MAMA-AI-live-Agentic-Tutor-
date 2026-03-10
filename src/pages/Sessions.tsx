import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Play, ChevronRight, Image as ImageIcon, Video } from 'lucide-react';
import { useSessions, SavedSession } from '../hooks/useSessions';

export default function Sessions() {
  const navigate = useNavigate();
  const { sessions } = useSessions();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  console.log('[Sessions] Rendering with', sessions.length, 'sessions');

  const handleResume = (session: SavedSession) => {
    // Navigate to the appropriate mode with the session ID to resume
    navigate(`/${session.mode}/entry?resumeId=${session.id}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#faf9f5] text-zinc-900 p-6 pb-24">
      <header className="flex items-center justify-between mb-8">
        <button onClick={() => navigate(-1)} className="p-2 bg-white border border-zinc-200 rounded-full hover:bg-zinc-50 transition-colors shadow-sm">
          <ArrowLeft size={24} className="text-zinc-600" />
        </button>
        <h1 className="text-xl font-bold text-zinc-900">Session History</h1>
        <div className="w-10"></div>
      </header>

      <div className="space-y-4 max-w-2xl mx-auto w-full">
        {sessions.length === 0 ? (
          <div className="text-center bg-white border border-zinc-200 rounded-[32px] shadow-sm py-16 px-6 flex flex-col items-center">
            <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
              <Clock size={40} className="text-zinc-300" />
            </div>
            <p className="font-bold text-zinc-900 text-xl">No past sessions found</p>
            <p className="text-zinc-500 mt-2 font-medium max-w-[250px]">Start a Lab or Exam to see your history here.</p>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="bg-white border border-zinc-200 rounded-3xl overflow-hidden transition-all shadow-sm">
              {/* Header / Summary */}
              <div 
                className="p-6 cursor-pointer flex items-center justify-between hover:bg-zinc-50 transition-colors"
                onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
              >
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                      session.mode === 'lab' 
                        ? 'bg-teal-50 text-teal-600' 
                        : session.mode === 'tutor'
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      {session.mode} Mode
                    </span>
                    <span className="text-xs font-medium text-zinc-500">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 tracking-tight">{session.summary}</h3>
                </div>
                <ChevronRight 
                  size={20} 
                  className={`text-zinc-400 transition-transform ${expandedId === session.id ? 'rotate-90' : ''}`} 
                />
              </div>

              {/* Expanded Content (Chat Log) */}
              {expandedId === session.id && (
                <div className="p-6 pt-0 border-t border-zinc-100 bg-zinc-50/50">
                  <div className="space-y-6 mt-6 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {session.messages.map((msg, idx) => (
                      <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-white border border-zinc-200 text-zinc-800 rounded-tr-sm' 
                            : 'bg-amber-50 border border-amber-100 text-amber-900 rounded-tl-sm'
                        }`}>
                          <p className={`text-xs font-semibold mb-1 uppercase tracking-wider ${
                            msg.role === 'user' ? 'text-zinc-400' : 'text-amber-600/70'
                          }`}>
                            {msg.role === 'user' ? 'You' : 'Mama AI'}
                          </p>
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                          
                          {msg.image && (
                            <div className="mt-4 relative rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
                              <img src={msg.image} alt="Generated Visual Aid" className="w-full h-auto" />
                              <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 border border-zinc-200/50 shadow-sm">
                                <ImageIcon size={12} className="text-amber-500" />
                                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Visual Aid</span>
                              </div>
                            </div>
                          )}
                          {msg.video && (
                            <div className="mt-4 relative rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
                              <video 
                                src={msg.video} 
                                controls 
                                className="w-full h-auto max-h-64"
                                poster="/video-thumbnail.jpg"
                              />
                              <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 border border-zinc-200/50 shadow-sm">
                                <Video size={12} className="text-indigo-500" />
                                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Video</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-zinc-200/50 flex justify-end">
                    <button 
                      onClick={() => handleResume(session)}
                      className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-700 transition-colors shadow-sm"
                    >
                      <Play size={16} fill="currentColor" />
                      Resume Session
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
