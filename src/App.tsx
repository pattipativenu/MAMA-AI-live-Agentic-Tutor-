import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import MobileLayout from './components/MobileLayout';
import Home from './pages/Home';
import LabEntry from './pages/lab/Entry';
import ExamEntry from './pages/exam/Entry';
import Settings from './pages/Settings';
import Sessions from './pages/Sessions';
import StudyLibrary from './pages/study/StudyLibrary';
import StudyDetail from './pages/study/StudyDetail';
import TutorChat from './pages/study/TutorChat';
import Summary from './pages/summary/Summary';

import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Onboarding from './pages/auth/Onboarding';
import { useAuth } from './contexts/AuthContext';

function ProtectedLayout() {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser) return <Navigate to="/login" replace />;
  // We cannot navigate to onboarding if they are completely unauthenticated because they wouldn't hit this wrapper, but just in case:
  if (!userProfile) return <Navigate to="/onboarding" replace />;

  return (
    <MobileLayout>
      <Outlet />
    </MobileLayout>
  );
}

export default function App() {
  const { currentUser, userProfile } = useAuth();
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  if (hasKey === null) {
    return <div className="min-h-screen bg-[rgb(250,249,245)] flex items-center justify-center text-zinc-900">Loading...</div>;
  }

  // We only enforce API key check if the user is authenticated and trying to use the app
  if (!hasKey && currentUser && userProfile) {
    return (
      <div className="min-h-screen bg-[rgb(250,249,245)] flex flex-col items-center justify-center text-zinc-900 p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">API Key Required</h1>
        <p className="text-zinc-600 mb-8 max-w-md">
          To use Mama AI's advanced features, you need to select a Google AI Studio API key.
          <br /><br />
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-teal-600 underline">Learn more about billing</a>
        </p>
        <button
          onClick={handleSelectKey}
          className="bg-teal-500 text-white font-bold py-3 px-6 rounded-full hover:bg-teal-600 transition-colors shadow-md"
        >
          Select API Key
        </button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={currentUser ? <Navigate to="/" replace /> : <Signup />} />

        {/* Onboarding Route (Requires auth, but NO profile yet) */}
        <Route path="/onboarding" element={
          !currentUser ? <Navigate to="/login" replace /> :
            userProfile ? <Navigate to="/" replace /> : <Onboarding />
        } />

        {/* Protected App Routes (Wrapped in MobileLayout) */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/lab/entry" element={<LabEntry />} />
          <Route path="/exam/entry" element={<ExamEntry />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/study" element={<StudyLibrary />} />
          <Route path="/study/:bookId" element={<StudyDetail />} />
          <Route path="/study/:bookId/:chapterIndex" element={<TutorChat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
