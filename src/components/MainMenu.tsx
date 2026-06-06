import React, { useState, useEffect } from "react";
import { Track, RaceRecord, PlayerProfile } from "../types";
import { TRACK_CONFIGS } from "../tracksData";
import { fetchLeaderboard, registerPlayer } from "../api";
import { Trophy, Play, Users, User, Palette, Keyboard, Crown } from "lucide-react";
import { motion } from "motion/react";

interface MainMenuProps {
  playerId: string;
  nickname: string;
  carColor: string;
  setNickname: (val: string) => void;
  setCarColor: (val: string) => void;
  onStartGame: (trackId: string, isMultiplayer: boolean) => void;
}

export function formatTime(ms: number): string {
  if (ms === Infinity || isNaN(ms)) return "--:--.--";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const centi = Math.floor((ms % 1000) / 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centi.toString().padStart(2, '0')}`;
}

const COLOR_PALETTE = [
  { name: "Neon Blue", value: "#3b82f6" },
  { name: "Scuderia Red", value: "#ef4444" },
  { name: "Hyper Green", value: "#22c55e" },
  { name: "Acid Yellow", value: "#eab308" },
  { name: "Plum Purple", value: "#a855f7" },
  { name: "Hot Pink", value: "#ec4899" },
  { name: "Carbon Gray", value: "#fbbf24" },
  { name: "Deep Cyan", value: "#06b6d4" },
];

export function MainMenu({
  playerId,
  nickname,
  carColor,
  setNickname,
  setCarColor,
  onStartGame,
}: MainMenuProps) {
  const [selectedTrackId, setSelectedTrackId] = useState<string>("track-1");
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [tempNickname, setTempNickname] = useState<string>(nickname);
  const [leaderboard, setLeaderboard] = useState<RaceRecord[]>([]);
  const [isNameSaving, setIsNameSaving] = useState(false);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Load Leaderboard for selected track
  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingLeaderboard(true);
      try {
        const records = await fetchLeaderboard(selectedTrackId);
        if (active) {
          // Keep only top 8 records
          setLeaderboard(records.slice(0, 8));
        }
      } catch (err) {
        console.error("Error loading track leaderboard:", err);
      } finally {
        if (active) setLoadingLeaderboard(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [selectedTrackId]);

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempNickname.trim()) return;
    setIsNameSaving(true);
    try {
      const p = await registerPlayer(playerId, tempNickname);
      setNickname(p.nickname);
    } catch (err) {
      console.error(err);
    } finally {
      setIsNameSaving(false);
    }
  };

  const selectedTrack = TRACK_CONFIGS.find((t) => t.id === selectedTrackId) || TRACK_CONFIGS[0];

  return (
    <div id="main-menu-container" className="min-h-screen bg-slate-950 text-white flex flex-col font-sans selection:bg-blue-500/30 selection:text-blue-300">
      {/* Visual background lights */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="font-black text-xl tracking-wider text-white">3D</span>
            </div>
            <div>
              <h1 className="text-2xl font-black italic tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                3D RACE
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">High Speed Simulation</p>
            </div>
          </div>

          {/* Quick status information */}
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>ONLINE LOBBY ACTIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Column - Setup & Options (5 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Profile Card */}
          <section id="driver-profile-setup" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-blue-500" />
              Driver Profile
            </h2>
            
            <form onSubmit={handleSaveNickname} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Driver Nickname</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={16}
                    value={tempNickname}
                    onChange={(e) => setTempNickname(e.target.value)}
                    placeholder="Enter your handle..."
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2.5 text-sm font-medium transition-all outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isNameSaving || tempNickname === nickname}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 cursor-pointer disabled:cursor-not-allowed px-4 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all"
                  >
                    {isNameSaving ? "Saving" : "Apply"}
                  </button>
                </div>
              </div>
            </form>

            {/* Car paint styling colors */}
            <div className="mt-5 pt-5 border-t border-slate-800/60">
              <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Select Car Livery
              </label>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCarColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className={`h-9 rounded-lg transition-transform relative cursor-pointer ${
                      carColor === c.value
                        ? "ring-2 ring-white scale-110 shadow-lg shadow-white/10 z-10"
                        : "opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                    title={c.name}
                  >
                    {carColor === c.value && (
                      <span className="absolute inset-0 bg-white/20 rounded-lg animate-ping pointer-events-none" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Game Mode Configuration */}
          <section id="game-mode-setup" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-indigo-400" />
              Game Mode
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setIsMultiplayer(false)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer ${
                  !isMultiplayer
                    ? "bg-slate-950/80 border-blue-500 shadow-lg shadow-blue-500/5 text-blue-400"
                    : "bg-slate-900/30 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                }`}
              >
                <Crown className="w-5 h-5 mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider">Single Player</span>
                <span className="text-[10px] text-slate-500 mt-1">Free Sandbox Run</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMultiplayer(true)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer ${
                  isMultiplayer
                    ? "bg-slate-950/80 border-indigo-500 shadow-lg shadow-indigo-500/5 text-indigo-400"
                    : "bg-slate-900/30 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                }`}
              >
                <Users className="w-5 h-5 mb-2 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Multiplayer</span>
                <span className="text-[10px] text-slate-500 mt-1">Real-time Ghost Sync</span>
              </button>
            </div>

            {/* HIGHLY VISIBLE PRIMARY RACE PLAY BUTTON */}
            <div className="pt-2 border-t border-slate-800/40">
              <button
                id="main-play-button"
                onClick={() => onStartGame(selectedTrackId, isMultiplayer)}
                className="w-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-cyan-400 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-emerald-500/10 hover:shadow-emerald-400/20 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer text-center relative group overflow-hidden"
              >
                <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <div className="flex items-center gap-2 text-base tracking-wider uppercase font-extrabold">
                  <Play className="w-5 h-5 fill-white animate-pulse" />
                  RACE START / 게임 시작
                </div>
                <span className="text-[10px] font-sans text-emerald-100 font-medium tracking-normal">
                  Click to start on: <strong className="font-bold underline">{selectedTrack.name.split(":")[1] || selectedTrack.name}</strong>
                </span>
              </button>
            </div>
          </section>

          {/* Cockpit controls instructions */}
          <section className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 text-slate-400 space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <Keyboard className="w-4 h-4" /> Steering Controls
            </h3>
            <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-2 font-mono">
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-500">Accelerate:</span>
                <span className="text-blue-400">W / ↑</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-500">Steer Left:</span>
                <span className="text-blue-400">A / ←</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-500">Brake / Rev:</span>
                <span className="text-blue-400">S / ↓</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-500">Steer Right:</span>
                <span className="text-blue-400">D / →</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-500">Drift Slide:</span>
                <span className="text-purple-400">SPACEBAR</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1">
                <span className="text-slate-500">Respawn:</span>
                <span className="text-orange-400">R</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans pt-1">
              💡 Drift through hairpins at high speed for maximum drift angle and maintaining peak curves! Off-road grass reduces maximum speed dramatically.
            </p>
          </section>

        </div>

        {/* Right Column - Track Selection & Top Records (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Track choosing list */}
          <section id="track-selection" className="space-y-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-500" />
              Select Racing Circuit
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TRACK_CONFIGS.map((track) => {
                const isSelected = selectedTrackId === track.id;
                return (
                  <button
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                    className={`text-left p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 border-blue-500/80 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/20"
                        : "bg-slate-900/40 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/60"
                    }`}
                  >
                    {/* Track difficulty graphic bar */}
                    <div className="flex items-start justify-between gap-2 mb-2 relative z-10">
                      <div>
                        <h4 className="font-bold text-base text-white tracking-wide group-hover:text-blue-300 transition-colors">
                          {track.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-1">Difficulty:</span>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                i < track.difficulty
                                  ? track.difficulty > 4
                                    ? "bg-rose-500"
                                    : track.difficulty > 2
                                    ? "bg-amber-500"
                                    : "bg-green-500"
                                  : "bg-slate-800"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          Width: {track.roadWidth}m
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed font-sans relative z-10 line-clamp-2">
                      {track.description}
                    </p>

                    {/* Aesthetic background indicator */}
                    <div className="absolute right-0 bottom-0 translate-y-3 translate-x-3 text-7xl font-sans font-black italic select-none opacity-[0.02] text-white group-hover:opacity-[0.05] transition-opacity uppercase">
                      T{track.id.split("-")[1]}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Grid detailing selected track leaderboards */}
          <section id="track-leaderboards" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  {selectedTrack.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Active global records sorted by fastest completing speed.</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-slate-400 uppercase bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 inline-block font-semibold">
                  Track {selectedTrack.id.split("-")[1]}
                </span>
              </div>
            </div>

            {loadingLeaderboard ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-white animate-spin mb-4" />
                <span className="text-sm font-mono">RETRIEVING LAP ARCHIVES...</span>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-500 border border-dashed border-slate-800/80 rounded-xl bg-slate-950/25">
                <Trophy className="w-10 h-10 mb-3 text-slate-700" />
                <p className="text-sm font-bold uppercase tracking-wider">No Records Catalogued</p>
                <p className="text-xs text-slate-600 mt-1 max-w-xs">Be the first player to traverse this corridor and immortalize your record on the board!</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto rounded-xl border border-slate-800/50 bg-slate-950/40">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-900/20 text-slate-500 text-[10px] font-bold uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 w-12 text-center">Rank</th>
                      <th className="py-3 px-4">Driver</th>
                      <th className="py-3 px-4 text-right">Finish Time</th>
                      <th className="py-3 px-4 text-center">Date Traveled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-xs font-mono">
                    {leaderboard.map((record, index) => {
                      const isGold = index === 0;
                      const isSilver = index === 1;
                      const isBronze = index === 2;
                      return (
                        <tr
                          key={record.id}
                          className={`hover:bg-slate-900/40 transition-colors ${
                            record.playerId === playerId ? "bg-blue-600/5 font-semibold text-blue-300" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center font-bold">
                            {isGold ? (
                              <span className="text-amber-400 text-sm">🏆</span>
                            ) : isSilver ? (
                              <span className="text-slate-300 text-sm">🥈</span>
                            ) : isBronze ? (
                              <span className="text-amber-600 text-sm">🥉</span>
                            ) : (
                              index + 1
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-sans font-medium text-slate-200">
                            <span className="flex items-center gap-2">
                              {record.nickname}
                              {record.playerId === playerId && (
                                <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded uppercase font-mono tracking-wider font-normal">
                                  You
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right text-base font-black text-rose-400 tracking-wide">
                            {formatTime(record.finishTimeMs)}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-500 text-[11px] font-sans">
                            {new Date(record.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Ready overlay trigger */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-slate-400 text-xs flex items-center gap-2 font-sans font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                <span>Ready to start the race on <strong>{selectedTrack.name}</strong></span>
              </div>
              
              <button
                id="launch-race-button"
                onClick={() => onStartGame(selectedTrackId, isMultiplayer)}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-cyan-400 text-white font-black py-4 px-8 rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-sm tracking-wider uppercase group"
              >
                RACE START / 게임 시작
                <Play className="w-4 h-4 fill-white group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

          </section>

        </div>

      </main>

      {/* Footer detailing project */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-slate-500 text-xs mt-auto font-mono">
        <p>© 2026 3D RACE — Real-time Physics Engine Simulator. Designed in React + Three.js.</p>
      </footer>
    </div>
  );
}
