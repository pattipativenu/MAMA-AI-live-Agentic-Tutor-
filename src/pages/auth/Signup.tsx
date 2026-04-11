import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { Mail, Lock, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Once signed up, redirect to onboarding to collect profile info
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setError('');
    setLoading(true);
    try {
      const demoEmail = import.meta.env.VITE_DEMO_EMAIL || 'demo@mama.ai';
      const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || 'password123';
      await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Demo account not configured. Please login manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[rgb(250,249,245)] flex flex-col justify-center items-center p-6 text-zinc-900">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-4 mb-4">
            <img src="/assets/Mama_logo.png" alt="Mama AI Logo" className="w-32 h-auto object-contain" />
          </div>
          <p className="text-zinc-600 font-medium text-sm px-4">A multi-modal personal tutor that can see, hear, respond, and generate for you.</p>
          <h1 className="text-3xl font-bold tracking-tight mt-6">Create an account</h1>
          <p className="text-zinc-500 font-medium">Sign up to start learning with Mama AI.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-start gap-3 border border-red-100 text-sm font-medium">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-11 pr-4 py-3.5 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
                  <Lock size={20} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-11 pr-12 py-3.5 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all shadow-md active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 mt-6"
          >
            {loading ? 'Creating...' : 'Create Account'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>

        <p className="text-center text-zinc-500 font-medium text-sm pt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-amber-600 font-bold hover:underline">
            Log in
          </Link>
        </p>

        <div className="pt-4 border-t border-zinc-200">
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="w-full text-zinc-500 font-bold py-3 rounded-2xl hover:bg-zinc-100 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 text-sm"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
