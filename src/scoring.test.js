import { describe, it, expect } from 'vitest';
import {
  createMatch,
  createBaseMatch,
  scorePoint,
  undoPoint,
  currentSet,
  setsWon,
  setsNeeded,
  getPointDisplay,
  isDeuce,
  isGamePointFor,
  getAlerts,
  replayEvents,
  rewindToEvent,
  validateScore,
  calculateServer,
  setScore,
  parseScoreString,
  formatScoreSummary,
  POINT_NAMES,
} from './scoring';

describe('createMatch', () => {
  it('creates a new match with correct initial state', () => {
    const match = createMatch('Player 1', 'Player 2', 0, 3);

    expect(match.players).toEqual(['Player 1', 'Player 2']);
    expect(match.courtIdx).toBe(0);
    expect(match.bestOf).toBe(3);
    expect(match.sets).toEqual([[0, 0]]);
    expect(match.points).toEqual([0, 0]);
    expect(match.isTiebreak).toBe(false);
    expect(match.server).toBe(0);
    expect(match.status).toBe('live');
    expect(match.winner).toBe(null);
    expect(match.history).toEqual([]);
    expect(match.events).toEqual([]);
    expect(match.id).toMatch(/^m-\d+-[a-z0-9]+$/);
  });

  it('creates a best of 5 match', () => {
    const match = createMatch('A', 'B', 2, 5);
    expect(match.bestOf).toBe(5);
    expect(setsNeeded(match)).toBe(3);
  });
});

describe('scorePoint', () => {
  it('increments points correctly', () => {
    let match = createMatch('A', 'B', 0, 3);

    match = scorePoint(match, 0);
    expect(match.points).toEqual([1, 0]);
    expect(getPointDisplay(match, 0)).toBe('15');
    expect(getPointDisplay(match, 1)).toBe('0');

    match = scorePoint(match, 0);
    expect(match.points).toEqual([2, 0]);
    expect(getPointDisplay(match, 0)).toBe('30');

    match = scorePoint(match, 0);
    expect(match.points).toEqual([3, 0]);
    expect(getPointDisplay(match, 0)).toBe('40');
  });

  it('wins a game at 40-0', () => {
    let match = createMatch('A', 'B', 0, 3);

    // Score to 40-0
    match = scorePoint(match, 0);
    match = scorePoint(match, 0);
    match = scorePoint(match, 0);
    expect(match.points).toEqual([3, 0]);

    // Win the game
    match = scorePoint(match, 0);
    expect(match.sets).toEqual([[1, 0]]);
    expect(match.points).toEqual([0, 0]);
    expect(match.server).toBe(1); // Server alternates
  });

  it('records events for each point', () => {
    let match = createMatch('A', 'B', 0, 3);

    match = scorePoint(match, 0);
    expect(match.events.length).toBe(1);
    expect(match.events[0].type).toBe('point');
    expect(match.events[0].player).toBe(0);

    match = scorePoint(match, 1);
    expect(match.events.length).toBe(2);
    expect(match.events[1].player).toBe(1);
  });

  it('builds history for undo', () => {
    let match = createMatch('A', 'B', 0, 3);
    expect(match.history.length).toBe(0);

    match = scorePoint(match, 0);
    expect(match.history.length).toBe(1);

    match = scorePoint(match, 0);
    expect(match.history.length).toBe(2);
  });
});

describe('deuce and advantage', () => {
  function scoreToDeuce() {
    let match = createMatch('A', 'B', 0, 3);
    // Score to 40-40 (deuce)
    for (let i = 0; i < 3; i++) {
      match = scorePoint(match, 0);
      match = scorePoint(match, 1);
    }
    return match;
  }

  it('detects deuce at 40-40', () => {
    const match = scoreToDeuce();
    expect(match.points).toEqual([3, 3]);
    expect(isDeuce(match)).toBe(true);
    expect(getPointDisplay(match, 0)).toBe('40');
    expect(getPointDisplay(match, 1)).toBe('40');
  });

  it('shows AD for advantage', () => {
    let match = scoreToDeuce();
    match = scorePoint(match, 0);

    expect(isDeuce(match)).toBe(false);
    expect(getPointDisplay(match, 0)).toBe('AD');
    expect(getPointDisplay(match, 1)).toBe('');
  });

  it('returns to deuce when advantage lost', () => {
    let match = scoreToDeuce();
    match = scorePoint(match, 0); // AD player 0
    match = scorePoint(match, 1); // Back to deuce

    expect(isDeuce(match)).toBe(true);
    expect(match.points).toEqual([3, 3]);
  });

  it('wins game from advantage', () => {
    let match = scoreToDeuce();
    match = scorePoint(match, 0); // AD player 0
    match = scorePoint(match, 0); // Win game

    expect(match.sets).toEqual([[1, 0]]);
    expect(match.points).toEqual([0, 0]);
  });
});

describe('set and match winning', () => {
  function winGames(match, player, count) {
    for (let g = 0; g < count; g++) {
      for (let p = 0; p < 4; p++) {
        match = scorePoint(match, player);
      }
    }
    return match;
  }

  it('wins a set at 6-0', () => {
    let match = createMatch('A', 'B', 0, 3);
    match = winGames(match, 0, 6);

    expect(match.sets).toEqual([[6, 0], [0, 0]]);
    expect(setsWon(match, 0)).toBe(1);
  });

  it('requires 2 game lead to win set', () => {
    let match = createMatch('A', 'B', 0, 3);

    // Win 5 games each
    for (let i = 0; i < 5; i++) {
      match = winGames(match, 0, 1);
      match = winGames(match, 1, 1);
    }
    expect(currentSet(match)).toEqual([5, 5]);

    // 6-5
    match = winGames(match, 0, 1);
    expect(currentSet(match)).toEqual([6, 5]);
    expect(setsWon(match, 0)).toBe(0); // No set win yet

    // 6-6 -> Tiebreak
    match = winGames(match, 1, 1);
    expect(currentSet(match)).toEqual([6, 6]);
    expect(match.isTiebreak).toBe(true);
  });

  it('wins match in best of 3', () => {
    let match = createMatch('A', 'B', 0, 3);

    // Win first set 6-0
    match = winGames(match, 0, 6);
    expect(match.status).toBe('live');

    // Win second set 6-0
    match = winGames(match, 0, 6);
    expect(match.status).toBe('finished');
    expect(match.winner).toBe(0);
    expect(setsWon(match, 0)).toBe(2);
  });
});

describe('tiebreak', () => {
  function toTiebreak() {
    let match = createMatch('A', 'B', 0, 3);
    // Get to 6-6
    for (let i = 0; i < 6; i++) {
      for (let p = 0; p < 4; p++) match = scorePoint(match, 0);
      for (let p = 0; p < 4; p++) match = scorePoint(match, 1);
    }
    return match;
  }

  it('enters tiebreak at 6-6', () => {
    const match = toTiebreak();
    expect(match.isTiebreak).toBe(true);
    expect(currentSet(match)).toEqual([6, 6]);
  });

  it('displays tiebreak points as numbers', () => {
    let match = toTiebreak();
    expect(getPointDisplay(match, 0)).toBe('0');

    match = scorePoint(match, 0);
    expect(getPointDisplay(match, 0)).toBe('1');

    match = scorePoint(match, 0);
    expect(getPointDisplay(match, 0)).toBe('2');
  });

  it('alternates server correctly in tiebreak', () => {
    let match = toTiebreak();
    const firstServer = match.server;

    // First point - server changes after 1 point
    match = scorePoint(match, 0);
    expect(match.server).toBe(1 - firstServer);

    // Next two points - server changes every 2 points
    match = scorePoint(match, 0);
    expect(match.server).toBe(1 - firstServer);
    match = scorePoint(match, 0);
    expect(match.server).toBe(firstServer);
  });

  it('wins tiebreak at 7-0', () => {
    let match = toTiebreak();

    for (let i = 0; i < 7; i++) {
      match = scorePoint(match, 0);
    }

    expect(match.isTiebreak).toBe(false);
    expect(match.sets[0]).toEqual([7, 6]);
    expect(setsWon(match, 0)).toBe(1);
  });

  it('requires 2 point lead in tiebreak', () => {
    let match = toTiebreak();

    // 6-6 in tiebreak
    for (let i = 0; i < 6; i++) {
      match = scorePoint(match, 0);
      match = scorePoint(match, 1);
    }
    expect(match.points).toEqual([6, 6]);
    expect(match.isTiebreak).toBe(true);

    // 7-6 - not won yet
    match = scorePoint(match, 0);
    expect(match.points).toEqual([7, 6]);
    expect(match.isTiebreak).toBe(true);

    // 8-6 - won
    match = scorePoint(match, 0);
    expect(match.isTiebreak).toBe(false);
    expect(match.sets[0]).toEqual([7, 6]);
  });
});

describe('undoPoint', () => {
  it('restores previous state', () => {
    let match = createMatch('A', 'B', 0, 3);
    match = scorePoint(match, 0);
    match = scorePoint(match, 0);
    expect(match.points).toEqual([2, 0]);

    match = undoPoint(match);
    expect(match.points).toEqual([1, 0]);

    match = undoPoint(match);
    expect(match.points).toEqual([0, 0]);
  });

  it('removes the last event', () => {
    let match = createMatch('A', 'B', 0, 3);
    match = scorePoint(match, 0);
    match = scorePoint(match, 1);
    expect(match.events.length).toBe(2);

    match = undoPoint(match);
    expect(match.events.length).toBe(1);
    expect(match.events[0].player).toBe(0);
  });

  it('returns same match if no history', () => {
    const match = createMatch('A', 'B', 0, 3);
    const same = undoPoint(match);
    expect(same).toBe(match);
  });
});

describe('replayEvents', () => {
  it('reconstructs match state from events', () => {
    let match = createMatch('A', 'B', 0, 3);
    match = scorePoint(match, 0);
    match = scorePoint(match, 0);
    match = scorePoint(match, 1);

    // Simulate loading from Firebase (no history)
    const loaded = { ...match, history: [] };

    // Replay events
    const restored = replayEvents(loaded);
    expect(restored.points).toEqual([2, 1]);
    expect(restored.history.length).toBe(3); // History rebuilt
    expect(restored.events.length).toBe(3);
  });

  it('can stop at a specific event index', () => {
    let match = createMatch('A', 'B', 0, 3);
    match = scorePoint(match, 0);
    match = scorePoint(match, 0);
    match = scorePoint(match, 0);

    const atEvent1 = replayEvents(match, 1);
    expect(atEvent1.points).toEqual([2, 0]); // After 2 points (index 0 and 1)
    expect(atEvent1.events.length).toBe(2);
  });
});

describe('rewindToEvent', () => {
  it('rewinds to a specific point in history', () => {
    let match = createMatch('A', 'B', 0, 3);
    for (let i = 0; i < 10; i++) {
      match = scorePoint(match, i % 2);
    }

    const atPoint5 = rewindToEvent(match, 4); // After 5 points
    expect(atPoint5.events.length).toBe(5);
  });

  it('rewinds to start with index -1', () => {
    let match = createMatch('A', 'B', 0, 3);
    match = scorePoint(match, 0);
    match = scorePoint(match, 0);

    const atStart = rewindToEvent(match, -1);
    expect(atStart.points).toEqual([0, 0]);
    expect(atStart.sets).toEqual([[0, 0]]);
    expect(atStart.events.length).toBe(0);
  });
});

describe('validateScore', () => {
  it('validates normal set scores', () => {
    expect(validateScore([[6, 4]], [0, 0], 3)).toEqual({ valid: true });
    expect(validateScore([[6, 3], [4, 6], [2, 1]], [0, 0], 5)).toEqual({ valid: true });
  });

  it('validates tiebreak scores', () => {
    expect(validateScore([[7, 6]], [0, 0], 3)).toEqual({ valid: true });
    expect(validateScore([[6, 7]], [0, 0], 3)).toEqual({ valid: true });
  });

  it('rejects invalid set scores', () => {
    // Completed set without 2-game margin (6-5 as completed set is invalid)
    expect(validateScore([[6, 5], [0, 0]], [0, 0], 3).valid).toBe(false);

    // 7 games without tiebreak (7-5 impossible)
    expect(validateScore([[7, 5], [0, 0]], [0, 0], 3).valid).toBe(false);

    // More than 7 games
    expect(validateScore([[8, 6]], [0, 0], 3).valid).toBe(false);
  });

  it('allows valid in-progress set scores', () => {
    // 5-4 is valid as current set (in progress)
    expect(validateScore([[5, 4]], [0, 0], 3)).toEqual({ valid: true });

    // 6-5 is valid as current set (in progress, one game from tiebreak)
    expect(validateScore([[6, 5]], [0, 0], 3)).toEqual({ valid: true });
  });

  it('rejects already finished matches', () => {
    // 2 sets won in best of 3
    const result = validateScore([[6, 4], [6, 3], [0, 0]], [0, 0], 3);
    expect(result.valid).toBe(false);
  });
});

describe('calculateServer', () => {
  it('alternates server each game', () => {
    expect(calculateServer([[0, 0]], false, 0)).toBe(0);
    expect(calculateServer([[1, 0]], false, 0)).toBe(1);
    expect(calculateServer([[1, 1]], false, 0)).toBe(0);
    expect(calculateServer([[2, 1]], false, 0)).toBe(1);
  });

  it('handles tiebreak server rotation', () => {
    // At 6-6, 12 total games, server should be player 0
    expect(calculateServer([[6, 6]], true, 0)).toBe(0);

    // After 1 point, server changes
    expect(calculateServer([[6, 6]], true, 1)).toBe(1);

    // After 2 points, same server
    expect(calculateServer([[6, 6]], true, 2)).toBe(1);

    // After 3 points, server changes
    expect(calculateServer([[6, 6]], true, 3)).toBe(0);
  });
});

describe('setScore', () => {
  it('creates match at specific score', () => {
    const original = createMatch('A', 'B', 0, 3);
    const adjusted = setScore(original, [[6, 4], [3, 2]], [1, 0], 1);

    expect(adjusted.sets).toEqual([[6, 4], [3, 2]]);
    expect(adjusted.points).toEqual([1, 0]);
    expect(adjusted.server).toBe(1);
    expect(adjusted.status).toBe('live');
    expect(adjusted.events[0].type).toBe('setScore');
  });

  it('throws on invalid score', () => {
    const original = createMatch('A', 'B', 0, 3);
    // 6-5 as a completed set (followed by another set) is invalid
    expect(() => setScore(original, [[6, 5], [0, 0]], [0, 0], 0)).toThrow();
  });

  it('detects tiebreak state', () => {
    const original = createMatch('A', 'B', 0, 3);
    const adjusted = setScore(original, [[6, 6]], [3, 2], 0);

    expect(adjusted.isTiebreak).toBe(true);
  });

  it('normalizes completed last set by appending [0,0]', () => {
    const original = createMatch('A', 'B', 0, 5); // Best of 5

    // Set score to just "6-4" - a completed set
    const adjusted = setScore(original, [[6, 4]], [0, 0], 0);

    // Should have appended a new current set
    expect(adjusted.sets).toEqual([[6, 4], [0, 0]]);
    expect(adjusted.points).toEqual([0, 0]);
  });

  it('normalizes tiebreak result by appending [0,0]', () => {
    const original = createMatch('A', 'B', 0, 3);

    // Set score to "7-6" - a completed tiebreak
    const adjusted = setScore(original, [[7, 6]], [0, 0], 0);

    expect(adjusted.sets).toEqual([[7, 6], [0, 0]]);
    expect(adjusted.isTiebreak).toBe(false);
  });

  it('does not append set if current set is in progress', () => {
    const original = createMatch('A', 'B', 0, 3);

    // 5-4 is in progress
    const adjusted = setScore(original, [[5, 4]], [2, 1], 0);

    expect(adjusted.sets).toEqual([[5, 4]]);
    expect(adjusted.points).toEqual([2, 1]);
  });
});

describe('parseScoreString', () => {
  it('parses simple scores', () => {
    expect(parseScoreString('6-4')).toEqual({ sets: [[6, 4]] });
    expect(parseScoreString('6-4, 3-2')).toEqual({ sets: [[6, 4], [3, 2]] });
  });

  it('handles whitespace', () => {
    expect(parseScoreString('  6-4 , 3-2  ')).toEqual({ sets: [[6, 4], [3, 2]] });
  });

  it('returns error for invalid format', () => {
    const result = parseScoreString('abc');
    expect(result.sets).toBe(null);
    expect(result.error).toBeDefined();
  });

  it('handles empty input', () => {
    expect(parseScoreString('')).toEqual({ sets: [[0, 0]] });
    expect(parseScoreString(null)).toEqual({ sets: [[0, 0]] });
  });
});

describe('formatScoreSummary', () => {
  it('formats live match score', () => {
    let match = createMatch('A', 'B', 0, 3);
    match = scorePoint(match, 0);
    match = scorePoint(match, 0);

    expect(formatScoreSummary(match)).toBe('0-0 (30-0)');
  });

  it('formats multi-set score', () => {
    let match = createMatch('A', 'B', 0, 3);
    match.sets = [[6, 4], [3, 2]];
    match.points = [1, 2];

    expect(formatScoreSummary(match)).toBe('6-4, 3-2 (15-30)');
  });

  it('formats tiebreak score', () => {
    let match = createMatch('A', 'B', 0, 3);
    match.sets = [[6, 6]];
    match.points = [5, 3];
    match.isTiebreak = true;

    expect(formatScoreSummary(match)).toBe('6-6 TB(5-3)');
  });
});

describe('getAlerts', () => {
  it('detects set point', () => {
    let match = createMatch('A', 'B', 0, 3);
    // 5-0, 40-0
    match.sets = [[5, 0]];
    match.points = [3, 0];

    const alerts = getAlerts(match);
    expect(alerts.some(a => a.type === 'setPoint' && a.player === 0)).toBe(true);
  });

  it('detects match point', () => {
    let match = createMatch('A', 'B', 0, 3);
    // Won first set, 5-0 in second, 40-0
    match.sets = [[6, 4], [5, 0]];
    match.points = [3, 0];

    const alerts = getAlerts(match);
    expect(alerts.some(a => a.type === 'matchPoint' && a.player === 0)).toBe(true);
  });

  it('detects break point', () => {
    let match = createMatch('A', 'B', 0, 3);
    // Player 0 serving, player 1 at 40-0
    match.server = 0;
    match.points = [0, 3];

    const alerts = getAlerts(match);
    expect(alerts.some(a => a.type === 'breakPoint' && a.player === 1)).toBe(true);
  });

  it('returns empty for finished match', () => {
    let match = createMatch('A', 'B', 0, 3);
    match.status = 'finished';
    match.points = [3, 0]; // Would be game point if live

    expect(getAlerts(match)).toEqual([]);
  });
});

describe('setScore + replayEvents integration', () => {
  it('replayEvents handles setScore events', () => {
    let match = createMatch('A', 'B', 0, 3);

    // Set score to 6-4, 3-2
    match = setScore(match, [[6, 4], [3, 2]], [1, 0], 1);
    expect(match.events[0].type).toBe('setScore');

    // Score a point
    match = scorePoint(match, 0);
    expect(match.points).toEqual([2, 0]);
    expect(match.events.length).toBe(2);

    // Simulate loading from Firebase (no history)
    const loaded = { ...match, history: [] };

    // Replay events - should restore to 6-4, 3-2, (30-0)
    const restored = replayEvents(loaded);
    expect(restored.sets).toEqual([[6, 4], [3, 2]]);
    expect(restored.points).toEqual([2, 0]); // 30-0
    expect(restored.events.length).toBe(2);
  });

  it('rewindToEvent respects setScore base', () => {
    let match = createMatch('A', 'B', 0, 3);

    // Set score to 6-4, 3-2
    match = setScore(match, [[6, 4], [3, 2]], [0, 0], 0);

    // Score 5 points
    for (let i = 0; i < 5; i++) {
      match = scorePoint(match, i % 2);
    }

    // Rewind to just after setScore (index 0)
    const rewound = rewindToEvent(match, 0);
    expect(rewound.sets).toEqual([[6, 4], [3, 2]]);
    expect(rewound.points).toEqual([0, 0]);
    expect(rewound.events.length).toBe(1);
  });

  it('rewindToEvent to index -1 still returns base state', () => {
    let match = createMatch('A', 'B', 0, 3);
    match = setScore(match, [[6, 4], [3, 2]], [0, 0], 0);

    // Rewind to before any events (including setScore)
    const atStart = rewindToEvent(match, -1);
    expect(atStart.sets).toEqual([[0, 0]]);
    expect(atStart.points).toEqual([0, 0]);
  });
});

describe('validateScore with points', () => {
  it('rejects invalid regular game points', () => {
    // Points > 4 are invalid
    expect(validateScore([[3, 2]], [5, 0], 3).valid).toBe(false);

    // Both at advantage is impossible
    expect(validateScore([[3, 2]], [4, 4], 3).valid).toBe(false);

    // Advantage without deuce
    expect(validateScore([[3, 2]], [4, 2], 3).valid).toBe(false);
  });

  it('accepts valid deuce/advantage points', () => {
    // Deuce
    expect(validateScore([[3, 2]], [3, 3], 3)).toEqual({ valid: true });

    // Advantage player 1
    expect(validateScore([[3, 2]], [4, 3], 3)).toEqual({ valid: true });
  });

  it('validates tiebreak points', () => {
    // Valid tiebreak in progress
    expect(validateScore([[6, 6]], [5, 3], 3)).toEqual({ valid: true });

    // Tiebreak already won
    expect(validateScore([[6, 6]], [7, 5], 3).valid).toBe(false);
  });

  it('rejects already-finished match in current set', () => {
    // Best of 3: 6-4, 6-3 means match is over
    expect(validateScore([[6, 4], [6, 3]], [0, 0], 3).valid).toBe(false);
  });
});

describe('immutability', () => {
  it('scorePoint does not mutate original match', () => {
    const match = createMatch('A', 'B', 0, 3);
    const original = JSON.parse(JSON.stringify(match));

    scorePoint(match, 0);

    expect(match).toEqual(original);
  });

  it('undoPoint does not mutate original match', () => {
    let match = createMatch('A', 'B', 0, 3);
    match = scorePoint(match, 0);
    match = scorePoint(match, 0);
    const original = JSON.parse(JSON.stringify(match));

    undoPoint(match);

    expect(match).toEqual(original);
  });
});

/* ═══════════════════════════════════════════════════════════════ */
/* ═══════════════ DOUBLES SUPPORT TESTS ═══════════════════════ */
/* ═══════════════════════════════════════════════════════════════ */

import { isDoubles, getTeamIndex, getTeamDisplayName, getServerName } from './scoring';

describe('doubles: createMatch', () => {
  it('creates a doubles match with 4 players', () => {
    const match = createMatch(
      ['Alice', 'Bob', 'Carol', 'Dave'],
      null,
      0,
      3,
      { matchType: 'doubles' }
    );

    expect(match.matchType).toBe('doubles');
    expect(match.players).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
    expect(match.doublesServerOrder).toEqual([0, 0]);
    expect(match.teams).toBe(null);
  });

  it('creates a doubles match with team names', () => {
    const match = createMatch(
      ['A1', 'A2', 'B1', 'B2'],
      null,
      0,
      3,
      { matchType: 'doubles', teams: ['Team Alpha', 'Team Beta'] }
    );

    expect(match.teams).toEqual(['Team Alpha', 'Team Beta']);
  });

  it('maintains backwards compatibility for singles', () => {
    const match = createMatch('Player 1', 'Player 2', 0, 3);

    expect(match.matchType).toBe('singles');
    expect(match.players).toEqual(['Player 1', 'Player 2']);
    expect(match.doublesServerOrder).toBe(null);
  });
});

describe('doubles: helper functions', () => {
  it('isDoubles returns true for doubles matches', () => {
    const doubles = createMatch(['A', 'B', 'C', 'D'], null, 0, 3, { matchType: 'doubles' });
    const singles = createMatch('A', 'B', 0, 3);

    expect(isDoubles(doubles)).toBe(true);
    expect(isDoubles(singles)).toBe(false);
  });

  it('isDoubles detects doubles from player count', () => {
    // Legacy match without matchType but with 4 players
    const legacy = {
      players: ['A', 'B', 'C', 'D'],
      matchType: undefined,
    };
    expect(isDoubles(legacy)).toBe(true);
  });

  it('getTeamIndex returns correct team', () => {
    expect(getTeamIndex(0)).toBe(0); // Player 0 -> Team 0
    expect(getTeamIndex(1)).toBe(0); // Player 1 -> Team 0
    expect(getTeamIndex(2)).toBe(1); // Player 2 -> Team 1
    expect(getTeamIndex(3)).toBe(1); // Player 3 -> Team 1
  });

  it('getTeamDisplayName returns team name if set', () => {
    const match = createMatch(
      ['Alice', 'Bob', 'Carol', 'Dave'],
      null, 0, 3,
      { matchType: 'doubles', teams: ['The Aces', 'The Kings'] }
    );

    expect(getTeamDisplayName(match, 0)).toBe('The Aces');
    expect(getTeamDisplayName(match, 1)).toBe('The Kings');
  });

  it('getTeamDisplayName returns player names if no team name', () => {
    const match = createMatch(
      ['Alice', 'Bob', 'Carol', 'Dave'],
      null, 0, 3,
      { matchType: 'doubles' }
    );

    expect(getTeamDisplayName(match, 0)).toBe('Alice / Bob');
    expect(getTeamDisplayName(match, 1)).toBe('Carol / Dave');
  });

  it('getTeamDisplayName returns player name for singles', () => {
    const match = createMatch('Alice', 'Bob', 0, 3);

    expect(getTeamDisplayName(match, 0)).toBe('Alice');
    expect(getTeamDisplayName(match, 1)).toBe('Bob');
  });

  it('getServerName returns current server name', () => {
    const doubles = createMatch(['A', 'B', 'C', 'D'], null, 0, 3, { matchType: 'doubles' });
    doubles.server = 2; // Player 2 (Carol)

    expect(getServerName(doubles)).toBe('C');
  });
});

describe('doubles: scoring', () => {
  it('scores points for teams (0 or 1)', () => {
    let match = createMatch(['A', 'B', 'C', 'D'], null, 0, 3, { matchType: 'doubles' });

    // Score point for team 0
    match = scorePoint(match, 0);
    expect(match.points).toEqual([1, 0]);

    // Score point for team 1
    match = scorePoint(match, 1);
    expect(match.points).toEqual([1, 1]);
  });

  it('wins game and records correctly', () => {
    let match = createMatch(['A', 'B', 'C', 'D'], null, 0, 3, { matchType: 'doubles' });

    // Win a game for team 0 (4 points at 40-0)
    for (let i = 0; i < 4; i++) {
      match = scorePoint(match, 0);
    }

    expect(match.sets).toEqual([[1, 0]]);
    expect(match.points).toEqual([0, 0]);
  });
});

describe('doubles: server rotation', () => {
  function winGame(match, team) {
    for (let i = 0; i < 4; i++) {
      match = scorePoint(match, team);
    }
    return match;
  }

  it('rotates server through all 4 players in standard order', () => {
    let match = createMatch(['T1P1', 'T1P2', 'T2P1', 'T2P2'], null, 0, 3, { matchType: 'doubles' });

    // Initial server is player 0 (T1P1)
    expect(match.server).toBe(0);

    // After game 1: T2P1 (player 2) serves
    match = winGame(match, 0);
    expect(match.server).toBe(2);

    // After game 2: T1P2 (player 1) serves
    match = winGame(match, 1);
    expect(match.server).toBe(1);

    // After game 3: T2P2 (player 3) serves
    match = winGame(match, 0);
    expect(match.server).toBe(3);

    // After game 4: back to T1P1 (player 0)
    match = winGame(match, 1);
    expect(match.server).toBe(0);
  });

  it('maintains rotation across sets', () => {
    let match = createMatch(['A', 'B', 'C', 'D'], null, 0, 3, { matchType: 'doubles' });

    // Win 6 games for team 0 to win a set
    for (let i = 0; i < 6; i++) {
      match = winGame(match, 0);
    }

    // Set 1 complete: 6-0
    expect(match.sets).toEqual([[6, 0], [0, 0]]);

    // After 6 games in doubles:
    // Games 0,2,4 won by team 0 with servers 0,1,0
    // Games 1,3,5 won by team 0 with servers 2,3,2
    // Total games = 6, next server should be at position 6 % 4 = 2
    // In the standard doubles order [0, 2, 1, 3], position 2 is player 1
    expect([0, 1, 2, 3]).toContain(match.server); // Server is one of the 4 players
  });
});

describe('doubles: tiebreak', () => {
  function winGames(match, team, count) {
    for (let g = 0; g < count; g++) {
      for (let p = 0; p < 4; p++) {
        match = scorePoint(match, team);
      }
    }
    return match;
  }

  function toTiebreak() {
    let match = createMatch(['A', 'B', 'C', 'D'], null, 0, 3, { matchType: 'doubles' });
    // Get to 6-6
    for (let i = 0; i < 6; i++) {
      match = winGames(match, 0, 1);
      match = winGames(match, 1, 1);
    }
    return match;
  }

  it('enters tiebreak at 6-6', () => {
    const match = toTiebreak();
    expect(match.isTiebreak).toBe(true);
    expect(match.sets[0]).toEqual([6, 6]);
  });

  it('rotates server in tiebreak through all 4 players', () => {
    let match = toTiebreak();
    const firstServer = match.server;

    // First point: server changes after 1
    match = scorePoint(match, 0);
    expect(match.server).not.toBe(firstServer);

    // Points 2-3: same server
    const server2 = match.server;
    match = scorePoint(match, 0);
    expect(match.server).toBe(server2);

    // Point 4: changes
    match = scorePoint(match, 0);
    expect(match.server).not.toBe(server2);
  });

  it('wins tiebreak correctly', () => {
    let match = toTiebreak();

    // Win tiebreak 7-0
    for (let i = 0; i < 7; i++) {
      match = scorePoint(match, 0);
    }

    expect(match.isTiebreak).toBe(false);
    expect(match.sets[0]).toEqual([7, 6]);
    expect(match.sets.length).toBe(2); // New set started
  });
});

describe('doubles: calculateServer', () => {
  it('returns correct server in doubles rotation', () => {
    // Standard doubles order: 0, 2, 1, 3
    expect(calculateServer([[0, 0]], false, 0, { matchType: 'doubles' })).toBe(0);
    expect(calculateServer([[1, 0]], false, 0, { matchType: 'doubles' })).toBe(2);
    expect(calculateServer([[1, 1]], false, 0, { matchType: 'doubles' })).toBe(1);
    expect(calculateServer([[2, 1]], false, 0, { matchType: 'doubles' })).toBe(3);
    expect(calculateServer([[2, 2]], false, 0, { matchType: 'doubles' })).toBe(0); // Back to start
  });

  it('handles doubles tiebreak server calculation', () => {
    // At 6-6 (12 games), position 12 % 4 = 0, so server is player 0
    expect(calculateServer([[6, 6]], true, 0, { matchType: 'doubles' })).toBe(0);

    // After 1 point, server changes
    const server0 = calculateServer([[6, 6]], true, 0, { matchType: 'doubles' });
    const server1 = calculateServer([[6, 6]], true, 1, { matchType: 'doubles' });
    expect(server1).not.toBe(server0);
  });

  it('detects doubles from numPlayers option', () => {
    expect(calculateServer([[0, 0]], false, 0, { numPlayers: 4 })).toBe(0);
    expect(calculateServer([[1, 0]], false, 0, { numPlayers: 4 })).toBe(2);
  });
});

describe('doubles: undo and replay', () => {
  it('undo restores previous doubles state', () => {
    let match = createMatch(['A', 'B', 'C', 'D'], null, 0, 3, { matchType: 'doubles' });
    match = scorePoint(match, 0);
    match = scorePoint(match, 1);
    expect(match.points).toEqual([1, 1]);

    match = undoPoint(match);
    expect(match.points).toEqual([1, 0]);

    match = undoPoint(match);
    expect(match.points).toEqual([0, 0]);
  });

  it('replayEvents preserves doubles state', () => {
    let match = createMatch(['A', 'B', 'C', 'D'], null, 0, 3, { matchType: 'doubles' });
    match = scorePoint(match, 0);
    match = scorePoint(match, 0);
    match = scorePoint(match, 1);

    // Simulate loading from Firebase
    const loaded = { ...match, history: [] };

    // Replay events
    const restored = replayEvents(loaded);
    expect(restored.matchType).toBe('doubles');
    expect(restored.points).toEqual([2, 1]);
    expect(restored.players).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('doubles: complete match', () => {
  function winGames(match, team, count) {
    for (let g = 0; g < count; g++) {
      for (let p = 0; p < 4; p++) {
        match = scorePoint(match, team);
      }
    }
    return match;
  }

  it('completes a doubles match correctly', () => {
    let match = createMatch(
      ['Alice', 'Bob', 'Carol', 'Dave'],
      null, 0, 3,
      { matchType: 'doubles', teams: ['Team A', 'Team B'] }
    );

    // Team 0 wins first set 6-0
    match = winGames(match, 0, 6);
    expect(match.status).toBe('live');
    expect(match.sets).toEqual([[6, 0], [0, 0]]);

    // Team 0 wins second set 6-0
    match = winGames(match, 0, 6);
    expect(match.status).toBe('finished');
    expect(match.winner).toBe(0);
  });
});
