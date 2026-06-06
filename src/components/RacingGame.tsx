import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TrackConfig, TRACK_CONFIGS } from "../tracksData";
import { CarControlState, CarPhysicsState, OpponentState } from "../types";
import { GameHUD } from "./GameHUD";
import { submitRaceRecord, syncMultiplayer } from "../api";
import { formatTime } from "./MainMenu";
import { Play, Trophy, RefreshCw, LogOut, ArrowRight, Zap, Award } from "lucide-react";
import { motion } from "motion/react";

interface RacingGameProps {
  playerId: string;
  nickname: string;
  carColor: string;
  trackId: string;
  isMultiplayer: boolean;
  onExit: () => void;
}

export function RacingGame({
  playerId,
  nickname,
  carColor,
  trackId,
  isMultiplayer,
  onExit,
}: RacingGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackConfig = TRACK_CONFIGS.find((t) => t.id === trackId) || TRACK_CONFIGS[0];

  // Game States
  const [speed, setSpeed] = useState(0);
  const [elapsedTimeMs, setElapsedTimeMs] = useState(0);
  const [currentLap, setCurrentLap] = useState(1);
  const [isDrifting, setIsDrifting] = useState(false);
  const [driftCombo, setDriftCombo] = useState(0);
  const [opponents, setOpponents] = useState<{ nickname: string; speed: number; x: number; z: number }[]>([]);
  const [countdown, setCountdown] = useState<number | null>(3);
  const [gameResult, setGameResult] = useState<{ finishTimeMs: number; bestLapTimeMs: number; isHighScore: boolean } | null>(null);
  const [boosterCharge, setBoosterCharge] = useState(0);
  const [isBoosting, setIsBoosting] = useState(false);

  // References for Animation Loop (Avoid trigger state re-renders for core physics)
  const statsRef = useRef({
    speed: 0,
    heading: 0,
    x: 0,
    y: 0,
    z: 0,
    currentLap: 1,
    lastNearestIndex: 0,
    lapStartTime: 0,
    elapsedSinceStart: 0,
    bestLapTimeMs: Infinity,
    raceDone: false,
    controls: { forward: false, backward: false, left: false, right: false, handbrake: false, respawn: false, boost: false } as CarControlState,
    wheelsAngle: 0,
    isDrifting: false,
    driftPoints: 0,
    countdownActive: true,
    isBoosting: false,
    boosterCharge: 0,
    boosterUnlocked: false,
  });

  const totalLaps = 3;

  // Touch handlers to merge with statsRef controls
  const handleTouchControl = (control: string, active: boolean) => {
    const { controls } = statsRef.current;
    if (control === "left") controls.left = active;
    if (control === "right") controls.right = active;
    if (control === "forward") controls.forward = active;
    if (control === "backward") controls.backward = active;
    if (control === "handbrake") controls.handbrake = active;
    if (control === "boost") controls.boost = active;
  };

  const handleManualRespawn = () => {
    statsRef.current.controls.respawn = true;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // --- SETUP THREE.JS ENVIRONMENT ---
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    // Warm, ambient and skies depending on decor type
    scene.background = new THREE.Color(trackConfig.skyColor);
    scene.fog = new THREE.FogExp2(trackConfig.skyColor, 0.0015);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.3, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    // Light Setup
    const ambientLight = new THREE.AmbientLight(trackConfig.ambientColor, 0.55);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff1e1, 1.0);
    dirLight.position.set(120, 200, 80);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 400;
    const d = 150;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Ground Plane Floor grid simulation based on biome type
    const groundSize = 2500;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, 4, 4);
    const groundMat = new THREE.MeshStandardMaterial({
      color: trackConfig.groundColor,
      roughness: 0.9,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    scene.add(ground);

    // Procedural grid helper lines for sci-fi look on neon grids
    if (trackConfig.decorType === "neon") {
      const grid = new THREE.GridHelper(1000, 100, 0xd946ef, 0x1e152a);
      grid.position.y = -0.05;
      scene.add(grid);
    }

    // --- CONSTRUCT CURVE MATHS ---
    const curvePoints = trackConfig.controlPoints;
    const spline = new THREE.CatmullRomCurve3(curvePoints, true);
    
    // Smooth high density sampling of spline points for tracking
    const splineSamplesCount = 1000;
    const trackPoints = spline.getSpacedPoints(splineSamplesCount);

    // Helper: Build procedurally high fidelity racetrack geometry with stripes
    const roadWidth = trackConfig.roadWidth;
    const segmentsCount = 450;
    const roadGeometry = new THREE.BufferGeometry();
    const curbsGeometry = new THREE.BufferGeometry();

    const roadVerticesList: number[] = [];
    const roadNormalsList: number[] = [];
    const roadColorsList: number[] = [];
    const roadIndicesList: number[] = [];

    const curbsVerticesList: number[] = [];
    const curbsColorsList: number[] = [];
    const curbsIndicesList: number[] = [];

    for (let i = 0; i <= segmentsCount; i++) {
      const t = i / segmentsCount;
      const point = spline.getPointAt(t % 1);
      const tangent = spline.getTangentAt(t % 1).normalize();
      
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Road boundary vertices coordinates
      const pLeft = new THREE.Vector3().copy(point).addScaledVector(right, -roadWidth / 2);
      const pRight = new THREE.Vector3().copy(point).addScaledVector(right, roadWidth / 2);

      roadVerticesList.push(pLeft.x, pLeft.y, pLeft.z);
      roadVerticesList.push(pRight.x, pRight.y, pRight.z);

      roadNormalsList.push(0, 1, 0);
      roadNormalsList.push(0, 1, 0);

      // Procedural asphalt color with stripes down lane center
      const asphaltVal = 0.12 + (Math.sin(i * 0.4) * 0.02);
      let r = asphaltVal, g = asphaltVal, b = asphaltVal + 0.02;

      // Draw striped safety lanes on edges
      if ((i % 14) < 1) {
        r = 0.75; g = 0.75; b = 0.75;
      }

      roadColorsList.push(r, g, b);
      roadColorsList.push(r, g, b);

      // Curbs on layout edge
      const cLeftOut = new THREE.Vector3().copy(point).addScaledVector(right, -(roadWidth / 2 + 1.25));
      const cRightOut = new THREE.Vector3().copy(point).addScaledVector(right, (roadWidth / 2 + 1.25));

      curbsVerticesList.push(pLeft.x, pLeft.y + 0.08, pLeft.z);
      curbsVerticesList.push(cLeftOut.x, cLeftOut.y + 0.12, cLeftOut.z);
      curbsVerticesList.push(pRight.x, pRight.y + 0.08, pRight.z);
      curbsVerticesList.push(cRightOut.x, cRightOut.y + 0.12, cRightOut.z);

      // Red and white curbs
      const isRed = (i % 6) < 3;
      const curbR = isRed ? 0.95 : 0.95;
      const curbG = isRed ? 0.15 : 0.95;
      const curbB = isRed ? 0.15 : 0.95;

      curbsColorsList.push(curbR, curbG, curbB);
      curbsColorsList.push(curbR, curbG, curbB);
      curbsColorsList.push(curbR, curbG, curbB);
      curbsColorsList.push(curbR, curbG, curbB);
    }

    // Build indexing for quads
    for (let i = 0; i < segmentsCount; i++) {
      const v0 = i * 2;
      const v1 = v0 + 1;
      const v2 = v0 + 2;
      const v3 = v0 + 3;

      roadIndicesList.push(v0, v1, v2);
      roadIndicesList.push(v1, v3, v2);

      // Curb quads
      const cLeft0 = i * 4;
      const cLeft1 = cLeft0 + 1;
      const cLeft2 = cLeft0 + 4;
      const cLeft3 = cLeft0 + 5;

      curbsIndicesList.push(cLeft0, cLeft2, cLeft1);
      curbsIndicesList.push(cLeft1, cLeft2, cLeft3);

      const cRight0 = i * 4 + 2;
      const cRight1 = cRight0 + 1;
      const cRight2 = cRight0 + 4;
      const cRight3 = cRight0 + 5;

      curbsIndicesList.push(cRight0, cRight1, cRight2);
      curbsIndicesList.push(cRight1, cRight3, cRight2);
    }

    roadGeometry.setAttribute("position", new THREE.Float32BufferAttribute(roadVerticesList, 3));
    roadGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(roadNormalsList, 3));
    roadGeometry.setAttribute("color", new THREE.Float32BufferAttribute(roadColorsList, 3));
    roadGeometry.setIndex(roadIndicesList);

    curbsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(curbsVerticesList, 3));
    curbsGeometry.setAttribute("color", new THREE.Float32BufferAttribute(curbsColorsList, 3));
    curbsGeometry.setIndex(curbsIndicesList);

    const roadMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
    });
    const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    const curbsMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.2,
    });
    const curbsMesh = new THREE.Mesh(curbsGeometry, curbsMaterial);
    curbsMesh.receiveShadow = true;
    curbsMesh.castShadow = true;
    scene.add(curbsMesh);

    // --- PROCEDURAL STAGE DECORATIONS (Trees, cacti, rocks, signboards) ---
    const sceneryGroup = new THREE.Group();
    scene.add(sceneryGroup);

    const makeTreeSegment = (x: number, y: number, z: number) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      
      const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d3725, roughness: 0.95 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.5;
      trunk.castShadow = true;
      g.add(trunk);

      let leavesColor = 0x1f6630;
      if (trackConfig.decorType === "desert") leavesColor = 0xd97706;
      if (trackConfig.decorType === "snow") leavesColor = 0xdbeafe;
      if (trackConfig.decorType === "neon") leavesColor = 0x06b6d4;

      const foliageGeo = new THREE.ConeGeometry(3.5, 7, 7);
      const foliageMat = new THREE.MeshStandardMaterial({ color: leavesColor, roughness: 0.8 });
      const leaves = new THREE.Mesh(foliageGeo, foliageMat);
      leaves.position.y = 6.0;
      leaves.castShadow = true;
      g.add(leaves);

      return g;
    };

    const makeStoneCanyon = (x: number, y: number, z: number, size: number) => {
      const stoneGeo = new THREE.DodecahedronGeometry(size, 1);
      const stoneMat = new THREE.MeshStandardMaterial({
        color: trackConfig.decorType === "desert" ? 0xb45309 : 0x334155,
        roughness: 0.9,
      });
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(x, y + size/2, z);
      stone.castShadow = true;
      stone.receiveShadow = true;
      return stone;
    };

    // Distribute scenery alongside the track path borders
    for (let i = 0; i < splineSamplesCount; i += 12) {
      const p = trackPoints[i];
      const tang = spline.getTangentAt(i / splineSamplesCount).normalize();
      const right = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

      // Alternate offsets left/right
      const isLeft = (i % 24) === 0;
      const margin = roadWidth / 2 + 10 + Math.random() * 20;
      const sPos = new THREE.Vector3().copy(p).addScaledVector(right, isLeft ? -margin : margin);

      if (trackConfig.decorType === "desert") {
        sceneryGroup.add(makeStoneCanyon(sPos.x, sPos.y, sPos.z, 6 + Math.random() * 8));
      } else {
        sceneryGroup.add(makeTreeSegment(sPos.x, sPos.y, sPos.z));
      }
    }

    // --- START/FINISH LINE ARCHWAY ---
    const makeArchway = () => {
      const arch = new THREE.Group();
      // Position at start vector
      const pStart = spline.getPointAt(0);
      const tang = spline.getTangentAt(0).normalize();
      const right = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();

      arch.position.copy(pStart);
      arch.rotation.y = Math.atan2(tang.x, tang.z);

      const offset = roadWidth / 2 + 1.5;

      const trussMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
      const towerGeo = new THREE.BoxGeometry(1.5, 16, 1.5);
      
      const leftPillar = new THREE.Mesh(towerGeo, trussMat);
      leftPillar.position.set(-offset, 8, 0);
      leftPillar.castShadow = true;
      arch.add(leftPillar);

      const rightPillar = new THREE.Mesh(towerGeo, trussMat);
      rightPillar.position.set(offset, 8, 0);
      rightPillar.castShadow = true;
      arch.add(rightPillar);

      const barGeo = new THREE.BoxGeometry(offset * 2 + 2, 2.5, 1.2);
      const bannerMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8 });
      const topBar = new THREE.Mesh(barGeo, bannerMat);
      topBar.position.set(0, 15, 0);
      topBar.castShadow = true;
      arch.add(topBar);

      // Light glow strip
      const glowGeo = new THREE.BoxGeometry(offset * 2 + 1, 0.4, 0.2);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const glowStr = new THREE.Mesh(glowGeo, glowMat);
      glowStr.position.set(0, 13.5, 0.5);
      arch.add(glowStr);

      return arch;
    };
    scene.add(makeArchway());

    // --- PROCEDURALLY BUILD THE SPORTS CAR MODEL ---
    const buildSportsCar = (bodyColorValue: string) => {
      const carGroup = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(bodyColorValue),
        roughness: 0.15,
        metalness: 0.8,
      });

      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.5,
      });

      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.6,
        roughness: 0.05,
      });

      const tireMat = new THREE.MeshStandardMaterial({
        color: 0x0b0f19,
        roughness: 0.9,
      });

      const alloyMat = new THREE.MeshStandardMaterial({
        color: 0xd1d5db,
        metalness: 0.9,
        roughness: 0.1,
      });

      // Chassis base platform
      const chassisGeo = new THREE.BoxGeometry(2.3, 0.5, 4.4);
      const chassis = new THREE.Mesh(chassisGeo, bodyMat);
      chassis.position.y = 0.45;
      chassis.castShadow = true;
      chassis.receiveShadow = true;
      carGroup.add(chassis);

      // Cabin / Canopy dome
      const canopyGeo = new THREE.BoxGeometry(1.6, 0.7, 2.0);
      const canopy = new THREE.Mesh(canopyGeo, glassMat);
      canopy.position.set(0, 0.95, -0.2);
      canopy.castShadow = true;
      carGroup.add(canopy);

      // Front nose spoiler wedge
      const noseGeo = new THREE.BoxGeometry(2.4, 0.25, 0.8);
      const nose = new THREE.Mesh(noseGeo, bodyMat);
      nose.position.set(0, 0.3, 2.2);
      nose.castShadow = true;
      carGroup.add(nose);

      const noseCenterGeo = new THREE.BoxGeometry(0.8, 0.35, 1.2);
      const noseCenter = new THREE.Mesh(noseCenterGeo, bodyMat);
      noseCenter.position.set(0, 0.45, 1.8);
      noseCenter.castShadow = true;
      carGroup.add(noseCenter);

      // Rear Spoiler wing plates
      const wingStalkGeo = new THREE.BoxGeometry(0.15, 0.9, 0.15);
      const wingStalkL = new THREE.Mesh(wingStalkGeo, frameMat);
      wingStalkL.position.set(-0.8, 0.85, -2.0);
      wingStalkL.castShadow = true;
      carGroup.add(wingStalkL);

      const wingStalkR = new THREE.Mesh(wingStalkGeo, frameMat);
      wingStalkR.position.set(0.8, 0.85, -2.0);
      wingStalkR.castShadow = true;
      carGroup.add(wingStalkR);

      const wingPlateGeo = new THREE.BoxGeometry(2.6, 0.1, 0.75);
      const wingPlate = new THREE.Mesh(wingPlateGeo, bodyMat);
      wingPlate.position.set(0, 1.3, -2.0);
      wingPlate.castShadow = true;
      carGroup.add(wingPlate);

      // Wheel meshes setup (4 items)
      const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.55, 12);
      wheelGeo.rotateZ(Math.PI / 2);

      const wheelHubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.58, 8);
      wheelHubGeo.rotateZ(Math.PI / 2);

      const createWheelMesh = (xOffset: number, zOffset: number) => {
        const wheel = new THREE.Group();
        wheel.position.set(xOffset, 0.5, zOffset);
        
        const outerTire = new THREE.Mesh(wheelGeo, tireMat);
        outerTire.castShadow = true;
        wheel.add(outerTire);

        const innerRim = new THREE.Mesh(wheelHubGeo, alloyMat);
        wheel.add(innerRim);

        return wheel;
      };

      const wheelFL = createWheelMesh(-1.25, 1.35);
      const wheelFR = createWheelMesh(1.25, 1.35);
      const wheelRL = createWheelMesh(-1.25, -1.35);
      const wheelRR = createWheelMesh(1.25, -1.35);

      carGroup.add(wheelFL, wheelFR, wheelRL, wheelRR);

      // Red Brake Taillights
      const lightGeo = new THREE.BoxGeometry(0.35, 0.15, 0.1);
      const taillightL = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      taillightL.position.set(-0.8, 0.52, -2.22);
      carGroup.add(taillightL);

      const taillightR = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      taillightR.position.set(0.8, 0.52, -2.22);
      carGroup.add(taillightR);

      // Cyan Flame Thruster Exhaust
      const thrusterMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.95,
      });
      const thrusterGeo = new THREE.CylinderGeometry(0.02, 0.35, 1.5, 8);
      thrusterGeo.rotateX(Math.PI / 2); // Rotate to point backward
      const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
      thruster.position.set(0, 0.42, -2.25);
      thruster.visible = false;
      carGroup.add(thruster);

      // Save components for rotational animation inside loop
      return {
        mesh: carGroup,
        wheelFrontLeft: wheelFL,
        wheelFrontRight: wheelFR,
        wheelRearLeft: wheelRL,
        wheelRearRight: wheelRR,
        bodyMaterial: bodyMat,
        brakeLights: [taillightL, taillightR],
        thruster: thruster,
      };
    };

    const playerCar = buildSportsCar(carColor);
    scene.add(playerCar.mesh);

    // Initial position at start point
    const startPoint = spline.getPointAt(0);
    const startTangent = spline.getTangentAt(0).normalize();
    statsRef.current.x = startPoint.x;
    statsRef.current.y = startPoint.y;
    statsRef.current.z = startPoint.z;
    statsRef.current.heading = Math.atan2(startTangent.x, startTangent.z);

    playerCar.mesh.position.set(statsRef.current.x, statsRef.current.y, statsRef.current.z);
    playerCar.mesh.rotation.y = statsRef.current.heading;

    // --- OPPONENTS CARS REGISTRY (Multiplayer) ---
    const opponentCars: Record<string, {
      model: any;
      nameplate: any;
      targetPos: THREE.Vector3;
      targetHeading: number;
    }> = {};

    const createOpponentVisual = (oppId: string, oppName: string, oppColor: string) => {
      const oppCar = buildSportsCar(oppColor);
      scene.add(oppCar.mesh);

      // Generate a floating text/billboard for 3D nickname tag
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 40;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(0, 0, 160, 40);
        ctx.strokeStyle = oppColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 158, 38);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(oppName.substring(0, 12), 80, 20);
      }

      const canvasTex = new THREE.CanvasTexture(canvas);
      const plateMat = new THREE.SpriteMaterial({ map: canvasTex });
      const nameplate = new THREE.Sprite(plateMat);
      nameplate.scale.set(4.5, 1.25, 1);
      scene.add(nameplate);

      opponentCars[oppId] = {
        model: oppCar,
        nameplate,
        targetPos: new THREE.Vector3(),
        targetHeading: 0,
      };
    };

    const removeOpponentVisual = (oppId: string) => {
      if (opponentCars[oppId]) {
        scene.remove(opponentCars[oppId].model.mesh);
        scene.remove(opponentCars[oppId].nameplate);
        delete opponentCars[oppId];
      }
    };

    // --- KEYBOARD LISTENER SETUP ---
    const handleKeyDown = (e: KeyboardEvent) => {
      const { controls } = statsRef.current;
      switch (e.key.toLowerCase()) {
        case "arrowup":
        case "w":
          controls.forward = true;
          break;
        case "arrowdown":
        case "s":
          controls.backward = true;
          break;
        case "arrowleft":
        case "a":
          controls.left = true;
          break;
        case "arrowright":
        case "d":
          controls.right = true;
          break;
        case " ":
          controls.handbrake = true;
          break;
        case "r":
          controls.respawn = true;
          break;
        case "shift":
          controls.boost = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const { controls } = statsRef.current;
      switch (e.key.toLowerCase()) {
        case "arrowup":
        case "w":
          controls.forward = false;
          break;
        case "arrowdown":
        case "s":
          controls.backward = false;
          break;
        case "arrowleft":
        case "a":
          controls.left = false;
          break;
        case "arrowright":
        case "d":
          controls.right = false;
          break;
        case " ":
          controls.handbrake = false;
          break;
        case "shift":
          controls.boost = false;
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // --- DRIFT SMOKE PARTICLE EMITTER SYSTEM ---
    const particlesCount = 80;
    const smokeGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.05,
    });
    const smokeParticles: Array<{ mesh: THREE.Mesh; active: boolean; age: number; speed: THREE.Vector3 }> = [];

    for (let i = 0; i < particlesCount; i++) {
      const mesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
      mesh.visible = false;
      scene.add(mesh);
      smokeParticles.push({
        mesh,
        active: false,
        age: 0,
        speed: new THREE.Vector3(),
      });
    }

    const spawnSmokeTrail = (pos: THREE.Vector3, isBooster: boolean = false) => {
      const p = smokeParticles.find((part) => !part.active);
      if (!p) return;
      p.active = true;
      p.age = 0;
      p.mesh.position.copy(pos);
      p.mesh.scale.set(isBooster ? 1.5 : 1.0, isBooster ? 1.5 : 1.0, isBooster ? 1.5 : 1.0);
      p.mesh.visible = true;
      
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      if (isBooster) {
        mat.color.setHex(0x00f0ff); // Cyan booster fire
        mat.opacity = 0.85;
        p.speed.set(
          (Math.random() - 0.5) * 3.0,
          (Math.random() - 0.5) * 1.0,
          (Math.random() - 0.5) * 3.0
        );
      } else {
        mat.color.setHex(0xcbd5e1); // Slate gray drift smoke
        mat.opacity = 0.5;
        p.speed.set(
          (Math.random() - 0.5) * 1.5,
          Math.random() * 2.5,
          (Math.random() - 0.5) * 1.5
        );
      }
    };

    // --- RECURRING MULTIPLAYER SYNCER TIMERS ---
    const syncInterval = setInterval(async () => {
      if (!isMultiplayer || statsRef.current.raceDone) return;
      
      const st = statsRef.current;
      try {
        const peers = await syncMultiplayer({
          id: playerId,
          nickname,
          trackId,
          color: carColor,
          x: st.x,
          y: st.y,
          z: st.z,
          heading: st.heading,
          speed: st.speed,
          wheelsAngle: st.wheelsAngle,
          isDrifting: st.isDrifting,
        });

        // Track and update peer ghost rendering states
        const activeRemoteIds = new Set(peers.map((p) => p.id));
        
        // Remove left peers
        Object.keys(opponentCars).forEach((oppId) => {
          if (!activeRemoteIds.has(oppId)) removeOpponentVisual(oppId);
        });

        // Add/update existing peers
        peers.forEach((peer) => {
          if (!opponentCars[peer.id]) {
            createOpponentVisual(peer.id, peer.nickname, peer.color);
          }
          const c = opponentCars[peer.id];
          c.targetPos.set(peer.x, peer.y, peer.z);
          c.targetHeading = peer.heading;
          
          // Speed simulation visual indicator
          c.model.mesh.rotation.y = peer.heading;
          c.model.wheelFrontLeft.rotation.y = peer.wheelsAngle;
          c.model.wheelFrontRight.rotation.y = peer.wheelsAngle;
          
          if (peer.isDrifting) {
            // Spawn some smoke on their tail
            const pTailL = new THREE.Vector3(-1, 0.3, -1.3).applyMatrix4(c.model.mesh.matrixWorld);
            spawnSmokeTrail(pTailL);
          }
        });

        setOpponents(peers.map((p) => ({ nickname: p.nickname, speed: p.speed, x: p.x, z: p.z })));
      } catch (err) {
        console.warn("Multiplayer ping skipped due to latency spikes", err);
      }
    }, 450);

    // --- CLOCK AND ANIMATION GAME LOOP ---
    const clock = new THREE.Clock();
    let frameId: number;

    const tick = () => {
      const st = statsRef.current;
      const prevIdx = st.lastNearestIndex;
      let dt = clock.getDelta();
      if (dt > 0.1) dt = 0.1; // Cap extreme delays to keep frame consistent

      // 1. Wait for countdown to expire before letting the player move
      if (st.countdownActive) {
        st.speed = 0;
      } else if (!st.raceDone) {
        st.elapsedSinceStart += dt * 1000;
        setElapsedTimeMs(st.elapsedSinceStart);
      }

      // 2. RESPOND TO PLAYER CONTROLS & PHYSICS ENGINE
      const turnLimit = 0.45;
      const turnSensitivity = 2.4;

      // Steering wheel yaw rotations smoothly returning to center
      if (st.controls.left) {
        st.wheelsAngle = THREE.MathUtils.lerp(st.wheelsAngle, turnLimit, turnSensitivity * dt);
      } else if (st.controls.right) {
        st.wheelsAngle = THREE.MathUtils.lerp(st.wheelsAngle, -turnLimit, turnSensitivity * dt);
      } else {
        st.wheelsAngle = THREE.MathUtils.lerp(st.wheelsAngle, 0, 5.0 * dt);
      }

      // Align body lights
      if (playerCar.brakeLights) {
        const isBraking = st.controls.backward && st.speed > 0;
        playerCar.brakeLights.forEach((light) => {
          (light.material as THREE.MeshBasicMaterial).color.setHex(isBraking ? 0xff0000 : 0xef4444);
        });
      }

      // Check offroad positioning from track spline limits
      let nearestDist = Infinity;
      let nearestIndex = 0;

      // Search region scans for optimization
      const searchRadius = 40;
      const startScan = Math.max(0, st.lastNearestIndex - searchRadius);
      const endScan = Math.min(splineSamplesCount - 1, st.lastNearestIndex + searchRadius);

      for (let j = startScan; j <= endScan; j++) {
        const distSq = new THREE.Vector3(st.x, 0, st.z).distanceToSquared(new THREE.Vector3(trackPoints[j].x, 0, trackPoints[j].z));
        if (distSq < nearestDist) {
          nearestDist = distSq;
          nearestIndex = j;
        }
      }

      // Wrap-around scans
      if (st.lastNearestIndex < searchRadius || st.lastNearestIndex > splineSamplesCount - searchRadius) {
        for (let j = 0; j < searchRadius; j++) {
          const d1 = new THREE.Vector3(st.x, 0, st.z).distanceToSquared(new THREE.Vector3(trackPoints[j].x, 0, trackPoints[j].z));
          if (d1 < nearestDist) {
            nearestDist = d1;
            nearestIndex = j;
          }
          const d2 = new THREE.Vector3(st.x, 0, st.z).distanceToSquared(new THREE.Vector3(trackPoints[splineSamplesCount - 1 - j].x, 0, trackPoints[splineSamplesCount - 1 - j].z));
          if (d2 < nearestDist) {
            nearestDist = d2;
            nearestIndex = splineSamplesCount - 1 - j;
          }
        }
      }

      st.lastNearestIndex = nearestIndex;
      const actualDistance = Math.sqrt(nearestDist);
      const isOffRoad = actualDistance > (roadWidth / 2);

      // Handle Manual Reset Alignment
      if (st.controls.respawn) {
        st.controls.respawn = false;
        
        // Relocate to closest track centerpoint
        const targetAlign = trackPoints[st.lastNearestIndex];
        st.x = targetAlign.x;
        st.y = targetAlign.y + 0.5;
        st.z = targetAlign.z;
        st.speed = 0;

        // Project alignment rotation vector
        const curveHeading = spline.getTangentAt(st.lastNearestIndex / splineSamplesCount).normalize();
        st.heading = Math.atan2(curveHeading.x, curveHeading.z);
      }

      // Speed accelerations and drift mechanics variables block
      st.isDrifting = st.controls.handbrake && Math.abs(st.speed) > 12.0 && Math.abs(st.wheelsAngle) > 0.12;

      // Charge booster during drift when racing and countdown is complete (charges ~22% per second, total 4.5s)
      if (st.isDrifting && !st.countdownActive && !st.raceDone) {
        st.boosterCharge = Math.min(100, st.boosterCharge + 22.0 * dt);
        if (st.boosterCharge >= 100) {
          st.boosterUnlocked = true;
        }
      }

      // Handle dynamic booster activation
      if (st.boosterUnlocked && st.controls.boost && st.boosterCharge > 0 && !st.countdownActive && !st.raceDone) {
        st.isBoosting = true;
        // Drain booster charge over time (~38% depletion per second, approx 2.6s max duration)
        st.boosterCharge = Math.max(0, st.boosterCharge - 38.0 * dt);
        if (st.boosterCharge <= 0) {
          st.isBoosting = false;
          st.boosterUnlocked = false;
        }
      } else {
        st.isBoosting = false;
        // If booster runs empty, unlock standard charging cycle
        if (st.boosterCharge <= 0) {
          st.boosterUnlocked = false;
        }
      }

      let targetMaxSpeed = isOffRoad ? 7.5 : 36.5; // (in units per sec, approx 25 vs 130 km/h)
      let accelForce = 15.0;
      const brakesForce = 34.0;
      const standardDrag = 0.85;

      // Rocket boosted state!
      if (st.isBoosting) {
        targetMaxSpeed = isOffRoad ? 25.0 : 58.0; // Blast through roads and grass easily
        accelForce = 45.0;
      }

      if (st.controls.forward) {
        st.speed += accelForce * dt;
        if (st.speed > targetMaxSpeed) st.speed = THREE.MathUtils.lerp(st.speed, targetMaxSpeed, 2.5 * dt);
      } else if (st.controls.backward) {
        st.speed -= brakesForce * dt;
        if (st.speed < -12) st.speed = -12;
      } else {
        // Linear damp drags
        st.speed *= Math.pow(standardDrag, dt);
        if (Math.abs(st.speed) < 0.1) st.speed = 0;
      }

      // Off-road instant massive grass drag penalty
      if (isOffRoad && st.speed > targetMaxSpeed) {
        st.speed = THREE.MathUtils.lerp(st.speed, targetMaxSpeed, 6.0 * dt);
      }

      // Drifting rotation overrides
      let steeringEffort = st.wheelsAngle * turnSensitivity * (st.speed * 0.04);
      if (st.isDrifting) {
        steeringEffort *= 2.0; // Increase tail slide angular rotation
        st.driftPoints += 1;
        setDriftCombo(st.driftPoints);
        setIsDrifting(true);

        // Spawn drift smokey tails
        if (Math.random() < 0.85) {
          // Rear wheel paths position calculation
          const offsetPosL = new THREE.Vector3(-0.95, 0.2, -1.25).applyMatrix4(playerCar.mesh.matrixWorld);
          const offsetPosR = new THREE.Vector3(0.95, 0.2, -1.25).applyMatrix4(playerCar.mesh.matrixWorld);
          spawnSmokeTrail(offsetPosL);
          spawnSmokeTrail(offsetPosR);
        }
      } else {
        if (st.driftPoints > 0) st.driftPoints = 0;
        setIsDrifting(false);
      }

      // Animate sports car back thruster and spawn exhaust cyan flame sparks
      if (playerCar.thruster) {
        if (st.isBoosting) {
          playerCar.thruster.visible = true;
          const scl = 0.8 + Math.random() * 0.4;
          playerCar.thruster.scale.set(scl, scl, 1.3 + Math.random() * 0.6);
          
          if (Math.random() < 0.9) {
            const exhaustPos = new THREE.Vector3(0, 0.42, -2.25).applyMatrix4(playerCar.mesh.matrixWorld);
            spawnSmokeTrail(exhaustPos, true);
          }
        } else {
          playerCar.thruster.visible = false;
        }
      }

      st.heading += steeringEffort * dt;

      // Coordinate movements
      st.x += Math.sin(st.heading) * st.speed * dt;
      st.z += Math.cos(st.heading) * st.speed * dt;

      // Match track elevation seamlessly
      const groundTrackPoint = spline.getPointAt(st.lastNearestIndex / splineSamplesCount);
      st.y = THREE.MathUtils.lerp(st.y, groundTrackPoint.y, 10.0 * dt);

      // Rotate visual sports car mesh to target vectors
      playerCar.mesh.position.set(st.x, st.y, st.z);
      // Drift body sway offsets rotation around Y direction for styling
      const driftSway = st.isDrifting ? (st.wheelsAngle * 0.42) : 0;
      playerCar.mesh.rotation.y = st.heading + driftSway;

      // Animate wheels spin and steer angles
      const rotFactor = (st.speed * dt) / 0.5; // (speed * dt) / radius
      playerCar.wheelRearLeft.rotation.x += rotFactor;
      playerCar.wheelRearRight.rotation.x += rotFactor;
      playerCar.wheelFrontLeft.rotation.x += rotFactor;
      playerCar.wheelFrontRight.rotation.x += rotFactor;

      playerCar.wheelFrontLeft.rotation.y = st.wheelsAngle;
      playerCar.wheelFrontRight.rotation.y = st.wheelsAngle;

      // 3. TRACK LAP COMPLETE CHECKPOINT PROGRESSIONS
      // We check if the player crossed the start-finish corridor indices (around 0 and 1000)
      const buffer = 35;
      
      // If we jump from near 1000 to near 0, completed lap
      if (prevIdx < buffer && st.lastNearestIndex < buffer) {
        const hasPassedFinish = (st.lastNearestIndex >= 0 && st.lastNearestIndex < 5);
        // Ensure they traversed backwards to 980+ first to prevent cheating
        // Let's implement lap completion check using spline checkpoints
        if (st.lastNearestIndex < prevIdx && prevIdx - st.lastNearestIndex > buffer * 2.5) {
          // Cheat checking loop skip indicator
        }
      }

      // Safer lap completion checking: if index crosses from 980+ directly to 10-
      if (st.lastNearestIndex < 25 && st.lastNearestIndex >= 0 && (st.lastNearestIndex - st.lastNearestIndex === 0)) {
        // Wait, did we just transition from 3D points?
      }

      // Robust Lap Checker
      const curSampleIndex = splineSamplesCount - 15;
      if (prevIdx > curSampleIndex && nearestIndex < 35 && !st.raceDone) {
        // Complete current lap!
        const lapDoneTime = st.elapsedSinceStart - st.lapStartTime;
        if (lapDoneTime > 8000) { // Anti cheat lap minimum time buffer
          if (lapDoneTime < st.bestLapTimeMs) st.bestLapTimeMs = lapDoneTime;

          if (st.currentLap >= totalLaps) {
            // FINISH THE RACING CRITERIAS!
            st.raceDone = true;
            st.speed = 0;
            const finalTime = st.elapsedSinceStart;

            // Submit record to Server Database
            const triggerSubmit = async () => {
              try {
                const res = await submitRaceRecord(playerId, trackId, finalTime);
                setGameResult({
                  finishTimeMs: finalTime,
                  bestLapTimeMs: st.bestLapTimeMs,
                  isHighScore: res.success,
                });
              } catch (err) {
                console.error("Trouble storing result record:", err);
                setGameResult({
                  finishTimeMs: finalTime,
                  bestLapTimeMs: st.bestLapTimeMs,
                  isHighScore: false,
                });
              }
            };
            triggerSubmit();
          } else {
            st.currentLap += 1;
            st.lapStartTime = st.elapsedSinceStart;
            setCurrentLap(st.currentLap);
          }
        }
      }

      // 4. ANIMATE DRIFTS SMOKE PARTICLES
      smokeParticles.forEach((part) => {
        if (!part.active) return;
        part.age += dt;
        if (part.age > 0.8) {
          part.active = false;
          part.mesh.visible = false;
        } else {
          part.mesh.position.addScaledVector(part.speed, dt);
          part.mesh.scale.multiplyScalar(1.025);
          (part.mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - part.age / 0.8);
        }
      });

      // 5. ANIMATE MULTIPLAYER GHOST INTERPOLATIONS
      Object.keys(opponentCars).forEach((oppId) => {
        const peerCar = opponentCars[oppId];
        // Smoothly interpolate positions to remove socket micro-stutter
        peerCar.model.mesh.position.lerp(peerCar.targetPos, 12.0 * dt);
        
        // Lift 3D Nameplate above opponent car cabin
        peerCar.nameplate.position.copy(peerCar.model.mesh.position).add(new THREE.Vector3(0, 3.2, 0));
      });

      // 6. UPDATE SMART THIRD-PERSON SPRINGY FOLLOW CAMERA
      // Camera is behind the car, pointing at it
      const camOffsetDistance = 10.0;
      const camHeight = 3.65;
      
      const camTargetPos = new THREE.Vector3()
        .copy(playerCar.mesh.position)
        .addScaledVector(new THREE.Vector3(Math.sin(st.heading), 0, Math.cos(st.heading)), -camOffsetDistance);
      
      camTargetPos.y += camHeight;

      camera.position.lerp(camTargetPos, 7.5 * dt);
      
      const lookAtTarget = new THREE.Vector3().copy(playerCar.mesh.position).add(new THREE.Vector3(0, 1.0, 0));
      camera.lookAt(lookAtTarget);

      // Camera FOV dynamic performance speed stretch for drift booster warp
      const targetFov = st.isBoosting ? 74 : 60;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 6.0 * dt);
        camera.updateProjectionMatrix();
      }

      // Render Viewport
      renderer.render(scene, camera);

      // Sync state to UI HUD Speed & Booster properties
      setSpeed(st.speed);
      setBoosterCharge(st.boosterCharge);
      setIsBoosting(st.isBoosting);

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    // --- COUNTDOWN SCHEDULER START ---
    let tickCount = 3;
    const countTimer = setInterval(() => {
      tickCount -= 1;
      if (tickCount === 0) {
        statsRef.current.countdownActive = false;
        setCountdown(0);
      } else if (tickCount < 0) {
        setCountdown(null);
        clearInterval(countTimer);
      } else {
        setCountdown(tickCount);
      }
    }, 1000);

    // Handle viewport resize events
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // CLEANUP DISPOSALS ON DESTROY
    return () => {
      clearInterval(countTimer);
      clearInterval(syncInterval);
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", handleResize);

      // Dispose Three assets
      roadGeometry.dispose();
      curbsGeometry.dispose();
      roadMaterial.dispose();
      curbsMaterial.dispose();
      smokeGeo.dispose();
      smokeMat.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      
      Object.keys(opponentCars).forEach((oppId) => removeOpponentVisual(oppId));

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [trackId, carColor, isMultiplayer]);

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-950 overflow-hidden select-none">
      
      {/* Three.js Canvas container viewport wrapper */}
      <div ref={containerRef} className="w-full h-full object-cover select-none" />

      {/* Embedded interactive head-up-display */}
      {gameResult === null && (
        <GameHUD
          trackName={trackConfig.name}
          speed={speed}
          elapsedTimeMs={elapsedTimeMs}
          currentLap={currentLap}
          totalLaps={totalLaps}
          isDrifting={isDrifting}
          driftCombo={driftCombo}
          isMultiplayer={isMultiplayer}
          opponents={opponents}
          onRespawn={handleManualRespawn}
          onExit={onExit}
          countdown={countdown}
          onTouchControl={handleTouchControl}
          boosterCharge={boosterCharge}
          isBoosting={isBoosting}
        />
      )}

      {/* Finished Stage results overlay card */}
      {gameResult !== null && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 15 }}
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl relative overflow-hidden"
          >
            {/* Visual background rings */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-purple-600/10 rounded-full blur-2xl" />

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-500/20">
              <Trophy className="w-8 h-8 text-white" />
            </div>

            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">Race Completed</h2>
            <h3 className="text-2xl font-black italic tracking-wide text-white font-sans">{trackConfig.name}</h3>

            <div className="mt-6 space-y-3 font-mono">
              {/* Total final lap time speed details */}
              <div className="bg-slate-950 border border-slate-900 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-slate-500 text-xs uppercase font-bold">Laps completed</span>
                <span className="text-base text-slate-200 font-bold">{totalLaps} / {totalLaps}</span>
              </div>

              <div className="bg-slate-950 border border-slate-900 p-5 rounded-2xl flex justify-between items-center relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500" />
                <span className="text-slate-400 text-xs uppercase font-bold pl-1">Total Time</span>
                <span className="text-3xl font-black text-rose-400 tracking-wider">
                  {formatTime(gameResult.finishTimeMs)}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-900 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-slate-500 text-xs uppercase font-bold">Best Single Lap</span>
                <span className="text-lg text-emerald-400 font-bold tracking-wide">
                  {formatTime(gameResult.bestLapTimeMs)}
                </span>
              </div>
            </div>

            {gameResult.isHighScore && (
              <div className="mt-5 p-3.5 bg-yellow-950/25 border border-yellow-500/20 text-yellow-500 rounded-xl text-xs flex items-center justify-center gap-2 font-semibold">
                <Award className="w-4 h-4 animate-bounce text-yellow-400" />
                <span>NEW PERSONAL BEST SAVED ON SERVER TIMELINE!</span>
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onExit}
                className="w-full sm:flex-1 py-3.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-sm font-bold uppercase tracking-wider text-slate-300 transition-all cursor-pointer"
              >
                Exit Menu
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full sm:flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/10 transition-all cursor-pointer"
              >
                Restart Race
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
