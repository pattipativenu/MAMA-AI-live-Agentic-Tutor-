import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { User, Gamepad2, BookOpen, Tv, Rocket, Dumbbell, Palette, Music, Trophy, Eye, Ear, Hand, ArrowRight, CheckCircle2, LogOut } from 'lucide-react';
import { UserProfile } from '../../hooks/useProfile';

const HOBBIES = [
  { id: 'cricket', label: 'Cricket', icon: Trophy },
  { id: 'football', label: 'Football', icon: Trophy },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'anime', label: 'Anime', icon: Tv },
  { id: 'space', label: 'Space', icon: Rocket },
  { id: 'gym', label: 'Gym/Workout', icon: Dumbbell },
  { id: 'art', label: 'Art/Drawing', icon: Palette },
  { id: 'music', label: 'Music', icon: Music },
];

const LEARNING_STYLES = [
  { id: 'visual', label: 'Visual (Images & Diagrams)', icon: Eye },
  { id: 'auditory', label: 'Auditory (Listening & Speaking)', icon: Ear },
  { id: 'kinesthetic', label: 'Kinesthetic (Doing & Hands-on)', icon: Hand },
];

const CAROUSEL_IMAGES = [
  '/assets/hobby_kids_9x16.png',
  '/assets/hobby_advanced_9x16.png'
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { currentUser, refreshProfile, logout } = useAuth();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: '',
    age: '',
    grade: '', // Extrapolated from age/grade field from original profile
    gender: '',
    hobbies: [],
    learningStyle: ''
  });

  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Auto-rotating carousel effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 4000); // Rotate every 4 seconds
    return () => clearInterval(interval);
  }, []);

  const toggleHobby = (hobbyId: string) => {
    setFormData(prev => {
      const hobbies = prev.hobbies || [];
      const newHobbies = hobbies.includes(hobbyId)
        ? hobbies.filter(h => h !== hobbyId)
        : [...hobbies, hobbyId];
      return { ...prev, hobbies: newHobbies };
    });
  };

  const selectAllHobbies = () => {
    setFormData(prev => ({ ...prev, hobbies: HOBBIES.map(h => h.id) }));
  };

  const handleNext = () => {
    if (step === 1 && (!formData.name || !formData.age || !formData.gender)) {
      alert("Please fill in your basic details to continue.");
      return;
    }
    setStep(2);
  };

  const handleFinish = async () => {
    if (!formData.learningStyle) {
      alert("Please select a learning style.");
      return;
    }
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      // Create user document in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        name: formData.name,
        email: currentUser.email,
        age: formData.age,
        grade: formData.grade || formData.age, // Fallback
        gender: formData.gender,
        hobbies: formData.hobbies,
        learningStyle: formData.learningStyle,
        createdAt: new Date().toISOString()
      }, { merge: true });

      await refreshProfile();
      navigate('/'); // Go to home once profile exists
    } catch (err) {
      console.error("Failed to save profile:", err);
      alert("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[rgb(250,249,245)] flex flex-col justify-center items-center p-6 text-zinc-900 pb-20">
      <div className="w-full max-w-md space-y-6">

        {/* Progress header & Escape Hatch */}
        <div className="flex justify-between items-start mb-8 px-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Setup Profile</h1>
            <div className="flex items-center gap-3">
              <p className="text-zinc-500 font-medium text-sm">Step {step} of 2</p>
              <div className="flex gap-1.5">
                <div className={`h-1.5 rounded-full w-6 ${step >= 1 ? 'bg-amber-500' : 'bg-zinc-200'}`} />
                <div className={`h-1.5 rounded-full w-6 transition-colors duration-500 ${step >= 2 ? 'bg-amber-500' : 'bg-zinc-200'}`} />
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-red-500 transition-colors bg-white px-3 py-1.5 rounded-full border border-zinc-200 shadow-sm"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>

        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="space-y-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
                    <User size={20} />
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="What should Mama AI call you?"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl pl-11 pr-4 py-3.5 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Age</label>
                  <input
                    type="text"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="e.g. 15"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3.5 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-medium"
                  />
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Grade/Class</label>
                  <input
                    type="text"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    placeholder="e.g. 10th"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3.5 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3.5 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-medium appearance-none"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

            </div>

            <button
              onClick={handleNext}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all shadow-md active:scale-[0.98]"
            >
              Continue to Preferences <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* STEP 2: Preferences */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">

            {/* Auto-Rotating Dynamic Slider */}
            <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col items-center">
              <h2 className="text-base font-bold text-center mb-2 px-2 text-zinc-800">
                Mama, use your hobbies to create real-world examples that actually make sense to you!
              </h2>

              <div className="relative w-full aspect-9/16 max-h-[400px] rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-inner flex justify-center items-center">
                {CAROUSEL_IMAGES.map((src, idx) => (
                  <img
                    key={src}
                    src={src}
                    alt={`Tutorial image ${idx + 1}`}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${idx === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                  />
                ))}

                {/* Carousel Indicators */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                  {CAROUSEL_IMAGES.map((_, idx) => (
                    <div key={idx} className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-amber-500 w-4' : 'bg-white/50'}`} />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-800"><Gamepad2 size={16} className="text-teal-500" /> Favorite Activities</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {HOBBIES.map(hobby => {
                  const Icon = hobby.icon;
                  const isSelected = formData.hobbies?.includes(hobby.id);
                  return (
                    <button
                      key={hobby.id}
                      onClick={() => toggleHobby(hobby.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border transition-all shadow-sm ${isSelected
                        ? 'bg-teal-500 border-teal-600 text-white'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                        }`}
                    >
                      <Icon size={14} />
                      <span className="text-xs font-bold tracking-wide">{hobby.label}</span>
                    </button>
                  );
                })}
                <button
                  onClick={selectAllHobbies}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border transition-all shadow-sm bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100`}
                >
                  <span className="text-xs font-bold tracking-wide">All of the above</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-2 text-zinc-800 mb-2">
                <CheckCircle2 size={16} className="text-amber-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Learning Style</h2>
              </div>
              <div className="space-y-2">
                {LEARNING_STYLES.map(style => {
                  const Icon = style.icon;
                  const isSelected = formData.learningStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => setFormData({ ...formData, learningStyle: style.id })}
                      className={`w-full flex items-center gap-4 p-3 rounded-2xl border transition-all text-left shadow-sm ${isSelected
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-zinc-50 border-zinc-200'
                        }`}
                    >
                      <div className={`p-2 rounded-xl transition-colors ${isSelected ? 'bg-amber-500 text-white' : 'bg-white text-zinc-400'}`}>
                        <Icon size={18} />
                      </div>
                      <span className={`font-bold text-sm ${isSelected ? 'text-amber-900' : 'text-zinc-600'}`}>{style.label}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setFormData({ ...formData, learningStyle: 'all' })}
                  className={`w-full flex items-center gap-4 p-3 rounded-2xl border transition-all text-left shadow-sm ${formData.learningStyle === 'all'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-zinc-50 border-zinc-200'
                    }`}
                >
                  <div className={`p-2 rounded-xl transition-colors ${formData.learningStyle === 'all' ? 'bg-amber-500 text-white' : 'bg-white text-zinc-400'}`}>
                    <CheckCircle2 size={18} />
                  </div>
                  <span className={`font-bold text-sm ${formData.learningStyle === 'all' ? 'text-amber-900' : 'text-zinc-600'}`}>All of the above</span>
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-white border border-zinc-200 text-zinc-700 font-bold py-4 rounded-2xl hover:bg-zinc-50 transition-all shadow-sm active:scale-[0.98]"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="flex-2 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all shadow-md active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? 'Finishing...' : 'Complete Profile'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
