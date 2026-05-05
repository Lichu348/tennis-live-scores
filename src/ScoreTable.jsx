import { Trophy } from "lucide-react";
import { getPointDisplay, isDeuce, isDoubles, getTeamDisplayName, getServerName } from "./scoring";
import { S } from "./styles";

export default function ScoreTable({ match, compact, large }) {
  const fontSize = large
    ? { name: 28, score: 36, pts: 30 }
    : compact
      ? { name: 14, score: 18, pts: 16 }
      : { name: 16, score: 22, pts: 20 };

  const pad = compact ? "6px 0" : large ? "10px 0" : "8px 0";

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={thBase}></th>
          {match.sets.map((_, si) => (
            <th key={si} style={{
              ...thBase,
              width: large ? 60 : compact ? 36 : 44,
              textAlign: "center",
            }}>
              {si === match.sets.length - 1 && match.status === "live" ? "" : `S${si + 1}`}
            </th>
          ))}
          {match.status === "live" && (
            <th style={{
              ...thBase,
              width: large ? 70 : compact ? 40 : 50,
              textAlign: "center",
            }}>
              {match.isMatchTiebreak ? "MTB" : match.isTiebreak ? "TB" : "Pts"}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {[0, 1].map(pi => {
          const isWinner = match.status === "finished" && match.winner === pi;
          return (
            <tr key={pi} style={{ borderTop: pi === 1 ? `1px solid ${S.border}` : "none" }}>
              {/* Player/Team name */}
              <td style={{ padding: pad, display: "flex", alignItems: "center", gap: 6 }}>
                {/* Server indicator: for doubles, check if current server's team matches */}
                {match.status === "live" && (
                  isDoubles(match)
                    ? (pi === 0 ? match.server < 2 : match.server >= 2) && (
                        <div style={{
                          width: compact ? 6 : 8,
                          height: compact ? 6 : 8,
                          borderRadius: "50%",
                          background: S.goldBright,
                          flexShrink: 0,
                        }} />
                      )
                    : match.server === pi && (
                        <div style={{
                          width: compact ? 6 : 8,
                          height: compact ? 6 : 8,
                          borderRadius: "50%",
                          background: S.goldBright,
                          flexShrink: 0,
                        }} />
                      )
                )}
                {isWinner && <Trophy size={compact ? 12 : 16} color={S.gold} style={{ flexShrink: 0 }} />}
                <span style={{
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: fontSize.name,
                  fontWeight: isWinner ? 700 : 500,
                  color: isWinner ? S.gold : match.status === "finished" && !isWinner ? S.textDim : S.text,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: large ? 280 : compact ? 140 : 180,
                  display: "inline-block",
                }}>
                  {getTeamDisplayName(match, pi)}
                </span>
              </td>

              {/* Set scores */}
              {match.sets.map((set, si) => {
                const isCurrent = si === match.sets.length - 1 && match.status === "live";
                const wonSet = set[pi] > set[1 - pi] && !isCurrent;
                return (
                  <td key={si} style={{
                    textAlign: "center",
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: fontSize.score,
                    fontWeight: wonSet ? 700 : isCurrent ? 600 : 400,
                    color: isCurrent ? "#fff" : wonSet ? S.text : S.textDim,
                    padding: pad,
                  }}>
                    {set[pi]}
                  </td>
                );
              })}

              {/* Current game points */}
              {match.status === "live" && (
                <td style={{
                  textAlign: "center",
                  fontFamily: "'Oswald', sans-serif",
                  fontSize: fontSize.pts,
                  fontWeight: 600,
                  color: getPointDisplay(match, pi) === "AD" ? S.goldBright : S.greenBright,
                  padding: pad,
                }}>
                  {isDeuce(match) ? "40" : getPointDisplay(match, pi)}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const thBase = {
  textAlign: "left",
  fontSize: 10,
  color: S.textDim,
  fontWeight: 500,
  letterSpacing: 1,
  textTransform: "uppercase",
  paddingBottom: 6,
  fontFamily: "'Barlow', sans-serif",
};
