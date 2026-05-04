import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Trophy, AlertCircle } from "lucide-react";
import { createTournament } from "./firebase";
import { generateSingleElimination, generateRoundRobin, nextPowerOf2 } from "./drawGenerator";
import { S } from "./styles";

/**
 * Tournament creation wizard.
 * Steps:
 * 1. Basic info (name, dates, format)
 * 2. Add entries
 * 3. Seeding
 * 4. Generate draw
 */
export default function TournamentCreate({ onBack, onCreated }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Tournament data
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [format, setFormat] = useState("single_elimination");
  const [matchType, setMatchType] = useState("singles");
  const [bestOf, setBestOf] = useState(3);
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState("");

  // Derived values
  const minDrawSize = nextPowerOf2(entries.length);
  const drawSizeOptions = format === "round_robin"
    ? [entries.length]
    : [4, 8, 16, 32].filter(s => s >= entries.length);
  const [drawSize, setDrawSize] = useState(8);

  const handleAddEntry = () => {
    if (!newEntry.trim()) return;
    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setEntries([...entries, {
      id,
      name: newEntry.trim(),
      seed: entries.length + 1,
    }]);
    setNewEntry("");
  };

  const handleRemoveEntry = (id) => {
    const filtered = entries.filter(e => e.id !== id);
    // Re-number seeds
    const reseeded = filtered.map((e, i) => ({ ...e, seed: i + 1 }));
    setEntries(reseeded);
  };

  const handleMoveSeed = (index, direction) => {
    if (
      (direction === -1 && index === 0) ||
      (direction === 1 && index === entries.length - 1)
    ) return;

    const newEntries = [...entries];
    const swapIdx = index + direction;
    [newEntries[index], newEntries[swapIdx]] = [newEntries[swapIdx], newEntries[index]];

    // Re-number seeds
    const reseeded = newEntries.map((e, i) => ({ ...e, seed: i + 1 }));
    setEntries(reseeded);
  };

  const handleGenerateDraw = async () => {
    if (entries.length < 2) {
      setError("Need at least 2 entries to generate a draw");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let draw;
      if (format === "round_robin") {
        draw = generateRoundRobin(entries);
      } else {
        // Single elimination
        const size = drawSize >= entries.length ? drawSize : minDrawSize;
        draw = generateSingleElimination(entries, size);
      }

      const tournament = {
        name: name || "Untitled Tournament",
        startDate,
        format,
        matchType,
        bestOf,
        drawSize: format === "round_robin" ? entries.length : drawSize,
        entries,
        rounds: draw.rounds,
        standings: draw.standings || null,
        status: "published",
      };

      const id = await createTournament(tournament);

      // Return the created tournament
      onCreated({ ...tournament, id });
    } catch (err) {
      console.error("Failed to create tournament:", err);
      setError(err.message);
      setSaving(false);
    }
  };

  // Step 1: Basic Info
  if (step === 1) {
    return (
      <div style={{ padding: 20, minHeight: "100vh" }}>
        <button onClick={onBack} style={backBtn}>
          <ChevronLeft size={18} /> Cancel
        </button>

        <div style={heading}>Create Tournament</div>
        <div style={stepIndicator}>Step 1 of 3: Basic Info</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 400 }}>
          <label style={labelStyle}>
            Tournament Name
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Club Championships 2026"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Start Date
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={inputStyle}
            />
          </label>

          <div>
            <div style={labelStyle}>Format</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {[
                { value: "single_elimination", label: "Single Elimination" },
                { value: "round_robin", label: "Round Robin" },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  style={{
                    padding: "10px 16px", borderRadius: 8,
                    border: format === f.value ? `2px solid ${S.goldBright}` : `1px solid ${S.border}`,
                    background: format === f.value ? "#2a2010" : S.surface,
                    color: format === f.value ? S.goldBright : S.text,
                    fontSize: 13, cursor: "pointer",
                    fontFamily: "'Barlow', sans-serif",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={labelStyle}>Match Type</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {["singles", "doubles"].map(type => (
                <button
                  key={type}
                  onClick={() => setMatchType(type)}
                  style={{
                    padding: "10px 16px", borderRadius: 8,
                    border: matchType === type ? `2px solid ${S.goldBright}` : `1px solid ${S.border}`,
                    background: matchType === type ? "#2a2010" : S.surface,
                    color: matchType === type ? S.goldBright : S.text,
                    fontSize: 13, cursor: "pointer", textTransform: "capitalize",
                    fontFamily: "'Barlow', sans-serif",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={labelStyle}>Match Format</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {[3, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setBestOf(n)}
                  style={{
                    padding: "10px 16px", borderRadius: 8,
                    border: bestOf === n ? `2px solid ${S.goldBright}` : `1px solid ${S.border}`,
                    background: bestOf === n ? "#2a2010" : S.surface,
                    color: bestOf === n ? S.goldBright : S.text,
                    fontSize: 13, cursor: "pointer",
                    fontFamily: "'Barlow', sans-serif",
                  }}
                >
                  Best of {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            style={{
              marginTop: 16, padding: "14px 24px",
              background: `linear-gradient(135deg, ${S.green}, #1a5c38)`,
              border: "none", borderRadius: 10, color: "#fff",
              fontSize: 16, fontFamily: "'Oswald', sans-serif",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            Next: Add Entries <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Add Entries
  if (step === 2) {
    return (
      <div style={{ padding: 20, minHeight: "100vh" }}>
        <button onClick={() => setStep(1)} style={backBtn}>
          <ChevronLeft size={18} /> Back
        </button>

        <div style={heading}>Add {matchType === "doubles" ? "Teams" : "Players"}</div>
        <div style={stepIndicator}>Step 2 of 3: Entries ({entries.length})</div>

        <div style={{ maxWidth: 400 }}>
          {/* Add entry form */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              value={newEntry}
              onChange={e => setNewEntry(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddEntry()}
              placeholder={matchType === "doubles" ? "Team name or Player1/Player2" : "Player name"}
              style={{ ...inputStyle, flex: 1, margin: 0 }}
            />
            <button
              onClick={handleAddEntry}
              style={{
                padding: "0 16px", borderRadius: 10,
                background: S.green, border: "none",
                color: "#fff", cursor: "pointer",
              }}
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Entry list */}
          {entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: S.textDim }}>
              No entries yet. Add {matchType === "doubles" ? "teams" : "players"} above.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {entries.map((entry, idx) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", background: S.surface,
                    borderRadius: 8, border: `1px solid ${S.border}`,
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: S.surfaceLight, color: S.textDim,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {entry.seed}
                  </span>
                  <span style={{ flex: 1, color: S.text, fontSize: 14 }}>
                    {entry.name}
                  </span>
                  <button
                    onClick={() => handleRemoveEntry(entry.id)}
                    style={{
                      background: "none", border: "none",
                      color: S.textDim, cursor: "pointer", padding: 4,
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                flex: 1, padding: "12px 16px",
                background: S.surface, border: `1px solid ${S.border}`,
                borderRadius: 8, color: S.text, cursor: "pointer",
                fontSize: 14, fontFamily: "'Barlow', sans-serif",
              }}
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={entries.length < 2}
              style={{
                flex: 1, padding: "12px 16px",
                background: entries.length < 2 ? S.surfaceLight : `linear-gradient(135deg, ${S.green}, #1a5c38)`,
                border: "none", borderRadius: 8, color: "#fff",
                cursor: entries.length < 2 ? "default" : "pointer",
                opacity: entries.length < 2 ? 0.5 : 1,
                fontSize: 14, fontFamily: "'Oswald', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Seeding & Generate
  return (
    <div style={{ padding: 20, minHeight: "100vh" }}>
      <button onClick={() => setStep(2)} style={backBtn}>
        <ChevronLeft size={18} /> Back
      </button>

      <div style={heading}>Seeding & Draw</div>
      <div style={stepIndicator}>Step 3 of 3: Review and Generate</div>

      <div style={{ maxWidth: 400 }}>
        {/* Draw size selector (for elimination only) */}
        {format === "single_elimination" && (
          <div style={{ marginBottom: 20 }}>
            <div style={labelStyle}>Draw Size</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {drawSizeOptions.map(size => (
                <button
                  key={size}
                  onClick={() => setDrawSize(size)}
                  style={{
                    padding: "10px 20px", borderRadius: 8,
                    border: drawSize === size ? `2px solid ${S.goldBright}` : `1px solid ${S.border}`,
                    background: drawSize === size ? "#2a2010" : S.surface,
                    color: drawSize === size ? S.goldBright : S.text,
                    fontSize: 14, cursor: "pointer",
                    fontFamily: "'Barlow', sans-serif",
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: S.textDim, marginTop: 6 }}>
              {entries.length} entries → {drawSize - entries.length} byes
            </div>
          </div>
        )}

        {/* Seeding list */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Seeding (drag to reorder)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {entries.map((entry, idx) => (
              <div
                key={entry.id}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", background: S.surface,
                  borderRadius: 6, border: `1px solid ${S.border}`,
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: idx < 4 ? S.gold + "33" : S.surfaceLight,
                  color: idx < 4 ? S.gold : S.textDim,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 600,
                }}>
                  {idx + 1}
                </span>
                <span style={{ flex: 1, color: S.text, fontSize: 14 }}>
                  {entry.name}
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => handleMoveSeed(idx, -1)}
                    disabled={idx === 0}
                    style={{
                      padding: "4px 8px", background: S.surfaceLight,
                      border: "none", borderRadius: 4, cursor: idx === 0 ? "default" : "pointer",
                      color: S.textDim, opacity: idx === 0 ? 0.3 : 1,
                    }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveSeed(idx, 1)}
                    disabled={idx === entries.length - 1}
                    style={{
                      padding: "4px 8px", background: S.surfaceLight,
                      border: "none", borderRadius: 4, cursor: idx === entries.length - 1 ? "default" : "pointer",
                      color: S.textDim, opacity: idx === entries.length - 1 ? 0.3 : 1,
                    }}
                  >
                    ↓
                  </button>
                </div>
              </div>
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

        {/* Generate button */}
        <button
          onClick={handleGenerateDraw}
          disabled={saving}
          style={{
            width: "100%", padding: "16px 24px",
            background: saving ? S.surfaceLight : `linear-gradient(135deg, ${S.gold}, #b8860b)`,
            border: "none", borderRadius: 10, color: "#000",
            fontSize: 17, fontFamily: "'Oswald', sans-serif", fontWeight: 600,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <Trophy size={20} />
          {saving ? "Creating..." : "Generate Draw"}
        </button>
      </div>
    </div>
  );
}

const backBtn = {
  background: "none", border: "none", color: S.textDim,
  cursor: "pointer", display: "flex", alignItems: "center",
  gap: 6, marginBottom: 20, fontSize: 14, fontFamily: "'Barlow', sans-serif",
};

const heading = {
  fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 600,
  color: S.gold, textTransform: "uppercase", marginBottom: 8,
};

const stepIndicator = {
  fontSize: 13, color: S.textDim, marginBottom: 24,
};

const labelStyle = {
  display: "block",
  fontSize: 12, color: S.textDim,
  textTransform: "uppercase", letterSpacing: 1,
};

const inputStyle = {
  display: "block", width: "100%", marginTop: 8,
  padding: "12px 14px", background: S.surface,
  border: `1px solid ${S.border}`, borderRadius: 10,
  color: S.text, fontSize: 15, fontFamily: "'Barlow', sans-serif",
  outline: "none", boxSizing: "border-box",
};
