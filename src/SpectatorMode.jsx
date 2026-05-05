import { useState, useEffect, useRef, useCallback } from "react";
import {
  Monitor, ChevronLeft, Wifi, WifiOff, RefreshCw,
  Maximize2, Minimize2, Trophy, AlertTriangle,
} from "lucide-react";
import { getPointDisplay, isDeuce, getAlerts, isDoubles, getTeamDisplayName } from "./scoring";
import { subscribeToMatches } from "./firebase";
import ScoreTable from "./ScoreTable";
import { S, COURT_COLORS } from "./styles";

// Staleness thresholds (ms)
const STALE_WARNING_MS = 30000;     // 30 sec - show "Xs ago"
const STALE_ALERT_MS = 60000;       // 60 sec - yellow warning
const STALE_CRITICAL_MS = 300000;   // 5 min - red warning + auto-refresh
const HEARTBEAT_INTERVAL_MS = 15000; // 15 sec check interval

// Reconnection backoff (ms)
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const MAX_RECONNECT_ATTEMPTS = 10;

export default function SpectatorMode({ onBack }) {
  const [matches, setMatches] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [staleness, setStaleness] = useState(0); // ms since last update
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const unsubRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Reconnection with exponential backoff - defined first to avoid stale closures
  const attemptReconnect = useCallback(() => {
    setReconnectAttempts(prev => {
      if (prev >= MAX_RECONNECT_ATTEMPTS) {
        setIsReconnecting(false);
        return prev;
      }

      setIsReconnecting(true);
      const delay = BACKOFF_DELAYS[Math.min(prev, BACKOFF_DELAYS.length - 1)];

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        // Clean up existing subscription
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }

        let hasReceivedData = false;

        // Re-subscribe
        unsubRef.current = subscribeToMatches(
          (all) => {
            hasReceivedData = true;
            setMatches(all);
            setConnected(true);
            setLastUpdate(Date.now());
            setReconnectAttempts(0);
            setIsReconnecting(false);
          },
          (error) => {
            console.error("Subscription error:", error);
            setConnected(false);
            setIsReconnecting(false);
            // Schedule another retry after error
            setReconnectAttempts(p => {
              if (p < MAX_RECONNECT_ATTEMPTS) {
                const nextDelay = BACKOFF_DELAYS[Math.min(p, BACKOFF_DELAYS.length - 1)];
                reconnectTimeoutRef.current = setTimeout(() => {
                  attemptReconnect();
                }, nextDelay);
              }
              return p;
            });
          }
        );

        // Timeout for this reconnect attempt
        setTimeout(() => {
          if (!hasReceivedData && unsubRef.current) {
            // No data received - treat as failure
            setIsReconnecting(false);
            setReconnectAttempts(p => {
              if (p < MAX_RECONNECT_ATTEMPTS) {
                attemptReconnect();
              }
              return p;
            });
          }
        }, 5000);
      }, delay);

      return prev + 1;
    });
  }, []);

  // Subscribe to matches with reconnection support
  const subscribe = useCallback(() => {
    // Clean up existing subscription
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    let hasReceivedData = false;

    unsubRef.current = subscribeToMatches(
      (all) => {
        setMatches(all);
        hasReceivedData = true;
        setConnected(true);
        setLastUpdate(Date.now());
        setReconnectAttempts(0);
        setIsReconnecting(false);
      },
      (error) => {
        console.error("Subscription error:", error);
        setConnected(false);
        attemptReconnect();
      }
    );

    // Initial connection timeout
    const t = setTimeout(() => {
      if (!hasReceivedData) {
        setConnected(false);
        attemptReconnect();
      }
    }, 5000);

    return () => clearTimeout(t);
  }, [attemptReconnect]);

  // Initial subscription
  useEffect(() => {
    const cleanup = subscribe();
    return () => {
      cleanup?.();
      if (unsubRef.current) unsubRef.current();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [subscribe]);

  // Heartbeat: check staleness every 15 seconds
  useEffect(() => {
    const heartbeat = setInterval(() => {
      const now = Date.now();
      const staleMs = now - lastUpdate;
      setStaleness(staleMs);

      // After 5 minutes stale, escalate reconnect attempts (don't auto-refresh)
      // Firebase will handle actual reconnection - we just need to show status
      if (staleMs >= STALE_CRITICAL_MS && connected) {
        // Mark as disconnected to trigger reconnect UI
        setConnected(false);
      }

      // Attempt reconnect if stale for 60+ seconds
      if (staleMs >= STALE_ALERT_MS && !isReconnecting && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        console.log("Data stale, attempting reconnect...");
        attemptReconnect();
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(heartbeat);
  }, [lastUpdate, connected, isReconnecting, reconnectAttempts, attemptReconnect]);

  // Manual refresh handler
  const handleManualRefresh = () => {
    window.location.reload();
  };

  // Format staleness for display
  const getStalenessText = () => {
    if (staleness < STALE_WARNING_MS) return null;
    const seconds = Math.floor(staleness / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  // Get connection status display
  const getConnectionStatus = () => {
    if (isReconnecting) {
      return {
        icon: <RefreshCw size={14} className="spin" />,
        text: `Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
        color: S.gold,
      };
    }
    if (!connected) {
      return { icon: <WifiOff size={14} />, text: "Disconnected", color: S.red };
    }
    if (staleness >= STALE_CRITICAL_MS) {
      return { icon: <AlertTriangle size={14} />, text: "Connection lost", color: S.red };
    }
    if (staleness >= STALE_ALERT_MS) {
      return { icon: <AlertTriangle size={14} />, text: getStalenessText(), color: "#d97706" };
    }
    if (staleness >= STALE_WARNING_MS) {
      return { icon: <Wifi size={14} />, text: getStalenessText(), color: S.textDim };
    }
    return { icon: <Wifi size={14} />, text: "Live", color: S.greenBright };
  };

  const liveMatches = matches.filter(m => m.status === "live");
  const recentFinished = matches
    .filter(m => m.status === "finished")
    .sort((a, b) => (b.finishedAt || b.createdAt) - (a.finishedAt || a.createdAt))
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
                      : a.type === "matchTiebreak" ? "Match Tiebreak"
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
                  {m.isMatchTiebreak ? "Match Tiebreak" : m.isTiebreak ? "Tiebreak" : "Points"}
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

        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }
          @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          .spin { animation: spin 1s linear infinite; }
        `}</style>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Staleness warning with manual refresh */}
          {staleness >= STALE_ALERT_MS && (
            <button
              onClick={handleManualRefresh}
              style={{
                background: staleness >= STALE_CRITICAL_MS ? S.red : "#d97706",
                border: "none",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 11,
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          )}
          {/* Connection status */}
          {(() => {
            const status = getConnectionStatus();
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: status.color }}>
                {status.icon}
                {status.text}
              </div>
            );
          })()}
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

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
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
