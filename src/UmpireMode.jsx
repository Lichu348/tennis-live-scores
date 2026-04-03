import { useState } from "react";
import { Undo2, ChevronLeft, CircleDot, Trophy } from "lucide-react";
import { createMatch, scorePoint, undoPoint, getPointDisplay, isDeuce, getAlerts } from "./scoring";
import { saveMatch, removeMatch } from "./firebase";
import ScoreTable from "./ScoreTable";
import { S, COURT_COLORS } from "./styles";

export default function UmpireMode({ onBack }) {
  const [match, setMatch] = useState(null);
  const [setup, setSetup] = useState({ p1: "", p2: "", court: 0, bestOf: 3 });

  /* ─── Start Match ─── */
  const startMatch = () => {
    if (!setup.p1.trim() || !setup.p2.trim()) return;
    const m = createMatch(setup.p1.trim(), setup.p2.trim(), setup.court, setup.bestOf);
    setMatch(m);
    saveMatch(m);
  };

  /* ─── Score Point ─── */
  const handleScore = (pi) => {
    setMatch(prev => {
      const next = scorePoint(prev, pi);
      saveMatch(next); // fire-and-forget write to Firebase
      return next;
    });
  };

  /* ─── Undo ─── */
  const handleUndo = () => {
    setMatch(prev => {
      const next = undoPoint(prev);
      saveMatch(next);
      return next;
    });
  };

  /* ─── End / New Match ─── */
  const handleEndMatch = () => {
    if (match) removeMatch(match.id);
    setMatch(null);
  };

  /* ═══════════════════ SETUP SCREEN ═══════════════════ */
  if (!match) {
    return (
      <div style={{ padding: 20 }}>
        <button onClick={onBack} style={backBtn}>
          <ChevronLeft size={18} /> Back
        </button>

        <div style={heading}>New Match</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
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

          <button onClick={startMatch} disabled={!setup.p1.trim() || !setup.p2.trim()} style={{
            marginTop: 12, padding: "16px 24px",
            background: (!setup.p1.trim() || !setup.p2.trim()) ? S.surfaceLight : `linear-gradient(135deg, ${S.green}, #1a5c38)`,
            border: "none", borderRadius: 12, color: "#fff", fontSize: 17,
            fontFamily: "'Oswald', sans-serif", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: 1,
            cursor: (!setup.p1.trim() || !setup.p2.trim()) ? "default" : "pointer",
            opacity: (!setup.p1.trim() || !setup.p2.trim()) ? 0.4 : 1,
          }}>
            Start Match
          </button>
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

      {/* Alert banner */}
      {alerts.length > 0 && match.status === "live" && (
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
                  {match.isTiebreak ? "TB" : "Points"}
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
            {match.players[match.winner]} Wins
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
          {[0, 1].map(pi => (
            <button key={pi} onClick={() => handleScore(pi)} style={{
              flex: 1, minHeight: 120, border: "none", cursor: "pointer",
              background: pi === 0
                ? `linear-gradient(180deg, ${cc.bg}dd, ${cc.bg})`
                : `linear-gradient(180deg, ${S.surfaceLight}, ${S.surface})`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              borderTop: pi === 1 ? `1px solid ${S.border}` : "none",
              transition: "filter 0.1s",
            }}
              onMouseDown={e => e.currentTarget.style.filter = "brightness(1.3)"}
              onMouseUp={e => e.currentTarget.style.filter = "brightness(1)"}
              onTouchStart={e => e.currentTarget.style.filter = "brightness(1.3)"}
              onTouchEnd={e => e.currentTarget.style.filter = "brightness(1)"}
            >
              {match.server === pi && <CircleDot size={16} color={S.goldBright} />}
              <span style={{
                fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 600,
                color: "#fff", textTransform: "uppercase", letterSpacing: 1,
              }}>
                {match.players[pi]}
              </span>
            </button>
          ))}
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
