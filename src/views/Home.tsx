import { useNavigate } from 'react-router-dom';

export default function Home() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
            <div className="mb-8 relative">
                <div className="absolute inset-0 bg-cyan-500 blur-3xl opacity-20 rounded-full"></div>
                <h2 className="text-5xl font-extrabold tracking-tight mb-4 relative text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    Welcome to Mama AI
                </h2>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto relative">
                    Your multimodal AI tutor. Experience hands-on learning with real-time feedback, deep pedagogical evaluation, and interactive storytelling.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mt-8">
                <button
                    onClick={() => navigate('/lab')}
                    className="group flex flex-col items-center p-8 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-cyan-500/20"
                >
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Lab Mode</h3>
                    <p className="text-slate-400 text-sm">Real-time experiment guidance with Live Vision & Audio</p>
                </button>

                <button
                    onClick={() => navigate('/exam')}
                    className="group flex flex-col items-center p-8 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-purple-500/20"
                >
                    <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Exam Mode</h3>
                    <p className="text-slate-400 text-sm">Testing & Interactive Visual Storytelling Feedback</p>
                </button>
            </div>
        </div>
    );
}
