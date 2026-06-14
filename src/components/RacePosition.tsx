import React, { useMemo } from "react";
import { Award, Users, Trophy } from "lucide-react";

interface OpponentData {
  id: string;
  nickname: string;
  progress?: number;
  color?: string;
}

interface RacePositionProps {
  playerId: string;
  playerNickname: string;
  playerColor?: string;
  playerProgress: number;
  opponents: OpponentData[];
  isMultiplayer: boolean;
}

export function RacePosition({
  playerId,
  playerNickname,
  playerColor = "#3b82f6",
  playerProgress,
  opponents,
  isMultiplayer,
}: RacePositionProps) {

  // Consolidate list of all active racers, including local player and remote peers
  const standings = useMemo(() => {
    const list = [
      {
        id: playerId,
        nickname: playerNickname,
        progress: playerProgress,
        color: playerColor,
        isSelf: true,
      },
    ];

    if (isMultiplayer) {
      opponents.forEach((opp) => {
        list.push({
          id: opp.id,
          nickname: opp.nickname || "Opponent",
          progress: opp.progress ?? 0,
          color: opp.color || "#ef4444",
          isSelf: false,
        });
      });
    }

    // Sort descending by progress (highest track progress = leading standing position)
    return list.sort((a, b) => b.progress - a.progress);
  }, [playerId, playerNickname, playerColor, playerProgress, opponents, isMultiplayer]);

  const selfIndex = standings.findIndex((r) => r.isSelf);
  const currentRank = selfIndex !== -1 ? selfIndex + 1 : 1;
  const totalRacers = standings.length;

  // Convert number rank to ordinal suffix (e.g., 1 -> "1st", 2 -> "2nd", etc.)
  const ordinalSuffix = (num: number) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return num + "st";
    if (j === 2 && k !== 12) return num + "nd";
    if (j === 3 && k !== 13) return num + "rd";
    return num + "th";
  };

  return (
    <div className="flex flex-col gap-2 pointer-events-none animate-fade-in" id="race-rankings-hud">
      {/* Sleek Primary Rank Widget */}
      <div className="flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 shadow-xl pointer-events-auto">
        <div className={`p-2 rounded-xl flex items-center justify-center ${currentRank === 1 ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
          <Trophy className="w-5 h-5" />
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-400">Position</span>
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="font-sans font-extrabold text-2xl text-white tracking-tight">
              {ordinalSuffix(currentRank)}
            </span>
            {isMultiplayer && (
              <span className="font-mono text-xs text-slate-400">
                / {totalRacers}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mini Live Standings Grid (Only rendered if multiplayer or multiple racers present) */}
      {isMultiplayer && standings.length > 1 && (
        <div className="bg-slate-950/75 backdrop-blur-sm p-3 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-1.5 w-44 md:w-48 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Users className="w-3 h-3" /> Live Standings
            </span>
          </div>

          {standings.slice(0, 5).map((racer, index) => {
            const lapVal = Math.floor(racer.progress) + 1;
            const cappedLap = Math.min(3, lapVal);
            
            return (
              <div
                key={racer.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs leading-none transition-colors ${
                  racer.isSelf
                    ? "bg-blue-500/10 border border-blue-500/20 text-blue-300"
                    : "bg-white/[0.02] text-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                  <span className={`font-mono text-[9px] font-bold px-1 rounded ${
                    index === 0 ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                  }`}>
                    {index + 1}
                  </span>
                  
                  {/* Color pill */}
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: racer.color }}
                  />

                  <span className="truncate font-medium">
                    {racer.nickname}
                  </span>
                </div>

                <span className="font-mono text-[9px] text-slate-400 shrink-0">
                  {racer.progress >= 3.0 ? "FINISHED" : `Lap ${cappedLap}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
