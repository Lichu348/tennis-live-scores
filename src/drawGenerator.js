/* ─── Draw Generation Algorithms ─── */

/**
 * Standard seeding positions for single elimination brackets.
 * Ensures top seeds don't meet until later rounds.
 */
const SEEDING_POSITIONS = {
  2: [1, 2],
  4: [1, 4, 3, 2],
  8: [1, 8, 4, 5, 3, 6, 2, 7],
  16: [1, 16, 8, 9, 4, 13, 5, 12, 3, 14, 6, 11, 2, 15, 7, 10],
  32: [
    1, 32, 16, 17, 8, 25, 9, 24,
    4, 29, 13, 20, 5, 28, 12, 21,
    3, 30, 14, 19, 6, 27, 11, 22,
    2, 31, 15, 18, 7, 26, 10, 23
  ],
};

/**
 * Get round name based on draw size and round index.
 */
export function getRoundName(drawSize, roundIndex, totalRounds) {
  const roundsFromFinal = totalRounds - roundIndex - 1;

  if (roundsFromFinal === 0) return "Final";
  if (roundsFromFinal === 1) return "Semi-Final";
  if (roundsFromFinal === 2) return "Quarter-Final";
  if (roundsFromFinal === 3) return "Round of 16";
  if (roundsFromFinal === 4) return "Round of 32";
  if (roundsFromFinal === 5) return "Round of 64";

  return `Round ${roundIndex + 1}`;
}

/**
 * Calculate the number of rounds needed for a draw size.
 */
export function getRoundCount(drawSize) {
  return Math.log2(drawSize);
}

/**
 * Get the next power of 2 >= n.
 */
export function nextPowerOf2(n) {
  let power = 1;
  while (power < n) power *= 2;
  return power;
}

/**
 * Generate single elimination bracket.
 *
 * @param {Array} entries - Array of { id, name, seed } objects
 * @param {number} drawSize - Must be power of 2 (4, 8, 16, 32)
 * @returns {Object} - { rounds: [...] }
 */
export function generateSingleElimination(entries, drawSize) {
  // Validate draw size
  if (!SEEDING_POSITIONS[drawSize]) {
    throw new Error(`Draw size ${drawSize} not supported. Use 2, 4, 8, 16, or 32.`);
  }

  if (entries.length > drawSize) {
    throw new Error(`Too many entries (${entries.length}) for draw size ${drawSize}`);
  }

  const totalRounds = getRoundCount(drawSize);
  const seedingPositions = SEEDING_POSITIONS[drawSize];

  // Sort entries by seed
  const sortedEntries = [...entries].sort((a, b) => (a.seed || 999) - (b.seed || 999));

  // Map entries to positions based on seeding
  const positions = new Array(drawSize).fill(null);
  for (let i = 0; i < sortedEntries.length; i++) {
    const position = seedingPositions[i] - 1; // 0-indexed
    positions[position] = sortedEntries[i].id;
  }

  // Generate first round matches
  const firstRoundMatches = [];
  for (let i = 0; i < drawSize; i += 2) {
    firstRoundMatches.push({
      position: firstRoundMatches.length + 1,
      entry1: positions[i],
      entry2: positions[i + 1],
      matchId: null,
      winnerId: null,
    });
  }

  // Handle byes: if entry2 is null, entry1 auto-advances
  const firstRoundWithByes = firstRoundMatches.map(m => {
    if (m.entry1 && !m.entry2) {
      return { ...m, winnerId: m.entry1, isBye: true };
    }
    if (!m.entry1 && m.entry2) {
      return { ...m, winnerId: m.entry2, isBye: true };
    }
    return m;
  });

  // Generate all rounds
  const rounds = [{
    name: getRoundName(drawSize, 0, totalRounds),
    roundIndex: 0,
    matches: firstRoundWithByes,
  }];

  // Generate subsequent rounds
  let matchesInRound = drawSize / 2;
  for (let roundIndex = 1; roundIndex < totalRounds; roundIndex++) {
    matchesInRound = matchesInRound / 2;
    const roundMatches = [];

    for (let i = 0; i < matchesInRound; i++) {
      roundMatches.push({
        position: i + 1,
        entry1: null, // Will be filled by previous round winners
        entry2: null,
        matchId: null,
        winnerId: null,
        // Track which previous matches feed into this one
        feedsFrom: [
          { round: roundIndex - 1, position: i * 2 + 1 },
          { round: roundIndex - 1, position: i * 2 + 2 },
        ],
      });
    }

    rounds.push({
      name: getRoundName(drawSize, roundIndex, totalRounds),
      roundIndex,
      matches: roundMatches,
    });
  }

  // Apply byes to advance winners to second round
  const updatedRounds = applyByes(rounds);

  return { rounds: updatedRounds };
}

/**
 * Apply bye winners to the next round.
 */
function applyByes(rounds) {
  if (rounds.length < 2) return rounds;

  const updatedRounds = rounds.map(r => ({ ...r, matches: r.matches.map(m => ({ ...m })) }));

  // For each bye in round 1, advance winner to round 2
  updatedRounds[0].matches.forEach((match, idx) => {
    if (match.isBye && match.winnerId) {
      // Find the match this feeds into
      const nextRoundMatchIdx = Math.floor(idx / 2);
      const isFirstSlot = idx % 2 === 0;

      if (updatedRounds[1] && updatedRounds[1].matches[nextRoundMatchIdx]) {
        if (isFirstSlot) {
          updatedRounds[1].matches[nextRoundMatchIdx].entry1 = match.winnerId;
        } else {
          updatedRounds[1].matches[nextRoundMatchIdx].entry2 = match.winnerId;
        }
      }
    }
  });

  return updatedRounds;
}

/**
 * Advance a winner to the next round.
 *
 * @param {Object} tournament - Tournament object with rounds
 * @param {number} roundIndex - Current round index
 * @param {number} matchPosition - Match position within round (1-indexed)
 * @param {string} winnerId - Entry ID of the winner
 * @returns {Object} - Updated tournament
 */
export function advanceWinner(tournament, roundIndex, matchPosition, winnerId) {
  const rounds = tournament.rounds.map(r => ({
    ...r,
    matches: r.matches.map(m => ({ ...m })),
  }));

  // Update current match
  const currentMatch = rounds[roundIndex].matches[matchPosition - 1];
  currentMatch.winnerId = winnerId;

  // If there's a next round, advance winner
  if (roundIndex + 1 < rounds.length) {
    const nextMatchPosition = Math.ceil(matchPosition / 2);
    const nextMatch = rounds[roundIndex + 1].matches[nextMatchPosition - 1];

    // Determine if this goes to entry1 or entry2 slot
    const isFirstSlot = matchPosition % 2 === 1;
    if (isFirstSlot) {
      nextMatch.entry1 = winnerId;
    } else {
      nextMatch.entry2 = winnerId;
    }
  }

  return { ...tournament, rounds };
}

/**
 * Check if a bracket match is ready to be played.
 * Both entries must be filled (from previous rounds or initial draw).
 */
export function isMatchReady(rounds, roundIndex, matchPosition) {
  const match = rounds[roundIndex]?.matches[matchPosition - 1];
  if (!match) return false;

  // If it's a bye, it's already complete
  if (match.isBye) return false;

  // If already has a winner, it's complete
  if (match.winnerId) return false;

  // Both entries must be filled
  return match.entry1 !== null && match.entry2 !== null;
}

/**
 * Get the entry object by ID from tournament entries.
 */
export function getEntryById(tournament, entryId) {
  return tournament.entries.find(e => e.id === entryId) || null;
}

/**
 * Get entry names for a match.
 */
export function getMatchEntryNames(tournament, roundIndex, matchPosition) {
  const match = tournament.rounds[roundIndex]?.matches[matchPosition - 1];
  if (!match) return { entry1Name: null, entry2Name: null };

  const entry1 = match.entry1 ? getEntryById(tournament, match.entry1) : null;
  const entry2 = match.entry2 ? getEntryById(tournament, match.entry2) : null;

  return {
    entry1Name: entry1?.name || null,
    entry2Name: entry2?.name || null,
  };
}

/* ─── Round Robin Generation ─── */

/**
 * Generate round robin schedule using circle method.
 *
 * @param {Array} entries - Array of { id, name } objects
 * @returns {Object} - { rounds: [...], standings: [...] }
 */
export function generateRoundRobin(entries) {
  const n = entries.length;

  // If odd number, add a bye
  const participants = [...entries];
  const hasBye = n % 2 === 1;
  if (hasBye) {
    participants.push({ id: 'BYE', name: 'BYE', isBye: true });
  }

  const numParticipants = participants.length;
  const numRounds = numParticipants - 1;
  const matchesPerRound = numParticipants / 2;

  // Circle method: fix position 0, rotate others
  const rounds = [];

  for (let round = 0; round < numRounds; round++) {
    const roundMatches = [];

    for (let match = 0; match < matchesPerRound; match++) {
      let entry1Idx, entry2Idx;

      if (match === 0) {
        entry1Idx = 0;
        entry2Idx = numParticipants - 1 - round;
        if (entry2Idx <= 0) entry2Idx = numParticipants + entry2Idx - 1;
      } else {
        // Rotate positions
        entry1Idx = match;
        entry2Idx = numParticipants - 1 - match;

        // Apply rotation
        entry1Idx = ((entry1Idx - 1 + numParticipants - 1 - round) % (numParticipants - 1)) + 1;
        entry2Idx = ((entry2Idx - 1 + numParticipants - 1 - round) % (numParticipants - 1)) + 1;
      }

      const entry1 = participants[entry1Idx];
      const entry2 = participants[entry2Idx];

      // Skip bye matches
      if (entry1.isBye || entry2.isBye) continue;

      roundMatches.push({
        position: roundMatches.length + 1,
        entry1: entry1.id,
        entry2: entry2.id,
        matchId: null,
        winnerId: null,
        // For round robin, also track score
        entry1Sets: 0,
        entry2Sets: 0,
        entry1Games: 0,
        entry2Games: 0,
      });
    }

    rounds.push({
      name: `Round ${round + 1}`,
      roundIndex: round,
      matches: roundMatches,
    });
  }

  // Initialize standings
  const standings = entries.map(e => ({
    entryId: e.id,
    name: e.name,
    played: 0,
    won: 0,
    lost: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
  }));

  return { rounds, standings };
}

/**
 * Update round robin standings after a match.
 */
export function updateRoundRobinStandings(tournament, roundIndex, matchPosition, result) {
  const { entry1Sets, entry2Sets, entry1Games, entry2Games } = result;

  const match = tournament.rounds[roundIndex].matches[matchPosition - 1];
  const entry1Id = match.entry1;
  const entry2Id = match.entry2;

  const standings = tournament.standings.map(s => ({ ...s }));

  const entry1Standing = standings.find(s => s.entryId === entry1Id);
  const entry2Standing = standings.find(s => s.entryId === entry2Id);

  if (entry1Standing) {
    entry1Standing.played++;
    entry1Standing.setsWon += entry1Sets;
    entry1Standing.setsLost += entry2Sets;
    entry1Standing.gamesWon += entry1Games;
    entry1Standing.gamesLost += entry2Games;
    if (entry1Sets > entry2Sets) entry1Standing.won++;
    else entry1Standing.lost++;
  }

  if (entry2Standing) {
    entry2Standing.played++;
    entry2Standing.setsWon += entry2Sets;
    entry2Standing.setsLost += entry1Sets;
    entry2Standing.gamesWon += entry2Games;
    entry2Standing.gamesLost += entry1Games;
    if (entry2Sets > entry1Sets) entry2Standing.won++;
    else entry2Standing.lost++;
  }

  // Sort standings
  standings.sort((a, b) => {
    // Primary: wins
    if (b.won !== a.won) return b.won - a.won;
    // Secondary: set difference
    const aSetDiff = a.setsWon - a.setsLost;
    const bSetDiff = b.setsWon - b.setsLost;
    if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;
    // Tertiary: game difference
    const aGameDiff = a.gamesWon - a.gamesLost;
    const bGameDiff = b.gamesWon - b.gamesLost;
    return bGameDiff - aGameDiff;
  });

  return { ...tournament, standings };
}

/**
 * Get tournament progress statistics.
 */
export function getTournamentProgress(tournament) {
  let totalMatches = 0;
  let completedMatches = 0;
  let inProgressMatches = 0;

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (!match.isBye) {
        totalMatches++;
        if (match.winnerId) {
          completedMatches++;
        } else if (match.matchId) {
          inProgressMatches++;
        }
      }
    }
  }

  return {
    totalMatches,
    completedMatches,
    inProgressMatches,
    pendingMatches: totalMatches - completedMatches - inProgressMatches,
    percentComplete: totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0,
  };
}
