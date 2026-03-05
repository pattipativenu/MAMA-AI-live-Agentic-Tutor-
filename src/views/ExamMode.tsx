import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGeminiReasoning } from '../hooks/useGeminiReasoning';
import { useGeminiLive } from '../hooks/useGeminiLive';

export default function ExamMode() {
    const [searchParams] = useSearchParams();
    const isMock = searchParams.get('mock') === 'true';
    const { evaluateTranscript, isEvaluating, error } = useGeminiReasoning();
    const { connect, disconnect, isConnected, currentImage } = useGeminiLive();

    const [evaluation, setEvaluation] = useState<any>(null);

    useEffect(() => {
        if (isMock && !evaluation && !isEvaluating) {
            const mockTranscript = "Student: I'm pouring the Benedict's solution into the test tube. Mama AI: Good, now what color is it? Student: It's blue. Wait, I should heat it up. Mama AI: Yes, put it in the water bath. Student: Okay, it's turning green, then yellow! Mama AI: Excellent. What does that indicate? Student: It means there are reducing sugars. Like sucrose. Mama AI: Actually, sucrose is a non-reducing sugar. Glucose and fructose are reducing.";

            evaluateTranscript(mockTranscript).then(result => {
                if (result) setEvaluation(result);
            });
        }
    }, [isMock, evaluateTranscript, evaluation, isEvaluating]);

    const startOralQuiz = () => {
        const prompt = `You are Mama AI in Exam Mode. The student just finished an experiment. Here is their evaluation: ${JSON.stringify(evaluation)}. Start an oral quiz with 2 rapid-fire questions testing their retention of the incorrect concepts and the hooks you provided.`;
        connect(prompt);
    };

    return (
        <div className="flex flex-col items-center justify-start py-8 px-4 w-full">
            <div className="w-full max-w-5xl">
                <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    Pedagogical Evaluation
                </h2>

                {isEvaluating ? (
                    <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 flex flex-col items-center justify-center animate-pulse">
                        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-xl text-slate-300">Mama AI is evaluating your transcript...</p>
                        <p className="text-sm text-slate-500 mt-2">Gemini 3.1 Pro is generating custom visual hooks.</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-red-400">
                        Error: {error}
                    </div>
                ) : evaluation ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Left Column: Stats */}
                        <div className="flex flex-col gap-6 lg:col-span-1">
                            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
                                <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Understood
                                </h3>
                                <ul className="space-y-2">
                                    {evaluation.correct.map((item: string, i: number) => (
                                        <li key={i} className="text-slate-300 text-sm bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">{item}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
                                <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    Needs Review
                                </h3>
                                <ul className="space-y-2">
                                    {evaluation.incorrect.map((item: string, i: number) => (
                                        <li key={i} className="text-slate-300 text-sm bg-slate-900/50 p-3 rounded-lg border border-amber-500/20">{item}</li>
                                    ))}
                                    {evaluation.missing.map((item: string, i: number) => (
                                        <li key={i + 100} className="text-slate-300 text-sm bg-slate-900/50 p-3 rounded-lg border border-amber-500/20">{item} (Missing)</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Right Column: Storyteller & Hooks */}
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            <div className="bg-gradient-to-br from-slate-800 to-indigo-900/40 rounded-2xl p-1 border border-indigo-500/30 shadow-2xl overflow-hidden">
                                <div className="bg-slate-900 rounded-xl p-6 h-full flex flex-col">
                                    <h3 className="text-xl font-bold text-white mb-2">Mental Hooks Generated</h3>
                                    <p className="text-slate-400 text-sm mb-6">Gemini 3.1 Pro has synthesized these analogies to help you remember.</p>

                                    <div className="grid gap-4 mb-6">
                                        {evaluation.hooks.map((hook: string, i: number) => (
                                            <div key={i} className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl flex gap-4 items-start">
                                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold shrink-0">{i + 1}</div>
                                                <p className="text-indigo-100 italic">"{hook}"</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-auto pt-6 border-t border-slate-700/50 flex flex-col md:flex-row gap-6 items-center">
                                        <div className="flex-1 w-full aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 relative flex items-center justify-center">
                                            {currentImage ? (
                                                <img src={currentImage} alt="Story visual" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-500">
                                                    <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span className="text-xs tracking-widest uppercase">Waiting for Storyteller</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-center gap-4">
                                            <p className="text-slate-300 text-sm">
                                                Ready to test your knowledge on these hooks? Start the oral exam. Mama AI will interleave visual storytelling using Nano Banana Pro equivalents (Gemini Image Gen) dynamically.
                                            </p>
                                            {!isConnected ? (
                                                <button onClick={startOralQuiz} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-semibold transition-colors shadow-lg hover:shadow-purple-500/25">
                                                    Start Oral Quiz
                                                </button>
                                            ) : (
                                                <button onClick={disconnect} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-semibold transition-colors shadow-lg shadow-red-500/20">
                                                    End Quiz
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                ) : null}
            </div>
        </div>
    );
}
