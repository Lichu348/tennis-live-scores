import { useState, useEffect } from "react";
import {
  Monitor, ChevronLeft, Wifi, WifiOff,
  Maximize2, Minimize2, Trophy,
} from "lucide-react";
import { getPointDisplay, isDeuce, getAlerts } from "./scoring";
import { subscribeToMatches } from "./firebase";
import ScoreTable from "./ScoreTable";
import { S, COURT_COLORS } from "./styles";

export default function SpectatorMode({ onBack }) {
  const [matches, setMatches] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [connected, setConnected] = useState(false);

  /* Real-time subscription to all matches */
  useEffect(() => {
    const unsub = subscribeToMatches((all) => {
      setMatches(all);
      setConnected(true);
    });
    // Mark as connected after first tick even if empty
    const t = setTimeout(() => setConnected(true), 3000);
    return () => { unsub(); clearTimeout(t); };
  }, []);

  const liveMatches = matches.filter(m => m.status === "live");
  const recentFinished = matches
    .filter(m => m.status === "finished")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
  const allDisplay = [...liveMatches, ...recentFinished];

  /* ═══════════════ EXPANDED SINGLE-MATCH VIEW ═══════════════ */
  if (expanded) {
    const m = matches.find(x => x.id === expanded);
    if (!m) {
      setExpanded(null);
      return null;
    }
    const cc = COURT_COLORS[m.courtIdx] || COURT_COLORS[0];
    const alerts = getAlerts(m);
    const hasMatchPoint = alerts.some(a => a.type === "matchPoint");
    const hasSetPoint = alerts.some(a => a.type === "setPoint");

    return (
      <div
        onClick={() => setExpanded(null)}
        style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: 32, minHeight: "100vh", position: "relative",
        }}
      >
        <button
          onClick={() => setExpanded(null)}
          style={{
            position: "absolute", top: 20, right: 20,
            background: "none", border: "none", color: S.textDim, cursor: "pointer",
          }}
        >
          <Minimize2 size={24} />
        </button>

        {/* Alert pill */}
        {alerts.length > 0 && m.status === "live" && (
          <div style={{
            marginBottom: 20, padding: "10px 32px", borderRadius: 8,
            fontFamily: "'Oswald', sans-serif", fontSize: 22,
            fontWeight: 600, textTransform: "uppercase", letterSpacing: 3,
            background: hasMatchPoint ? "#dc2626" : hasSetPoint ? "#d97706" : cc.accent,
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

        {/* Court badge */}
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: cc.light, marginBottom: 6 }} />
        <div style={{
          fontFamily: "'Oswald', sans-serif", fontSize: 18,
          color: cc.light, textTransform: "uppercase",
          letterSpacing: 2, marginBottom: 24,
        }}>
          {cc.name}
        </div>

        {/* Final banner */}
        {m.status === "finished" && (
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 20, color: S.gold,
            textTransform: "uppercase", letterSpacing: 2, marginBottom: 16,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Trophy size={20} color={S.gold} /> Final
          </div>
        )}

        {/* Big scoreboard */}
        <div style={{ width: "100%", maxWidth: 600 }}>
          <ScoreTable match={m} compact={false} large />
        </div>

        {/* Point score */}
        {m.status === "live" && !isDeuce(m) && (
          <div style={{ display: "flex", gap: 60, marginTop: 28 }}>
            {[0, 1].map(pi => (
              <div key={pi} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, color: S.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
                  {m.isTiebreak ? "Tiebreak" : "Points"}
                </div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 56, fontWeight: 700, color: S.text }}>
                  {getPointDisplay(m, pi)}
                </div>
              </div>
            ))}
          </div>
        )}
        {m.status === "live" && isDeuce(m) && (
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 36,
            color: S.gold, fontWeight: 600, marginTop: 28,
            textTransform: "uppercase", letterSpacing: 3,
          }}>
            Deuce
          </div>
        )}

        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }`}</style>
      </div>
    );
  }

  /* ═══════════════ GRID VIEW ═══════════════ */
  return (
    <div style={{ padding: 20, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <button onClick={onBack} style={backBtn}>
          <ChevronLeft size={18} /> Back
        </button>
        <div style={{
          fontFamily: "'Oswald', sans-serif", fontSize: 24,
          fontWeight: 700, color: S.gold,
          textTransform: "uppercase", letterSpacing: 2,
        }}>
          Live Scores
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: connected ? S.greenBright : S.red }}>
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? "Live" : "Connecting…"}
        </div>
      </div>

      {/* Empty state */}
      {allDisplay.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: S.textDim }}>
          <Monitor size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 18,
            textTransform: "uppercase", letterSpacing: 1,
          }}>
            No active matches
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Matches will appear here when an umpire starts scoring
          </div>
        </div>
      )}

      {/* Match cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: allDisplay.length === 1 ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))",
        gap: 16,
      }}>
        {allDisplay.map(m => (
          <MatchCard key={m.id} match={m} onExpand={() => setExpanded(m.id)} />
        ))}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }`}</style>
    </div>
  );
}

/* ─── Match Card ─── */
function MatchCard({ match, onExpand }) {
  const cc = COURT_COLORS[match.courtIdx] || COURT_COLORS[0];
  const alerts = getAlerts(match);
  const hasMatchPoint = alerts.some(a => a.type === "matchPoint");
  const hasSetPoint = alerts.some(a => a.type === "setPoint");
  const isFinished = match.status === "finished";

  const alertColor = hasMatchPoint
    ? "#dc2626"
    : hasSetPoint
      ? "#d97706"
      : alerts.length > 0
        ? cc.accent
        : null;

  return (
    <div
      onClick={onExpand}
      style={{
        background: S.surface, borderRadius: 14, overflow: "hidden", cursor: "pointer",
        border: alertColor ? `2px solid ${alertColor}` : `1px solid ${S.border}`,
        transition: "transform 0.15s, box-shadow 0.15s",
        boxShadow: hasMatchPoint ? `0 0 20px ${alertColor}44` : "none",
      }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      {/* Court header */}
      <div style={{
        padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
        background: isFinished ? S.surfaceLight : cc.bg,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: isFinished ? S.textDim : cc.light }} />
          <span style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 13,
            color: isFinished ? S.textDim : "#fff",
            textTransform: "uppercase", letterSpacing: 1,
          }}>
            {cc.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {alerts.length > 0 && !isFinished && (
            <span style={{
              fontSize: 10, fontFamily: "'Oswald', sans-serif",
              textTransform: "uppercase", letterSpacing: 1,
              padding: "2px 8px", borderRadius: 4, fontWeight: 600,
              background: alertColor, color: "#fff",
              animation: hasMatchPoint ? "pulse 1.5s ease-in-out infinite" : "none",
            }}>
              {hasMatchPoint ? "Match Pt" : hasSetPoint ? "Set Pt" : alerts[0].type === "breakPoint" ? "Break Pt" : "TB"}
            </span>
          )}
          {isFinished && (
            <span style={{
              fontSize: 10, fontFamily: "'Oswald', sans-serif",
              textTransform: "uppercase", letterSpacing: 1,
              padding: "2px 8px", borderRadius: 4, fontWeight: 600,
              background: S.gold, color: "#000",
            }}>
              Final
            </span>
          )}
          <Maximize2 size={14} color={isFinished ? S.textDim : "#fff"} />
        </div>
      </div>

      {/* Score */}
      <div style={{ padding: "10px 14px" }}>
        <ScoreTable match={match} compact />
      </div>
    </div>
  );
}

const backBtn = {
  background: "none", border: "none", color: S.textDim,
  cursor: "pointer", display: "flex", alignItems: "center",
  gap: 6, fontSize: 14, fontFamily: "'Barlow', sans-serif",
};
