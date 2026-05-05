import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, Trophy, Play, Users, Clock, Check, ChevronRight,
  CircleDot, Undo2, Edit3, History, AlertTriangle
} from "lucide-react";
import {
  subscribeToTournament, subscribeToMatch, updateBracketMatch,
  saveMatch, removeMatch, acquireLock, refreshLock, checkMatchLock,
  updateTournament
} from "./firebase";
import {
  getEntryById, isMatchReady, advanceWinner, getTournamentProgress,
  getMatchEntryNames, updateRoundRobinStandings
} from "./drawGenerator";
import {
  createMatch, scorePoint, undoPoint, getPointDisplay, isDeuce, getAlerts,
  replayEvents, isDoubles, getTeamDisplayName, getTeamIndex
} from "./scoring";
import ScoreTable from "./ScoreTable";
import ScoreAdjustModal from "./ScoreAdjustModal";
import HistoryModal from "./HistoryModal";
import { S, COURT_COLORS } from "./styles";

export default function TournamentView({ tournament: initialTournament, onBack }) {
  const [tournament, setTournament] = useState(initialTournament);
  const [view, setView] = useState("bracket"); // "bracket" | "scoring"
  const [activeMatch, setActiveMatch] = useState(null);
  const [activeBracketPosition, setActiveBracketPosition] = useState(null); // { roundIndex, matchPosition }

  // Scoring state (when in scoring view)
  const [lockConflict, setLockConflict] = useState(null);
  const [showScoreAdjust, setShowScoreAdjust] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Pending resume - awaiting user confirmation before taking over locked match
  const [pendingResume, setPendingResume] = useState(null);

  // Subscribe to tournament updates
  useEffect(() => {
    if (!tournament?.id) return;

    const unsub = subscribeToTournament(tournament.id, (updated) => {
      if (updated) {
        setTournament(updated);
      }
    });

    return unsub;
  }, [tournament?.id]);

  // Subscribe to active match for lock detection
  useEffect(() => {
    if (!activeMatch?.id) return;

    const unsub = subscribeToMatch(activeMatch.id, (remoteMatch) => {
      if (!remoteMatch) return;

      const lock = checkMatchLock(remoteMatch);
      if (lock && lock.isLocked && !lock.isStale) {
        setLockConflict({
          lockedBy: lock.lockedBy,
          isStale: false,
          message: "Another device is scoring this match",
        });
      }
    });

    return unsub;
  }, [activeMatch?.id]);

  /**
   * Start scoring a bracket match.
   * Creates a new match in Firebase linked to this tournament/bracket position.
   */
  const handleStartMatch = useCallback((roundIndex, matchPosition) => {
    const bracketMatch = tournament.rounds[roundIndex]?.matches[matchPosition - 1];
    if (!bracketMatch) return;

    const entry1 = getEntryById(tournament, bracketMatch.entry1);
    const entry2 = getEntryById(tournament, bracketMatch.entry2);

    if (!entry1 || !entry2) {
      console.error("Missing entries for match");
      return;
    }

    // Determine if doubles based on entry names (e.g., "Player1/Player2")
    const isDoublesMatch = tournament.matchType === "doubles";

    let match;
    if (isDoublesMatch) {
      // Parse team names - expect "Player1/Player2" format
      const team1Players = entry1.name.split("/").map(s => s.trim());
      const team2Players = entry2.name.split("/").map(s => s.trim());

      const players = [
        team1Players[0] || entry1.name,
        team1Players[1] || "",
        team2Players[0] || entry2.name,
        team2Players[1] || "",
      ];

      match = createMatch(players, null, 0, tournament.bestOf || 3, {
        matchType: "doubles",
        teams: [entry1.name, entry2.name],
        tournamentId: tournament.id,
        bracketRound: roundIndex,
        bracketPosition: matchPosition,
      });
    } else {
      match = createMatch(entry1.name, entry2.name, 0, tournament.bestOf || 3, {
        tournamentId: tournament.id,
        bracketRound: roundIndex,
        bracketPosition: matchPosition,
      });
    }

    // Add entry IDs for bracket tracking
    match.entry1Id = entry1.id;
    match.entry2Id = entry2.id;

    const lockedMatch = acquireLock(match);
    setActiveMatch(lockedMatch);
    setActiveBracketPosition({ roundIndex, matchPosition });
    saveMatch(lockedMatch);

    // Update bracket to reference this match
    updateBracketMatch(tournament.id, roundIndex, matchPosition, {
      matchId: lockedMatch.id,
    });

    setView("scoring");
  }, [tournament]);

  /**
   * Resume an existing match from bracket.
   * If the match is locked by another device, we prompt for confirmation first.
   */
  const handleResumeMatch = useCallback(async (roundIndex, matchPosition, matchId) => {
    let isHandled = false; // Prevent double-handling from subscription

    const unsub = subscribeToMatch(matchId, (remoteMatch) => {
      if (!remoteMatch || isHandled) return;

      const lock = checkMatchLock(remoteMatch);

      // If locked by another device (non-stale), require confirmation
      if (lock && lock.isLocked && !lock.isStale) {
        isHandled = true;
        setPendingResume({
          roundIndex,
          matchPosition,
          matchId,
          lockedBy: lock.lockedBy,
        });
        unsub();
        return; // Don't acquire lock - wait for user confirmation
      }

      // Not locked or stale lock - proceed normally
      isHandled = true;
      let restored;
      if (remoteMatch.events && remoteMatch.events.length > 0) {
        restored = replayEvents(remoteMatch);
      } else {
        restored = { ...remoteMatch, history: [], events: [] };
      }

      const lockedMatch = acquireLock(restored);
      setActiveMatch(lockedMatch);
      setActiveBracketPosition({ roundIndex, matchPosition });
      saveMatch(lockedMatch);
      setView("scoring");
      unsub();
    });
  }, []);

  /**
   * Confirm taking over a locked match (after user explicitly approves).
   * Re-fetches latest match state to avoid using stale data.
   */
  const handleConfirmTakeover = useCallback(() => {
    if (!pendingResume) return;

    const { roundIndex, matchPosition, matchId } = pendingResume;

    // Re-fetch latest match state before takeover
    const unsub = subscribeToMatch(matchId, (remoteMatch) => {
      if (!remoteMatch) {
        unsub();
        return;
      }

      let restored;
      if (remoteMatch.events && remoteMatch.events.length > 0) {
        restored = replayEvents(remoteMatch);
      } else {
        restored = { ...remoteMatch, history: [], events: [] };
      }

      const lockedMatch = acquireLock(restored);
      setActiveMatch(lockedMatch);
      setActiveBracketPosition({ roundIndex, matchPosition });
      saveMatch(lockedMatch);
      setPendingResume(null);
      setView("scoring");
      unsub();
    });
  }, [pendingResume]);

  /**
   * Cancel takeover - dismiss the confirmation dialog.
   */
  const handleCancelTakeover = useCallback(() => {
    setPendingResume(null);
  }, []);

  /**
   * Handle scoring a point.
   */
  const handleScore = (teamIdx) => {
    if (lockConflict) return;

    setActiveMatch(prev => {
      const next = scorePoint(prev, teamIdx);
      const withLock = refreshLock(next);
      saveMatch(withLock);

      // Check if match just finished
      if (next.status === "finished") {
        handleMatchFinished(withLock);
      }

      return withLock;
    });
  };

  /**
   * Handle undo.
   */
  const handleUndo = () => {
    if (lockConflict) return;

    setActiveMatch(prev => {
      const next = undoPoint(prev);
      const withLock = refreshLock(next);
      saveMatch(withLock);
      return withLock;
    });
  };

  /**
   * Handle match completion - update bracket/standings based on tournament format.
   * Writes are awaited sequentially to prevent race conditions.
   */
  const handleMatchFinished = useCallback(async (match) => {
    if (!activeBracketPosition || !tournament) return;

    const { roundIndex, matchPosition } = activeBracketPosition;

    // Determine winner entry ID
    const winnerEntryId = match.winner === 0 ? match.entry1Id : match.entry2Id;

    try {
      // Handle round-robin differently - update standings only, don't touch other fixtures
      if (tournament.format === "round_robin") {
        // Calculate sets and games from the match scores
        const entry1Sets = match.sets.filter(s => s[0] > s[1]).length;
        const entry2Sets = match.sets.filter(s => s[1] > s[0]).length;
        const entry1Games = match.sets.reduce((sum, s) => sum + s[0], 0);
        const entry2Games = match.sets.reduce((sum, s) => sum + s[1], 0);

        // Update standings (returns new tournament with updated standings)
        const updatedTournament = updateRoundRobinStandings(tournament, roundIndex, matchPosition, {
          entry1Sets,
          entry2Sets,
          entry1Games,
          entry2Games,
        });

        // Persist updated standings to Firebase FIRST
        await updateTournament(tournament.id, { standings: updatedTournament.standings });

        // THEN update this specific match with winnerId
        await updateBracketMatch(tournament.id, roundIndex, matchPosition, {
          winnerId: winnerEntryId,
        });
        return;
      }

      // Single elimination (knockout) - advance winner to next round
      const updated = advanceWinner(tournament, roundIndex, matchPosition, winnerEntryId);

      // Save winnerId to Firebase FIRST
      await updateBracketMatch(tournament.id, roundIndex, matchPosition, {
        winnerId: winnerEntryId,
      });

      // THEN update next round slot if applicable
      if (roundIndex + 1 < updated.rounds.length) {
        const nextMatchPosition = Math.ceil(matchPosition / 2);
        const isFirstSlot = matchPosition % 2 === 1;
        const nextMatch = updated.rounds[roundIndex + 1].matches[nextMatchPosition - 1];

        await updateBracketMatch(tournament.id, roundIndex + 1, nextMatchPosition, {
          entry1: isFirstSlot ? winnerEntryId : nextMatch.entry1,
          entry2: isFirstSlot ? nextMatch.entry2 : winnerEntryId,
        });
      }
    } catch (err) {
      console.error("Failed to update tournament after match completion:", err);
    }
  }, [activeBracketPosition, tournament]);

  /**
   * Return to bracket view.
   */
  const handleBackToBracket = () => {
    setActiveMatch(null);
    setActiveBracketPosition(null);
    setLockConflict(null);
    setShowScoreAdjust(false);
    setShowHistory(false);
    setView("bracket");
  };

  /**
   * Score adjustment handler.
   */
  const handleScoreAdjust = useCallback((newMatch) => {
    const lockedMatch = acquireLock(newMatch);
    setActiveMatch(lockedMatch);
    saveMatch(lockedMatch);
    setShowScoreAdjust(false);
  }, []);

  /**
   * History rewind handler.
   */
  const handleRewind = useCallback((newMatch) => {
    const lockedMatch = acquireLock(newMatch);
    setActiveMatch(lockedMatch);
    saveMatch(lockedMatch);
    setShowHistory(false);
  }, []);

  // ════════════════════════════════════════════════════════════════
  // SCORING VIEW
  // ════════════════════════════════════════════════════════════════
  if (view === "scoring" && activeMatch) {
    const cc = COURT_COLORS[activeMatch.courtIdx] || COURT_COLORS[0];
    const alerts = getAlerts(activeMatch);
    const hasMatchPoint = alerts.some(a => a.type === "matchPoint");
    const hasSetPoint = alerts.some(a => a.type === "setPoint");
    const hasBreakPoint = alerts.some(a => a.type === "breakPoint");

    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{
          padding: "12px 16px", display: "flex", justifyContent: "space-between",
          alignItems: "center", borderBottom: `1px solid ${S.border}`,
        }}>
          <button onClick={handleBackToBracket} style={backBtnSmall}>
            <ChevronLeft size={16} /> Bracket
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(activeMatch.events?.length > 0) && (
              <button onClick={() => setShowHistory(true)} style={iconBtn}>
                <History size={14} />
              </button>
            )}
            {activeMatch.status === "live" && (
              <button onClick={() => setShowScoreAdjust(true)} style={iconBtn}>
                <Edit3 size={14} /> Adjust
              </button>
            )}
            <button
              onClick={handleUndo}
              disabled={!activeMatch.history?.length}
              style={{
                ...iconBtn,
                color: activeMatch.history?.length ? S.text : S.textDim,
                opacity: activeMatch.history?.length ? 1 : 0.4,
              }}
            >
              <Undo2 size={14} /> Undo
            </button>
          </div>
        </div>

        {/* Score adjustment modal */}
        {showScoreAdjust && (
          <ScoreAdjustModal
            match={activeMatch}
            onSubmit={handleScoreAdjust}
            onCancel={() => setShowScoreAdjust(false)}
          />
        )}

        {/* History viewer modal */}
        {showHistory && (
          <HistoryModal
            match={activeMatch}
            onRewind={handleRewind}
            onCancel={() => setShowHistory(false)}
          />
        )}

        {/* Lock conflict banner */}
        {lockConflict && (
          <div style={{
            padding: "12px 16px", textAlign: "center",
            background: "#dc262622", borderBottom: `1px solid #dc2626`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <AlertTriangle size={16} color={S.red} />
            <span style={{ color: S.red, fontSize: 13 }}>
              {lockConflict.message}
            </span>
          </div>
        )}

        {/* Alert banner */}
        {alerts.length > 0 && activeMatch.status === "live" && !lockConflict && (
          <div style={{
            padding: "8px 16px", textAlign: "center",
            fontFamily: "'Oswald', sans-serif", fontSize: 15,
            fontWeight: 600, textTransform: "uppercase", letterSpacing: 2,
            background: hasMatchPoint
              ? "linear-gradient(90deg, #b91c1c, #dc2626)"
              : hasSetPoint
                ? "linear-gradient(90deg, #b45309, #d97706)"
                : hasBreakPoint
                  ? "linear-gradient(90deg, #6d28d9, #7c3aed)"
                  : `linear-gradient(90deg, ${cc.bg}, ${cc.accent})`,
            color: "#fff",
            animation: hasMatchPoint ? "pulse 1.5s ease-in-out infinite" : "none",
          }}>
            {alerts
              .map(a =>
                a.type === "matchPoint" ? "Match Point"
                  : a.type === "setPoint" ? "Set Point"
                    : a.type === "breakPoint" ? "Break Point"
                      : "Tiebreak"
              )
              .join(" · ")}
          </div>
        )}

        {/* Scoreboard */}
        <div style={{ padding: "12px 16px" }}>
          <ScoreTable match={activeMatch} compact={false} />
        </div>

        {/* Current game points */}
        <div style={{ textAlign: "center", padding: "0 16px 16px" }}>
          {isDeuce(activeMatch) ? (
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: S.gold, fontWeight: 600 }}>
              DEUCE
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
              {[0, 1].map(pi => (
                <div key={pi}>
                  <div style={{ fontSize: 11, color: S.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
                    {activeMatch.isTiebreak ? "TB" : "Points"}
                  </div>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 36, fontWeight: 700, color: S.text }}>
                    {getPointDisplay(activeMatch, pi)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Match finished */}
        {activeMatch.status === "finished" && (
          <div style={{ textAlign: "center", padding: 20 }}>
            <Trophy size={40} color={S.gold} style={{ margin: "0 auto 8px" }} />
            <div style={{
              fontFamily: "'Oswald', sans-serif", fontSize: 26,
              fontWeight: 700, color: S.gold, textTransform: "uppercase",
            }}>
              {getTeamDisplayName(activeMatch, activeMatch.winner)} Wins
            </div>
            <button onClick={handleBackToBracket} style={{
              marginTop: 20, padding: "14px 28px", background: S.surface,
              border: `1px solid ${S.border}`, borderRadius: 10, color: S.text,
              fontSize: 15, cursor: "pointer", fontFamily: "'Oswald', sans-serif",
              fontWeight: 500, textTransform: "uppercase", letterSpacing: 1,
            }}>
              Back to Bracket
            </button>
          </div>
        )}

        {/* Big tap-target scoring buttons */}
        {activeMatch.status === "live" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: "auto" }}>
            {[0, 1].map(teamIdx => {
              const isServingTeam = isDoubles(activeMatch)
                ? getTeamIndex(activeMatch.server) === teamIdx
                : activeMatch.server === teamIdx;

              return (
                <button key={teamIdx} onClick={() => handleScore(teamIdx)} style={{
                  flex: 1, minHeight: 120, border: "none", cursor: "pointer",
                  background: teamIdx === 0
                    ? `linear-gradient(180deg, ${cc.bg}dd, ${cc.bg})`
                    : `linear-gradient(180deg, ${S.surfaceLight}, ${S.surface})`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                  borderTop: teamIdx === 1 ? `1px solid ${S.border}` : "none",
                  transition: "filter 0.1s",
                }}
                  onMouseDown={e => e.currentTarget.style.filter = "brightness(1.3)"}
                  onMouseUp={e => e.currentTarget.style.filter = "brightness(1)"}
                  onTouchStart={e => e.currentTarget.style.filter = "brightness(1.3)"}
                  onTouchEnd={e => e.currentTarget.style.filter = "brightness(1)"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isServingTeam && <CircleDot size={16} color={S.goldBright} />}
                    <span style={{
                      fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 600,
                      color: "#fff", textTransform: "uppercase", letterSpacing: 1,
                    }}>
                      {getTeamDisplayName(activeMatch, teamIdx)}
                    </span>
                  </div>
                  {isDoubles(activeMatch) && isServingTeam && (
                    <span style={{
                      fontSize: 12, color: S.goldBright, fontWeight: 500,
                      fontFamily: "'Barlow', sans-serif",
                    }}>
                      Serving: {activeMatch.players[activeMatch.server]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }`}</style>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // BRACKET VIEW
  // ════════════════════════════════════════════════════════════════
  const progress = tournament.rounds ? getTournamentProgress(tournament) : null;
  const isRoundRobin = tournament.format === "round_robin";

  return (
    <div style={{ padding: 20, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={onBack} style={backBtn}>
          <ChevronLeft size={18} /> Back
        </button>

        <div style={{
          fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700,
          color: S.gold, textTransform: "uppercase", letterSpacing: 1,
          marginBottom: 4,
        }}>
          {tournament.name}
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 13, color: S.textDim, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Users size={14} />
            {tournament.entries?.length || 0} {tournament.matchType === "doubles" ? "teams" : "players"}
          </span>
          {progress && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={14} />
              {progress.completedMatches}/{progress.totalMatches} matches
            </span>
          )}
          {tournament.format && (
            <span style={{
              padding: "2px 8px", borderRadius: 4,
              background: S.surfaceLight, fontSize: 11,
              textTransform: "uppercase",
            }}>
              {tournament.format.replace("_", " ")}
            </span>
          )}
        </div>
      </div>

      {/* Bracket / Round Robin Display */}
      {isRoundRobin ? (
        <RoundRobinView tournament={tournament} onStartMatch={handleStartMatch} onResumeMatch={handleResumeMatch} />
      ) : (
        <BracketView tournament={tournament} onStartMatch={handleStartMatch} onResumeMatch={handleResumeMatch} />
      )}

      {/* Lock Takeover Confirmation Modal */}
      {pendingResume && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: S.surface, borderRadius: 16, padding: 24,
            maxWidth: 360, width: "100%", border: `1px solid ${S.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <AlertTriangle size={24} color={S.gold} />
              <div style={{
                fontFamily: "'Oswald', sans-serif", fontSize: 18,
                fontWeight: 600, color: S.text, textTransform: "uppercase",
              }}>
                Match In Progress
              </div>
            </div>
            <p style={{ color: S.textDim, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              This match is currently being scored by <strong style={{ color: S.text }}>{pendingResume.lockedBy}</strong>.
              Taking over will disconnect their session.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleCancelTakeover} style={{
                flex: 1, padding: "12px 16px", borderRadius: 8,
                background: S.surfaceLight, border: `1px solid ${S.border}`,
                color: S.text, fontSize: 14, cursor: "pointer",
                fontFamily: "'Barlow', sans-serif",
              }}>
                Cancel
              </button>
              <button onClick={handleConfirmTakeover} style={{
                flex: 1, padding: "12px 16px", borderRadius: 8,
                background: S.gold, border: "none",
                color: S.bg, fontSize: 14, fontWeight: 600, cursor: "pointer",
                fontFamily: "'Barlow', sans-serif",
              }}>
                Take Over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// BRACKET VIEW COMPONENT (Single Elimination)
// ════════════════════════════════════════════════════════════════
function BracketView({ tournament, onStartMatch, onResumeMatch }) {
  if (!tournament.rounds?.length) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: S.textDim }}>
        No bracket generated yet.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{
        display: "flex", gap: 20, minWidth: "fit-content",
        paddingBottom: 20,
      }}>
        {tournament.rounds.map((round, roundIndex) => (
          <div key={roundIndex} style={{ minWidth: 200 }}>
            {/* Round header */}
            <div style={{
              fontFamily: "'Oswald', sans-serif", fontSize: 14,
              fontWeight: 600, color: S.gold, textTransform: "uppercase",
              letterSpacing: 1, marginBottom: 12, textAlign: "center",
            }}>
              {round.name}
            </div>

            {/* Matches in this round */}
            <div style={{
              display: "flex", flexDirection: "column", gap: 12,
              justifyContent: "space-around",
              minHeight: roundIndex === 0 ? "auto" : `${tournament.rounds[0].matches.length * 80}px`,
            }}>
              {round.matches.map((match, matchIdx) => (
                <BracketMatchCard
                  key={matchIdx}
                  tournament={tournament}
                  roundIndex={roundIndex}
                  matchPosition={matchIdx + 1}
                  match={match}
                  onStart={() => onStartMatch(roundIndex, matchIdx + 1)}
                  onResume={() => onResumeMatch(roundIndex, matchIdx + 1, match.matchId)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Champion display */}
        <div style={{ minWidth: 160, display: "flex", alignItems: "center" }}>
          <ChampionCard tournament={tournament} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// BRACKET MATCH CARD
// ════════════════════════════════════════════════════════════════
function BracketMatchCard({ tournament, roundIndex, matchPosition, match, onStart, onResume }) {
  const entry1 = match.entry1 ? getEntryById(tournament, match.entry1) : null;
  const entry2 = match.entry2 ? getEntryById(tournament, match.entry2) : null;
  const winner = match.winnerId ? getEntryById(tournament, match.winnerId) : null;

  const isReady = entry1 && entry2 && !match.winnerId;
  const isComplete = !!match.winnerId;
  const isInProgress = match.matchId && !match.winnerId;
  const isBye = match.isBye;

  return (
    <div style={{
      background: S.surface, borderRadius: 10,
      border: `1px solid ${isComplete ? S.green + "44" : isInProgress ? S.gold + "44" : S.border}`,
      overflow: "hidden",
    }}>
      {/* Entry slots */}
      {[entry1, entry2].map((entry, idx) => {
        const isWinner = winner && entry?.id === winner.id;
        const slot = idx === 0 ? match.entry1 : match.entry2;

        return (
          <div
            key={idx}
            style={{
              padding: "10px 12px",
              borderBottom: idx === 0 ? `1px solid ${S.border}` : "none",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: isWinner ? S.green + "22" : "transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {entry ? (
                <>
                  {entry.seed && entry.seed <= tournament.entries.length / 2 && (
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: S.gold + "33", color: S.gold,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 600,
                    }}>
                      {entry.seed}
                    </span>
                  )}
                  <span style={{
                    color: isWinner ? S.greenBright : S.text,
                    fontSize: 13, fontWeight: isWinner ? 600 : 400,
                  }}>
                    {entry.name}
                  </span>
                </>
              ) : slot === null ? (
                <span style={{ color: S.textDim, fontSize: 12, fontStyle: "italic" }}>
                  TBD
                </span>
              ) : (
                <span style={{ color: S.textDim, fontSize: 12, fontStyle: "italic" }}>
                  BYE
                </span>
              )}
            </div>
            {isWinner && <Check size={14} color={S.greenBright} />}
          </div>
        );
      })}

      {/* Action button */}
      {!isBye && (
        <div style={{
          padding: "8px 12px", borderTop: `1px solid ${S.border}`,
          background: S.surfaceLight,
        }}>
          {isComplete ? (
            <div style={{ fontSize: 11, color: S.greenBright, textAlign: "center" }}>
              Complete
            </div>
          ) : isInProgress ? (
            <button onClick={onResume} style={matchActionBtn}>
              <Play size={12} /> Resume
            </button>
          ) : isReady ? (
            <button onClick={onStart} style={matchActionBtn}>
              <Play size={12} /> Start Match
            </button>
          ) : (
            <div style={{ fontSize: 11, color: S.textDim, textAlign: "center" }}>
              Waiting for entries
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CHAMPION CARD
// ════════════════════════════════════════════════════════════════
function ChampionCard({ tournament }) {
  const finalRound = tournament.rounds?.[tournament.rounds.length - 1];
  const finalMatch = finalRound?.matches[0];
  const champion = finalMatch?.winnerId ? getEntryById(tournament, finalMatch.winnerId) : null;

  if (!champion) {
    return (
      <div style={{
        padding: 20, textAlign: "center",
        background: S.surface, borderRadius: 12,
        border: `1px dashed ${S.border}`,
      }}>
        <Trophy size={32} color={S.textDim} style={{ opacity: 0.3 }} />
        <div style={{
          marginTop: 8, fontSize: 12, color: S.textDim,
          textTransform: "uppercase", letterSpacing: 1,
        }}>
          Champion
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: 20, textAlign: "center",
      background: `linear-gradient(135deg, ${S.gold}22, ${S.gold}11)`,
      borderRadius: 12, border: `2px solid ${S.gold}`,
    }}>
      <Trophy size={32} color={S.gold} />
      <div style={{
        marginTop: 8, fontFamily: "'Oswald', sans-serif",
        fontSize: 11, color: S.gold, textTransform: "uppercase",
        letterSpacing: 2,
      }}>
        Champion
      </div>
      <div style={{
        marginTop: 4, fontFamily: "'Oswald', sans-serif",
        fontSize: 18, fontWeight: 600, color: S.text,
      }}>
        {champion.name}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ROUND ROBIN VIEW
// ════════════════════════════════════════════════════════════════
function RoundRobinView({ tournament, onStartMatch, onResumeMatch }) {
  const [expandedRound, setExpandedRound] = useState(0);

  if (!tournament.rounds?.length) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: S.textDim }}>
        No schedule generated yet.
      </div>
    );
  }

  return (
    <div>
      {/* Standings table */}
      {tournament.standings && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 16,
            fontWeight: 600, color: S.gold, marginBottom: 12,
            textTransform: "uppercase", letterSpacing: 1,
          }}>
            Standings
          </div>
          <div style={{
            background: S.surface, borderRadius: 10,
            border: `1px solid ${S.border}`, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Player</th>
                  <th style={thStyle}>P</th>
                  <th style={thStyle}>W</th>
                  <th style={thStyle}>L</th>
                  <th style={thStyle}>Sets</th>
                </tr>
              </thead>
              <tbody>
                {tournament.standings.map((s, idx) => (
                  <tr key={s.entryId} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td style={tdStyle}>{idx + 1}</td>
                    <td style={{ ...tdStyle, textAlign: "left", fontWeight: 500 }}>{s.name}</td>
                    <td style={tdStyle}>{s.played}</td>
                    <td style={{ ...tdStyle, color: S.greenBright }}>{s.won}</td>
                    <td style={{ ...tdStyle, color: S.red }}>{s.lost}</td>
                    <td style={tdStyle}>{s.setsWon}-{s.setsLost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rounds accordion */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tournament.rounds.map((round, roundIndex) => (
          <div key={roundIndex} style={{
            background: S.surface, borderRadius: 10,
            border: `1px solid ${S.border}`, overflow: "hidden",
          }}>
            {/* Round header */}
            <button
              onClick={() => setExpandedRound(expandedRound === roundIndex ? -1 : roundIndex)}
              style={{
                width: "100%", padding: "12px 16px",
                background: "none", border: "none",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                cursor: "pointer",
              }}
            >
              <span style={{
                fontFamily: "'Oswald', sans-serif", fontSize: 14,
                fontWeight: 600, color: S.text,
              }}>
                {round.name}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: S.textDim }}>
                  {round.matches.filter(m => m.winnerId).length}/{round.matches.length}
                </span>
                <ChevronRight
                  size={16}
                  color={S.textDim}
                  style={{
                    transform: expandedRound === roundIndex ? "rotate(90deg)" : "rotate(0)",
                    transition: "transform 0.2s",
                  }}
                />
              </div>
            </button>

            {/* Round matches */}
            {expandedRound === roundIndex && (
              <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {round.matches.map((match, matchIdx) => {
                  const entry1 = getEntryById(tournament, match.entry1);
                  const entry2 = getEntryById(tournament, match.entry2);
                  const isComplete = !!match.winnerId;
                  const isInProgress = match.matchId && !match.winnerId;

                  return (
                    <div
                      key={matchIdx}
                      style={{
                        padding: "10px 12px", background: S.surfaceLight,
                        borderRadius: 8, display: "flex",
                        justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <div style={{ fontSize: 13, color: S.text }}>
                        {entry1?.name || "?"} vs {entry2?.name || "?"}
                      </div>
                      {isComplete ? (
                        <Check size={16} color={S.greenBright} />
                      ) : isInProgress ? (
                        <button
                          onClick={() => onResumeMatch(roundIndex, matchIdx + 1, match.matchId)}
                          style={matchActionBtnSmall}
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          onClick={() => onStartMatch(roundIndex, matchIdx + 1)}
                          style={matchActionBtnSmall}
                        >
                          Start
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════
const backBtn = {
  background: "none", border: "none", color: S.textDim,
  cursor: "pointer", display: "flex", alignItems: "center",
  gap: 6, marginBottom: 16, fontSize: 14, fontFamily: "'Barlow', sans-serif",
};

const backBtnSmall = {
  background: "none", border: "none", color: S.textDim,
  cursor: "pointer", display: "flex", alignItems: "center",
  gap: 4, fontSize: 13, fontFamily: "'Barlow', sans-serif",
};

const iconBtn = {
  padding: "6px 12px", background: S.surface, border: `1px solid ${S.border}`,
  borderRadius: 8, color: S.textDim, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 4, fontSize: 12,
  fontFamily: "'Barlow', sans-serif",
};

const matchActionBtn = {
  width: "100%", padding: "6px 10px", borderRadius: 6,
  background: S.green, border: "none", color: "#fff",
  fontSize: 12, cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center", gap: 4,
  fontFamily: "'Barlow', sans-serif", fontWeight: 500,
};

const matchActionBtnSmall = {
  padding: "4px 10px", borderRadius: 6,
  background: S.green, border: "none", color: "#fff",
  fontSize: 11, cursor: "pointer",
  fontFamily: "'Barlow', sans-serif", fontWeight: 500,
};

const thStyle = {
  padding: "10px 8px", fontSize: 11, color: S.textDim,
  textTransform: "uppercase", letterSpacing: 1, textAlign: "center",
};

const tdStyle = {
  padding: "10px 8px", fontSize: 13, color: S.text, textAlign: "center",
};
