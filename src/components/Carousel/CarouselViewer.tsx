import React from 'react';
import { useCarousel, CarouselSlide } from '../../hooks/useCarousel';
import { Play, Pause, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface CarouselViewerProps {
    slides: CarouselSlide[];
    onComplete?: () => void;
}

export default function CarouselViewer({ slides, onComplete }: CarouselViewerProps) {
    const { userProfile } = useAuth();
    const autoAdvance = userProfile?.autoAdvanceCarousel !== false; // Defaults to true

    const {
        currentIndex,
        currentSlide,
        isPlaying,
        progress,
        togglePlay,
        nextSlide,
        prevSlide,
        isFinished
    } = useCarousel(slides, autoAdvance);

    React.useEffect(() => {
        if (isFinished && onComplete) {
            onComplete();
        }
    }, [isFinished, onComplete]);

    if (!currentSlide || slides.length === 0) return null;

    return (
        <div className="flex flex-col w-full h-full bg-zinc-950 text-white relative rounded-4xl overflow-hidden shadow-2xl border border-zinc-800">
            {/* Media Container */}
            <div className="flex-1 relative w-full h-full bg-zinc-900 flex items-center justify-center">
                {currentSlide.type === 'image' && currentSlide.url ? (
                    <img src={currentSlide.url} alt="Carousel slide" className="w-full h-full object-cover opacity-90" />
                ) : currentSlide.type === 'video' && currentSlide.url ? (
                    <video src={currentSlide.url} autoPlay={isPlaying} loop muted playsInline className="w-full h-full object-cover" />
                ) : (
                    <div className="p-8 text-center flex flex-col items-center gap-4">
                        <FileText size={48} className="text-zinc-600" />
                        <p className="text-xl font-medium text-zinc-300">{currentSlide.fallbackText || "Media unavailable"}</p>
                    </div>
                )}

                {/* Overlay Gradients */}
                <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/60 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-64 bg-linear-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

                {/* Narration Text Subtitles */}
                <div className="absolute bottom-20 inset-x-0 px-6 max-w-[430px] mx-auto w-full">
                    <p className="text-center md:text-lg text-base font-medium leading-relaxed text-amber-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] bg-black/50 backdrop-blur-md py-3 px-5 rounded-2xl border border-white/10">
                        {currentSlide.narrationText}
                    </p>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 pb-6 pt-4 px-6 flex flex-col gap-3 pointer-events-auto z-10 max-w-[430px] mx-auto w-full">

                {/* Progress Bar Container */}
                <div className="flex gap-1.5 w-full">
                    {slides.map((_, idx) => (
                        <div key={idx} className="h-1.5 flex-1 rounded-full bg-zinc-700/50 overflow-hidden relative">
                            <div
                                className={`absolute inset-y-0 left-0 bg-amber-400 rounded-full transition-all ease-linear ${idx < currentIndex ? 'w-full duration-0' : idx === currentIndex ? 'duration-50' : 'w-0 duration-0'
                                    }`}
                                style={{ width: idx === currentIndex ? `${progress * 100}%` : undefined }}
                            />
                        </div>
                    ))}
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between mt-2">
                    <button onClick={prevSlide} disabled={currentIndex === 0} className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                        <ChevronLeft size={28} />
                    </button>

                    <button onClick={togglePlay} className="w-14 h-14 flex items-center justify-center rounded-full bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all active:scale-95">
                        {isPlaying ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current ml-1" />}
                    </button>

                    <button onClick={nextSlide} disabled={currentIndex === slides.length - 1} className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                        <ChevronRight size={28} />
                    </button>
                </div>

            </div>
        </div>
    );
}
