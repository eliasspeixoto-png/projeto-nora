
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { 
  initializeFirestore, 
  getFirestore,
  persistentLocalCache, 
  persistentMultipleTabManager, 
  type Firestore 
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getMessaging, isSupported as isMessagingSupported, type Messaging } from "firebase/messaging";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Singleton instances
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let messaging: Messaging | undefined;
let analytics: Analytics | undefined;

const isServer = typeof window === 'undefined';

// Initialize or get App
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth & Storage (safe for multiple calls)
auth = getAuth(app);
storage = getStorage(app);

// Initialize Firestore (Persistence must only be initialized ONCE)
if (!isServer) {
    try {
        // We use a global variable to track if firestore was already initialized with settings
        // @ts-ignore
        if (!window._firebase_db_initialized) {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager()
                })
            });
            // @ts-ignore
            window._firebase_db_initialized = true;
        } else {
            db = getFirestore(app);
        }

        // Initialize Messaging safely
        isMessagingSupported().then(yes => {
            if (yes) messaging = getMessaging(app);
        }).catch(() => {});

        // Initialize Analytics safely
        isSupported().then(yes => {
            if (yes) analytics = getAnalytics(app);
        });
    } catch (e) {
        console.warn("Firebase Client side initialization failed:", e);
        db = getFirestore(app);
    }
} else {
    db = getFirestore(app);
}

export function initializeFirebase() {
  return { app, auth, db, storage, messaging, analytics };
}
