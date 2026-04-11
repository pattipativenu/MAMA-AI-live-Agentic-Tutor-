import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '../firebase';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types/profile';  // canonical source of truth

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    if (!db) {
      setUserProfile(null);
      return;
    }
    try {
      const docRef = doc(db, 'users', uid);
      // Race against a 5-second timeout so a hanging Firestore call
      // (e.g. unreachable DB, wrong config) can never permanently block the app.
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const docSnap = await Promise.race([getDoc(docRef), timeout]);
      if (docSnap && 'exists' in docSnap && docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        setUserProfile(null);
      }
    } catch (e) {
      console.error("Error fetching user profile", e);
      setUserProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await fetchProfile(currentUser.uid);
    }
  };

  useEffect(() => {
    if (!auth) {
      console.warn("Firebase Auth is not initialized. Skipping auth listener.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      // Resolve loading AFTER profile fetch so the app navigates directly
      // to the right page with no flash through /onboarding.
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    if (auth) {
      await firebaseSignOut(auth);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[rgb(250,249,245)] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
