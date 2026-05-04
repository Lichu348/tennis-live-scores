# Tennis Live Scores - Feature Plan: Doubles & Draws

## Overview

Two major features to make the app viable for serious club use:
1. **Doubles Support** - 4-player matches with correct serving rotation
2. **Draw Management** - Pre-loaded tournament brackets with auto-progression

---

## Feature 1: Doubles Support

### Current State
- Only supports 2 players (singles)
- Server alternates every game between the two players
- Tiebreak rotation assumes singles rules

### Target State
- Support both singles and doubles matches
- Doubles: 4 players in 2 teams
- Correct doubles serving rotation (4-player cycle)
- Correct doubles tiebreak rotation
- Team display on spectator screens

---

### Doubles Serving Rules

**Regular Games:**
```
Game 1: Team A, Player 1 serves
Game 2: Team B, Player 1 serves
Game 3: Team A, Player 2 serves
Game 4: Team B, Player 2 serves
Game 5: Team A, Player 1 serves (cycle repeats)
```

**Tiebreak:**
```
Point 1:    Team A, Player 1 serves (whoever is next in rotation)
Points 2-3: Team B, Player 1 serves
Points 4-5: Team A, Player 2 serves
Points 6-7: Team B, Player 2 serves
Points 8-9: Team A, Player 1 serves (cycle continues)
... switch sides every 6 points
```

After tiebreak, the player who served first in the tiebreak's partner serves first in the next set.

---

### Implementation

#### Phase 1: Data Model Changes

**File: `src/scoring.js`**

```javascript
// Current match structure
{
  players: ["Player 1", "Player 2"],
  server: 0,  // 0 or 1
  // ...
}

// New match structure
{
  matchType: "singles" | "doubles",

  // Singles: 2 players
  // Doubles: 4 players [Team1P1, Team1P2, Team2P1, Team2P2]
  players: ["Player 1", "Player 2"] | ["T1P1", "T1P2", "T2P1", "T2P2"],

  // Optional team names for doubles
  teams: null | ["Team 1 Name", "Team 2 Name"],

  // Server index (0-1 for singles, 0-3 for doubles)
  server: 0,

  // For doubles: tracks serving order within each team
  // [Team1 next server index (0 or 1), Team2 next server index (0 or 1)]
  doublesServerOrder: null | [0, 0],

  // ...rest unchanged
}
```

#### Phase 2: Scoring Logic Changes

**File: `src/scoring.js`**

New/Modified Functions:

| Function | Change |
|----------|--------|
| `createMatch(players, format, courtIdx, matchType, teams)` | Add matchType and teams params |
| `getNextServer(match)` | Handle 4-player rotation for doubles |
| `getNextServerAfterTiebreak(match)` | Handle doubles tiebreak → next set transition |
| `scorePoint(match, playerIdx)` | playerIdx is 0 or 1 (team index), not individual |
| `getTeamIndex(playerIdx)` | Helper: returns 0 for players 0-1, 1 for players 2-3 |

**Doubles Server Rotation Logic:**

```javascript
function getNextServerDoubles(match) {
  const totalGames = getTotalGamesInSet(match);
  const inTiebreak = isInTiebreak(match);

  if (inTiebreak) {
    return getNextServerDoublesTiebreak(match);
  }

  // Regular game rotation: 0 → 2 → 1 → 3 → 0 → ...
  // (Team1P1 → Team2P1 → Team1P2 → Team2P2)
  const serverOrder = [0, 2, 1, 3];
  return serverOrder[totalGames % 4];
}

function getNextServerDoublesTiebreak(match) {
  const tiebreakPoints = getTiebreakPoints(match);

  // First point: next in normal rotation
  if (tiebreakPoints === 0) {
    return getNextServerDoubles(match);
  }

  // After first point: rotate every 2 points
  // But within 4-player cycle
  const serverAtStart = match.tiebreakFirstServer;
  const rotationIndex = Math.floor((tiebreakPoints + 1) / 2) % 4;

  // Cycle through all 4 players
  const serverOrder = getDoublesServerCycle(serverAtStart);
  return serverOrder[rotationIndex];
}
```

#### Phase 3: UI Changes - Match Setup

**File: `src/UmpireMode.jsx`**

Match Creation Form:

```
┌─────────────────────────────────────┐
│  Match Type                         │
│  ┌─────────┐  ┌─────────┐          │
│  │ Singles │  │ Doubles │          │
│  └─────────┘  └─────────┘          │
├─────────────────────────────────────┤
│  [If Singles - current UI]         │
│  Player 1: [____________]          │
│  Player 2: [____________]          │
├─────────────────────────────────────┤
│  [If Doubles]                       │
│                                     │
│  Team 1 Name: [____________] (opt)  │
│  Player 1:    [____________]        │
│  Player 2:    [____________]        │
│                                     │
│  Team 2 Name: [____________] (opt)  │
│  Player 1:    [____________]        │
│  Player 2:    [____________]        │
│                                     │
│  First Server: [Dropdown - 4 opts]  │
├─────────────────────────────────────┤
│  Court: [______]  Format: [Bo3/Bo5] │
│                                     │
│         [ Start Match ]             │
└─────────────────────────────────────┘
```

#### Phase 4: UI Changes - Scoring Screen

**File: `src/UmpireMode.jsx`**

Doubles Scoring Interface:

```
┌─────────────────────────────────────┐
│  Centre Court        HISTORY · BACK │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │   Smith / Jones             │    │  ← Tap for Team 1 point
│  │   (Serving: Smith ●)        │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   Brown / Davis             │    │  ← Tap for Team 2 point
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│           30 — 40                   │
├─────────────────────────────────────┤
│  Team           │ S1 │ S2 │ Pts │   │
│  Smith/Jones    │  6 │  3 │  30 │   │
│  Brown/Davis    │  4 │  5 │  40 │   │
├─────────────────────────────────────┤
│  ↶ UNDO      HISTORY      ADJUST    │
└─────────────────────────────────────┘
```

Key UI decisions:
- Show "PlayerA / PlayerB" or team name if provided
- Indicate current server by name within the team
- Point buttons are per-team (2 buttons, not 4)

#### Phase 5: UI Changes - Spectator Display

**File: `src/SpectatorMode.jsx`**

```
┌─────────────────────────────────────┐
│  CENTRE COURT              ● LIVE   │
├─────────────────────────────────────┤
│  ● Smith / Jones      6  4  30      │
│    Brown / Davis      4  6  15      │
└─────────────────────────────────────┘
```

- Use "/" separator for doubles
- Or show team name if provided
- Server dot appears next to serving team

#### Phase 6: Score Adjustment for Doubles

**File: `src/ScoreAdjustModal.jsx`**

- Add server selection from 4 players (not 2)
- Validate serving order is consistent with game count

---

### Doubles Test Cases

```javascript
describe('Doubles scoring', () => {
  test('creates doubles match with 4 players');
  test('server rotates through 4 players correctly');
  test('tiebreak server rotation follows doubles rules');
  test('post-tiebreak server is partner of tiebreak starter');
  test('scorePoint accepts team index 0 or 1');
  test('undo preserves doubles server state');
  test('setScore validates doubles server position');
});
```

---

### Migration & Compatibility

- Existing matches: `matchType` defaults to `"singles"` if undefined
- No migration needed - additive schema change
- Spectator mode auto-detects doubles by `players.length === 4`

---

## Feature 2: Draw Management

### Current State
- Umpires manually create each match
- No concept of tournament/event
- No bracket progression
- Results aren't preserved after 24h cleanup

### Target State
- Create tournaments with pre-defined draws
- Support multiple draw formats
- Auto-generate matches from draws
- Auto-progress winners through bracket
- Standings and results tracking
- Optional integration with external systems

---

### Draw Formats to Support

| Format | Description | Use Case |
|--------|-------------|----------|
| **Single Elimination** | Lose once, you're out | Quick tournaments, championships |
| **Double Elimination** | Must lose twice to be eliminated | Fairer tournaments |
| **Round Robin** | Everyone plays everyone | League play, small groups |
| **Group + Knockout** | Round robin groups → single elim | Larger tournaments |
| **Compass Draw** | Losers continue in consolation | Maximize matches for players |

**Phase 1:** Single Elimination + Round Robin
**Phase 2:** Group + Knockout, Double Elimination
**Phase 3:** Compass Draw, custom formats

---

### Data Model

#### Tournament/Event

```javascript
// New collection: /tournaments/{tournamentId}
{
  id: "t-abc123",
  name: "Club Championships 2026",
  startDate: "2026-05-10",
  endDate: "2026-05-11",

  // Draw configuration
  format: "single_elimination" | "round_robin" | "group_knockout",
  drawSize: 16,  // Number of players/teams
  bestOf: 3,     // Match format
  matchType: "singles" | "doubles",

  // State
  status: "draft" | "published" | "in_progress" | "completed",

  // Players/teams (seeded order)
  entries: [
    { id: "e1", name: "J. Smith", seed: 1 },
    { id: "e2", name: "A. Jones", seed: 2 },
    // ...
  ],

  // For round robin: group assignments
  groups: null | [
    { name: "Group A", entries: ["e1", "e4", "e5", "e8"] },
    { name: "Group B", entries: ["e2", "e3", "e6", "e7"] },
  ],

  // Bracket structure (generated)
  rounds: [
    {
      name: "Round of 16",
      matches: [
        { position: 1, entry1: "e1", entry2: "e16", matchId: null },
        { position: 2, entry1: "e8", entry2: "e9", matchId: null },
        // ...
      ]
    },
    {
      name: "Quarter-Finals",
      matches: [
        { position: 1, entry1: null, entry2: null, matchId: null }, // Winner of R16-1 vs R16-2
        // ...
      ]
    },
    // ...
  ],

  // Scheduling
  scheduledMatches: [
    { matchPosition: "R16-1", court: 0, time: "09:00" },
    // ...
  ],

  createdAt: timestamp,
  createdBy: "session-xyz",
}
```

#### Match Enhancement

```javascript
// Existing match, enhanced
{
  // ...existing fields...

  // Tournament linkage (optional)
  tournamentId: null | "t-abc123",
  roundName: null | "Quarter-Final",
  matchPosition: null | "QF-2",

  // Entry references (for auto-progression)
  entry1Id: null | "e1",
  entry2Id: null | "e2",

  // Result (set when match completes)
  winnerId: null | "e1",
}
```

---

### Implementation Phases

#### Phase 1: Tournament Shell (No Draw Logic)

Create basic tournament CRUD without bracket generation.

**New Files:**
- `src/TournamentMode.jsx` - Tournament list and management
- `src/TournamentCreate.jsx` - Create/edit tournament form
- `src/TournamentView.jsx` - View tournament details and matches

**Firebase Functions:**
```javascript
// src/firebase.js additions
export function createTournament(tournament) { }
export function updateTournament(id, updates) { }
export function deleteTournament(id) { }
export function subscribeTournament(id, callback) { }
export function listTournaments(callback) { }
```

**UI Flow:**
```
Home → Tournament Mode →
  ├── [Create Tournament]
  ├── [Active Tournaments List]
  └── [Tournament] → View Details → [Manually Create Matches]
```

#### Phase 2: Single Elimination Draw

Auto-generate bracket from seeded entry list.

**New File: `src/drawGenerator.js`**

```javascript
/**
 * Generate single elimination bracket
 * Handles seeding, byes, and bracket positions
 */
export function generateSingleElimination(entries, drawSize) {
  // drawSize must be power of 2: 4, 8, 16, 32, 64
  // entries.length can be less (creates byes)

  // Standard seeding positions for power-of-2 draws
  // e.g., 8-draw: [1,8,4,5,3,6,2,7] ensures seeds don't meet early

  return {
    rounds: [
      {
        name: getRoundName(drawSize, 0), // "Round of 16"
        matches: [
          { position: 1, entry1: "seed1", entry2: "seed16_or_bye" },
          // ...
        ]
      },
      // ...
    ]
  };
}

export function advanceWinner(tournament, matchPosition, winnerId) {
  // Find next round match
  // Set winner as entry1 or entry2 in next match
  // Return updated tournament
}
```

**Bracket Visualization:**

```
┌─────────────────────────────────────────────────────────┐
│  CLUB CHAMPIONSHIPS - SINGLES                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Round of 8        Quarter-Final     Semi-Final  Final │
│                                                         │
│  [1] Smith ────┐                                       │
│                ├── Smith ────┐                         │
│  [8] Wilson ───┘             │                         │
│                              ├── Smith ────┐           │
│  [4] Brown ────┐             │             │           │
│                ├── Brown ────┘             │           │
│  [5] Davis ────┘                           │           │
│                                            ├── ????    │
│  [3] Jones ────┐                           │           │
│                ├── Jones ────┐             │           │
│  [6] Clark ────┘             │             │           │
│                              ├── ???? ────┘           │
│  [2] Taylor ───┐             │                         │
│                ├── ???? ────┘                         │
│  [7] Moore ────┘                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**File: `src/BracketView.jsx`**

- Visual bracket display
- Click match to: create/open scoring, view result
- Live updates as matches complete
- Responsive for mobile (vertical scroll) and TV (full bracket)

#### Phase 3: Round Robin

**Algorithm:**
```javascript
export function generateRoundRobin(entries) {
  // Classic circle method
  // n players → n-1 rounds (or n rounds if odd, with bye)
  // Each round has n/2 matches

  // Returns all matches upfront (unlike knockout)
  return {
    rounds: [
      { name: "Round 1", matches: [...] },
      { name: "Round 2", matches: [...] },
      // ...
    ]
  };
}
```

**Standings Table:**

```
┌──────────────────────────────────────────────────────────┐
│  GROUP A STANDINGS                                        │
├──────────────────────────────────────────────────────────┤
│  #  Player       P   W   L   Sets+  Sets-  Games+  Games-│
│  1  Smith        3   3   0   6      1      42      28    │
│  2  Jones        3   2   1   4      3      38      32    │
│  3  Brown        3   1   2   3      4      35      36    │
│  4  Davis        3   0   3   0      6      22      41    │
└──────────────────────────────────────────────────────────┘
```

**File: `src/StandingsTable.jsx`**

- Sortable by wins, then set difference, then game difference
- Head-to-head tiebreaker option
- Highlight qualified positions (top 2 advance)

#### Phase 4: Match Auto-Creation

When umpire is ready to score a bracket match:

1. Umpire taps match in bracket view
2. If match doesn't exist yet:
   - Auto-create match with pre-filled player names
   - Pre-fill court if scheduled
   - Link match to tournament position
3. Open scoring interface
4. On match completion:
   - `winnerId` set automatically
   - `advanceWinner()` called to update bracket
   - Next round match becomes available

```javascript
async function startBracketMatch(tournament, matchPosition) {
  const bracketMatch = findBracketMatch(tournament, matchPosition);

  if (!bracketMatch.entry1 || !bracketMatch.entry2) {
    throw new Error("Previous matches not complete");
  }

  // Create live match
  const match = createMatch(
    getPlayerNames(tournament, bracketMatch),
    tournament.bestOf,
    getScheduledCourt(tournament, matchPosition),
    tournament.matchType
  );

  // Link to tournament
  match.tournamentId = tournament.id;
  match.matchPosition = matchPosition;
  match.entry1Id = bracketMatch.entry1;
  match.entry2Id = bracketMatch.entry2;

  const matchId = await saveMatch(match);

  // Update tournament with match reference
  await updateBracketMatchId(tournament.id, matchPosition, matchId);

  return matchId;
}
```

#### Phase 5: Scheduling

**Schedule Creation UI:**

```
┌─────────────────────────────────────────────────────────┐
│  SCHEDULE - SATURDAY 10 MAY                             │
├─────────────────────────────────────────────────────────┤
│  TIME    COURT 1         COURT 2         COURT 3        │
├─────────────────────────────────────────────────────────┤
│  09:00   R16: Smith v    R16: Jones v    R16: Brown v   │
│          Wilson          Clark           Davis          │
│                                                         │
│  10:30   R16: Taylor v   R16: Moore v    R16: Evans v   │
│          Adams           White           Green          │
│                                                         │
│  12:00   QF1             QF2             QF3            │
│          (TBD)           (TBD)           (TBD)          │
│                                                         │
│  14:00   SF1             SF2             --             │
│          (TBD)           (TBD)                          │
│                                                         │
│  16:00   FINAL           --              --             │
│          (TBD)                                          │
└─────────────────────────────────────────────────────────┘
```

**File: `src/ScheduleView.jsx`**

- Drag-and-drop match assignment
- Time slot grid by court
- Conflict detection (player in two places)
- Print-friendly view for posting

#### Phase 6: Results & History

**Tournament Results:**

- Final standings/bracket preserved after completion
- Export to CSV/PDF
- Integration hooks for external systems

```javascript
export function exportTournamentResults(tournament) {
  return {
    name: tournament.name,
    date: tournament.startDate,
    format: tournament.format,
    winner: getWinner(tournament),
    finalist: getFinalist(tournament),
    results: getAllMatchResults(tournament),
  };
}
```

---

### UI Navigation Update

**Home Screen:**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│             TENNIS LIVE SCORES                          │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   UMPIRE    │  │  SPECTATOR  │  │    ADMIN    │     │
│  │    MODE     │  │    MODE     │  │    MODE     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              TOURNAMENTS                         │   │
│  │  View draws, schedule, and start matches        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Tournament Mode Flow:**

```
Tournaments List
  ├── [Create New] → Tournament Setup Wizard
  │     ├── Step 1: Name, dates, format
  │     ├── Step 2: Add entries (manual or import)
  │     ├── Step 3: Seeding
  │     ├── Step 4: Generate draw
  │     └── Step 5: Schedule (optional)
  │
  └── [Tournament] → Tournament Dashboard
        ├── Draw/Bracket Tab
        │     └── Click match → Create & Score
        ├── Schedule Tab
        ├── Standings Tab (round robin)
        └── Settings Tab
              ├── Edit entries
              ├── Regenerate draw
              └── Delete tournament
```

---

### File Structure

```
src/
├── scoring.js                 # Enhanced for doubles
├── drawGenerator.js           # NEW: Bracket generation algorithms
├── tournamentUtils.js         # NEW: Tournament helpers
│
├── TournamentMode.jsx         # NEW: Tournament list
├── TournamentCreate.jsx       # NEW: Create wizard
├── TournamentView.jsx         # NEW: Tournament dashboard
├── BracketView.jsx            # NEW: Visual bracket
├── ScheduleView.jsx           # NEW: Schedule grid
├── StandingsTable.jsx         # NEW: Round robin standings
│
├── UmpireMode.jsx             # Enhanced for doubles + tournament matches
├── SpectatorMode.jsx          # Enhanced for doubles display
├── ScoreAdjustModal.jsx       # Enhanced for doubles
│
└── firebase.js                # Tournament CRUD functions
```

---

### Implementation Order

| PR | Feature | Complexity | Dependencies |
|----|---------|------------|--------------|
| **PR 1** | Doubles data model + scoring logic | Medium | None |
| **PR 2** | Doubles UI (setup + scoring) | Medium | PR 1 |
| **PR 3** | Doubles spectator display | Low | PR 1 |
| **PR 4** | Tournament CRUD + basic UI | Medium | None |
| **PR 5** | Single elimination generator | Medium | PR 4 |
| **PR 6** | Bracket visualization | Medium | PR 5 |
| **PR 7** | Match auto-creation from bracket | Medium | PR 6 |
| **PR 8** | Round robin generator + standings | Medium | PR 4 |
| **PR 9** | Scheduling UI | Medium | PR 7 |
| **PR 10** | Results export | Low | PR 7, PR 8 |

---

### Testing Strategy

**Doubles:**
- Unit tests for all server rotation scenarios
- Unit tests for tiebreak edge cases
- Integration tests for full doubles match flow

**Draws:**
- Unit tests for bracket generation (various sizes, byes)
- Unit tests for round robin scheduling
- Unit tests for winner advancement
- Integration tests for full tournament flow

---

### Migration Notes

- All changes are additive
- Existing matches/functionality unaffected
- `matchType` defaults to `"singles"` for existing matches
- Tournaments are a new collection, no migration needed

---

## Summary

| Feature | New Files | Modified Files | Estimated Effort |
|---------|-----------|----------------|------------------|
| **Doubles** | 0 | 4 (scoring.js, UmpireMode, SpectatorMode, ScoreAdjust) | 2-3 days |
| **Tournaments** | 7 | 3 (firebase.js, App.jsx, UmpireMode) | 5-7 days |

**Total: ~10 days of development**

### Quick Wins First

1. **Doubles** is the simpler feature and unlocks a huge use case
2. **Tournament shell** (without draw generation) lets clubs at least organize matches
3. **Single elimination** covers most club tournaments
4. **Round robin** handles leagues

### Future Considerations

- LTA/Tennis Link integration (API availability unknown)
- Player database (avoid retyping names)
- Historical results archive
- Mobile app (React Native wrapper)
