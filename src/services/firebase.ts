import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase client configuration is public by design.
// Hardcoding it here prevents the platform from deleting it via .gitignore rules.
const firebaseConfig = {
  apiKey: "AIzaSyBjPEOr-fP3ku5pcrRKZzrXQ2b7H7qFJZ4",
  authDomain: "mama-ai-487817.firebaseapp.com",
  projectId: "mama-ai-487817",
  storageBucket: "mama-ai-487817.firebasestorage.app",
  messagingSenderId: "972465918951",
  appId: "1:972465918951:web:6ea52168426fda2e7fe342",
  measurementId: "G-RSZQG3892M"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Using default database first. If you specifically created a named database "mama", 
// we might need to change this to getFirestore(app, "mama")
export const db = getFirestore(app);
export const storage = getStorage(app);
