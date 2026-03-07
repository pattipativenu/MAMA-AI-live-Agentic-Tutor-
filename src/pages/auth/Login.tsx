import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { Mail, Lock, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login() {
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
      await signInWithEmailAndPassword(auth, email, password);
      // Let AuthContext handle the user state. 
      // We will navigate the user based on whether they have a profile or not in App.tsx,
      // but safely we can just navigate to Home, and Home/App will handle Onboarding redirect.
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (userDoc.exists()) {
        navigate('/');
      } else {
        navigate('/onboarding');
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
      } else {
        setError(err.message || 'Failed to sign in with Google.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[rgb(250,249,245)] flex flex-col justify-center items-center p-6 text-zinc-900">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-4 mb-4">
            <img src="/assets/mama-ai-logo.png" alt="Mama AI Logo" className="w-32 h-auto object-contain" />
          </div>
          <p className="text-zinc-600 font-medium text-sm px-4">A multi-modal personal tutor that can see, hear, respond, and generate for you.</p>
          <h1 className="text-3xl font-bold tracking-tight mt-6">Welcome back</h1>
          <p className="text-zinc-500 font-medium">Please enter your details to sign in.</p>
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
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center object-contain pointer-events-none text-zinc-400">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-11 pr-4 py-3.5 text-zinc-900 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all font-medium"
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
                  placeholder="••••••••"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-11 pr-12 py-3.5 text-zinc-900 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all font-medium"
                  required
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
            {loading ? 'Signing in...' : 'Sign In'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>

        <div className="relative mt-8 mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200"></div>
          </div>
          <div className="relative flex justify-center text-sm font-medium">
            <span className="px-3 bg-[rgb(250,249,245)] text-zinc-400 uppercase text-xs font-bold tracking-wider">Or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-zinc-200 text-zinc-900 font-bold py-4 rounded-2xl hover:bg-zinc-50 transition-all shadow-sm active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-zinc-500 font-medium text-sm pt-4">
          Don't have an account?{' '}
          <Link to="/signup" className="text-teal-600 font-bold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
