import { initializeApp } from "firebase/app";
try {
  initializeApp({
    apiKey: undefined,
    authDomain: undefined,
    projectId: undefined
  });
  console.log("SUCCESS");
} catch (e) {
  console.log("ERROR:", e.message);
}
