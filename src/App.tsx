import { useState, useEffect } from "react";
import { MainMenu } from "./components/MainMenu";
import { RacingGame } from "./components/RacingGame";
import { registerPlayer } from "./api";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [playerId, setPlayerId] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [carColor, setCarColor] = useState<string>("#3b82f6");
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Initialize unique stable player ID and register nickname
  useEffect(() => {
    let savedId = localStorage.getItem("racer_player_id");
    let savedName = localStorage.getItem("racer_player_nickname") || "";
    let savedColor = localStorage.getItem("racer_player_color") || "#3b82f6";

    if (!savedId) {
      savedId = "racer-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("racer_player_id", savedId);
    }
    if (!savedName) {
      savedName = "Driver " + Math.random().toString(36).substring(2, 6).toUpperCase();
      localStorage.setItem("racer_player_nickname", savedName);
    }

    setPlayerId(savedId);
    setCarColor(savedColor);

    // Register player with backend database
    async function load() {
      try {
        const p = await registerPlayer(savedId!, savedName);
        setNickname(p.nickname);
      } catch (err) {
        console.warn("Express database initialization deferred, offline storage in action", err);
        setNickname(savedName);
      } finally {
        setIsInitializing(false);
      }
    }
    load();
  }, []);

  // Sync color changes or name updates locally
  const handleSetCarColor = (col: string) => {
    setCarColor(col);
    localStorage.setItem("racer_player_color", col);
  };

  const handleSetNickname = (name: string) => {
    setNickname(name);
    localStorage.setItem("racer_player_nickname", name);
  };

  const [selectedTrackId, setSelectedTrackId] = useState<string>("track-1");

  const handleStartGame = (trackId: string, multiplayerMode: boolean, roomCode?: string) => {
    setIsMultiplayer(multiplayerMode);
    setActiveRoomCode(roomCode || null);
    setActiveTrackId(trackId);
    setSelectedTrackId(trackId);
  };

  const handleExitGame = () => {
    setActiveRoomCode(null);
    setActiveTrackId(null);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center font-mono">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 animate-spin mb-4 shadow-lg shadow-blue-500/20" />
        <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">INITIALIZING ENGINES...</span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-950 overflow-hidden">
      <AnimatePresence mode="wait">
        {activeTrackId === null ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full overflow-y-auto"
          >
            <MainMenu
              playerId={playerId}
              nickname={nickname}
              carColor={carColor}
              setNickname={handleSetNickname}
              setCarColor={handleSetCarColor}
              onStartGame={handleStartGame}
              selectedTrackId={selectedTrackId}
              setSelectedTrackId={setSelectedTrackId}
            />
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full h-full"
          >
            <RacingGame
              playerId={playerId}
              nickname={nickname}
              carColor={carColor}
              trackId={activeTrackId}
              isMultiplayer={isMultiplayer}
              roomCode={activeRoomCode || undefined}
              onExit={handleExitGame}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
