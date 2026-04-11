import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
try {
  const app = initializeApp({
    apiKey: "",
    authDomain: "",
    projectId: ""
  });
  const auth = getAuth(app);
  console.log("SUCCESS");
} catch (e) {
  console.log("ERROR:", e.message);
}
