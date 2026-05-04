import { useState, useEffect } from "react";
import { X, AlertCircle, Check } from "lucide-react";
import { parseScoreString, validateScore, calculateServer, setScore, POINT_NAMES } from "./scoring";
import { S } from "./styles";

/**
 * Modal for adjusting the score when resuming a match (jump-to-score).
 *
 * Props:
 * - match: The current match object
 * - onSubmit: (newMatch) => void - called with adjusted match
 * - onCancel: () => void - called when modal is dismissed
 */
export default function ScoreAdjustModal({ match, onSubmit, onCancel }) {
  // Parse current score for initial values
  const currentSetsStr = match.sets
    .map(s => `${s[0]}-${s[1]}`)
    .join(", ");

  const [setsInput, setSetsInput] = useState(currentSetsStr);
  const [points, setPoints] = useState(match.points || [0, 0]);
  const [server, setServer] = useState(match.server || 0);
  const [error, setError] = useState(null);
  const [previewValid, setPreviewValid] = useState(true);

  // Validate on change
  useEffect(() => {
    const { sets, error: parseError } = parseScoreString(setsInput);
    if (parseError) {
      setError(parseError);
      setPreviewValid(false);
      return;
    }

    const validation = validateScore(sets, points, match.bestOf);
    if (!validation.valid) {
      setError(validation.error);
      setPreviewValid(false);
      return;
    }

    setError(null);
    setPreviewValid(true);
  }, [setsInput, points, match.bestOf]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!previewValid) return;

    try {
      const { sets } = parseScoreString(setsInput);
      const newMatch = setScore(match, sets, points, server);
      onSubmit(newMatch);
    } catch (err) {
      setError(err.message);
    }
  };

  // Auto-calculate server
  const handleAutoServer = () => {
    const { sets } = parseScoreString(setsInput);
    if (sets) {
      const currentSet = sets[sets.length - 1] || [0, 0];
      const isTiebreak = currentSet[0] === 6 && currentSet[1] === 6;
      const autoServer = calculateServer(
        sets,
        isTiebreak,
        isTiebreak ? (points[0] + points[1]) : 0
      );
      setServer(autoServer);
    }
  };

  // Point options for dropdown
  const pointOptions = match.isTiebreak || (
    parseScoreString(setsInput).sets?.[parseScoreString(setsInput).sets?.length - 1]?.[0] === 6 &&
    parseScoreString(setsInput).sets?.[parseScoreString(setsInput).sets?.length - 1]?.[1] === 6
  )
    ? Array.from({ length: 15 }, (_, i) => ({ value: i, label: String(i) }))
    : [
        { value: 0, label: "0" },
        { value: 1, label: "15" },
        { value: 2, label: "30" },
        { value: 3, label: "40" },
        { value: 4, label: "AD" },
      ];

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 22,
            fontWeight: 600, color: S.text, textTransform: "uppercase",
          }}>
            Adjust Score
          </div>
          <button onClick={onCancel} style={closeBtn}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Sets input */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>
              Set Scores
              <input
                type="text"
                value={setsInput}
                onChange={e => setSetsInput(e.target.value)}
                placeholder="e.g., 6-4, 3-2"
                style={inputStyle}
              />
            </label>
            <div style={{ fontSize: 11, color: S.textDim, marginTop: 4 }}>
              Enter completed sets and current set, e.g., "6-4, 3-2"
            </div>
          </div>

          {/* Current game points */}
          <div style={{ marginBottom: 20 }}>
            <div style={labelStyle}>Current Game Points</div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {[0, 1].map(pi => (
                <div key={pi} style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: S.textDim, marginBottom: 4 }}>
                    {match.players[pi]}
                  </div>
                  <select
                    value={points[pi]}
                    onChange={e => {
                      const newPoints = [...points];
                      newPoints[pi] = parseInt(e.target.value, 10);
                      setPoints(newPoints);
                    }}
                    style={selectStyle}
                  >
                    {pointOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Server selection */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={labelStyle}>Server</div>
              <button type="button" onClick={handleAutoServer} style={{
                background: "none", border: "none", color: S.gold,
                cursor: "pointer", fontSize: 11, fontFamily: "'Barlow', sans-serif",
              }}>
                Auto-calculate
              </button>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {[0, 1].map(pi => (
                <button
                  key={pi}
                  type="button"
                  onClick={() => setServer(pi)}
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: 8,
                    border: server === pi ? `2px solid ${S.goldBright}` : `1px solid ${S.border}`,
                    background: server === pi ? "#2a2010" : S.surfaceLight,
                    color: server === pi ? S.goldBright : S.text,
                    cursor: "pointer", fontSize: 14,
                    fontFamily: "'Barlow', sans-serif",
                  }}
                >
                  {match.players[pi]}
                </button>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 12px", borderRadius: 8, marginBottom: 16,
              background: "#dc262622", color: S.red, fontSize: 13,
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!previewValid}
            style={{
              width: "100%", padding: "14px 24px",
              background: previewValid
                ? `linear-gradient(135deg, ${S.green}, #1a5c38)`
                : S.surfaceLight,
              border: "none", borderRadius: 10, color: "#fff",
              fontSize: 16, fontFamily: "'Oswald', sans-serif",
              fontWeight: 600, textTransform: "uppercase",
              cursor: previewValid ? "pointer" : "default",
              opacity: previewValid ? 1 : 0.5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Check size={18} /> Apply Score
          </button>
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
  padding: 24,
  width: "100%",
  maxWidth: 400,
  border: `1px solid ${S.border}`,
};

const closeBtn = {
  background: "none", border: "none",
  color: S.textDim, cursor: "pointer", padding: 4,
};

const labelStyle = {
  display: "block",
  fontSize: 12, color: S.textDim,
  textTransform: "uppercase", letterSpacing: 1,
  marginBottom: 8,
};

const inputStyle = {
  display: "block", width: "100%", marginTop: 6,
  padding: "12px 14px", background: S.surfaceLight,
  border: `1px solid ${S.border}`, borderRadius: 10,
  color: S.text, fontSize: 16, fontFamily: "'Barlow', sans-serif",
  outline: "none", boxSizing: "border-box",
};

const selectStyle = {
  width: "100%", padding: "12px 14px",
  background: S.surfaceLight, border: `1px solid ${S.border}`,
  borderRadius: 10, color: S.text, fontSize: 16,
  fontFamily: "'Barlow', sans-serif", outline: "none",
  cursor: "pointer",
};
