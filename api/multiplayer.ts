import express from "express";

const app = express();
app.use(express.json());

interface MultiplayerState {
  id: string;
  nickname: string;
  trackId: string;
  color: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  wheelsAngle: number;
  isDrifting: boolean;
  lastUpdated: number;
  roomCode?: string;
  isReady?: boolean;
  inLobby?: boolean;
  progress?: number;
}

interface RoomState {
  status: "waiting" | "playing";
  trackId: string;
  hostId: string;
  lastActivity: number;
}

// In-memory collections inside Vercel Function instances
const roomsState: Record<string, any> = {};
const multiplayerLobby: Record<string, any> = {};

// 1. Lobby Ping
app.post(["/api/multiplayer/lobby-ping", "/lobby-ping"], (req, res) => {
  const { id, nickname, trackId, color, roomCode, isReady } = req.body;
  if (!id || !roomCode) {
    res.status(400).json({ error: "id and roomCode are required." });
    return;
  }

  const normalizedRoom = String(roomCode).trim();

  // Register lobby player status
  multiplayerLobby[id] = {
    id,
    nickname: (nickname || "Guest").substring(0, 16),
    trackId: trackId || "track-1",
    color: color || "#3b82f6",
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    speed: 0,
    wheelsAngle: 0,
    isDrifting: false,
    lastUpdated: Date.now(),
    roomCode: normalizedRoom,
    isReady: !!isReady,
    inLobby: true,
  };
  
  // Update or initialize room status
  if (!roomsState[normalizedRoom]) {
    roomsState[normalizedRoom] = {
      status: "waiting",
      trackId: trackId || "track-1",
      hostId: id,
      lastActivity: Date.now(),
    };
  } else {
    roomsState[normalizedRoom].lastActivity = Date.now();
    // If host is pinging, update global track choice
    if (roomsState[normalizedRoom].hostId === id && trackId) {
      roomsState[normalizedRoom].trackId = trackId;
    }
  }

  const now = Date.now();
  // Fetch members in same room within 4 seconds window
  const members = Object.values(multiplayerLobby).filter(
    (p) => (p.roomCode || "") === normalizedRoom && now - p.lastUpdated < 4000
  ).map(p => ({
    id: p.id,
    nickname: p.nickname,
    color: p.color,
    isReady: !!p.isReady,
  }));

  res.json({
    status: roomsState[normalizedRoom].status,
    trackId: roomsState[normalizedRoom].trackId,
    hostId: roomsState[normalizedRoom].hostId,
    members,
  });
});

// 2. Lobby Start
app.post(["/api/multiplayer/lobby-start", "/lobby-start"], (req, res) => {
  const { roomCode } = req.body;
  if (!roomCode) {
    res.status(400).json({ error: "roomCode is required." });
    return;
  }

  const normalizedRoom = String(roomCode).trim();
  if (roomsState[normalizedRoom]) {
    roomsState[normalizedRoom].status = "playing";
    roomsState[normalizedRoom].lastActivity = Date.now();
    res.json({ success: true, status: "playing" });
  } else {
    res.status(404).json({ error: "Room not found." });
  }
});

// 3. Coordination Synchronization in Active gameplay
app.post(["/api/multiplayer/sync", "/sync"], (req, res) => {
  const { id, nickname, trackId, color, x, y, z, heading, speed, wheelsAngle, isDrifting, roomCode, progress } = req.body;

  if (!id || !trackId) {
    res.status(400).json({ error: "id and trackId are required." });
    return;
  }

  // Register/update state in lobby
  multiplayerLobby[id] = {
    id,
    nickname: (nickname || "Guest").substring(0, 16),
    trackId,
    color: color || "#3b82f6",
    x: typeof x === "number" ? x : 0,
    y: typeof y === "number" ? y : 0,
    z: typeof z === "number" ? z : 0,
    heading: typeof heading === "number" ? heading : 0,
    speed: typeof speed === "number" ? speed : 0,
    wheelsAngle: typeof wheelsAngle === "number" ? wheelsAngle : 0,
    isDrifting: !!isDrifting,
    lastUpdated: Date.now(),
    roomCode: roomCode || "",
    progress: typeof progress === "number" ? progress : 0,
  };

  // Clean up expired players (inactive for > 4 seconds)
  const now = Date.now();
  const activePlayers = Object.values(multiplayerLobby).filter(
    (p) => p.id !== id && p.trackId === trackId && (p.roomCode || "") === (roomCode || "") && now - p.lastUpdated < 4000
  );

  res.json(activePlayers);
});

export default app;
