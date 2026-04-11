import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

/** Safe init: Vite HMR re-executes this module; a second initializeApp() throws and blanks the app. */
function getOrInitApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey) return null;
  try {
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  } catch (e) {
    console.error('Firebase initialization failed:', e);
    return null;
  }
}

const app = getOrInitApp();

if (!app) {
  console.error("FIREBASE CONFIGURATION MISSING: VITE_FIREBASE_API_KEY is not defined.");
  console.error("Please create a .env.local file using .env.example as a template.");
}

export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app, 'mama') : null as any;
export const storage = app ? getStorage(app) : null as any;

