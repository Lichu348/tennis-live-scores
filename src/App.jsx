import { useState, useEffect, useCallback } from "react";
import { Smartphone, Monitor, Settings, Trophy } from "lucide-react";
import UmpireMode from "./UmpireMode";
import SpectatorMode from "./SpectatorMode";
import AdminMode from "./AdminMode";
import TournamentMode from "./TournamentMode";
import PinModal from "./PinModal";
import { getUmpirePin, setUmpirePin, hashPin, verifyPin } from "./firebase";
import { S } from "./styles";

// Session validity duration (8 hours)
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// Check if umpire session is valid
function isSessionValid() {
  const session = localStorage.getItem("umpireSession");
  if (!session) return false;
  try {
    const { expiresAt } = JSON.parse(session);
    return Date.now() < expiresAt;
  } catch {
    return false;
  }
}

// Create a new session
function createSession() {
  localStorage.setItem("umpireSession", JSON.stringify({
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
  }));
}

// Clear the session
function clearSession() {
  localStorage.removeItem("umpireSession");
}

export default function App() {
  const [mode, setMode] = useState(null); // null | 'umpire' | 'spectator' | 'admin'
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState(null); // 'setup' | 'entry' | null
  const [pinError, setPinError] = useState(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(null); // null = loading, true/false = known
  const [pendingMode, setPendingMode] = useState(null); // 'umpire' | 'admin' - where to go after PIN

  // Check if PIN is configured on mount
  useEffect(() => {
    getUmpirePin().then(hash => {
      setHasPinSet(!!hash);
    }).catch(() => {
      setHasPinSet(false);
    });
  }, []);

  // Handle protected mode access (umpire or admin)
  const handleProtectedModeClick = useCallback(async (targetMode) => {
    // If session is valid, go straight to target mode
    if (isSessionValid()) {
      setMode(targetMode);
      return;
    }

    setPendingMode(targetMode);

    // Check if PIN is set
    const pinHash = await getUmpirePin();

    if (pinHash) {
      // PIN exists - require entry
      setPinMode("entry");
      setShowPinModal(true);
    } else {
      // No PIN - offer setup
      setPinMode("setup");
      setShowPinModal(true);
    }
  }, []);

  // Handle umpire mode request
  const handleUmpireClick = useCallback(() => {
    handleProtectedModeClick("umpire");
  }, [handleProtectedModeClick]);

  // Handle admin mode request
  const handleAdminClick = useCallback(() => {
    handleProtectedModeClick("admin");
  }, [handleProtectedModeClick]);

  // Handle PIN submission
  const handlePinSubmit = useCallback(async (pin) => {
    setPinError(null);
    setPinLoading(true);

    try {
      if (pinMode === "setup") {
        if (pin === null) {
          // User skipped PIN setup
          setShowPinModal(false);
          createSession();
          setMode(pendingMode || "umpire");
          setPendingMode(null);
        } else {
          // Set the PIN
          const hash = await hashPin(pin);
          await setUmpirePin(hash);
          setHasPinSet(true);
          setShowPinModal(false);
          createSession();
          setMode(pendingMode || "umpire");
          setPendingMode(null);
        }
      } else {
        // Verify PIN
        const valid = await verifyPin(pin);
        if (valid) {
          setShowPinModal(false);
          createSession();
          setMode(pendingMode || "umpire");
          setPendingMode(null);
        } else {
          setPinError("Incorrect PIN");
        }
      }
    } catch (err) {
      setPinError("Something went wrong. Please try again.");
      console.error("PIN error:", err);
    } finally {
      setPinLoading(false);
    }
  }, [pinMode, pendingMode]);

  // Handle PIN modal cancel
  const handlePinCancel = useCallback(() => {
    setShowPinModal(false);
    setPinError(null);
    setPinMode(null);
    setPendingMode(null);
  }, []);

  // Lock umpire mode (clear session)
  const handleLock = useCallback(() => {
    clearSession();
    setMode(null);
  }, []);

  if (mode === "umpire") return <Shell><UmpireMode onBack={() => setMode(null)} onLock={handleLock} /></Shell>;
  if (mode === "spectator") return <Shell><SpectatorMode onBack={() => setMode(null)} /></Shell>;
  if (mode === "admin") return <Shell><AdminMode onBack={() => setMode(null)} /></Shell>;
  if (mode === "tournament") return <Shell><TournamentMode onBack={() => setMode(null)} /></Shell>;

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
          onClick={handleUmpireClick}
          icon={<Smartphone size={32} color="#fff" />}
          gradient={`linear-gradient(135deg, ${S.green}, #1a5c38)`}
          borderColor="#34d37a33"
          title="Umpire"
          subtitle={hasPinSet ? "PIN protected" : "Score a match from your phone"}
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

        {/* Tournament button */}
        <ModeButton
          onClick={() => handleProtectedModeClick("tournament")}
          icon={<Trophy size={32} color="#fff" />}
          gradient={`linear-gradient(135deg, ${S.gold}, #b8860b)`}
          borderColor="#d4a84333"
          title="Tournaments"
          subtitle="Create and manage tournament brackets"
        />

        {/* Admin button */}
        <ModeButton
          onClick={handleAdminClick}
          icon={<Settings size={32} color="#fff" />}
          gradient="linear-gradient(135deg, #4a4a4a, #2a2a2a)"
          borderColor="#6b728033"
          title="Admin"
          subtitle={hasPinSet ? "PIN protected" : "Manage matches"}
        />
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <PinModal
          isSetup={pinMode === "setup"}
          onSubmit={handlePinSubmit}
          onCancel={handlePinCancel}
          error={pinError}
          loading={pinLoading}
        />
      )}
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
