/* ─── Tennis Scoring Engine ─── */
/* Pure functions — no side effects, no storage, no React */

export const POINT_NAMES = ["0", "15", "30", "40"];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function snapshot(m) {
  const c = deepClone(m);
  c.history = [];
  c.events = []; // Don't include events in snapshots
  return c;
}

/* ─── Factory ─── */

export function createMatch(p1, p2, courtIdx, bestOf) {
  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    players: [p1, p2],
    courtIdx,
    bestOf,
    sets: [[0, 0]],
    points: [0, 0],
    isTiebreak: false,
    tiebreakStartServer: null,
    server: 0,
    status: "live",
    winner: null,
    history: [],       // Local undo history (React state only)
    events: [],        // Persistent event log (saved to Firebase)
    createdAt: Date.now(),
  };
}

/**
 * Create a base match state (no events applied) from match config.
 * Used by replayEvents to start from a clean slate.
 */
export function createBaseMatch(players, courtIdx, bestOf, id, createdAt) {
  return {
    id,
    players,
    courtIdx,
    bestOf,
    sets: [[0, 0]],
    points: [0, 0],
    isTiebreak: false,
    tiebreakStartServer: null,
    server: 0,
    status: "live",
    winner: null,
    history: [],
    events: [],
    createdAt,
  };
}

/**
 * Replay a sequence of events to reconstruct match state.
 * Returns the match state after applying events[0..stopAtIndex].
 * If stopAtIndex is undefined, replays all events.
 */
export function replayEvents(match, stopAtIndex) {
  // Create fresh base state
  let current = createBaseMatch(
    match.players,
    match.courtIdx,
    match.bestOf,
    match.id,
    match.createdAt
  );

  const events = match.events || [];
  const endIndex = stopAtIndex !== undefined ? stopAtIndex : events.length - 1;

  // Replay events up to endIndex
  const replayedEvents = [];

  for (let i = 0; i <= endIndex && i < events.length; i++) {
    const event = events[i];
    replayedEvents.push(event);

    if (event.type === "point") {
      // Apply point without adding to events (we're replaying)
      current = scorePointInternal(current, event.player);
    } else if (event.type === "setScore") {
      // Apply score adjustment - sets the base state to the adjusted score
      current = {
        ...current,
        sets: event.sets.map(s => [...s]), // Deep copy sets
        points: event.points ? [...event.points] : [0, 0],
        server: event.server !== undefined ? event.server : current.server,
        isTiebreak: event.sets.length > 0 &&
          event.sets[event.sets.length - 1][0] === 6 &&
          event.sets[event.sets.length - 1][1] === 6,
        history: [], // Clear history after adjustment
      };
      // Set tiebreakStartServer if entering tiebreak
      if (current.isTiebreak) {
        current.tiebreakStartServer = calculateServer(
          current.sets.slice(0, -1).concat([[6, 5]]),
          false,
          0
        );
      }
    }
  }

  // Set the replayed events
  current.events = replayedEvents;

  return current;
}

/**
 * Internal scoring function that doesn't record events.
 * Used by replayEvents and scorePoint.
 */
function scorePointInternal(m, pi) {
  if (m.status !== "live") return m;
  const next = deepClone(m);
  next.history = [...m.history, snapshot(m)];
  const oi = 1 - pi;

  if (next.isTiebreak) {
    next.points[pi]++;
    const total = next.points[0] + next.points[1];
    if (total % 2 === 1) {
      next.server = next.server === 0 ? 1 : 0;
    }
    if (next.points[pi] >= 7 && next.points[pi] - next.points[oi] >= 2) {
      winGame(next, pi);
    }
  } else {
    const pp = next.points[pi], po = next.points[oi];
    if (pp < 3) {
      next.points[pi]++;
    } else if (po < 3) {
      winGame(next, pi);
    } else {
      if (pp === po) {
        next.points[pi]++;
      } else if (pp > po) {
        winGame(next, pi);
      } else {
        next.points[oi]--;
      }
    }
  }
  return next;
}

/* ─── Queries ─── */

export function currentSet(m) {
  return m.sets[m.sets.length - 1];
}

export function setsWon(m, pi) {
  return m.sets.filter((s, i) => {
    if (i === m.sets.length - 1 && m.status === "live") return false;
    return s[pi] > s[1 - pi];
  }).length;
}

export function setsNeeded(m) {
  return Math.ceil(m.bestOf / 2);
}

export function getPointDisplay(m, pi) {
  if (m.isTiebreak) return String(m.points[pi]);
  const p0 = m.points[0], p1 = m.points[1];
  if (p0 >= 3 && p1 >= 3) {
    if (p0 === p1) return "40";
    return m.points[pi] > m.points[1 - pi] ? "AD" : "";
  }
  return POINT_NAMES[m.points[pi]];
}

export function isDeuce(m) {
  return !m.isTiebreak && m.points[0] >= 3 && m.points[1] >= 3 && m.points[0] === m.points[1];
}

export function isGamePointFor(m, pi) {
  if (m.status !== "live") return false;
  if (m.isTiebreak) {
    return m.points[pi] >= 6 && m.points[pi] > m.points[1 - pi];
  }
  if (m.points[pi] >= 3) {
    if (m.points[1 - pi] < 3) return true;
    if (m.points[pi] > m.points[1 - pi]) return true;
  }
  return false;
}

function wouldWinSet(m, pi) {
  const cs = currentSet(m);
  if (m.isTiebreak) return true;
  const newGames = cs[pi] + 1;
  const oppGames = cs[1 - pi];
  return newGames >= 6 && newGames - oppGames >= 2;
}

function wouldWinMatch(m, pi) {
  let wins = m.sets.filter((s, i) => {
    if (i === m.sets.length - 1) return false;
    return s[pi] > s[1 - pi];
  }).length;
  return wins + 1 >= setsNeeded(m);
}

export function getAlerts(m) {
  if (m.status !== "live") return [];
  const alerts = [];
  for (let pi = 0; pi < 2; pi++) {
    if (isGamePointFor(m, pi)) {
      if (wouldWinSet(m, pi) && wouldWinMatch(m, pi)) {
        alerts.push({ type: "matchPoint", player: pi });
      } else if (wouldWinSet(m, pi)) {
        alerts.push({ type: "setPoint", player: pi });
      }
      if (m.server !== pi && !m.isTiebreak) {
        alerts.push({ type: "breakPoint", player: pi });
      }
    }
  }
  if (m.isTiebreak && alerts.length === 0) {
    alerts.push({ type: "tiebreak", player: -1 });
  }
  return alerts;
}

/* ─── Mutations ─── */

function winGame(m, pi) {
  const cs = currentSet(m);
  cs[pi]++;
  m.points = [0, 0];

  const wasInTiebreak = m.isTiebreak;
  m.isTiebreak = false;

  // Check set win
  let setWon = false;
  if (wasInTiebreak) {
    setWon = true;
  } else if (cs[0] >= 6 || cs[1] >= 6) {
    if (Math.abs(cs[0] - cs[1]) >= 2) {
      setWon = true;
    }
  }

  if (setWon) {
    let wins = m.sets.filter(s => s[pi] > s[1 - pi]).length;
    if (wins >= setsNeeded(m)) {
      m.status = "finished";
      m.winner = pi;
      m.finishedAt = Date.now();
    } else {
      m.sets.push([0, 0]);
    }
  } else if (cs[0] === 6 && cs[1] === 6) {
    m.isTiebreak = true;
    m.tiebreakStartServer = m.server;
  }

  // Server rotation
  if (wasInTiebreak) {
    // The player who served last regular game (tiebreakStartServer) serves first in next set
    // because the OTHER player served first in the tiebreak, and should now receive
    m.server = m.tiebreakStartServer;
    m.tiebreakStartServer = null;
  } else {
    m.server = m.server === 0 ? 1 : 0;
  }
}

export function scorePoint(m, pi) {
  if (m.status !== "live") return m;

  // Apply the point
  const next = scorePointInternal(m, pi);

  // Record the event
  const event = {
    type: "point",
    player: pi,
    timestamp: Date.now(),
    index: (m.events || []).length,
  };
  next.events = [...(m.events || []), event];

  return next;
}

export function undoPoint(m) {
  if (!m.history || m.history.length === 0) return m;
  const prev = deepClone(m.history[m.history.length - 1]);
  prev.history = m.history.slice(0, -1);
  // Remove the last event as well
  prev.events = (m.events || []).slice(0, -1);
  return prev;
}

/**
 * Rewind match to a specific point in history by event index.
 * Returns match state after applying events[0..eventIndex].
 */
export function rewindToEvent(m, eventIndex) {
  if (!m.events || m.events.length === 0) return m;
  if (eventIndex < 0) {
    // Rewind to start (before any points)
    return createBaseMatch(
      m.players,
      m.courtIdx,
      m.bestOf,
      m.id,
      m.createdAt
    );
  }
  return replayEvents(m, eventIndex);
}

/**
 * Get a summary of the score at a given point in the event history.
 * Returns { sets, points, isTiebreak, server } for display.
 */
export function getScoreAtEvent(match, eventIndex) {
  const state = rewindToEvent(match, eventIndex);
  return {
    sets: state.sets,
    points: state.points,
    isTiebreak: state.isTiebreak,
    server: state.server,
    status: state.status,
    winner: state.winner,
  };
}

/**
 * Format a score summary for display.
 * Example: "6-4, 3-2 (15-30)"
 */
export function formatScoreSummary(m) {
  const completeSets = m.sets.slice(0, -1);
  const currSet = currentSet(m);

  let result = completeSets.map(s => `${s[0]}-${s[1]}`).join(", ");

  if (m.status === "live") {
    if (result) result += ", ";
    result += `${currSet[0]}-${currSet[1]}`;

    if (m.isTiebreak) {
      result += ` TB(${m.points[0]}-${m.points[1]})`;
    } else if (m.points[0] > 0 || m.points[1] > 0) {
      result += ` (${getPointDisplay(m, 0)}-${getPointDisplay(m, 1)})`;
    }
  }

  return result || "0-0";
}

/* ─── Jump to Score ─── */

/**
 * Validate that a target score is reachable in tennis.
 * Returns { valid: boolean, error?: string }
 */
export function validateScore(sets, currentGamePoints, bestOf) {
  const setsNeededToWin = Math.ceil(bestOf / 2);

  if (!sets || sets.length === 0) {
    return { valid: false, error: "At least one set is required" };
  }

  // Count sets won by each player (excluding current set)
  let p1Sets = 0, p2Sets = 0;

  for (let i = 0; i < sets.length; i++) {
    const [g1, g2] = sets[i];
    const isCurrentSet = i === sets.length - 1;

    // Games must be non-negative
    if (g1 < 0 || g2 < 0) {
      return { valid: false, error: `Set ${i + 1}: Games cannot be negative` };
    }

    // Can't have more than 7 games
    if (g1 > 7 || g2 > 7) {
      return { valid: false, error: `Set ${i + 1}: Games cannot exceed 7` };
    }

    // If 7 games, must be 7-6 tiebreak
    if ((g1 === 7 && g2 !== 6) || (g2 === 7 && g1 !== 6)) {
      return { valid: false, error: `Set ${i + 1}: 7 games only valid in tiebreak (7-6)` };
    }

    // Check if this set is completed (has a winner)
    const setIsComplete = (
      (g1 === 7 && g2 === 6) || (g1 === 6 && g2 === 7) || // Tiebreak
      (g1 >= 6 && g1 - g2 >= 2) || // Player 1 won
      (g2 >= 6 && g2 - g1 >= 2)    // Player 2 won
    );

    if (!isCurrentSet) {
      // Previous sets must be completed
      if (!setIsComplete) {
        return { valid: false, error: `Set ${i + 1}: Incomplete set cannot precede another set` };
      }
      // Count the winner
      if (g1 > g2) p1Sets++;
      else p2Sets++;
    } else {
      // Current set
      if (setIsComplete) {
        // Current set is also complete - count it and check if match is over
        if (g1 > g2) p1Sets++;
        else p2Sets++;

        if (p1Sets >= setsNeededToWin || p2Sets >= setsNeededToWin) {
          return { valid: false, error: "Match is already finished at this score" };
        }
      }
    }

    // Check if match was already won before this set
    if (p1Sets >= setsNeededToWin || p2Sets >= setsNeededToWin) {
      return { valid: false, error: "Match already finished before this set" };
    }
  }

  // Validate current game points
  if (currentGamePoints) {
    const [p1, p2] = currentGamePoints;
    const currentSet = sets[sets.length - 1];
    const isTiebreak = currentSet[0] === 6 && currentSet[1] === 6;

    if (p1 < 0 || p2 < 0) {
      return { valid: false, error: "Points cannot be negative" };
    }

    if (isTiebreak) {
      // Tiebreak points can be any non-negative number (until someone wins)
      // But if someone has 7+, they need 2-point lead to have won
      if ((p1 >= 7 && p1 - p2 >= 2) || (p2 >= 7 && p2 - p1 >= 2)) {
        return { valid: false, error: "Tiebreak is already won at this score" };
      }
    } else {
      // Regular game: points are 0, 1, 2, 3 (40), or 4+ for deuce/advantage
      // Max is 4 for advantage (one player must have advantage)
      if (p1 > 4 || p2 > 4) {
        return { valid: false, error: "Points cannot exceed 4 (advantage)" };
      }
      // If both have 4, that's impossible (someone would have won)
      if (p1 === 4 && p2 === 4) {
        return { valid: false, error: "Both players cannot have advantage simultaneously" };
      }
      // If one has 4, other must have 3 (advantage situation)
      if (p1 === 4 && p2 < 3) {
        return { valid: false, error: "Advantage only valid at deuce (opponent must have 3 points)" };
      }
      if (p2 === 4 && p1 < 3) {
        return { valid: false, error: "Advantage only valid at deuce (opponent must have 3 points)" };
      }
    }
  }

  return { valid: true };
}

/**
 * Calculate who should be serving based on total games played.
 * In tennis, server alternates each game. Player 1 serves first (game 0).
 *
 * Returns 0 or 1 (player index).
 */
export function calculateServer(sets, isTiebreak, tiebreakPoints) {
  // Count total games played across all sets
  let totalGames = 0;
  for (const [g1, g2] of sets) {
    totalGames += g1 + g2;
  }

  if (isTiebreak) {
    // In tiebreak, server changes after first point, then every 2 points
    // The player who would serve the 13th game (first tiebreak) serves first
    const tiebreakFirstServer = totalGames % 2 === 0 ? 0 : 1;

    if (tiebreakPoints === 0) {
      return tiebreakFirstServer;
    }
    // After first point, changes every 2 points
    const pointsSinceFirst = tiebreakPoints;
    const serverChanges = Math.floor((pointsSinceFirst + 1) / 2);
    return (tiebreakFirstServer + serverChanges) % 2;
  }

  // Regular game: server alternates each game
  // Player 1 (index 0) serves games 0, 2, 4, ...
  // Player 2 (index 1) serves games 1, 3, 5, ...
  return totalGames % 2;
}

/**
 * Check if a set score represents a completed set.
 */
function isSetComplete(g1, g2) {
  // Tiebreak result
  if ((g1 === 7 && g2 === 6) || (g1 === 6 && g2 === 7)) {
    return true;
  }
  // Won with 2-game margin
  if (g1 >= 6 && g1 - g2 >= 2) return true;
  if (g2 >= 6 && g2 - g1 >= 2) return true;
  return false;
}

/**
 * Create a match state at a specific score.
 * Used for "jump to score" feature when resuming a match.
 *
 * @param {Object} match - The original match object (for players, court, etc.)
 * @param {Array<[number, number]>} sets - Array of set scores, e.g., [[6, 4], [3, 2]]
 * @param {[number, number]} points - Current game points [p1, p2]
 * @param {number} server - Who's serving (0 or 1)
 * @returns {Object} - New match state at the target score
 */
export function setScore(match, sets, points, server) {
  // Validate the score
  const validation = validateScore(sets, points, match.bestOf);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Normalize sets: if the last set is completed, append a new current set [0,0]
  let normalizedSets = sets.map(s => [...s]); // Deep copy
  if (normalizedSets.length > 0) {
    const lastSet = normalizedSets[normalizedSets.length - 1];
    if (isSetComplete(lastSet[0], lastSet[1])) {
      // Check if match isn't finished (should be caught by validateScore, but double-check)
      const setsNeededToWin = Math.ceil(match.bestOf / 2);
      let p1Sets = 0, p2Sets = 0;
      for (const [g1, g2] of normalizedSets) {
        if (isSetComplete(g1, g2)) {
          if (g1 > g2) p1Sets++;
          else p2Sets++;
        }
      }
      if (p1Sets < setsNeededToWin && p2Sets < setsNeededToWin) {
        // Match not finished - start a new set
        normalizedSets.push([0, 0]);
        // Points should be 0-0 for a new set
        points = [0, 0];
      }
    }
  }

  // Determine if we're in a tiebreak (6-6 in current set)
  const currentSetScore = normalizedSets[normalizedSets.length - 1] || [0, 0];
  const isTiebreak = currentSetScore[0] === 6 && currentSetScore[1] === 6;

  // Create the new match state
  const newMatch = {
    ...match,
    sets: normalizedSets.length > 0 ? normalizedSets : [[0, 0]],
    points: points || [0, 0],
    isTiebreak,
    tiebreakStartServer: isTiebreak ? calculateServer(normalizedSets.slice(0, -1).concat([[6, 5]]), false, 0) : null,
    server: server !== undefined ? server : calculateServer(normalizedSets, isTiebreak, isTiebreak ? (points[0] + points[1]) : 0),
    status: "live",
    winner: null,
    history: [], // Clear history - can't undo past the jump
    events: [
      // Add a special "setScore" event so we know the match was jumped
      {
        type: "setScore",
        sets: normalizedSets,
        points: points || [0, 0],
        server,
        timestamp: Date.now(),
        index: 0,
      },
    ],
  };

  return newMatch;
}

/**
 * Parse a score string like "6-4, 3-2" into sets array.
 * Returns { sets: [[6,4], [3,2]], error?: string }
 */
export function parseScoreString(scoreStr) {
  if (!scoreStr || !scoreStr.trim()) {
    return { sets: [[0, 0]] };
  }

  const sets = [];
  const parts = scoreStr.split(",").map(s => s.trim());

  for (const part of parts) {
    const match = part.match(/^(\d+)\s*[-:]\s*(\d+)$/);
    if (!match) {
      return { sets: null, error: `Invalid set format: "${part}". Use "6-4" format.` };
    }
    sets.push([parseInt(match[1], 10), parseInt(match[2], 10)]);
  }

  return { sets: sets.length > 0 ? sets : [[0, 0]] };
}
