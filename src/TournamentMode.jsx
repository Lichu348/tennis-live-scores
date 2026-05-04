import { useState, useEffect } from "react";
import { ChevronLeft, Plus, Trophy, Calendar, Users, Trash2, Play } from "lucide-react";
import { subscribeToTournaments, deleteTournament } from "./firebase";
import { getTournamentProgress } from "./drawGenerator";
import TournamentCreate from "./TournamentCreate";
import TournamentView from "./TournamentView";
import { S } from "./styles";

export default function TournamentMode({ onBack }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // "list" | "create" | "view"
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const unsub = subscribeToTournaments(
      (all) => {
        // Sort: in_progress first, then by date
        const sorted = [...all].sort((a, b) => {
          if (a.status === "in_progress" && b.status !== "in_progress") return -1;
          if (a.status !== "in_progress" && b.status === "in_progress") return 1;
          return b.createdAt - a.createdAt;
        });
        setTournaments(sorted);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load tournaments:", error);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const handleDelete = async (id) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    try {
      await deleteTournament(id);
      setConfirmDelete(null);
    } catch (err) {
      console.error("Failed to delete tournament:", err);
    }
  };

  const handleOpenTournament = (tournament) => {
    setSelectedTournament(tournament);
    setView("view");
  };

  const handleTournamentCreated = (tournament) => {
    setSelectedTournament(tournament);
    setView("view");
  };

  if (view === "create") {
    return (
      <TournamentCreate
        onBack={() => setView("list")}
        onCreated={handleTournamentCreated}
      />
    );
  }

  if (view === "view" && selectedTournament) {
    return (
      <TournamentView
        tournament={selectedTournament}
        onBack={() => {
          setSelectedTournament(null);
          setView("list");
        }}
      />
    );
  }

  // Tournament List View
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
          Tournaments
        </div>
        <button onClick={() => setView("create")} style={createBtn}>
          <Plus size={16} /> New
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: S.textDim }}>
          Loading tournaments...
        </div>
      )}

      {/* Empty state */}
      {!loading && tournaments.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: S.textDim }}>
          <Trophy size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <div style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 18,
            textTransform: "uppercase", letterSpacing: 1,
          }}>
            No tournaments
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Create a tournament to get started
          </div>
          <button
            onClick={() => setView("create")}
            style={{
              marginTop: 20, padding: "12px 24px",
              background: `linear-gradient(135deg, ${S.green}, #1a5c38)`,
              border: "none", borderRadius: 10, color: "#fff",
              fontSize: 15, fontFamily: "'Oswald', sans-serif",
              cursor: "pointer", display: "inline-flex",
              alignItems: "center", gap: 8,
            }}
          >
            <Plus size={18} /> Create Tournament
          </button>
        </div>
      )}

      {/* Tournament List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tournaments.map(tournament => {
          const progress = tournament.rounds ? getTournamentProgress(tournament) : null;
          const isConfirming = confirmDelete === tournament.id;

          return (
            <div
              key={tournament.id}
              style={{
                background: S.surface, borderRadius: 12,
                border: `1px solid ${S.border}`, overflow: "hidden",
              }}
            >
              {/* Tournament header - clickable */}
              <div
                onClick={() => handleOpenTournament(tournament)}
                style={{
                  padding: "16px 20px", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div>
                  <div style={{
                    fontFamily: "'Oswald', sans-serif", fontSize: 18,
                    fontWeight: 600, color: S.text, textTransform: "uppercase",
                    marginBottom: 4,
                  }}>
                    {tournament.name}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: S.textDim }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Users size={12} />
                      {tournament.entries?.length || 0} {tournament.matchType === "doubles" ? "teams" : "players"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={12} />
                      {tournament.startDate || "Not scheduled"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Status badge */}
                  <span style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 11,
                    fontWeight: 600, textTransform: "uppercase",
                    background: tournament.status === "in_progress" ? S.greenBright + "22" :
                                tournament.status === "completed" ? S.gold + "22" : S.surfaceLight,
                    color: tournament.status === "in_progress" ? S.greenBright :
                           tournament.status === "completed" ? S.gold : S.textDim,
                  }}>
                    {tournament.status === "in_progress" ? "Live" :
                     tournament.status === "completed" ? "Complete" :
                     tournament.status === "published" ? "Ready" : "Draft"}
                  </span>
                  {/* Progress */}
                  {progress && progress.totalMatches > 0 && (
                    <span style={{ fontSize: 12, color: S.textDim }}>
                      {progress.completedMatches}/{progress.totalMatches}
                    </span>
                  )}
                </div>
              </div>

              {/* Action bar */}
              <div style={{
                padding: "10px 20px",
                borderTop: `1px solid ${S.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: S.surfaceLight,
              }}>
                <button
                  onClick={() => handleOpenTournament(tournament)}
                  style={{
                    padding: "6px 12px", borderRadius: 6,
                    background: S.surface, border: `1px solid ${S.border}`,
                    color: S.text, fontSize: 12, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                    fontFamily: "'Barlow', sans-serif",
                  }}
                >
                  <Play size={12} />
                  {tournament.status === "draft" ? "Setup" : "Open"}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(tournament.id);
                  }}
                  style={{
                    padding: "6px 12px", borderRadius: 6,
                    background: isConfirming ? S.red + "22" : "transparent",
                    border: isConfirming ? `1px solid ${S.red}` : "none",
                    color: isConfirming ? S.red : S.textDim,
                    fontSize: 12, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                    fontFamily: "'Barlow', sans-serif",
                  }}
                >
                  <Trash2 size={12} />
                  {isConfirming ? "Confirm?" : "Delete"}
                </button>
              </div>
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

const createBtn = {
  padding: "8px 14px", borderRadius: 8,
  background: S.surface, border: `1px solid ${S.border}`,
  color: S.gold, fontSize: 13, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 6,
  fontFamily: "'Barlow', sans-serif", fontWeight: 500,
};
