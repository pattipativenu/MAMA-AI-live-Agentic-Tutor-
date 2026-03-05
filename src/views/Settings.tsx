export default function Settings() {
    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Settings</h2>

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-slate-700">
                    <h3 className="text-xl font-semibold mb-2">Device Selection</h3>
                    <p className="text-sm text-slate-400 mb-4">Choose your preferred camera and microphone.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Camera</label>
                            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500">
                                <option>Default Camera</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Microphone</label>
                            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500">
                                <option>Default Microphone</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">API Status</h3>
                    <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                        <span className="text-slate-300">Gemini 3.1 Pro / Flash</span>
                        <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">Configured</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                        <span className="text-slate-300">Gemini 2.5 Pro (Live API)</span>
                        <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">Configured</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-slate-300">Firebase Auth & Firestore</span>
                        <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">Configured</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
