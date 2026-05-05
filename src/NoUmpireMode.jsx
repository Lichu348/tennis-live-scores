import { useState, useEffect, useCallback } from "react";
import { Undo2, ChevronLeft, Trophy, Users } from "lucide-react";
import {
  createMatch, scoreGame, undoPoint, currentSet, setsWon, setsNeeded,
  isDoubles, getTeamDisplayName
} from "./scoring";
import ScoreTable from "./ScoreTable";
import { S, COURT_COLORS } from "./styles";

/**
 * No Umpire Mode - Players track games themselves (not points).
 * Simpler interface for casual play without a dedicated umpire.
 * Data is stored locally only (not synced to Firebase).
 */
export default function NoUmpireMode({ onBack }) {
  const [match, setMatch] = useState(null);
  const [setup, setSetup] = useState({
    matchType: "singles",
    p1: "", p2: "", p3: "", p4: "",
    team1: "", team2: "",
    bestOf: 3
  });

  // Check if setup is valid
  const isSetupValid = setup.matchType === "doubles"
    ? setup.p1.trim() && setup.p2.trim() && setup.p3.trim() && setup.p4.trim()
    : setup.p1.trim() && setup.p2.trim();

  /* ─── Start Match ─── */
  const startMatch = () => {
    if (setup.matchType === "doubles") {
      if (!isSetupValid) return;
      const players = [setup.p1.trim(), setup.p2.trim(), setup.p3.trim(), setup.p4.trim()];
      const teams = (setup.team1.trim() || setup.team2.trim())
        ? [setup.team1.trim() || null, setup.team2.trim() || null]
        : null;
      const m = createMatch(players, null, 0, setup.bestOf, { matchType: "doubles", teams });
      setMatch(m);
    } else {
      if (!isSetupValid) return;
      const m = createMatch(setup.p1.trim(), setup.p2.trim(), 0, setup.bestOf);
      setMatch(m);
    }
  };

  /* ─── Score Game ─── */
  const handleScoreGame = (pi) => {
    setMatch(prev => scoreGame(prev, pi));
  };

  /* ─── Undo ─── */
  const handleUndo = () => {
    setMatch(prev => undoPoint(prev)); // undoPoint works for games too
  };

  /* ─── End / New Match ─── */
  const handleEndMatch = () => {
    setMatch(null);
  };

  /* ═══════════════════ SETUP SCREEN ═══════════════════ */
  if (!match) {
    return (
      <div style={{ padding: 20 }}>
        <button onClick={onBack} style={backBtn}>
          <ChevronLeft size={18} /> Back
        </button>

        <div style={heading}>No Umpire Mode</div>
        <div style={{ color: S.textDim, fontSize: 14, marginBottom: 24, marginTop: -12 }}>
          Players track games themselves - tap when you win a game
        </div>

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
            <>
              <label style={labelStyle}>
                Player 1
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
            <>
              {/* Team 1 */}
              <div style={{
                padding: 12, background: S.surfaceLight, borderRadius: 10,
                border: `1px solid ${S.border}`,
              }}>
                <div style={{ ...labelStyle, marginBottom: 8, color: S.gold }}>Team 1</div>
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
                <div style={{ ...labelStyle, marginBottom: 8, color: S.gold }}>Team 2</div>
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
                    placeholder="Player 1"
                    style={{ ...inputStyle, flex: 1, background: S.surface }}
                  />
                  <input
                    value={setup.p4}
                    onChange={e => setSetup(s => ({ ...s, p4: e.target.value }))}
                    placeholder="Player 2"
                    style={{ ...inputStyle, flex: 1, background: S.surface }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Best Of */}
          <label style={labelStyle}>
            Format
            <select
              value={setup.bestOf}
              onChange={e => setSetup(s => ({ ...s, bestOf: parseInt(e.target.value, 10) }))}
              style={inputStyle}
            >
              <option value={3}>Best of 3 (match tiebreak)</option>
              <option value={5}>Best of 5</option>
            </select>
          </label>

          {/* Start Button */}
          <button
            onClick={startMatch}
            disabled={!isSetupValid}
            style={{
              marginTop: 12, padding: "16px 24px",
              background: isSetupValid
                ? `linear-gradient(135deg, ${S.green}, #1a5c38)`
                : S.surfaceLight,
              border: "none", borderRadius: 12, color: "#fff",
              fontSize: 18, fontFamily: "'Oswald', sans-serif",
              fontWeight: 600, textTransform: "uppercase",
              cursor: isSetupValid ? "pointer" : "default",
              opacity: isSetupValid ? 1 : 0.5,
            }}
          >
            Start Match
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════ SCORING SCREEN ═══════════════════ */
  const cs = currentSet(match);
  const isMatchTiebreak = match.isMatchTiebreak;
  const isTiebreak = match.isTiebreak;

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={handleEndMatch} style={backBtn}>
          <ChevronLeft size={18} /> Exit
        </button>
        <button onClick={handleUndo} disabled={!match.history?.length} style={{
          ...backBtn,
          opacity: match.history?.length ? 1 : 0.4,
        }}>
          <Undo2 size={16} /> Undo
        </button>
      </div>

      {/* Status Banner */}
      {(isMatchTiebreak || isTiebreak) && (
        <div style={{
          background: `linear-gradient(135deg, ${S.gold}22, ${S.gold}11)`,
          border: `1px solid ${S.gold}44`,
          borderRadius: 10, padding: "10px 16px",
          textAlign: "center", marginBottom: 16,
          fontFamily: "'Oswald', sans-serif", fontSize: 18,
          color: S.gold, textTransform: "uppercase",
        }}>
          {isMatchTiebreak ? "Match Tiebreak (First to 10)" : "Tiebreak (First to 7)"}
        </div>
      )}

      {/* Score Display */}
      <div style={{ marginBottom: 24 }}>
        <ScoreTable match={match} compact={false} />
      </div>

      {/* Tiebreak Points Display */}
      {(isMatchTiebreak || isTiebreak) && (
        <div style={{
          display: "flex", justifyContent: "center", gap: 40,
          marginBottom: 24, padding: 16,
          background: S.surfaceLight, borderRadius: 12,
        }}>
          {[0, 1].map(pi => (
            <div key={pi} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: S.textDim, textTransform: "uppercase", marginBottom: 4 }}>
                {isMatchTiebreak ? "MTB" : "TB"} Points
              </div>
              <div style={{
                fontFamily: "'Oswald', sans-serif", fontSize: 42,
                fontWeight: 700, color: S.text,
              }}>
                {match.points[pi]}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Match finished */}
      {match.status === "finished" && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <Trophy size={48} color={S.gold} style={{ margin: "0 auto 12px" }} />
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 28,
            fontWeight: 700, color: S.gold, textTransform: "uppercase",
          }}>
            {getTeamDisplayName(match, match.winner)} Wins!
          </div>
          <button onClick={handleEndMatch} style={{
            marginTop: 20, padding: "14px 32px",
            background: S.surfaceLight, border: `1px solid ${S.border}`,
            borderRadius: 10, color: S.text,
            fontSize: 16, cursor: "pointer",
            fontFamily: "'Barlow', sans-serif",
          }}>
            New Match
          </button>
        </div>
      )}

      {/* Scoring Buttons */}
      {match.status === "live" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            textAlign: "center", fontSize: 14, color: S.textDim,
            textTransform: "uppercase", letterSpacing: 1,
          }}>
            {isMatchTiebreak || isTiebreak ? "Tap when you win a point" : "Tap when you win a game"}
          </div>

          {[0, 1].map(pi => (
            <button
              key={pi}
              onClick={() => handleScoreGame(pi)}
              style={{
                padding: "28px 20px",
                background: pi === 0
                  ? `linear-gradient(135deg, ${S.green}, #1a5c38)`
                  : "linear-gradient(135deg, #1e3a5f, #0f2340)",
                border: "none",
                borderRadius: 16,
                cursor: "pointer",
                transition: "transform 0.1s",
              }}
              onTouchStart={e => e.currentTarget.style.transform = "scale(0.97)"}
              onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <div style={{
                fontFamily: "'Oswald', sans-serif", fontSize: 22,
                fontWeight: 600, color: "#fff", textTransform: "uppercase",
              }}>
                {getTeamDisplayName(match, pi)}
              </div>
              <div style={{ fontSize: 14, color: "#ffffffaa", marginTop: 4 }}>
                {isMatchTiebreak || isTiebreak ? "+1 Point" : "+1 Game"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Styles ─── */
const backBtn = {
  display: "flex", alignItems: "center", gap: 4,
  background: "none", border: "none",
  color: S.textDim, fontSize: 14, cursor: "pointer",
  fontFamily: "'Barlow', sans-serif",
};

const heading = {
  fontFamily: "'Oswald', sans-serif", fontSize: 28,
  fontWeight: 700, color: S.text, textTransform: "uppercase",
  marginBottom: 20, marginTop: 16,
};

const labelStyle = {
  display: "flex", flexDirection: "column", gap: 6,
  fontSize: 13, color: S.textDim, textTransform: "uppercase",
  letterSpacing: 0.5, fontFamily: "'Barlow', sans-serif",
};

const inputStyle = {
  padding: "12px 14px", borderRadius: 8,
  border: `1px solid ${S.border}`, background: S.surfaceLight,
  color: S.text, fontSize: 16, width: "100%",
  fontFamily: "'Barlow', sans-serif", boxSizing: "border-box",
};
