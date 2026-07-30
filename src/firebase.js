import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink,
  GoogleAuthProvider,
  signInWithPopup 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 1. Your exact Firebase configuration keys
const firebaseConfig = {
  apiKey: "AIzaSyDThoAVkbK4FRx2eA9YuHdp9tBiWbTRAlY",
  authDomain: "travel-hub-app-4d314.firebaseapp.com",
  projectId: "travel-hub-app-4d314",
  storageBucket: "travel-hub-app-4d314.firebasestorage.app",
  messagingSenderId: "561821015724",
  appId: "1:561821015724:web:a3a2718181f0eb7c0b8909"
};

// 2. Initialise the Firebase app and our database/auth services (ONLY ONCE!)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 3. Magic Link Helper
export const actionCodeSettings = {
  url: window.location.origin, 
  handleCodeInApp: true, 
};

export const sendLoginEmail = async (email) => {
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

// 4. Google Login Helper
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
    return true;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    return false;
  }
};