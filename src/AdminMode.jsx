import { useState, useEffect } from "react";
import { ChevronLeft, Trash2, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { subscribeToMatches, removeMatch, deleteOldMatches } from "./firebase";
import { S, COURT_COLORS } from "./styles";

export default function AdminMode({ onBack }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null); // match ID being deleted
  const [confirmDelete, setConfirmDelete] = useState(null); // match ID to confirm
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }

  // Subscribe to all matches
  useEffect(() => {
    const unsub = subscribeToMatches(
      (all) => {
        // Sort: live first, then by date (newest first)
        const sorted = [...all].sort((a, b) => {
          if (a.status === "live" && b.status !== "live") return -1;
          if (a.status !== "live" && b.status === "live") return 1;
          return (b.finishedAt || b.createdAt) - (a.finishedAt || a.createdAt);
        });
        setMatches(sorted);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load matches:", error);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // Delete a single match
  const handleDelete = async (matchId) => {
    if (confirmDelete !== matchId) {
      setConfirmDelete(matchId);
      return;
    }

    setDeleting(matchId);
    setConfirmDelete(null);

    try {
      await removeMatch(matchId);
      setMessage({ type: "success", text: "Match deleted" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Failed to delete match:", err);
      setMessage({ type: "error", text: "Failed to delete match" });
    } finally {
      setDeleting(null);
    }
  };

  // Delete all finished matches
  const handleClearFinished = async () => {
    const finished = matches.filter(m => m.status === "finished");
    if (finished.length === 0) return;

    if (!confirm(`Delete ${finished.length} finished match${finished.length > 1 ? "es" : ""}?`)) {
      return;
    }

    setBulkDeleting(true);

    try {
      for (const match of finished) {
        await removeMatch(match.id);
      }
      setMessage({ type: "success", text: `${finished.length} matches deleted` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Failed to clear matches:", err);
      setMessage({ type: "error", text: "Failed to delete some matches" });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Delete old matches (24+ hours)
  const handleCleanup = async () => {
    setBulkDeleting(true);

    try {
      const count = await deleteOldMatches(24);
      if (count > 0) {
        setMessage({ type: "success", text: `${count} old matches deleted` });
      } else {
        setMessage({ type: "success", text: "No old matches to delete" });
      }
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Failed to cleanup:", err);
      setMessage({ type: "error", text: "Cleanup failed" });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Format date for display
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const liveCount = matches.filter(m => m.status === "live").length;
  const finishedCount = matches.filter(m => m.status === "finished").length;

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
          Match Manager
        </div>
        <div style={{ width: 70 }} /> {/* Spacer for centering */}
      </div>

      {/* Status message */}
      {message && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 16px", borderRadius: 8, marginBottom: 16,
          background: message.type === "success" ? "#16a34a22" : "#dc262622",
          color: message.type === "success" ? "#22c55e" : S.red,
        }}>
          {message.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {/* Stats bar */}
      <div style={{
        display: "flex", gap: 16, marginBottom: 20,
        padding: "12px 16px", background: S.surface,
        borderRadius: 10, border: `1px solid ${S.border}`,
      }}>
        <div>
          <span style={{ color: S.greenBright, fontWeight: 600 }}>{liveCount}</span>
          <span style={{ color: S.textDim, marginLeft: 6, fontSize: 13 }}>Live</span>
        </div>
        <div>
          <span style={{ color: S.textDim, fontWeight: 600 }}>{finishedCount}</span>
          <span style={{ color: S.textDim, marginLeft: 6, fontSize: 13 }}>Finished</span>
        </div>
      </div>

      {/* Bulk actions */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={handleClearFinished}
          disabled={finishedCount === 0 || bulkDeleting}
          style={{
            ...actionBtn,
            opacity: finishedCount === 0 || bulkDeleting ? 0.5 : 1,
            cursor: finishedCount === 0 || bulkDeleting ? "default" : "pointer",
          }}
        >
          <Trash2 size={14} /> Clear Finished ({finishedCount})
        </button>
        <button
          onClick={handleCleanup}
          disabled={bulkDeleting}
          style={{
            ...actionBtn,
            opacity: bulkDeleting ? 0.5 : 1,
            cursor: bulkDeleting ? "default" : "pointer",
          }}
        >
          <Clock size={14} /> Delete 24h+ Old
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: S.textDim }}>
          Loading matches...
        </div>
      )}

      {/* Empty state */}
      {!loading && matches.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: S.textDim }}>
          <Trash2 size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 18,
            textTransform: "uppercase", letterSpacing: 1,
          }}>
            No matches
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Matches will appear here when created
          </div>
        </div>
      )}

      {/* Match list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {matches.map(match => {
          const cc = COURT_COLORS[match.courtIdx] || COURT_COLORS[0];
          const isLive = match.status === "live";
          const isConfirming = confirmDelete === match.id;
          const isDeleting = deleting === match.id;

          // Format score
          const score = match.sets
            .filter((_, i) => i < match.sets.length - 1 || match.status === "finished")
            .map(s => `${s[0]}-${s[1]}`)
            .join(", ") || "0-0";

          return (
            <div
              key={match.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", background: S.surface,
                borderRadius: 10, border: `1px solid ${S.border}`,
              }}
            >
              {/* Match info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: isLive ? S.greenBright : S.textDim,
                  }} />
                  <span style={{ fontSize: 12, color: S.textDim }}>{cc.name}</span>
                  <span style={{
                    fontSize: 10, padding: "2px 6px", borderRadius: 4,
                    background: isLive ? S.greenBright + "22" : S.surfaceLight,
                    color: isLive ? S.greenBright : S.textDim,
                    textTransform: "uppercase",
                  }}>
                    {isLive ? "Live" : "Finished"}
                  </span>
                </div>
                <div style={{ color: S.text, fontWeight: 500, marginBottom: 2 }}>
                  {match.players[0]} vs {match.players[1]}
                </div>
                <div style={{ fontSize: 13, color: S.textDim }}>
                  {score} · {formatDate(match.finishedAt || match.createdAt)}
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDelete(match.id)}
                disabled={isDeleting}
                style={{
                  padding: "8px 12px", borderRadius: 8,
                  border: isConfirming ? `1px solid ${S.red}` : `1px solid ${S.border}`,
                  background: isConfirming ? S.red + "22" : S.surfaceLight,
                  color: isConfirming ? S.red : S.textDim,
                  cursor: isDeleting ? "default" : "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 12, fontFamily: "'Barlow', sans-serif",
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                <Trash2 size={14} />
                {isDeleting ? "..." : isConfirming ? (isLive ? "Delete LIVE?" : "Confirm?") : "Delete"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const backBtn = {
  background: "none", border: "none", color: S.textDim,
  cursor: "pointer", display: "flex", alignItems: "center",
  gap: 6, fontSize: 14, fontFamily: "'Barlow', sans-serif",
};

const actionBtn = {
  padding: "10px 16px", borderRadius: 8,
  background: S.surface, border: `1px solid ${S.border}`,
  color: S.text, fontSize: 13, fontFamily: "'Barlow', sans-serif",
  display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
};
