/* ─── Tennis Scoring Engine ─── */
/* Pure functions — no side effects, no storage, no React */

export const POINT_NAMES = ["0", "15", "30", "40"];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function snapshot(m) {
  const c = deepClone(m);
  c.history = [];
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
    history: [],
    createdAt: Date.now(),
  };
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

export function undoPoint(m) {
  if (!m.history || m.history.length === 0) return m;
  const prev = m.history[m.history.length - 1];
  prev.history = m.history.slice(0, -1);
  return prev;
}
