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

/**
 * Create a new match.
 *
 * For singles: players = [player1, player2]
 * For doubles: players = [team1Player1, team1Player2, team2Player1, team2Player2]
 *
 * @param {string|string[]} p1OrPlayers - Player 1 name (singles) or array of all players (doubles)
 * @param {string} p2 - Player 2 name (singles only)
 * @param {number} courtIdx - Court index
 * @param {number} bestOf - Best of 3 or 5
 * @param {object} options - Optional: { matchType: 'singles'|'doubles', teams: [team1Name, team2Name] }
 */
export function createMatch(p1OrPlayers, p2, courtIdx, bestOf, options = {}) {
  const matchType = options.matchType || 'singles';
  const isDoubles = matchType === 'doubles';

  let players;
  let teams = null;

  if (isDoubles && Array.isArray(p1OrPlayers)) {
    // Doubles: p1OrPlayers is [t1p1, t1p2, t2p1, t2p2]
    players = p1OrPlayers;
    teams = options.teams || null;
  } else {
    // Singles: p1OrPlayers is player1 name, p2 is player2 name
    players = [p1OrPlayers, p2];
  }

  // Extract tournament metadata from options (if present)
  const { tournamentId, bracketRound, bracketPosition } = options;

  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    matchType,
    players,
    teams,                    // Optional team names for doubles: ["Team 1", "Team 2"]
    courtIdx,
    bestOf,
    sets: [[0, 0]],
    points: [0, 0],
    isTiebreak: false,
    tiebreakStartServer: null,
    server: 0,                // For singles: 0 or 1. For doubles: 0-3 (player index)
    doublesServerOrder: isDoubles ? [0, 0] : null, // [team1NextServer, team2NextServer] - 0 or 1 within team
    status: "live",
    winner: null,
    history: [],              // Local undo history (React state only)
    events: [],               // Persistent event log (saved to Firebase)
    createdAt: Date.now(),
    // Tournament metadata (if this match belongs to a tournament)
    ...(tournamentId && { tournamentId }),
    ...(bracketRound !== undefined && { bracketRound }),
    ...(bracketPosition !== undefined && { bracketPosition }),
  };
}

/**
 * Create a base match state (no events applied) from match config.
 * Used by replayEvents to start from a clean slate.
 */
export function createBaseMatch(players, courtIdx, bestOf, id, createdAt, matchType = 'singles', teams = null) {
  const isDoubles = matchType === 'doubles' || players.length === 4;
  return {
    id,
    matchType: isDoubles ? 'doubles' : 'singles',
    players,
    teams,
    courtIdx,
    bestOf,
    sets: [[0, 0]],
    points: [0, 0],
    isTiebreak: false,
    tiebreakStartServer: null,
    server: 0,
    doublesServerOrder: isDoubles ? [0, 0] : null,
    status: "live",
    winner: null,
    history: [],
    events: [],
    createdAt,
  };
}

/**
 * Check if a match is doubles.
 */
export function isDoubles(match) {
  return match.matchType === 'doubles' || match.players?.length === 4;
}

/**
 * Get team index (0 or 1) from player index in doubles.
 * Players 0-1 are team 0, players 2-3 are team 1.
 */
export function getTeamIndex(playerIndex) {
  return playerIndex < 2 ? 0 : 1;
}

/**
 * Get display name for a team in doubles.
 * Returns team name if set, otherwise "Player1 / Player2"
 */
export function getTeamDisplayName(match, teamIndex) {
  if (!isDoubles(match)) {
    return match.players[teamIndex] || '';
  }

  if (match.teams && match.teams[teamIndex]) {
    return match.teams[teamIndex];
  }

  const p1Idx = teamIndex * 2;
  const p2Idx = teamIndex * 2 + 1;
  return `${match.players[p1Idx]} / ${match.players[p2Idx]}`;
}

/**
 * Get the name of the current server in doubles.
 */
export function getServerName(match) {
  if (!isDoubles(match)) {
    return match.players[match.server];
  }
  return match.players[match.server];
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
    match.createdAt,
    match.matchType,
    match.teams
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
        // Restore doubles server order if present in event
        ...(event.doublesServerOrder && { doublesServerOrder: [...event.doublesServerOrder] }),
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
 *
 * For doubles: pi is the TEAM index (0 or 1), not player index.
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
      // Switch server in tiebreak
      next.server = getNextTiebreakServer(next);
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

/**
 * Get the next server after a tiebreak point.
 * For singles: alternates after 1st point, then every 2 points.
 * For doubles: rotates through all 4 players.
 */
function getNextTiebreakServer(match) {
  const total = match.points[0] + match.points[1];

  if (!isDoubles(match)) {
    // Singles: just flip between 0 and 1
    return match.server === 0 ? 1 : 0;
  }

  // Doubles tiebreak rotation:
  // After 1st point, then every 2 points, rotate to next player
  // Order: T1P1 → T2P1 → T1P2 → T2P2 → repeat
  // (or whatever the starting rotation was)

  // The tiebreakStartServer tells us who served first in the tiebreak
  const firstServer = match.tiebreakStartServer;

  // Calculate how many server changes have occurred
  // First point = 0 changes, points 2-3 = 1 change, points 4-5 = 2 changes, etc.
  const serverChanges = Math.floor((total + 1) / 2);

  // Build the doubles rotation starting from the first server
  const rotation = getDoublesServerRotation(firstServer);
  return rotation[serverChanges % 4];
}

/**
 * Get the full doubles server rotation starting from a given player.
 * Returns array of 4 player indices in serving order.
 *
 * Standard doubles rotation: T1P1 → T2P1 → T1P2 → T2P2
 * But we start from whoever the first server is.
 */
function getDoublesServerRotation(startingServer) {
  // Standard order: 0 (T1P1), 2 (T2P1), 1 (T1P2), 3 (T2P2)
  const standardOrder = [0, 2, 1, 3];

  // Find where the starting server is in the standard order
  const startIdx = standardOrder.indexOf(startingServer);
  if (startIdx === -1) {
    // Fallback if invalid
    return standardOrder;
  }

  // Rotate the array to start from the starting server
  return [
    ...standardOrder.slice(startIdx),
    ...standardOrder.slice(0, startIdx)
  ];
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
    // tiebreakStartServer will be set after rotation (below)
  }

  // Server rotation
  if (wasInTiebreak) {
    // After tiebreak, the player/team who served first in the tiebreak receives first in next set
    // So the partner (doubles) or opponent (singles) who would have served next serves first
    if (isDoubles(m)) {
      // In doubles: the partner of the tiebreak first server serves first in the new set
      const tiebreakFirstServer = m.tiebreakStartServer;
      const tiebreakFirstTeam = getTeamIndex(tiebreakFirstServer);
      // The OTHER team serves first in the new set, starting with their "next" server
      const newTeam = 1 - tiebreakFirstTeam;
      const teamNextServer = m.doublesServerOrder[newTeam];
      m.server = newTeam * 2 + teamNextServer;
      // Update the doublesServerOrder for that team
      m.doublesServerOrder[newTeam] = 1 - teamNextServer;
    } else {
      // Singles: player who served first in tiebreak receives first in next set
      m.server = m.tiebreakStartServer;
    }
    m.tiebreakStartServer = null;
  } else {
    // Regular game rotation
    if (isDoubles(m)) {
      m.server = getNextServerDoubles(m);
    } else {
      m.server = m.server === 0 ? 1 : 0;
    }
  }

  // Set tiebreakStartServer AFTER rotation (this is who actually serves first in the tiebreak)
  if (m.isTiebreak && m.tiebreakStartServer === null) {
    m.tiebreakStartServer = m.server;
  }
}

/**
 * Get the next server for doubles after a regular game.
 * Rotates: T1P1 → T2P1 → T1P2 → T2P2 → T1P1 → ...
 *
 * doublesServerOrder[teamIdx] tracks which player (0 or 1 within team)
 * serves NEXT time that team serves.
 */
function getNextServerDoubles(match) {
  const currentServer = match.server;
  const currentTeam = getTeamIndex(currentServer);

  // After serving, update the CURRENT team's next server to be the other player
  const currentPlayerInTeam = currentServer - currentTeam * 2; // 0 or 1 within team
  match.doublesServerOrder[currentTeam] = 1 - currentPlayerInTeam;

  // Move to the other team
  const nextTeam = 1 - currentTeam;

  // Get which player on that team serves next
  const nextPlayerInTeam = match.doublesServerOrder[nextTeam];

  // Calculate player index: team 0 = players 0,1; team 1 = players 2,3
  const nextServer = nextTeam * 2 + nextPlayerInTeam;

  return nextServer;
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
 * In tennis, server alternates each game.
 *
 * For singles: Returns 0 or 1 (player index).
 * For doubles: Returns 0-3 (player index). Use matchType='doubles' or numPlayers=4.
 *
 * @param {Array} sets - Array of set scores
 * @param {boolean} isTiebreak - Whether in tiebreak
 * @param {number} tiebreakPoints - Total tiebreak points played
 * @param {object} options - Optional: { matchType: 'doubles', firstServer: 0 }
 */
export function calculateServer(sets, isTiebreak, tiebreakPoints, options = {}) {
  const isDoublesMatch = options.matchType === 'doubles' || options.numPlayers === 4;

  // Count total games played across all sets
  let totalGames = 0;
  for (const [g1, g2] of sets) {
    totalGames += g1 + g2;
  }

  if (!isDoublesMatch) {
    // SINGLES
    if (isTiebreak) {
      const tiebreakFirstServer = totalGames % 2 === 0 ? 0 : 1;

      if (tiebreakPoints === 0) {
        return tiebreakFirstServer;
      }
      const pointsSinceFirst = tiebreakPoints;
      const serverChanges = Math.floor((pointsSinceFirst + 1) / 2);
      return (tiebreakFirstServer + serverChanges) % 2;
    }

    // Regular game: alternates each game
    return totalGames % 2;
  }

  // DOUBLES
  // Server order: 0 → 2 → 1 → 3 (T1P1 → T2P1 → T1P2 → T2P2)
  const doublesOrder = [0, 2, 1, 3];

  if (isTiebreak) {
    // Tiebreak first server is whoever would have served the 13th game
    const tiebreakFirstServerIdx = totalGames % 4;
    const tiebreakFirstServer = doublesOrder[tiebreakFirstServerIdx];

    if (tiebreakPoints === 0) {
      return tiebreakFirstServer;
    }

    // After first point, changes every 2 points through all 4 players
    const serverChanges = Math.floor((tiebreakPoints + 1) / 2);
    const rotation = getDoublesServerRotation(tiebreakFirstServer);
    return rotation[serverChanges % 4];
  }

  // Regular game: rotate through 4 players
  return doublesOrder[totalGames % 4];
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

  // Calculate doublesServerOrder based on total games played
  // The order depends on which team's turn it is and which player within that team
  let doublesServerOrder = null;
  if (match.matchType === 'doubles' || match.players?.length === 4) {
    // Calculate total games to figure out where we are in rotation
    let totalGames = 0;
    for (const [g1, g2] of normalizedSets) {
      totalGames += g1 + g2;
    }
    // Standard rotation: 0 → 2 → 1 → 3
    // After game N, the next server is doublesOrder[(N) % 4]
    // doublesServerOrder tracks which player (0 or 1 within team) serves NEXT for each team
    // We need to reverse-engineer this from the current position
    const doublesOrder = [0, 2, 1, 3];
    const currentServerIdx = totalGames % 4;
    const currentServer = doublesOrder[currentServerIdx];

    // For each team, figure out which player should serve next
    // Team 0: players 0, 1; Team 1: players 2, 3
    // The current server just finished their game, so next time their team serves,
    // it should be the OTHER player on that team
    doublesServerOrder = [0, 0]; // Default: player 0 of each team serves next

    // Look at the last time each team served to figure out the next server
    for (let i = 0; i < totalGames; i++) {
      const serverIdx = doublesOrder[i % 4];
      const team = serverIdx < 2 ? 0 : 1;
      const playerInTeam = serverIdx - team * 2;
      // After this player serves, the next server for this team is the other player
      doublesServerOrder[team] = 1 - playerInTeam;
    }
  }

  // Create the new match state
  const newMatch = {
    ...match,
    sets: normalizedSets.length > 0 ? normalizedSets : [[0, 0]],
    points: points || [0, 0],
    isTiebreak,
    tiebreakStartServer: isTiebreak ? calculateServer(normalizedSets.slice(0, -1).concat([[6, 5]]), false, 0) : null,
    server: server !== undefined ? server : calculateServer(normalizedSets, isTiebreak, isTiebreak ? (points[0] + points[1]) : 0),
    doublesServerOrder,
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
        doublesServerOrder, // Include for doubles replay
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
