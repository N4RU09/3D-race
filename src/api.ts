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

export async function submitRaceRecord(playerId: string, trackId: string, finishTimeMs: number): Promise<{ success: boolean; record: RaceRecord }> {
  const res = await fetch(`${API_BASE}/api/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, trackId, finishTimeMs }),
  });
  if (!res.ok) throw new Error("Failed to submit race record");
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
