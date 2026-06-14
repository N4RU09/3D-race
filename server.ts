import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

// Supabase Connection initialization
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const isSupabaseEnabled = !!(supabaseUrl && supabaseAnonKey);

let supabase: any = null;
if (isSupabaseEnabled) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("Supabase core connection established server-side.");
  } catch (error) {
    console.error("Supabase failed initialization:", error);
  }
}

interface Player {
  id: string;
  nickname: string;
  createdAt: string;
}

interface RaceRecord {
  id: string;
  playerId: string;
  nickname: string;
  trackId: string;
  finishTimeMs: number;
  createdAt: string;
}

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
}

// In-memory Room State Tracker for Launch Syncing
interface RoomState {
  status: "waiting" | "playing";
  trackId: string;
  hostId: string;
  lastActivity: number;
}
const roomsState: Record<string, RoomState> = {};

const DB_FILE = path.join(process.cwd(), "db.json");

// Default initial tracks info
const TRACK_DATA = [
  { id: "track-1", name: "Track 1: Beginner Speedway", difficulty: 1, description: "Broad high-speed turns designed for entry-level drivers." },
  { id: "track-2", name: "Track 2: Lakeside Curve", difficulty: 2, description: "Vast, flowing curves bordering a beautiful scenic backdrop." },
  { id: "track-3", name: "Track 3: Canyon Hairpins", difficulty: 3, description: "Tight mountainous bends requiring precise throttle adjustments." },
  { id: "track-4", name: "Track 4: Elevation Shift", difficulty: 4, description: "Frequent rises and drops that momentarily lift tires off the asphalt." },
  { id: "track-5", name: "Track 5: Alpine Maze", difficulty: 5, description: "A highly-complex multi-sequence combination calling for mastery." },
  { id: "track-6", name: "Track 6: Antigravity Grid", difficulty: 6, description: "The ultimate test with extremely narrow boundaries, extreme curves, and sharp angles." }
];

// In-memory store
let players: Record<string, Player> = {};
let raceRecords: RaceRecord[] = [];
const multiplayerLobby: Record<string, MultiplayerState> = {};

// Load DB
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(content);
      players = parsed.players || {};
      raceRecords = parsed.raceRecords || [];
      console.log(`Database loaded successfully. Records: ${raceRecords.length}, Players: ${Object.keys(players).length}`);
    } else {
      saveDB();
    }
  } catch (error) {
    console.error("Failed to load DB, starting fresh", error);
  }
}

// Save DB
function saveDB() {
  try {
    const content = JSON.stringify({ players, raceRecords }, null, 2);
    fs.writeFileSync(DB_FILE, content, "utf-8");
  } catch (error) {
    console.error("Failed to save DB", error);
  }
}

async function startServer() {
  loadDB();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Get track listing
  app.get("/api/tracks", (req, res) => {
    res.json(TRACK_DATA);
  });

  // 1b. Get database/Supabase integration status
  app.get("/api/db-status", async (req, res) => {
    let currentError: any = null;
    let healthy = false;
    
    if (isSupabaseEnabled && supabase) {
      try {
        const { error } = await supabase
          .from("race_records")
          .select("id")
          .limit(1);
        if (error) {
          currentError = error;
          healthy = false;
        } else {
          healthy = true;
        }
      } catch (err: any) {
        currentError = { message: err?.message || String(err) };
        healthy = false;
      }
    }

    res.json({
      supabaseEnabled: isSupabaseEnabled,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 22)}...` : "",
      healthy,
      error: currentError,
      sqlScript: `-- Supabase SQL Editor 에서 아래의 쿼리를 실행해 테이블을 생성해주세요:

-- 1. players 테이블 생성
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) 비활성화하여 기록 통신 에러 방지
ALTER TABLE players DISABLE ROW LEVEL SECURITY;

-- 2. race_records 테이블 생성
CREATE TABLE IF NOT EXISTS race_records (
  id TEXT PRIMARY KEY,
  player_id TEXT,
  "playerId" TEXT,
  nickname TEXT NOT NULL,
  track_id TEXT,
  "trackId" TEXT,
  finish_time_ms BIGINT,
  "finishTimeMs" BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 비활성화하여 기록 통신 에러 방지
ALTER TABLE race_records DISABLE ROW LEVEL SECURITY;

-- 익명/유저 권한 올바르게 설정
GRANT ALL ON TABLE players TO anon;
GRANT ALL ON TABLE players TO authenticated;
GRANT ALL ON TABLE players TO service_role;

GRANT ALL ON TABLE race_records TO anon;
GRANT ALL ON TABLE race_records TO authenticated;
GRANT ALL ON TABLE race_records TO service_role;`
    });
  });

  // 2. Fetch leaderboards by track ID
  app.get("/api/records/:trackId", async (req, res) => {
    const { trackId } = req.params;

    if (isSupabaseEnabled && supabase) {
      try {
        const { data, error } = await supabase
          .from("race_records")
          .select("*")
          .or(`trackId.eq.${trackId},track_id.eq.${trackId}`)
          .limit(200); // Fetch a slightly higher limit to leave room for deduplication

        if (!error && data) {
          const uniqueBests: Record<string, any> = {};
          
          data.forEach((item: any) => {
            const pId = item.playerId ?? item.player_id ?? "unknown";
            const fTime = Number(item.finishTimeMs ?? item.finish_time_ms ?? 9999999);
            const current = {
              id: item.id,
              playerId: pId,
              nickname: item.nickname || "Anonymous Racer",
              trackId: item.trackId ?? item.track_id,
              finishTimeMs: fTime,
              createdAt: item.createdAt ?? item.created_at,
            };

            if (!uniqueBests[pId] || fTime < uniqueBests[pId].finishTimeMs) {
              uniqueBests[pId] = current;
            }
          });

          const formattedRecords = Object.values(uniqueBests)
            .sort((a: any, b: any) => {
              if (a.finishTimeMs !== b.finishTimeMs) {
                return a.finishTimeMs - b.finishTimeMs;
              }
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });

          res.json(formattedRecords);
          return;
        }
        console.error("Supabase query failed, using local JSON store:", error);
      } catch (err) {
        console.error("Supabase fetch exception, defaulting to local JSON:", err);
      }
    }

    // Deduplicate local in-memory records similarly
    const uniqueBestsLocal: Record<string, RaceRecord> = {};
    raceRecords
      .filter((r) => r.trackId === trackId)
      .forEach((r) => {
        if (!uniqueBestsLocal[r.playerId] || r.finishTimeMs < uniqueBestsLocal[r.playerId].finishTimeMs) {
          uniqueBestsLocal[r.playerId] = r;
        }
      });

    const records = Object.values(uniqueBestsLocal)
      .sort((a, b) => {
        if (a.finishTimeMs !== b.finishTimeMs) {
          return a.finishTimeMs - b.finishTimeMs;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    res.json(records);
  });

  // 3. Register or edit player profile
  app.post("/api/players", async (req, res) => {
    const { id, nickname } = req.body;
    if (!id || !nickname) {
      res.status(400).json({ error: "Missing id or nickname." });
      return;
    }

    const currentNickname = nickname.trim().substring(0, 16) || "Racer";
    const playerObj = {
      id,
      nickname: currentNickname,
      createdAt: players[id]?.createdAt || new Date().toISOString(),
    };

    players[id] = playerObj;
    saveDB();

    // Update in multiplayer registry as well
    if (multiplayerLobby[id]) {
      multiplayerLobby[id].nickname = currentNickname;
    }

    // Try Supabase synchronization
    if (isSupabaseEnabled && supabase) {
      try {
        await supabase
          .from("players")
          .upsert({
            id: id,
            nickname: currentNickname,
            created_at: playerObj.createdAt,
            createdAt: playerObj.createdAt
          }, { onConflict: 'id' });
      } catch (err) {
        console.error("Supabase driver synchronization failed:", err);
      }
    }

    res.json(players[id]);
  });

  // 4. Save new race record
  app.post("/api/records", async (req, res) => {
    const { playerId, trackId, finishTimeMs, nickname: reqNickname } = req.body;
    if (!playerId || !trackId || typeof finishTimeMs !== "number") {
      res.status(400).json({ error: "Invalid parameters." });
      return;
    }

    let nickname = reqNickname ? String(reqNickname).trim().substring(0, 16) : null;
    const player = players[playerId];
    if (!nickname) {
      nickname = player ? player.nickname : "Anonymous Racer";
    }

    // In-memory registration recovery if players dictionary got wiped
    if (!player) {
      players[playerId] = {
        id: playerId,
        nickname,
        createdAt: new Date().toISOString(),
      };
      saveDB();
    }

    const record: RaceRecord = {
      id: "rec-" + Math.random().toString(36).substr(2, 9),
      playerId,
      nickname,
      trackId,
      finishTimeMs,
      createdAt: new Date().toISOString(),
    };

    raceRecords.push(record);
    saveDB();

    // Try Supabase storage
    if (isSupabaseEnabled && supabase) {
      try {
        await supabase
          .from("race_records")
          .insert({
            id: record.id,
            player_id: playerId,
            playerId: playerId,
            nickname: nickname,
            track_id: trackId,
            trackId: trackId,
            finish_time_ms: finishTimeMs,
            finishTimeMs: finishTimeMs,
            created_at: record.createdAt,
            createdAt: record.createdAt
          });
      } catch (err) {
        console.error("Supabase record submission sync failed:", err);
      }
    }

    res.json({ success: true, record });
  });

  // 4.5. Multiplayer Lobby Syncing
  app.post("/api/multiplayer/lobby-ping", (req, res) => {
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

  app.post("/api/multiplayer/lobby-start", (req, res) => {
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

  // 5. Multiplayer Realtime Synchronizer
  app.post("/api/multiplayer/sync", (req, res) => {
    const { id, nickname, trackId, color, x, y, z, heading, speed, wheelsAngle, isDrifting, roomCode } = req.body;

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
    };

    // Clean up expired players (inactive for > 4 seconds)
    const now = Date.now();
    const activePlayers = Object.values(multiplayerLobby).filter(
      (p) => p.id !== id && p.trackId === trackId && (p.roomCode || "") === (roomCode || "") && now - p.lastUpdated < 4000
    );

    res.json(activePlayers);
  });

  // Clean lobby periodically
  setInterval(() => {
    const now = Date.now();
    Object.keys(multiplayerLobby).forEach((key) => {
      if (now - multiplayerLobby[key].lastUpdated > 8000) {
        delete multiplayerLobby[key];
      }
    });
  }, 10000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
