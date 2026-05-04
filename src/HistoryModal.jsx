import { useState, useMemo } from "react";
import { X, RotateCcw, ChevronRight } from "lucide-react";
import { rewindToEvent, getPointDisplay, createBaseMatch } from "./scoring";
import { S } from "./styles";

// Internal function to apply a single point (simplified version of scorePointInternal)
function applyPointToState(state, playerIndex) {
  // Deep clone to avoid mutation
  const next = JSON.parse(JSON.stringify(state));
  const oi = 1 - playerIndex;

  if (next.isTiebreak) {
    next.points[playerIndex]++;
    const total = next.points[0] + next.points[1];
    if (total % 2 === 1) {
      next.server = next.server === 0 ? 1 : 0;
    }
    if (next.points[playerIndex] >= 7 && next.points[playerIndex] - next.points[oi] >= 2) {
      // Win tiebreak game
      const cs = next.sets[next.sets.length - 1];
      cs[playerIndex]++;
      next.points = [0, 0];
      next.isTiebreak = false;
      // Check set win
      const wins = next.sets.filter(s => s[playerIndex] > s[1 - playerIndex]).length;
      if (wins >= Math.ceil(next.bestOf / 2)) {
        next.status = "finished";
        next.winner = playerIndex;
      } else {
        next.sets.push([0, 0]);
      }
      next.server = next.tiebreakStartServer;
      next.tiebreakStartServer = null;
    }
  } else {
    const pp = next.points[playerIndex], po = next.points[oi];
    if (pp < 3) {
      next.points[playerIndex]++;
    } else if (po < 3) {
      // Win game
      winGameInState(next, playerIndex);
    } else {
      if (pp === po) {
        next.points[playerIndex]++;
      } else if (pp > po) {
        winGameInState(next, playerIndex);
      } else {
        next.points[oi]--;
      }
    }
  }
  return next;
}

function winGameInState(m, pi) {
  const cs = m.sets[m.sets.length - 1];
  cs[pi]++;
  m.points = [0, 0];

  const wasInTiebreak = m.isTiebreak;
  m.isTiebreak = false;

  let setWon = false;
  if (wasInTiebreak) {
    setWon = true;
  } else if (cs[0] >= 6 || cs[1] >= 6) {
    if (Math.abs(cs[0] - cs[1]) >= 2) {
      setWon = true;
    }
  }

  if (setWon) {
    const wins = m.sets.filter(s => s[pi] > s[1 - pi]).length;
    if (wins >= Math.ceil(m.bestOf / 2)) {
      m.status = "finished";
      m.winner = pi;
    } else {
      m.sets.push([0, 0]);
    }
  } else if (cs[0] === 6 && cs[1] === 6) {
    m.isTiebreak = true;
    m.tiebreakStartServer = m.server;
  }

  if (wasInTiebreak) {
    m.server = m.tiebreakStartServer;
    m.tiebreakStartServer = null;
  } else {
    m.server = m.server === 0 ? 1 : 0;
  }
}

/**
 * Modal for viewing point-by-point history and rewinding to any point.
 *
 * Props:
 * - match: The current match object with events
 * - onRewind: (newMatch) => void - called when user rewinds to a point
 * - onCancel: () => void - called when modal is dismissed
 */
export default function HistoryModal({ match, onRewind, onCancel }) {
  const [selectedIndex, setSelectedIndex] = useState(null);

  // Compute history entries with score at each point - O(n) instead of O(n²)
  const historyEntries = useMemo(() => {
    const events = match.events || [];
    const entries = [];

    // Start from base state
    let currentState = createBaseMatch(
      match.players,
      match.courtIdx,
      match.bestOf,
      match.id,
      match.createdAt
    );

    // Add initial state (before any points)
    entries.push({
      index: -1,
      label: "Match Start",
      score: "0-0",
      player: null,
      timestamp: match.createdAt,
    });

    // Replay events once, capturing state at each point
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      if (event.type === "point") {
        // Apply this point to get state after
        currentState = applyPointToState(currentState, event.player);
        const cs = currentState.sets[currentState.sets.length - 1] || [0, 0];

        // Format score string
        let scoreStr = "";
        if (currentState.sets.length > 1) {
          const prevSets = currentState.sets.slice(0, -1);
          scoreStr = prevSets.map(s => `${s[0]}-${s[1]}`).join(", ") + ", ";
        }
        scoreStr += `${cs[0]}-${cs[1]}`;

        // Add point score if in progress
        if (currentState.status === "live") {
          if (currentState.isTiebreak) {
            scoreStr += ` TB(${currentState.points[0]}-${currentState.points[1]})`;
          } else if (currentState.points[0] > 0 || currentState.points[1] > 0) {
            const p1 = getPointDisplay(currentState, 0);
            const p2 = getPointDisplay(currentState, 1);
            scoreStr += ` (${p1}-${p2})`;
          }
        }

        entries.push({
          index: i,
          label: `Point ${i + 1}`,
          score: scoreStr,
          player: event.player,
          playerName: match.players[event.player],
          timestamp: event.timestamp,
          isFinished: currentState.status === "finished",
          winner: currentState.winner,
        });
      } else if (event.type === "setScore") {
        // Score was manually set - reset currentState to match
        currentState = {
          ...currentState,
          sets: event.sets,
          points: event.points || [0, 0],
          server: event.server !== undefined ? event.server : currentState.server,
        };
        const scoreStr = event.sets.map(s => `${s[0]}-${s[1]}`).join(", ");
        entries.push({
          index: i,
          label: "Score Adjusted",
          score: scoreStr,
          player: null,
          timestamp: event.timestamp,
          isAdjustment: true,
        });
      }
    }

    return entries;
  }, [match]);

  const handleRewind = () => {
    if (selectedIndex === null) return;

    const newMatch = rewindToEvent(match, selectedIndex);
    onRewind(newMatch);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1px solid ${S.border}`,
        }}>
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 20,
            fontWeight: 600, color: S.text, textTransform: "uppercase",
          }}>
            Point History
          </div>
          <button onClick={onCancel} style={closeBtn}>
            <X size={20} />
          </button>
        </div>

        {/* History list */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "8px 0",
          maxHeight: "50vh",
        }}>
          {historyEntries.length <= 1 ? (
            <div style={{ textAlign: "center", padding: 40, color: S.textDim }}>
              No points scored yet
            </div>
          ) : (
            historyEntries.map((entry, idx) => (
              <button
                key={entry.index}
                onClick={() => setSelectedIndex(entry.index)}
                style={{
                  width: "100%", padding: "12px 20px",
                  background: selectedIndex === entry.index ? S.surfaceLight : "transparent",
                  border: "none", borderLeft: selectedIndex === entry.index
                    ? `3px solid ${S.gold}`
                    : "3px solid transparent",
                  cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                {/* Point number / icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: entry.player !== null
                    ? entry.player === 0 ? "#16a34a33" : "#3b82f633"
                    : S.surfaceLight,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {entry.player !== null ? (
                    <span style={{
                      fontFamily: "'Oswald', sans-serif", fontSize: 12,
                      fontWeight: 600,
                      color: entry.player === 0 ? "#22c55e" : "#60a5fa",
                    }}>
                      P{entry.player + 1}
                    </span>
                  ) : (
                    <ChevronRight size={14} color={S.textDim} />
                  )}
                </div>

                {/* Point info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 500, color: S.text,
                    }}>
                      {entry.label}
                    </span>
                    {entry.playerName && (
                      <span style={{
                        fontSize: 11, color: S.textDim,
                        background: S.surfaceLight, padding: "2px 6px",
                        borderRadius: 4,
                      }}>
                        {entry.playerName}
                      </span>
                    )}
                    {entry.isFinished && (
                      <span style={{
                        fontSize: 10, color: S.gold,
                        background: "#d4a84322", padding: "2px 6px",
                        borderRadius: 4, fontWeight: 600,
                      }}>
                        MATCH
                      </span>
                    )}
                    {entry.isAdjustment && (
                      <span style={{
                        fontSize: 10, color: "#d97706",
                        background: "#d9770622", padding: "2px 6px",
                        borderRadius: 4,
                      }}>
                        ADJUSTED
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 12, color: S.textDim, marginTop: 2,
                    fontFamily: "'Barlow', sans-serif",
                  }}>
                    {entry.score}
                    {entry.timestamp && (
                      <span style={{ marginLeft: 8, opacity: 0.7 }}>
                        {formatTime(entry.timestamp)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Selection indicator */}
                {selectedIndex === entry.index && (
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: S.gold, flexShrink: 0,
                  }} />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer with rewind button */}
        <div style={{
          padding: "16px 20px", borderTop: `1px solid ${S.border}`,
          display: "flex", gap: 12,
        }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "12px 16px", borderRadius: 8,
            background: S.surfaceLight, border: `1px solid ${S.border}`,
            color: S.text, cursor: "pointer", fontSize: 14,
          }}>
            Cancel
          </button>
          <button
            onClick={handleRewind}
            disabled={selectedIndex === null}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 8,
              background: selectedIndex !== null ? S.gold : S.surfaceLight,
              border: "none",
              color: selectedIndex !== null ? "#000" : S.textDim,
              cursor: selectedIndex !== null ? "pointer" : "default",
              fontSize: 14, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              opacity: selectedIndex !== null ? 1 : 0.5,
            }}
          >
            <RotateCcw size={16} />
            Rewind Here
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0, 0, 0, 0.85)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 20, zIndex: 1000,
};

const modalStyle = {
  background: S.surface,
  borderRadius: 16,
  width: "100%",
  maxWidth: 440,
  maxHeight: "80vh",
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${S.border}`,
  overflow: "hidden",
};

const closeBtn = {
  background: "none", border: "none",
  color: S.textDim, cursor: "pointer", padding: 4,
};
