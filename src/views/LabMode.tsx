import { useRef, useEffect, useState } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';

export default function LabMode() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const { connect, disconnect, isConnected, isConnecting, status, currentImage, toggleMute, isMuted } = useGeminiLive();
    const [cameraEnabled, setCameraEnabled] = useState(false);

    useEffect(() => {
        async function setupCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: 640, height: 480 }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                streamRef.current = stream;
                setCameraEnabled(true);
            } catch (err) {
                console.error("Failed to access camera:", err);
            }
        }
        setupCamera();

        return () => {
            // Cleanup camera on unmount
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            disconnect();
        };
    }, [disconnect]);

    const handleStartSession = () => {
        const systemPrompt = "You are Mama AI, a strict but encouraging pedagogical tutor. You are now in Lab Mode. The student is performing an experiment in front of their camera. Watch carefully. Acknowledge what they are doing. Interrupt them gently but immediately if they make a mistake in the physical steps. Output simple, conversational responses.";
        connect(systemPrompt, undefined, null, videoRef.current);
    };

    return (
        <div className="flex flex-col items-center justify-start min-h-[80vh] p-4 text-center">
            <div className="flex items-center gap-4 mb-8 w-full max-w-4xl justify-between">
                <h2 className="text-3xl font-bold">Lab Mode: Active Learning</h2>
                <div className="flex gap-2 items-center">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${isConnected ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                        {status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl">
                {/* Camera Feed Container */}
                <div className="flex flex-col gap-4">
                    <div className="w-full aspect-video bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden relative shadow-2xl flex flex-col">
                        {!cameraEnabled && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 z-10">
                                <p className="text-slate-400 animate-pulse">Waiting for camera access...</p>
                            </div>
                        )}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                        {/* Overlay recording indicator */}
                        {isConnected && (
                            <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full z-20">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                                <span className="text-xs font-medium text-white tracking-wider">LIVE</span>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center gap-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                        {!isConnected ? (
                            <button
                                onClick={handleStartSession}
                                disabled={isConnecting || !cameraEnabled}
                                className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-all shadow-lg hover:shadow-cyan-500/25 flex items-center gap-2"
                            >
                                {isConnecting ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                        <span>Connecting...</span>
                                    </>
                                ) : (
                                    <span>Start Guidance</span>
                                )}
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={toggleMute}
                                    className={`p-3 rounded-full transition-colors flex items-center justify-center ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                >
                                    {isMuted ? (
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" stroke="currentColor" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                                    ) : (
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                    )}
                                </button>
                                <button
                                    onClick={() => disconnect()}
                                    className="px-8 py-3 bg-red-600/90 hover:bg-red-500 text-white font-semibold rounded-full transition-all shadow-lg hover:shadow-red-500/25"
                                >
                                    End Session
                                </button>
                                <button
                                    onClick={() => {
                                        disconnect();
                                        window.location.href = '/exam?mock=true';
                                    }}
                                    className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-full transition-all shadow-lg hover:shadow-purple-500/25 ml-4"
                                >
                                    Finish & Evaluate
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Visual Aids Container */}
                <div className="flex flex-col bg-slate-800/30 rounded-2xl border border-slate-700 p-6 min-h-[400px]">
                    <h3 className="text-xl font-semibold mb-4 text-left flex items-center gap-2">
                        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Visual Clarification
                    </h3>
                    <div className="flex-1 w-full bg-slate-900/50 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden">
                        {currentImage ? (
                            <img src={currentImage} alt="AI Generated Diagram" className="w-full h-full object-contain" />
                        ) : (
                            <div className="text-slate-500 flex flex-col items-center gap-2">
                                <svg className="w-12 h-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                <span className="text-sm">Mama AI will generate diagrams here if needed.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
