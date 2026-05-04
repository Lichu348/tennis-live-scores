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
 * Save a match to Firebase.
 * - Strips local-only `history` array (undo snapshots stay in React state)
 * - Preserves `events` array for persistent history and rewind capability
 */
export async function saveMatch(match) {
  const payload = {
    ...match,
    history: [],           // Strip local undo snapshots
    events: match.events || [],  // Preserve event log
  };
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
 * Optionally calls `onError(error)` if the subscription fails.
 * Returns an unsubscribe function.
 */
export function subscribeToMatches(callback, onError) {
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
      if (onError) {
        onError(error);
      } else {
        callback([]);
      }
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

/* ─── Settings (PIN, auto-cleanup, etc.) ─── */

/**
 * Get app settings from Firebase.
 */
export async function getSettings() {
  const snap = await get(ref(db, "settings"));
  return snap.exists() ? snap.val() : {};
}

/**
 * Get the stored PIN hash. Returns null if no PIN is set.
 */
export async function getUmpirePin() {
  const snap = await get(ref(db, "settings/umpirePin"));
  return snap.exists() ? snap.val() : null;
}

/**
 * Set (or update) the umpire PIN hash.
 */
export async function setUmpirePin(pinHash) {
  await set(ref(db, "settings/umpirePin"), pinHash);
}

/**
 * Hash a PIN using PBKDF2 with salt.
 * Returns { salt: string, hash: string }
 *
 * Note: This is client-side protection only - for true security,
 * use Firebase Authentication with server-side validation.
 */
export async function hashPin(pin) {
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Import the PIN as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  // Derive the hash using PBKDF2 with 100,000 iterations
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  // Convert to hex strings
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  // Store as combined string: salt$hash
  return `${saltHex}$${hashHex}`;
}

/**
 * Verify a PIN against the stored hash.
 * Returns true if PIN is correct, false otherwise.
 */
export async function verifyPin(pin) {
  const stored = await getUmpirePin();
  if (!stored) return true; // No PIN set = always valid

  // Handle legacy SHA-256 hashes (no salt)
  if (!stored.includes("$")) {
    // Old format - direct SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const legacyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return legacyHash === stored;
  }

  // New format: salt$hash
  const [saltHex, storedHashHex] = stored.split("$");

  // Reconstruct salt from hex
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));

  // Derive hash using same salt
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const inputHashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  return inputHashHex === storedHashHex;
}

/**
 * Delete old matches by age (hours).
 */
export async function deleteOldMatches(hoursOld = 24) {
  const snap = await get(ref(db, "matches"));
  if (!snap.exists()) return 0;

  const cutoff = Date.now() - hoursOld * 60 * 60 * 1000;
  const matches = snap.val();
  let deleted = 0;

  for (const [id, match] of Object.entries(matches)) {
    const matchTime = match.finishedAt || match.createdAt;
    if (match.status === "finished" && matchTime < cutoff) {
      await remove(ref(db, `matches/${id}`));
      deleted++;
    }
  }

  return deleted;
}

/* ─── Match Locking ─── */

// Stale lock threshold: 5 minutes
const LOCK_STALE_MS = 5 * 60 * 1000;

/**
 * Generate a unique session ID for this browser tab.
 * Stored in sessionStorage so it persists across refreshes
 * but is unique per tab.
 */
export function getSessionId() {
  let sessionId = sessionStorage.getItem("umpireSessionId");
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("umpireSessionId", sessionId);
  }
  return sessionId;
}

/**
 * Check if a match is locked by another session.
 * Returns { isLocked, lockedBy, lockedAt, isStale } or null if not locked.
 */
export function checkMatchLock(match) {
  if (!match || !match.lockedBy) {
    return null;
  }

  const mySessionId = getSessionId();
  const isMyLock = match.lockedBy === mySessionId;
  const age = Date.now() - (match.lockedAt || 0);
  const isStale = age > LOCK_STALE_MS;

  return {
    isLocked: !isMyLock,
    lockedBy: match.lockedBy,
    lockedAt: match.lockedAt,
    isStale,
    isMine: isMyLock,
  };
}

/**
 * Acquire lock on a match.
 * Adds lockedBy and lockedAt fields to the match.
 */
export function acquireLock(match) {
  return {
    ...match,
    lockedBy: getSessionId(),
    lockedAt: Date.now(),
  };
}

/**
 * Refresh the lock timestamp (call on every point scored).
 */
export function refreshLock(match) {
  if (match.lockedBy !== getSessionId()) {
    // Don't refresh if we don't own the lock
    return match;
  }
  return {
    ...match,
    lockedAt: Date.now(),
  };
}

/**
 * Release the lock on a match.
 */
export function releaseLock(match) {
  const { lockedBy, lockedAt, ...rest } = match;
  return rest;
}

/* ─── Tournament CRUD ─── */

/**
 * Create a new tournament.
 */
export async function createTournament(tournament) {
  const id = tournament.id || `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const payload = {
    ...tournament,
    id,
    createdAt: Date.now(),
    createdBy: getSessionId(),
  };
  await set(ref(db, `tournaments/${id}`), payload);
  return id;
}

/**
 * Update a tournament.
 */
export async function updateTournament(id, updates) {
  const tournamentRef = ref(db, `tournaments/${id}`);
  const snap = await get(tournamentRef);
  if (!snap.exists()) {
    throw new Error(`Tournament ${id} not found`);
  }
  const current = snap.val();
  await set(tournamentRef, { ...current, ...updates, updatedAt: Date.now() });
}

/**
 * Delete a tournament and all associated matches.
 */
export async function deleteTournament(id) {
  // First, delete any matches linked to this tournament
  const matchesSnap = await get(ref(db, "matches"));
  if (matchesSnap.exists()) {
    const matches = matchesSnap.val();
    for (const [matchId, match] of Object.entries(matches)) {
      if (match.tournamentId === id) {
        await remove(ref(db, `matches/${matchId}`));
      }
    }
  }

  // Then delete the tournament
  await remove(ref(db, `tournaments/${id}`));
}

/**
 * Load a single tournament by ID.
 */
export async function loadTournament(id) {
  const snap = await get(ref(db, `tournaments/${id}`));
  return snap.exists() ? snap.val() : null;
}

/**
 * Subscribe to a single tournament.
 */
export function subscribeToTournament(id, callback) {
  const tournamentRef = ref(db, `tournaments/${id}`);
  const unsubscribe = onValue(
    tournamentRef,
    (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : null);
    },
    (error) => {
      console.error("Firebase tournament subscription error:", error);
      callback(null);
    }
  );
  return unsubscribe;
}

/**
 * Subscribe to all tournaments.
 */
export function subscribeToTournaments(callback, onError) {
  const tournamentsRef = ref(db, "tournaments");
  const unsubscribe = onValue(
    tournamentsRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const tournaments = Object.values(data);
      callback(tournaments);
    },
    (error) => {
      console.error("Firebase tournaments subscription error:", error);
      if (onError) {
        onError(error);
      } else {
        callback([]);
      }
    }
  );
  return unsubscribe;
}

/**
 * Update a specific bracket match (set matchId when scoring starts, winnerId when complete).
 */
export async function updateBracketMatch(tournamentId, roundIndex, matchPosition, updates) {
  const tournament = await loadTournament(tournamentId);
  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  const rounds = tournament.rounds.map((r, ri) => {
    if (ri !== roundIndex) return r;
    return {
      ...r,
      matches: r.matches.map((m, mi) => {
        if (mi !== matchPosition - 1) return m;
        return { ...m, ...updates };
      }),
    };
  });

  await updateTournament(tournamentId, { rounds });
}
