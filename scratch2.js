import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
try {
  const app = initializeApp({
    apiKey: undefined,
    authDomain: undefined,
    projectId: undefined
  });
  const auth = getAuth(app);
  console.log("SUCCESS");
} catch (e) {
  console.log("ERROR:", e.message);
}
