export interface Track {
  id: string;
  name: string;
  difficulty: number;
  description: string;
}

export interface PlayerProfile {
  id: string;
  nickname: string;
  createdAt: string;
}

export interface RaceRecord {
  id: string;
  playerId: string;
  nickname: string;
  trackId: string;
  finishTimeMs: number;
  createdAt: string;
}

export interface CarControlState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
  respawn: boolean;
}

export interface CarPhysicsState {
  x: number;
  y: number;
  z: number;
  speed: number;
  heading: number; // in radians
  angularVelocity: number;
  wheelsAngle: number;
  isDrifting: boolean;
}

export interface OpponentState {
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
}
