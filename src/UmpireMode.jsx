import { useState, useEffect, useCallback } from "react";
import { Undo2, ChevronLeft, CircleDot, Trophy, RefreshCw, Lock, AlertTriangle, Edit3, History } from "lucide-react";
import {
  createMatch, scorePoint, undoPoint, getPointDisplay, isDeuce, getAlerts,
  replayEvents, formatScoreSummary, isDoubles, getTeamDisplayName, getTeamIndex
} from "./scoring";
import {
  saveMatch, removeMatch, subscribeToMatches, subscribeToMatch,
  checkMatchLock, acquireLock, refreshLock, releaseLock, getSessionId
} from "./firebase";
import ScoreTable from "./ScoreTable";
import ScoreAdjustModal from "./ScoreAdjustModal";
import HistoryModal from "./HistoryModal";
import { S, COURT_COLORS } from "./styles";

export default function UmpireMode({ onBack, onLock }) {
  const [match, setMatch] = useState(null);
  const [setup, setSetup] = useState({
    matchType: "singles",
    p1: "", p2: "", p3: "", p4: "",  // p1,p2 = team 1; p3,p4 = team 2 for doubles
    team1: "", team2: "",            // Optional team names
    court: 0, bestOf: 3
  });
  const [liveMatches, setLiveMatches] = useState([]);
  const [showResume, setShowResume] = useState(false);

  // Lock states
  const [lockConflict, setLockConflict] = useState(null); // { lockedBy, isStale }
  const [showTakeoverConfirm, setShowTakeoverConfirm] = useState(false);
  const [pendingResumeMatch, setPendingResumeMatch] = useState(null);

  // Score adjustment state
  const [showScoreAdjust, setShowScoreAdjust] = useState(false);

  // History viewer state
  const [showHistory, setShowHistory] = useState(false);

  /* ─── Load existing live matches for resume ─── */
  useEffect(() => {
    const unsub = subscribeToMatches(
      (all) => {
        setLiveMatches(all.filter(m => m.status === "live"));
      },
      (error) => {
        console.error("Failed to load matches:", error);
      }
    );
    return unsub;
  }, []);

  /* ─── Subscribe to match changes for conflict detection ─── */
  useEffect(() => {
    if (!match) return;

    const unsub = subscribeToMatch(match.id, (remoteMatch) => {
      if (!remoteMatch) return;

      const lock = checkMatchLock(remoteMatch);
      if (lock && lock.isLocked && !lock.isStale) {
        // Another session took over
        setLockConflict({
          lockedBy: lock.lockedBy,
          isStale: false,
          message: "Another device is scoring this match",
        });
      }
    });

    return unsub;
  }, [match?.id]);

  /* ─── Resume existing match ─── */
  const attemptResume = useCallback((m) => {
    const lock = checkMatchLock(m);

    if (lock && lock.isLocked) {
      // Match is locked by another session
      setPendingResumeMatch(m);
      setLockConflict({
        lockedBy: lock.lockedBy,
        isStale: lock.isStale,
        message: lock.isStale
          ? "This match was being scored but the session expired"
          : "This match is being scored by another device",
      });
      setShowTakeoverConfirm(true);
      return;
    }

    // No lock or our lock - proceed with resume
    resumeWithLock(m);
  }, []);

  const resumeWithLock = useCallback((m) => {
    // Acquire lock
    const lockedMatch = acquireLock(m);

    // If match has events, replay them to restore full undo capability
    let restored;
    if (lockedMatch.events && lockedMatch.events.length > 0) {
      restored = replayEvents(lockedMatch);
      restored.lockedBy = lockedMatch.lockedBy;
      restored.lockedAt = lockedMatch.lockedAt;
    } else {
      restored = { ...lockedMatch, history: [], events: [] };
    }

    setMatch(restored);
    saveMatch(restored);
    setShowResume(false);
    setShowTakeoverConfirm(false);
    setPendingResumeMatch(null);
    setLockConflict(null);
  }, []);

  const handleTakeover = useCallback(() => {
    if (pendingResumeMatch) {
      resumeWithLock(pendingResumeMatch);
    }
  }, [pendingResumeMatch, resumeWithLock]);

  const cancelTakeover = useCallback(() => {
    setShowTakeoverConfirm(false);
    setPendingResumeMatch(null);
    setLockConflict(null);
  }, []);

  /* ─── Score Adjustment ─── */
  const handleScoreAdjust = useCallback((newMatch) => {
    // Apply lock to the adjusted match
    const lockedMatch = acquireLock(newMatch);
    setMatch(lockedMatch);
    saveMatch(lockedMatch);
    setShowScoreAdjust(false);
  }, []);

  /* ─── History Rewind ─── */
  const handleRewind = useCallback((newMatch) => {
    // Apply lock and save
    const lockedMatch = acquireLock(newMatch);
    setMatch(lockedMatch);
    saveMatch(lockedMatch);
    setShowHistory(false);
  }, []);

  /* ─── Start Match ─── */
  const startMatch = () => {
    if (setup.matchType === "doubles") {
      // Doubles: need all 4 players
      if (!setup.p1.trim() || !setup.p2.trim() || !setup.p3.trim() || !setup.p4.trim()) return;
      const players = [setup.p1.trim(), setup.p2.trim(), setup.p3.trim(), setup.p4.trim()];
      const teams = (setup.team1.trim() || setup.team2.trim())
        ? [setup.team1.trim() || null, setup.team2.trim() || null]
        : null;
      const m = createMatch(players, null, setup.court, setup.bestOf, { matchType: "doubles", teams });
      const lockedMatch = acquireLock(m);
      setMatch(lockedMatch);
      saveMatch(lockedMatch);
    } else {
      // Singles
      if (!setup.p1.trim() || !setup.p2.trim()) return;
      const m = createMatch(setup.p1.trim(), setup.p2.trim(), setup.court, setup.bestOf);
      const lockedMatch = acquireLock(m);
      setMatch(lockedMatch);
      saveMatch(lockedMatch);
    }
  };

  // Check if setup is valid
  const isSetupValid = setup.matchType === "doubles"
    ? setup.p1.trim() && setup.p2.trim() && setup.p3.trim() && setup.p4.trim()
    : setup.p1.trim() && setup.p2.trim();

  /* ─── Score Point ─── */
  const handleScore = (pi) => {
    // Don't score if we have a lock conflict
    if (lockConflict) return;

    setMatch(prev => {
      const next = scorePoint(prev, pi);
      // Refresh lock on every point
      const withLock = refreshLock(next);
      saveMatch(withLock);
      return withLock;
    });
  };

  /* ─── Undo ─── */
  const handleUndo = () => {
    if (lockConflict) return;

    setMatch(prev => {
      const next = undoPoint(prev);
      // Refresh lock on undo too
      const withLock = refreshLock(next);
      saveMatch(withLock);
      return withLock;
    });
  };

  /* ─── End / New Match ─── */
  const handleEndMatch = () => {
    if (match) {
      // Release lock before removing
      const unlocked = releaseLock(match);
      saveMatch(unlocked);
      removeMatch(match.id);
    }
    setMatch(null);
    setLockConflict(null);
  };

  /* ═══════════════════ SETUP SCREEN ═══════════════════ */
  if (!match) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onBack} style={backBtn}>
            <ChevronLeft size={18} /> Back
          </button>
          {onLock && (
            <button onClick={onLock} style={lockBtn}>
              <Lock size={14} /> Lock
            </button>
          )}
        </div>

        <div style={heading}>New Match</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
          {/* Match Type Toggle */}
          <div style={{ ...labelStyle, marginBottom: 4 }}>Match Type</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {["singles", "doubles"].map(type => (
              <button
                key={type}
                onClick={() => setSetup(s => ({ ...s, matchType: type }))}
                style={{
                  padding: "10px 20px", borderRadius: 8,
                  border: setup.matchType === type ? `2px solid ${S.goldBright}` : `1px solid ${S.border}`,
                  background: setup.matchType === type ? "#2a2010" : S.surface,
                  color: setup.matchType === type ? S.goldBright : S.text,
                  fontSize: 14, cursor: "pointer",
                  fontFamily: "'Barlow', sans-serif", fontWeight: 500,
                  textTransform: "capitalize",
                }}
              >
                {type}
              </button>
            ))}
          </div>

          {setup.matchType === "singles" ? (
            /* Singles: 2 player inputs */
            <>
              <label style={labelStyle}>
                Player 1 (serves first)
                <input
                  value={setup.p1}
                  onChange={e => setSetup(s => ({ ...s, p1: e.target.value }))}
                  placeholder="Name"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Player 2
                <input
                  value={setup.p2}
                  onChange={e => setSetup(s => ({ ...s, p2: e.target.value }))}
                  placeholder="Name"
                  style={inputStyle}
                />
              </label>
            </>
          ) : (
            /* Doubles: 4 player inputs + optional team names */
            <>
              {/* Team 1 */}
              <div style={{
                padding: 12, background: S.surfaceLight, borderRadius: 10,
                border: `1px solid ${S.border}`,
              }}>
                <div style={{ ...labelStyle, marginBottom: 8, color: S.gold }}>
                  Team 1 (serves first)
                </div>
                <input
                  value={setup.team1}
                  onChange={e => setSetup(s => ({ ...s, team1: e.target.value }))}
                  placeholder="Team name (optional)"
                  style={{ ...inputStyle, marginBottom: 8, background: S.surface }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={setup.p1}
                    onChange={e => setSetup(s => ({ ...s, p1: e.target.value }))}
                    placeholder="Player 1"
                    style={{ ...inputStyle, flex: 1, background: S.surface }}
                  />
                  <input
                    value={setup.p2}
                    onChange={e => setSetup(s => ({ ...s, p2: e.target.value }))}
                    placeholder="Player 2"
                    style={{ ...inputStyle, flex: 1, background: S.surface }}
                  />
                </div>
              </div>

              {/* Team 2 */}
              <div style={{
                padding: 12, background: S.surfaceLight, borderRadius: 10,
                border: `1px solid ${S.border}`,
              }}>
                <div style={{ ...labelStyle, marginBottom: 8 }}>Team 2</div>
                <input
                  value={setup.team2}
                  onChange={e => setSetup(s => ({ ...s, team2: e.target.value }))}
                  placeholder="Team name (optional)"
                  style={{ ...inputStyle, marginBottom: 8, background: S.surface }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={setup.p3}
                    onChange={e => setSetup(s => ({ ...s, p3: e.target.value }))}
                    placeholder="Player 3"
                    style={{ ...inputStyle, flex: 1, background: S.surface }}
                  />
                  <input
                    value={setup.p4}
                    onChange={e => setSetup(s => ({ ...s, p4: e.target.value }))}
                    placeholder="Player 4"
                    style={{ ...inputStyle, flex: 1, background: S.surface }}
                  />
                </div>
              </div>
            </>
          )}

          <div style={{ ...labelStyle, marginTop: 4 }}>Court</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {COURT_COLORS.map((c, i) => (
              <button key={i} onClick={() => setSetup(s => ({ ...s, court: i }))} style={{
                padding: "8px 14px", borderRadius: 8,
                border: setup.court === i ? `2px solid ${c.light}` : `1px solid ${S.border}`,
                background: setup.court === i ? c.bg : S.surface,
                color: "#fff", fontSize: 13, cursor: "pointer",
                fontFamily: "'Barlow', sans-serif", fontWeight: 500,
              }}>
                {c.name}
              </button>
            ))}
          </div>

          <div style={{ ...labelStyle, marginTop: 4 }}>Format</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[3, 5].map(n => (
              <button key={n} onClick={() => setSetup(s => ({ ...s, bestOf: n }))} style={{
                padding: "10px 20px", borderRadius: 8,
                border: setup.bestOf === n ? `2px solid ${S.goldBright}` : `1px solid ${S.border}`,
                background: setup.bestOf === n ? "#2a2010" : S.surface,
                color: setup.bestOf === n ? S.goldBright : S.text,
                fontSize: 14, cursor: "pointer",
                fontFamily: "'Barlow', sans-serif", fontWeight: 500,
              }}>
                Best of {n}
              </button>
            ))}
          </div>

          <button onClick={startMatch} disabled={!isSetupValid} style={{
            marginTop: 12, padding: "16px 24px",
            background: !isSetupValid ? S.surfaceLight : `linear-gradient(135deg, ${S.green}, #1a5c38)`,
            border: "none", borderRadius: 12, color: "#fff", fontSize: 17,
            fontFamily: "'Oswald', sans-serif", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: 1,
            cursor: !isSetupValid ? "default" : "pointer",
            opacity: !isSetupValid ? 0.4 : 1,
          }}>
            Start {setup.matchType === "doubles" ? "Doubles" : "Singles"} Match
          </button>

          {/* Lock takeover confirmation */}
          {showTakeoverConfirm && lockConflict && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.8)", display: "flex",
              alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000,
            }}>
              <div style={{
                background: S.surface, borderRadius: 16, padding: 24,
                maxWidth: 360, width: "100%", border: `1px solid ${S.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <AlertTriangle size={24} color="#d97706" />
                  <span style={{
                    fontFamily: "'Oswald', sans-serif", fontSize: 20,
                    fontWeight: 600, color: S.text,
                  }}>
                    Match In Use
                  </span>
                </div>
                <p style={{ color: S.textDim, fontSize: 14, marginBottom: 20 }}>
                  {lockConflict.message}
                  {lockConflict.isStale && " You can safely take over."}
                </p>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={cancelTakeover} style={{
                    flex: 1, padding: "12px 16px", borderRadius: 8,
                    background: S.surfaceLight, border: `1px solid ${S.border}`,
                    color: S.text, cursor: "pointer", fontSize: 14,
                  }}>
                    Cancel
                  </button>
                  <button onClick={handleTakeover} style={{
                    flex: 1, padding: "12px 16px", borderRadius: 8,
                    background: lockConflict.isStale ? S.green : "#d97706",
                    border: "none", color: "#fff", cursor: "pointer", fontSize: 14,
                    fontWeight: 600,
                  }}>
                    {lockConflict.isStale ? "Take Over" : "Force Take Over"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Resume existing match */}
          {liveMatches.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${S.border}` }}>
              <button onClick={() => setShowResume(!showResume)} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "none", border: "none", color: S.gold,
                cursor: "pointer", fontSize: 14, fontFamily: "'Barlow', sans-serif",
              }}>
                <RefreshCw size={16} />
                Resume existing match ({liveMatches.length})
              </button>
              {showResume && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {liveMatches.map(m => {
                    const cc = COURT_COLORS[m.courtIdx] || COURT_COLORS[0];
                    const lock = checkMatchLock(m);
                    const isLockedByOther = lock && lock.isLocked && !lock.isStale;
                    const isDoublesMatch = isDoubles(m);
                    return (
                      <button key={m.id} onClick={() => attemptResume(m)} style={{
                        padding: "12px 16px", background: S.surface,
                        border: `1px solid ${S.border}`, borderRadius: 10,
                        cursor: "pointer", textAlign: "left",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cc.light }} />
                          <span style={{ fontSize: 12, color: S.textDim }}>{cc.name}</span>
                          {isDoublesMatch && (
                            <span style={{
                              fontSize: 10, padding: "2px 6px", borderRadius: 4,
                              background: S.surfaceLight, color: S.textDim,
                            }}>
                              Doubles
                            </span>
                          )}
                          {isLockedByOther && (
                            <span style={{
                              fontSize: 10, padding: "2px 6px", borderRadius: 4,
                              background: "#d9770622", color: "#d97706",
                              display: "flex", alignItems: "center", gap: 4,
                            }}>
                              <Lock size={10} /> In Use
                            </span>
                          )}
                        </div>
                        <div style={{ color: S.text, fontSize: 14, fontWeight: 500 }}>
                          {getTeamDisplayName(m, 0)} vs {getTeamDisplayName(m, 1)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════ SCORING SCREEN ═══════════════════ */
  const cc = COURT_COLORS[match.courtIdx] || COURT_COLORS[0];
  const alerts = getAlerts(match);
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: cc.light }} />
          <span style={{ fontSize: 13, color: S.textDim, fontWeight: 500 }}>{cc.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* History button - show if we have events */}
          {(match.events?.length > 0) && (
            <button onClick={() => setShowHistory(true)} style={{
              padding: "6px 12px", background: S.surface, border: `1px solid ${S.border}`,
              borderRadius: 8, color: S.textDim,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, fontSize: 12,
              fontFamily: "'Barlow', sans-serif",
            }}>
              <History size={14} />
            </button>
          )}
          {match.status === "live" && (
            <button onClick={() => setShowScoreAdjust(true)} style={{
              padding: "6px 12px", background: S.surface, border: `1px solid ${S.border}`,
              borderRadius: 8, color: S.textDim,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, fontSize: 12,
              fontFamily: "'Barlow', sans-serif",
            }}>
              <Edit3 size={14} /> Adjust
            </button>
          )}
          <button onClick={handleUndo} disabled={!match.history.length} style={{
            padding: "6px 12px", background: S.surface, border: `1px solid ${S.border}`,
            borderRadius: 8, color: match.history.length ? S.text : S.textDim,
            cursor: match.history.length ? "pointer" : "default",
            display: "flex", alignItems: "center", gap: 4, fontSize: 12,
            fontFamily: "'Barlow', sans-serif",
            opacity: match.history.length ? 1 : 0.4,
          }}>
            <Undo2 size={14} /> Undo
          </button>
        </div>
      </div>

      {/* Score adjustment modal */}
      {showScoreAdjust && (
        <ScoreAdjustModal
          match={match}
          onSubmit={handleScoreAdjust}
          onCancel={() => setShowScoreAdjust(false)}
        />
      )}

      {/* History viewer modal */}
      {showHistory && (
        <HistoryModal
          match={match}
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
          <button
            onClick={() => resumeWithLock(match)}
            style={{
              marginLeft: 8, padding: "4px 10px", borderRadius: 6,
              background: S.red, border: "none", color: "#fff",
              fontSize: 12, cursor: "pointer",
            }}
          >
            Reclaim
          </button>
        </div>
      )}

      {/* Alert banner */}
      {alerts.length > 0 && match.status === "live" && !lockConflict && (
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
                    : a.type === "matchTiebreak" ? "Match Tiebreak"
                      : "Tiebreak"
            )
            .join(" · ")}
        </div>
      )}

      {/* Scoreboard */}
      <div style={{ padding: "12px 16px" }}>
        <ScoreTable match={match} compact={false} />
      </div>

      {/* Current game points */}
      <div style={{ textAlign: "center", padding: "0 16px 16px" }}>
        {isDeuce(match) ? (
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: S.gold, fontWeight: 600 }}>
            DEUCE
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
            {[0, 1].map(pi => (
              <div key={pi}>
                <div style={{ fontSize: 11, color: S.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
                  {match.isMatchTiebreak ? "MTB" : match.isTiebreak ? "TB" : "Points"}
                </div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 36, fontWeight: 700, color: S.text }}>
                  {getPointDisplay(match, pi)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match finished */}
      {match.status === "finished" && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <Trophy size={40} color={S.gold} style={{ margin: "0 auto 8px" }} />
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 26,
            fontWeight: 700, color: S.gold, textTransform: "uppercase",
          }}>
            {getTeamDisplayName(match, match.winner)} Wins
          </div>
          <button onClick={handleEndMatch} style={{
            marginTop: 20, padding: "14px 28px", background: S.surface,
            border: `1px solid ${S.border}`, borderRadius: 10, color: S.text,
            fontSize: 15, cursor: "pointer", fontFamily: "'Oswald', sans-serif",
            fontWeight: 500, textTransform: "uppercase", letterSpacing: 1,
          }}>
            New Match
          </button>
        </div>
      )}

      {/* Big tap-target scoring buttons */}
      {match.status === "live" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: "auto" }}>
          {[0, 1].map(teamIdx => {
            // For doubles: check if current server is on this team
            // For singles: check if server matches player index
            const isServingTeam = isDoubles(match)
              ? getTeamIndex(match.server) === teamIdx
              : match.server === teamIdx;

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
                    {getTeamDisplayName(match, teamIdx)}
                  </span>
                </div>
                {/* Show individual server name for doubles */}
                {isDoubles(match) && isServingTeam && (
                  <span style={{
                    fontSize: 12, color: S.goldBright, fontWeight: 500,
                    fontFamily: "'Barlow', sans-serif",
                  }}>
                    Serving: {match.players[match.server]}
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

/* ─── Shared inline style fragments ─── */
const backBtn = {
  background: "none", border: "none", color: S.textDim,
  cursor: "pointer", display: "flex", alignItems: "center",
  gap: 6, marginBottom: 20, fontSize: 14, fontFamily: "'Barlow', sans-serif",
};
const lockBtn = {
  background: S.surface, border: `1px solid ${S.border}`,
  borderRadius: 8, color: S.textDim, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
  fontSize: 12, fontFamily: "'Barlow', sans-serif", marginBottom: 20,
};
const heading = {
  fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 600,
  color: S.gold, textTransform: "uppercase", marginBottom: 24,
};
const labelStyle = {
  fontSize: 12, color: S.textDim, textTransform: "uppercase", letterSpacing: 1,
};
const inputStyle = {
  display: "block", width: "100%", marginTop: 6,
  padding: "12px 14px", background: S.surface,
  border: `1px solid ${S.border}`, borderRadius: 10,
  color: S.text, fontSize: 16, fontFamily: "'Barlow', sans-serif",
  outline: "none", boxSizing: "border-box",
};
