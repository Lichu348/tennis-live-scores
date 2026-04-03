import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  onValue,
  query,
  orderByChild,
} from "firebase/database";

/* ─── Firebase Init ─── */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ─── Match CRUD ─── */

/**
 * Save a match to Firebase. Strips local-only `history` array
 * to keep the payload small — undo history stays in React state.
 */
export async function saveMatch(match) {
  const payload = { ...match, history: [] };
  await set(ref(db, `matches/${match.id}`), payload);
}

/**
 * Load a single match by ID (one-off read).
 */
export async function loadMatch(id) {
  const snap = await get(ref(db, `matches/${id}`));
  return snap.exists() ? snap.val() : null;
}

/**
 * Remove a match from the database entirely.
 */
export async function removeMatch(id) {
  await remove(ref(db, `matches/${id}`));
}

/* ─── Real-time Subscriptions ─── */

/**
 * Subscribe to ALL matches. Calls `callback(matches[])` whenever
 * any match is added, updated, or removed.
 * Returns an unsubscribe function.
 */
export function subscribeToMatches(callback) {
  const matchesRef = ref(db, "matches");
  const unsubscribe = onValue(
    matchesRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const matches = Object.values(data);
      callback(matches);
    },
    (error) => {
      console.error("Firebase subscription error:", error);
      callback([]);
    }
  );
  return unsubscribe;
}

/**
 * Subscribe to a single match by ID.
 * Returns an unsubscribe function.
 */
export function subscribeToMatch(id, callback) {
  const matchRef = ref(db, `matches/${id}`);
  const unsubscribe = onValue(
    matchRef,
    (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : null);
    },
    (error) => {
      console.error("Firebase match subscription error:", error);
      callback(null);
    }
  );
  return unsubscribe;
}
