import { useState } from "react";
import { Lock, X, Eye, EyeOff } from "lucide-react";
import { S } from "./styles";

/**
 * PIN entry/setup modal.
 *
 * Props:
 * - isSetup: boolean - true for PIN creation, false for PIN entry
 * - onSubmit: (pin: string) => void - called when PIN is submitted
 * - onCancel: () => void - called when modal is dismissed
 * - error: string | null - error message to display
 * - loading: boolean - show loading state
 */
export default function PinModal({ isSetup, onSubmit, onCancel, error, loading }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;

    if (isSetup) {
      if (pin.length < 4) return;
      if (pin !== confirmPin) return;
    } else {
      if (!pin) return;
    }

    onSubmit(pin);
  };

  const isValid = isSetup
    ? pin.length >= 4 && pin === confirmPin
    : pin.length > 0;

  const confirmError = isSetup && confirmPin && pin !== confirmPin
    ? "PINs don't match"
    : null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Close button */}
        <button onClick={onCancel} style={closeBtn}>
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Lock size={32} color={S.gold} style={{ marginBottom: 8 }} />
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 24,
            fontWeight: 600, color: S.text, textTransform: "uppercase",
          }}>
            {isSetup ? "Set Umpire PIN" : "Enter PIN"}
          </div>
          <div style={{ fontSize: 13, color: S.textDim, marginTop: 4 }}>
            {isSetup
              ? "Create a PIN to protect umpire access"
              : "Enter PIN to access umpire mode"}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* PIN input */}
          <div style={{ marginBottom: isSetup ? 16 : 24 }}>
            <div style={{ position: "relative" }}>
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder={isSetup ? "Enter 4-8 digit PIN" : "Enter PIN"}
                autoFocus
                style={inputStyle}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={eyeBtn}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm PIN (setup only) */}
          {isSetup && (
            <div style={{ marginBottom: 24 }}>
              <input
                type={showPin ? "text" : "password"}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Confirm PIN"
                style={inputStyle}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              {confirmError && (
                <div style={{ color: S.red, fontSize: 12, marginTop: 6 }}>
                  {confirmError}
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={{
              color: S.red, fontSize: 13, textAlign: "center",
              marginBottom: 16, padding: "8px 12px",
              background: "#ef444422", borderRadius: 6,
            }}>
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!isValid || loading}
            style={{
              width: "100%", padding: "14px 24px",
              background: isValid && !loading
                ? `linear-gradient(135deg, ${S.green}, #1a5c38)`
                : S.surfaceLight,
              border: "none", borderRadius: 10, color: "#fff",
              fontSize: 16, fontFamily: "'Oswald', sans-serif",
              fontWeight: 600, textTransform: "uppercase",
              cursor: isValid && !loading ? "pointer" : "default",
              opacity: isValid && !loading ? 1 : 0.5,
            }}
          >
            {loading ? "Verifying..." : isSetup ? "Set PIN" : "Unlock"}
          </button>

          {/* Skip setup option */}
          {isSetup && (
            <button
              type="button"
              onClick={() => onSubmit(null)}
              style={{
                width: "100%", marginTop: 12, padding: "10px 24px",
                background: "none", border: `1px solid ${S.border}`,
                borderRadius: 10, color: S.textDim, fontSize: 13,
                cursor: "pointer", fontFamily: "'Barlow', sans-serif",
              }}
            >
              Skip for now (no PIN protection)
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0, 0, 0, 0.8)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 20, zIndex: 1000,
};

const modalStyle = {
  background: S.surface,
  borderRadius: 16,
  padding: 28,
  width: "100%",
  maxWidth: 360,
  position: "relative",
  border: `1px solid ${S.border}`,
};

const closeBtn = {
  position: "absolute",
  top: 12, right: 12,
  background: "none", border: "none",
  color: S.textDim, cursor: "pointer",
  padding: 4,
};

const inputStyle = {
  width: "100%",
  padding: "14px 48px 14px 16px",
  background: S.surfaceLight,
  border: `1px solid ${S.border}`,
  borderRadius: 10,
  color: S.text,
  fontSize: 18,
  fontFamily: "'Barlow', sans-serif",
  letterSpacing: 4,
  textAlign: "center",
  outline: "none",
  boxSizing: "border-box",
};

const eyeBtn = {
  position: "absolute",
  right: 12, top: "50%",
  transform: "translateY(-50%)",
  background: "none", border: "none",
  color: S.textDim, cursor: "pointer",
  padding: 4,
};
