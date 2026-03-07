import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, PlayCircle, RotateCcw, Award, Lightbulb } from 'lucide-react';
import CarouselViewer from '../../components/Carousel/CarouselViewer';
import { CarouselSlide } from '../../hooks/useCarousel';
import { useAuth } from '../../contexts/AuthContext';

const MOCK_SLIDES: CarouselSlide[] = [
  {
    id: '1',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=800',
    narrationText: 'The pH scale measures how acidic or basic a substance is.',
    durationMs: 4000
  },
  {
    id: '2',
    type: 'video',
    url: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
    narrationText: 'Notice how the indicator changes color as we add more base.',
    durationMs: 5000
  },
  {
    id: '3',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80&w=800',
    narrationText: 'A deep blue color indicates a strong base, like ammonia.',
    durationMs: 4000
  }
];

const MOCK_HOOKS = [
  { term: 'ACID', description: 'Angry Cats Irritate Dogs (Red/Pink colors, sour taste)' },
  { term: 'BASE', description: 'Bears Always Seek Eucalyptus (Blue colors, slippery feel)' },
  { term: 'NEUTRAL', description: 'Neither Extreme, Usually Transparent (Green/Clear, pH 7)' }
];

export default function Summary() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [showCarousel, setShowCarousel] = useState(false);

  const mockScore = 4; // 4 out of 5 stars

  if (showCarousel) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <button 
          onClick={() => setShowCarousel(false)}
          className="absolute top-12 right-6 z-50 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors cursor-pointer border border-white/10"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1 p-2 pt-12 pb-6 max-h-[92vh] max-w-[460px] mx-auto w-full">
           <CarouselViewer slides={MOCK_SLIDES} onComplete={() => setShowCarousel(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[rgb(250,249,245)] text-zinc-900 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 pt-6 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/')} className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-colors">
            <ArrowLeft size={20} className="text-zinc-600" />
          </button>
          <div className="flex items-center gap-2">
            <span className="bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Lab Mode
            </span>
          </div>
          <div className="w-10"></div>
        </div>
      </div>

      <div className="p-6 max-w-md mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Hero Section */}
        <div className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4 border-4 border-amber-50 shadow-inner">
            <Award size={40} className="text-amber-500" />
          </div>
          <h1 className="text-2xl font-black text-zinc-900 mb-2">Session Complete!</h1>
          <p className="text-zinc-500 font-medium mb-6">Great job today, {userProfile?.name?.split(' ')[0] || 'Student'}!</p>
          
          {/* Star Rating */}
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                key={star} 
                size={32} 
                className={`${star <= mockScore ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_4px_rgba(251,191,36,0.5)]' : 'fill-zinc-100 text-zinc-200'}`} 
              />
            ))}
          </div>
        </div>

        {/* Concept Hooks */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Lightbulb size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-zinc-800">Memory Hooks</h2>
          </div>
          
          <div className="grid gap-3">
            {MOCK_HOOKS.map((hook, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm hover:border-amber-300 transition-colors group">
                <h3 className="font-black text-indigo-600 mb-1 group-hover:text-amber-600 transition-colors">{hook.term}</h3>
                <p className="text-sm font-medium text-zinc-600 leading-relaxed">{hook.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <button 
            onClick={() => setShowCarousel(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-md active:scale-[0.98]"
          >
            <PlayCircle size={22} />
            Replay Visuals
          </button>
          
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 bg-white text-zinc-800 border-2 border-zinc-200 font-bold py-4 rounded-2xl hover:bg-zinc-50 transition-all active:scale-[0.98]"
          >
            <RotateCcw size={22} />
            Return Home
          </button>
        </div>

      </div>
    </div>
  );
}
