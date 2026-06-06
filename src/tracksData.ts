import * as THREE from "three";

export interface TrackConfig {
  id: string;
  name: string;
  difficulty: number;
  roadWidth: number;
  description: string;
  skyColor: string;
  groundColor: string;
  ambientColor: string;
  controlPoints: THREE.Vector3[];
  barrierColor: string;
  decorType: "grass" | "desert" | "alpine" | "volcanic" | "neon" | "snow";
}

export const TRACK_CONFIGS: TrackConfig[] = [
  {
    id: "track-1",
    name: "Track 1: Beginner Speedway",
    difficulty: 1,
    roadWidth: 22,
    description: "Broad, flat oval circuit designed for rookie calibration. Minimum braking required.",
    skyColor: "#a5f3fc", // Bright sky blue
    groundColor: "#15803d", // Lush grass
    ambientColor: "#ffffff",
    decorType: "grass",
    barrierColor: "#ef4444",
    controlPoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(100, 0, 20),
      new THREE.Vector3(200, 0, 0),
      new THREE.Vector3(260, 0, -80),
      new THREE.Vector3(200, 0, -160),
      new THREE.Vector3(100, 0, -180),
      new THREE.Vector3(0, 0, -160),
      new THREE.Vector3(-60, 0, -80),
    ]
  },
  {
    id: "track-2",
    name: "Track 2: Lakeside Curve",
    difficulty: 2,
    roadWidth: 18,
    description: "Relaxed winding curves sweeping along lakeside vectors. Watch out for the long sweeping final bend.",
    skyColor: "#bae6fd", // Clear soft blue
    groundColor: "#059669", // Rich emerald grass
    ambientColor: "#ffffff",
    decorType: "grass",
    barrierColor: "#3b82f6",
    controlPoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(80, 0, 40),
      new THREE.Vector3(180, 0, 60),
      new THREE.Vector3(240, 0, 0),
      new THREE.Vector3(220, 0, -100),
      new THREE.Vector3(140, 0, -140),
      new THREE.Vector3(60, 0, -60), // Inside curve
      new THREE.Vector3(-60, 0, -120),
      new THREE.Vector3(-140, 0, -60),
    ]
  },
  {
    id: "track-3",
    name: "Track 3: Canyon Hairpins",
    difficulty: 3,
    roadWidth: 15,
    description: "Searing sandy gorges presenting multiple high-drift curves and narrow choke points.",
    skyColor: "#ffedd5", // Warm orange sunset sky
    groundColor: "#d97706", // Sandy canyon beige/amber
    ambientColor: "#fee2e2",
    decorType: "desert",
    barrierColor: "#f59e0b",
    controlPoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(120, 0, 10),
      new THREE.Vector3(180, 0, -50),
      new THREE.Vector3(120, 0, -110), // Sharp hairpins section
      new THREE.Vector3(180, 0, -170),
      new THREE.Vector3(100, 0, -240),
      new THREE.Vector3(0, 0, -200),
      new THREE.Vector3(-20, 0, -130), // Mid Canyon S-bend
      new THREE.Vector3(-100, 0, -140),
      new THREE.Vector3(-80, 0, -50),
    ]
  },
  {
    id: "track-4",
    name: "Track 4: Elevation Shift",
    difficulty: 4,
    roadWidth: 16,
    description: "Sudden summits and dropping basins that shift tire traction and gravity indices.",
    skyColor: "#fdf2f8", // Lilac sky
    groundColor: "#475569", // Dark slate stone
    ambientColor: "#e2e8f0",
    decorType: "snow",
    barrierColor: "#8b5cf6",
    controlPoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(80, 25, 30),  // Sharp rise
      new THREE.Vector3(180, 45, 0),  // Hilltop curve
      new THREE.Vector3(240, 15, -80), // Downhill dip
      new THREE.Vector3(150, -10, -160), // Underpass dip
      new THREE.Vector3(50, 10, -220),
      new THREE.Vector3(-80, 30, -160), // Winding crest
      new THREE.Vector3(-120, 10, -60),
    ]
  },
  {
    id: "track-5",
    name: "Track 5: Alpine Maze",
    difficulty: 5,
    roadWidth: 13,
    description: "Winding snowbound track of consecutive left-right switches demanding professional apex braking.",
    skyColor: "#e0f2fe", // Pale frosty blue
    groundColor: "#0f172a", // Obsidian mountain rock
    ambientColor: "#f1f5f9",
    decorType: "alpine",
    barrierColor: "#06b6d4",
    controlPoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(60, 10, 40),
      new THREE.Vector3(110, 5, -20),   // Quick zig-zag
      new THREE.Vector3(150, 15, -40),
      new THREE.Vector3(190, 0, -100),
      new THREE.Vector3(140, -10, -150),
      new THREE.Vector3(70, 0, -120),   // Inner maze
      new THREE.Vector3(10, 10, -170),
      new THREE.Vector3(-50, 0, -130),
      new THREE.Vector3(-120, 15, -180), // Long icy bend
      new THREE.Vector3(-180, 5, -100),
      new THREE.Vector3(-120, 0, -20),
    ]
  },
  {
    id: "track-6",
    name: "Track 6: Antigravity Grid",
    difficulty: 6,
    roadWidth: 12,
    description: "Futuristic synthetic grid with hazardous drops, loop sensations, and tight glowing neon boundaries.",
    skyColor: "#09090b", // Absolute dark space
    groundColor: "#020617", // Cosmic dark blue void
    ambientColor: "#d946ef", // Magenta neon shine
    decorType: "neon",
    barrierColor: "#d946ef",
    controlPoints: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(70, -20, 50),   // Sub-level drop
      new THREE.Vector3(160, 0, 100),   // Dynamic corkscrew
      new THREE.Vector3(220, 30, 40),
      new THREE.Vector3(180, 10, -60),
      new THREE.Vector3(240, -10, -160), // High speed slope
      new THREE.Vector3(130, 20, -220),  
      new THREE.Vector3(30, 40, -160),   // Aerial loop bridge
      new THREE.Vector3(-70, -10, -210),
      new THREE.Vector3(-150, 15, -130), // Sharp hairpins
      new THREE.Vector3(-190, -10, -40),
      new THREE.Vector3(-100, 25, 10),
    ]
  }
];
