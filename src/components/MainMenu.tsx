import React, { useState, useEffect } from "react";
import { Track, RaceRecord, PlayerProfile } from "../types";
import { TRACK_CONFIGS } from "../tracksData";
import { fetchLeaderboard, registerPlayer, fetchDbStatus, DbStatus, lobbyPing, triggerLobbyStart, LobbyPlayer } from "../api";
import { Trophy, Play, Users, User, Palette, Keyboard, Crown, Database, AlertCircle, Copy, Check, Info, X } from "lucide-react";
import { motion } from "motion/react";

interface MainMenuProps {
  playerId: string;
  nickname: string;
  carColor: string;
  setNickname: (val: string) => void;
  setCarColor: (val: string) => void;
  onStartGame: (trackId: string, isMultiplayer: boolean, roomCode?: string) => void;
  selectedTrackId: string;
  setSelectedTrackId: (id: string) => void;
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
  selectedTrackId,
  setSelectedTrackId,
}: MainMenuProps) {
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [tempNickname, setTempNickname] = useState<string>(nickname);
  const [leaderboard, setLeaderboard] = useState<RaceRecord[]>([]);
  const [isNameSaving, setIsNameSaving] = useState(false);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const [multiplayerAction, setMultiplayerAction] = useState<"create" | "join">("create");
  const [inputRoomCode, setInputRoomCode] = useState<string>("");

  const [activeLobbyCode, setActiveLobbyCode] = useState<string | null>(null);
  const [lobbyMembers, setLobbyMembers] = useState<LobbyPlayer[]>([]);
  const [isLobbyReady, setIsLobbyReady] = useState<boolean>(false);
  const [lobbyHostId, setLobbyHostId] = useState<string>("");
  const [lobbyTrackId, setLobbyTrackId] = useState<string>("");

  // Poll lobby players while sitting inside a lobby
  useEffect(() => {
    if (!activeLobbyCode) return;

    let active = true;
    let timerId: any = null;

    async function tick() {
      try {
        const res = await lobbyPing({
          id: playerId,
          nickname: nickname || "Racer",
          trackId: selectedTrackId,
          color: carColor,
          roomCode: activeLobbyCode,
          isReady: isLobbyReady,
        });

        if (!active || !res) return;

        setLobbyMembers(res.members);
        setLobbyHostId(res.hostId);
        setLobbyTrackId(res.trackId);

        // If host updated track, enforce update on users choice
        if (res.hostId !== playerId && res.trackId && res.trackId !== selectedTrackId) {
          setSelectedTrackId(res.trackId);
        }

        // If rooms status goes "playing", immediately enter 3D sequence
        if (res.status === "playing") {
          active = false;
          setActiveLobbyCode(null);
          onStartGame(res.trackId, true, activeLobbyCode);
        }
      } catch (err) {
        console.error("Lobby polling error:", err);
      }
    }

    // Trigger initial immediately
    tick();

    timerId = setInterval(tick, 1500);

    return () => {
      active = false;
      if (timerId) clearInterval(timerId);
    };
  }, [activeLobbyCode, playerId, nickname, selectedTrackId, carColor, isLobbyReady, onStartGame]);

  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  const loadDbStatus = async () => {
    try {
      const status = await fetchDbStatus();
      setDbStatus(status);
    } catch (err) {
      console.error("Failed checking database connectivity:", err);
    }
  };

  useEffect(() => {
    loadDbStatus();
  }, [leaderboard]);

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
      {activeLobbyCode ? (
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center relative z-10 animate-fade-in">
          <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl space-y-6">
            
            {/* Lobby Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest font-mono">MULTIPLAYER ROOM LOBBY</span>
                </div>
                <h2 className="text-3xl font-black italic tracking-wide text-white mt-1">대기방 로비</h2>
                <p className="text-xs text-slate-400 mt-1">대기방에 참가한 사람들과 함께 실시간으로 레이스를 준비하세요.</p>
              </div>
              
              <div className="bg-slate-950/80 border border-slate-800 px-5 py-3 rounded-2xl flex flex-col items-center md:items-end font-mono">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">ROOM CODE</span>
                <span className="text-2xl font-black text-indigo-400 tracking-widest animate-pulse">{activeLobbyCode}</span>
              </div>
            </div>

            {/* Room Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
              
              {/* Left Side: Drivers list (7 cols) */}
              <div className="md:col-span-7 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                  참가한 운전자 목록 ({lobbyMembers.length} 명)
                </h3>
                
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {lobbyMembers.map((member) => {
                    const isHost = member.id === lobbyHostId;
                    const isMe = member.id === playerId;
                    return (
                      <div
                        key={member.id}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          isMe 
                            ? "bg-slate-950/85 border-indigo-500/40 shadow-md shadow-indigo-500/5" 
                            : "bg-slate-950/40 border-slate-800/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar Paint Circle */}
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center border shadow-inner"
                            style={{ 
                              backgroundColor: `${member.color}15`, 
                              borderColor: member.color 
                            }}
                          >
                            <span 
                              className="w-3.5 h-3.5 rounded-full shadow-md animate-pulse"
                              style={{ backgroundColor: member.color }}
                            />
                          </div>
                          
                          <div>
                            <span className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                              {member.nickname}
                              {isMe && (
                                <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-1.5 py-0.5 rounded uppercase font-mono tracking-wider font-normal">
                                  You
                                </span>
                              )}
                              {isHost && (
                                <span className="text-[9px] bg-amber-500/15 text-amber-505 border border-amber-500/25 px-1.5 py-0.5 rounded uppercase font-mono tracking-wider font-normal flex items-center gap-0.5">
                                  <Crown className="w-2.5 h-2.5 text-amber-500" /> Host
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-550 block font-mono mt-0.5">ID: {member.id.substring(0, 8)}...</span>
                          </div>
                        </div>

                        {/* Status label */}
                        <div>
                          {isHost ? (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/5 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                              READY
                            </span>
                          ) : member.isReady ? (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 text-emerald-400" /> READY
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-950 border border-slate-850 px-2.5 py-1 rounded-lg">
                              WAITING
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {lobbyMembers.length === 0 && (
                    <div className="text-center py-12 text-slate-650 border border-dashed border-slate-800 rounded-xl bg-slate-950/10 animate-pulse font-mono text-xs">
                      WAITING FOR TELEMETRY CONNECTIVITIES...
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Track info & Ready Action (5 cols) */}
              <div className="md:col-span-5 flex flex-col justify-between bg-slate-950/50 border border-slate-850 rounded-2xl p-5 space-y-6">
                
                {/* Track Details */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">SELECTED CORRIDOR</span>
                  
                  <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                    <span className="text-xs font-mono font-bold text-indigo-400">DIFF: ★{selectedTrack.difficulty}</span>
                    <h4 className="font-extrabold text-base text-slate-100 mt-1">{selectedTrack.name}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-1.5">{selectedTrack.description}</p>
                  </div>

                  {/* If you are host, you can select track as well! */}
                  {playerId === lobbyHostId ? (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">트랙 변경 (방장 전용)</label>
                      <select
                        value={selectedTrackId}
                        onChange={(e) => setSelectedTrackId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer shadow-inner"
                      >
                        {TRACK_CONFIGS.map((track) => (
                          <option key={track.id} value={track.id}>
                            {track.name} (★{track.difficulty})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 leading-relaxed italic pl-1">
                      💡 방장(Host)이 선택한 트랙과 실시간 동기화됩니다.
                    </p>
                  )}
                </div>

                {/* Operations & Action Trigger */}
                <div className="space-y-3">
                  {playerId === lobbyHostId ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const success = await triggerLobbyStart(activeLobbyCode);
                        if (success) {
                          setActiveLobbyCode(null);
                          onStartGame(selectedTrackId, true, activeLobbyCode);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black py-3 px-5 rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/25 transition-all outline-none cursor-pointer text-xs uppercase tracking-wider group active:scale-[0.98]"
                    >
                      <Play className="w-4 h-4 fill-white group-hover:translate-x-0.5 transition-transform" />
                      레이스 시작 (START RACE)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsLobbyReady(!isLobbyReady)}
                      className={`w-full flex items-center justify-center gap-2 font-black py-3 px-5 rounded-xl transition-all outline-none cursor-pointer text-xs uppercase tracking-wider active:scale-[0.98] ${
                        isLobbyReady
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/15"
                          : "bg-slate-800 hover:bg-slate-755 text-slate-350 border border-slate-700"
                      }`}
                    >
                      {isLobbyReady ? (
                        <>
                          <Check className="w-4 h-4 text-white shrink-0" />
                          레이스 준비 완료함 (READY)
                        </>
                      ) : (
                        "준비하기 (READY)"
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setActiveLobbyCode(null);
                      setIsLobbyReady(false);
                    }}
                    className="w-full hover:bg-slate-900 border border-slate-800/85 hover:border-slate-700 text-slate-400 hover:text-white font-bold py-2.5 px-5 rounded-xl transition-all cursor-pointer text-[10px] uppercase tracking-wider"
                  >
                    대기방 나가기 (Leave Room)
                  </button>
                </div>

              </div>

            </div>

          </div>
        </main>
      ) : (
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

            <div className="grid grid-cols-2 gap-3">
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

            {isMultiplayer && (
              <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-3">
                <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setMultiplayerAction("create")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase tracking-wide cursor-pointer text-center transition-all ${
                      multiplayerAction === "create"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Create Room
                  </button>
                  <button
                    type="button"
                    onClick={() => setMultiplayerAction("join")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md uppercase tracking-wide cursor-pointer text-center transition-all ${
                      multiplayerAction === "join"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Join Room
                  </button>
                </div>

                {multiplayerAction === "create" ? (
                  <div className="bg-indigo-950/20 border border-indigo-900/30 p-3 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 block">방 개설 가이드</span>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                      💡 우측 하단의 <strong>방 개설하기</strong> 버튼을 누르면 고유 대기방 코드가 임의로 발급되며 대기방 로비가 먼저 개설됩니다. 친구들과 대기방에서 다 같이 만나 준비를 완료한 뒤 게임 플레이를 시작할 수 있습니다.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Room Code (4 Digits)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={inputRoomCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setInputRoomCode(val);
                      }}
                      placeholder="e.g., 4018"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-center text-sm font-black tracking-widest text-indigo-400 outline-none"
                    />
                    <p className="text-[10px] text-slate-500 leading-relaxed font-sans pl-1">
                      💡 초대 받은 4자리 방 코드를 입력한 후 우측 하단의 <strong>방 참가하기</strong> 버튼을 눌러 대기방 로비에 입장하세요.
                    </p>
                  </div>
                )}
              </div>
            )}
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

            {/* Supabase connection status alerts */}
            {dbStatus && dbStatus.supabaseEnabled && (
              dbStatus.healthy ? (
                <div className="mb-4 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-950/10 text-emerald-400 text-xs flex items-center justify-between shadow-sm animate-fade-in font-sans">
                  <div className="flex items-center gap-2.5 font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-555"></span>
                    </span>
                    <span>Supabase 클라우드 데이터베이스 연동 활성화 완료</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded font-mono border border-emerald-500/10">Connected</span>
                </div>
              ) : (
                <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs leading-relaxed space-y-2.5 font-sans animate-pulse">
                  <div className="flex items-center gap-2 font-bold text-amber-200 uppercase tracking-wide">
                    <AlertCircle className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                    <span>Supabase 연결 상태: 테이블 설정 필요 ⚠️</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    환경 변수가 주입되었으나 필수 테이블(<code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-200 font-mono">players</code>, <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-200 font-mono">race_records</code>)이 아직 데이터베이스 상에 존재하지 않아 기록이 저장되지 않습니다.
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setCopiedSql(false);
                        setShowSqlModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg transition-all cursor-pointer text-[10px] uppercase tracking-wider"
                    >
                      <Database className="w-3.5 h-3.5" />
                      테이블 자동 생성 SQL 스크립트 복사하기
                    </button>
                  </div>
                </div>
              )
            )}

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
                <span>
                  {isMultiplayer ? (
                    multiplayerAction === "create" ? (
                      <><strong>{selectedTrack.name}</strong> 트랙 기반으로 새로운 멀티 대기방을 개설합니다.</>
                    ) : (
                      <>방 번호 <strong>{inputRoomCode || "____"}</strong> 대기방으로 참여합니다.</>
                    )
                  ) : (
                    <>이동할 트랙: <strong>{selectedTrack.name}</strong> (싱글플레이어 전용 랩 타임 대결)</>
                  )}
                </span>
              </div>
              
              <button
                id="launch-race-button"
                disabled={isMultiplayer && multiplayerAction === "join" && inputRoomCode.length < 4}
                onClick={() => {
                  if (isMultiplayer) {
                    if (multiplayerAction === "create") {
                      const code = Math.floor(1000 + Math.random() * 9000).toString();
                      setActiveLobbyCode(code);
                      setIsLobbyReady(true); // Host is automatically ready
                    } else {
                      if (inputRoomCode.length === 4) {
                        setActiveLobbyCode(inputRoomCode);
                        setIsLobbyReady(false);
                      }
                    }
                  } else {
                    onStartGame(selectedTrackId, false);
                  }
                }}
                className={`w-full sm:w-auto flex items-center justify-center gap-2.5 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-sm tracking-wider uppercase group ${
                  isMultiplayer && multiplayerAction === "join" && inputRoomCode.length < 4
                    ? "opacity-55 cursor-not-allowed hover:scale-100 bg-slate-800 text-slate-500"
                    : isMultiplayer
                    ? "bg-gradient-to-r from-indigo-650 via-indigo-700 to-indigo-800 hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-600/10 hover:shadow-indigo-500/25"
                    : "bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/10 hover:shadow-blue-500/20"
                }`}
              >
                {isMultiplayer ? (
                  multiplayerAction === "create" ? (
                    <>
                      방 개설하기 (Create Room)
                      <Users className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </>
                  ) : (
                    <>
                      방 참가하기 (Join Room)
                      <Play className="w-4 h-4 fill-white group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )
                ) : (
                  <>
                    레이스 시작 (Start Race)
                    <Play className="w-4 h-4 fill-white group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>

          </section>

        </div>

      </main>
      )}

      {/* Footer detailing project */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-slate-500 text-xs mt-auto font-mono">
        <p>© 2026 3D RACE — Real-time Physics Engine Simulator. Designed in React + Three.js.</p>
      </footer>

      {/* SQL Script Instruction Modal Overlay */}
      {showSqlModal && dbStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-left">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col font-sans">
            <button
              type="button"
              onClick={() => setShowSqlModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-850 pb-3 mb-4">
              <Database className="w-6 h-6 text-amber-500 animate-pulse" />
              <div>
                <h3 className="font-bold text-base text-white">Supabase 데이터베이스 연동 및 테이블 설정 가이드</h3>
                <p className="text-xs text-slate-400 mt-0.5">3D 레이싱 게임의 실시간 멀티플레이어 기록을 클라우드에 영구 저장합니다.</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase font-mono block">💡 간편 해결 절차 (30초 소요):</span>
                <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5 leading-relaxed pl-1">
                  <li>본인의 <strong>Supabase 대시보드</strong>에 로그인합니다.</li>
                  <li>좌측 탭에서 <strong>SQL Editor</strong> 메뉴를 클릭합니다.</li>
                  <li><strong>New Query</strong> 버튼을 누른 다음, 아래 스크립트를 전체 복사해 입력 창에 붙여넣습니다.</li>
                  <li>창 우측 하단의 <strong>Run</strong> (혹은 Cmd/Ctrl + Enter) 버튼을 눌러 스크립트를 활성화합니다!</li>
                </ol>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between pl-1">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold font-mono">SQL Generation Output:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(dbStatus.sqlScript);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      copiedSql
                        ? "bg-emerald-600 text-white"
                        : "bg-indigo-600 hover:bg-indigo-550 text-white"
                    }`}
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        복사 완료!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        스크립트 복사
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <pre className="bg-slate-950 text-[11px] text-indigo-300 p-4 rounded-xl font-mono overflow-x-auto max-h-[300px] border border-slate-800 border-dashed leading-relaxed select-all">
                    {dbStatus.sqlScript}
                  </pre>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center leading-relaxed font-sans">
                ⚠️ 테이블 생성이 완료되면 기록 주기를 기다릴 필요 없이 상단 상태 배지가 <span className="text-emerald-400 font-bold">🟢 연동 성공</span> 상태로 즉시 변경됩니다!
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-850 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all text-xs cursor-pointer uppercase tracking-wider"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
