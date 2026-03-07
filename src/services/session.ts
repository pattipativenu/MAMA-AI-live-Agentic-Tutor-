import { collection, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function createTestSession(userId: string) {
  const sessionId = `test_${Date.now()}`;
  const sessionRef = doc(collection(db, "sessions"), sessionId);
  
  const sessionData = {
    userId,
    mode: "lab",
    subject: "Science",
    topic: "Test Connection",
    startTime: serverTimestamp(),
    status: "active"
  };

  await setDoc(sessionRef, sessionData);
  return sessionId;
}

export async function getTestSession(sessionId: string) {
  const sessionRef = doc(db, "sessions", sessionId);
  const snapshot = await getDoc(sessionRef);
  return snapshot.exists() ? snapshot.data() : null;
}
