import { Track, RaceRecord, PlayerProfile, OpponentState } from "./types";

const API_BASE = "";

export async function fetchTracks(): Promise<Track[]> {
  const res = await fetch(`${API_BASE}/api/tracks`);
  if (!res.ok) throw new Error("Failed to fetch tracks");
  return res.json();
}

export async function fetchLeaderboard(trackId: string): Promise<RaceRecord[]> {
  const res = await fetch(`${API_BASE}/api/records/${trackId}`);
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  return res.json();
}

export async function registerPlayer(id: string, nickname: string): Promise<PlayerProfile> {
  const res = await fetch(`${API_BASE}/api/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, nickname }),
  });
  if (!res.ok) throw new Error("Failed to register player");
  return res.json();
}

export async function submitRaceRecord(playerId: string, trackId: string, finishTimeMs: number, nickname: string): Promise<{ success: boolean; record: RaceRecord }> {
  const res = await fetch(`${API_BASE}/api/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, trackId, finishTimeMs, nickname }),
  });
  if (!res.ok) throw new Error("Failed to submit race record");
  return res.json();
}

export interface DbStatus {
  supabaseEnabled: boolean;
  supabaseUrl: string;
  healthy: boolean;
  error: any;
  sqlScript: string;
}

export async function fetchDbStatus(): Promise<DbStatus> {
  const res = await fetch(`${API_BASE}/api/db-status`);
  if (!res.ok) throw new Error("Failed to fetch database status");
  return res.json();
}

export async function syncMultiplayer(state: {
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
  roomCode?: string;
  progress?: number;
}): Promise<OpponentState[]> {
  try {
    const res = await fetch(`${API_BASE}/api/multiplayer/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.warn("Multiplayer sync failed, offline fallbacks active", error);
    return [];
  }
}

export interface LobbyPlayer {
  id: string;
  nickname: string;
  color: string;
  isReady: boolean;
}

export interface LobbyResponse {
  status: "waiting" | "playing";
  trackId: string;
  hostId: string;
  members: LobbyPlayer[];
}

export async function lobbyPing(state: {
  id: string;
  nickname: string;
  trackId: string;
  color: string;
  roomCode: string;
  isReady: boolean;
}): Promise<LobbyResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/multiplayer/lobby-ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.warn("Lobby ping failed:", error);
    return null;
  }
}

export async function triggerLobbyStart(roomCode: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/multiplayer/lobby-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode }),
    });
    return res.ok;
  } catch (error) {
    console.warn("Failed to trigger lobby launch:", error);
    return false;
  }
}
