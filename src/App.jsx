import { useState } from "react";
import { Smartphone, Monitor } from "lucide-react";
import UmpireMode from "./UmpireMode";
import SpectatorMode from "./SpectatorMode";
import { S } from "./styles";

export default function App() {
  const [mode, setMode] = useState(null); // null | 'umpire' | 'spectator'

  if (mode === "umpire") return <Shell><UmpireMode onBack={() => setMode(null)} /></Shell>;
  if (mode === "spectator") return <Shell><SpectatorMode onBack={() => setMode(null)} /></Shell>;

  return (
    <Shell>
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        minHeight: "100vh", padding: 24, gap: 32,
      }}>
        {/* Branding */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 42,
            fontWeight: 700, letterSpacing: 2, color: S.gold,
            textTransform: "uppercase",
          }}>
            Live Tennis
          </div>
          <div style={{
            fontSize: 14, color: S.textDim, marginTop: 4,
            letterSpacing: 1, textTransform: "uppercase",
          }}>
            Scoring System
          </div>
        </div>

        {/* Umpire button */}
        <ModeButton
          onClick={() => setMode("umpire")}
          icon={<Smartphone size={32} color="#fff" />}
          gradient={`linear-gradient(135deg, ${S.green}, #1a5c38)`}
          borderColor="#34d37a33"
          title="Umpire"
          subtitle="Score a match from your phone"
        />

        {/* Spectator button */}
        <ModeButton
          onClick={() => setMode("spectator")}
          icon={<Monitor size={32} color="#fff" />}
          gradient="linear-gradient(135deg, #1e3a5f, #0f2340)"
          borderColor="#3b82f633"
          title="Clubhouse TV"
          subtitle="Live scoreboard for all courts"
        />
      </div>
    </Shell>
  );
}

/* ─── Layout shell ─── */
function Shell({ children }) {
  return (
    <div style={{
      fontFamily: "'Barlow', sans-serif",
      background: S.bg,
      color: S.text,
      minHeight: "100vh",
      width: "100%",
    }}>
      {children}
    </div>
  );
}

/* ─── Reusable mode button ─── */
function ModeButton({ onClick, icon, gradient, borderColor, title, subtitle }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", maxWidth: 340, padding: "28px 24px",
      background: gradient, border: `1px solid ${borderColor}`,
      borderRadius: 16, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 16,
      transition: "transform 0.15s",
    }}
      onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
    >
      {icon}
      <div style={{ textAlign: "left" }}>
        <div style={{
          fontFamily: "'Oswald', sans-serif", fontSize: 22,
          fontWeight: 600, color: "#fff", textTransform: "uppercase",
        }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "#ffffffaa", marginTop: 2 }}>{subtitle}</div>
      </div>
    </button>
  );
}
