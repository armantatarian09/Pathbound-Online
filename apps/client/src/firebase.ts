import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, type User } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCdYjh6WiHRtDineBnDt6Mg6RW7BBF4rRc",
  authDomain: "pathbound-online.firebaseapp.com",
  projectId: "pathbound-online",
  storageBucket: "pathbound-online.firebasestorage.app",
  messagingSenderId: "1097545048224",
  appId: "1:1097545048224:web:6bb0022f5a638097cde9c5",
  measurementId: "G-XK3B6FYMFG",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

void isSupported()
  .then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  })
  .catch(() => {
    // Analytics is optional in local/dev environments.
  });

export async function initFirebaseUser(): Promise<User | null> {
  try {
    const credential = await signInAnonymously(auth);
    return credential.user;
  } catch {
    return null;
  }
}
