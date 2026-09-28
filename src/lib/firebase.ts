import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-jo-studio.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-jo-studio",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-jo-studio.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "0",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "0",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

/**
 * Firestore with long-polling (some local proxies strip WebSockets) and an
 * IndexedDB cache, so the catalog still renders when the link drops.
 */
function makeDb() {
  if (typeof window === "undefined") return getFirestore(firebaseApp);
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      experimentalForceLongPolling: true,
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}
export const db = makeDb();
export const storage = getStorage(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export const IS_EMULATOR = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

if (IS_EMULATOR && typeof window !== "undefined") {
  // Connect SDKs to local emulators. Imported dynamically-free: these are sync calls.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { connectAuthEmulator } = require("firebase/auth");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { connectFirestoreEmulator } = require("firebase/firestore");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { connectStorageEmulator } = require("firebase/storage");
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  } catch {
    // already connected
  }
}
