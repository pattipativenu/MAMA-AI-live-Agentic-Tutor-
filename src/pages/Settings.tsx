import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Gamepad2, BookOpen, Tv, Rocket, Dumbbell, Palette, Music, Trophy, Eye, Ear, Hand, Save, CheckCircle2, Lock, Shield, LogOut } from 'lucide-react';
import { UserProfile } from '../hooks/useProfile';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db } from '../firebase';

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

export default function Settings() {
  const navigate = useNavigate();
  const { userProfile, currentUser, refreshProfile, logout } = useAuth();

  const [formData, setFormData] = useState<UserProfile>(userProfile || { name: '', age: '', gender: '', hobbies: [], learningStyle: '' });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'profile'>('account');

  useEffect(() => {
    if (userProfile) {
      setFormData(userProfile);
    }
  }, [userProfile]);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const toggleHobby = (hobbyId: string) => {
    setFormData(prev => {
      const hobbies = prev.hobbies?.includes(hobbyId)
        ? prev.hobbies.filter(h => h !== hobbyId)
        : [...(prev.hobbies || []), hobbyId];
      return { ...prev, hobbies };
    });
  };

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, formData, { merge: true });

      if (newPassword) {
        await updatePassword(currentUser, newPassword);
      }

      await refreshProfile();
      setSaved(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to save settings.");
    }
  };

  return (
    <div className="flex flex-col min-h-dvh bg-[rgb(250,249,245)] text-zinc-900 px-0 pt-0 relative pb-24">
      <div className="bg-white border-b border-zinc-200 px-6 py-4 pt-6 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-colors shrink-0">
            <ArrowLeft size={20} className="text-zinc-600" />
          </button>
          <h1 className="text-xl font-bold tracking-tight px-4 text-center">Settings</h1>
          <div className="w-10"></div>
        </div>

        {/* Custom Tab Selector */}
        <div className="flex p-1 bg-zinc-100/80 rounded-2xl w-full max-w-sm mx-auto shadow-inner border border-zinc-200/50">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'account' ? 'bg-white shadow-sm text-amber-600' : 'text-zinc-500 hover:text-zinc-700'
              }`}
          >
            Account Details
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'profile' ? 'bg-white shadow-sm text-teal-600' : 'text-zinc-500 hover:text-zinc-700'
              }`}
          >
            Student Profile
          </button>
        </div>
      </div>

      <div className="p-6 max-w-md mx-auto w-full space-y-8">

        {/* --- ACCOUNT TAB --- */}
        {activeTab === 'account' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

            <div className="space-y-4 bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                <User size={16} className="text-amber-500" /> Personal Info
              </h2>

              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Email</label>
                <div className="w-full bg-zinc-100 border border-zinc-200 rounded-2xl px-4 py-3 text-zinc-500 font-medium">
                  {currentUser?.email}
                </div>
              </div>

              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Full Name</label>
                <input
                  type="text"
                  placeholder="What should I call you?"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Age / Grade</label>
                <input
                  type="text"
                  placeholder="e.g., 12 years old, Class 7"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all appearance-none font-medium"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="space-y-4 bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                <Lock size={16} className="text-amber-500" /> Security
              </h2>

              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-4 bg-white p-5 rounded-3xl border border-red-100 shadow-sm mt-4">
              <button onClick={() => logout()} className="w-full flex justify-center items-center gap-2 text-red-500 font-bold py-2 hover:bg-red-50 rounded-xl transition-colors">
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        )}

        {/* --- STUDENT PROFILE TAB --- */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

            <div className="space-y-4 bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-2 text-zinc-800">
                <Gamepad2 size={18} className="text-teal-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Favorite Activities</h2>
              </div>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                Mama AI uses your hobbies to create real-world examples that actually make sense to you.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {HOBBIES.map(hobby => {
                  const Icon = hobby.icon;
                  const isSelected = formData.hobbies.includes(hobby.id);
                  return (
                    <button
                      key={hobby.id}
                      onClick={() => toggleHobby(hobby.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border transition-all shadow-sm ${isSelected
                        ? 'bg-teal-500 border-teal-600 text-white'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-teal-300 hover:bg-teal-50'
                        }`}
                    >
                      <Icon size={14} />
                      <span className="text-xs font-bold tracking-wide">{hobby.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex items-center gap-2 text-zinc-800">
                <Shield size={18} className="text-teal-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Learning Style</h2>
              </div>
              <div className="space-y-3 pt-2">
                {LEARNING_STYLES.map(style => {
                  const Icon = style.icon;
                  const isSelected = formData.learningStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => setFormData({ ...formData, learningStyle: style.id })}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left shadow-sm group ${isSelected
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-amber-200 hover:bg-amber-50/50'
                        }`}
                    >
                      <div className={`p-2.5 rounded-xl transition-colors ${isSelected ? 'bg-amber-500 text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-400 group-hover:text-amber-500'}`}>
                        <Icon size={20} />
                      </div>
                      <span className={`font-bold text-sm ${isSelected ? 'text-amber-900' : 'text-zinc-600'}`}>{style.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Global Save Button */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all shadow-md active:scale-[0.98] mt-4"
        >
          {saved ? (
            <>
              <CheckCircle2 size={20} className="text-green-500" />
              <span>Saved Successfully</span>
            </>
          ) : (
            <>
              <Save size={20} />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
