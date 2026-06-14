import React, { useMemo } from "react";
import * as THREE from "three";
import { TrackConfig } from "../tracksData";

interface MinimapProps {
  trackConfig: TrackConfig;
  playerPos: { x: number; z: number; heading: number };
  opponents: Array<{
    id: string;
    nickname: string;
    color: string;
    x: number;
    z: number;
    progress?: number;
  }>;
}

export function Minimap({ trackConfig, playerPos, opponents }: MinimapProps) {
  const points = trackConfig.controlPoints;

  // Track shape boundary matching for responsive auto-scaling
  const bounds = useMemo(() => {
    if (!points || points.length === 0) {
      return { minX: 0, maxX: 100, minZ: 0, maxZ: 100, width: 100, height: 100, centerX: 50, centerZ: 50 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });

    // Add extra padding so elements don't get chopped off on borders
    const paddingVal = 50; 
    minX -= paddingVal;
    maxX += paddingVal;
    minZ -= paddingVal;
    maxZ += paddingVal;

    const width = maxX - minX;
    const height = maxZ - minZ;

    return {
      minX,
      maxX,
      minZ,
      maxZ,
      width: width || 1,
      height: height || 1,
      centerX: minX + width / 2,
      centerZ: minZ + height / 2,
    };
  }, [points]);

  // ViewBox coordinates specification for native SVG scaling
  const viewBoxStr = `${bounds.minX} ${bounds.minZ} ${bounds.width} ${bounds.height}`;

  // Generate smooth closed circuit line points path
  const svgPathData = useMemo(() => {
    if (points.length < 2) return "";
    
    // Create an Catmull-Rom spline math representation inside React to align with Three.js exactly
    try {
      const curve = new THREE.CatmullRomCurve3(points, true);
      const sampledPoints = curve.getSpacedPoints(80);
      
      return sampledPoints
        .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.z.toFixed(1)}`)
        .join(" ") + " Z";
    } catch (e) {
      // Fallback to simple polygon if THREE utility fails
      return points
        .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.z.toFixed(1)}`)
        .join(" ") + " Z";
    }
  }, [points]);

  // Convert THREE heading (in radians, where 0 is South/positive Z, increasing counterclockwise usually)
  // to SVG rotation degrees (where 0 is UP/North, increasing clockwise)
  const getPlayerRotationDeg = (headingRad: number) => {
    // 1 rad is ~57.29 deg. Rotate heading to point in correct vertical align.
    const deg = (headingRad * 180) / Math.PI;
    return deg;
  };

  return (
    <div className="relative w-44 h-44 md:w-52 md:h-52 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-white/10 p-2.5 shadow-2xl flex flex-col items-center justify-center animate-fade-in">
      {/* Decorative Title */}
      <span className="absolute top-1.5 left-3 font-mono text-[10px] uppercase tracking-widest text-[#a5f3fc]/70">
        GPS Minimap
      </span>

      {/* SVG Canvas Map */}
      <svg
        className="w-full h-full max-w-[90%] max-h-[90%] drop-shadow-[0_0_12px_rgba(59,130,246,0.15)]"
        viewBox={viewBoxStr}
        id="minimap-canvas"
      >
        <defs>
          <linearGradient id="trackGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Outer circuit path outline glow */}
        <path
          d={svgPathData}
          fill="none"
          stroke="url(#trackGlow)"
          strokeWidth={trackConfig.roadWidth * 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Primary road track vector */}
        <path
          d={svgPathData}
          fill="none"
          stroke="#334155"
          strokeWidth={trackConfig.roadWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-colors"
        />

        {/* Center line separator */}
        <path
          d={svgPathData}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeDasharray="4 8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />

        {/* Render Opponent state locations */}
        {opponents.map((opp) => {
          const sizeScalar = bounds.width * 0.045;
          return (
            <g key={opp.id} className="transition-all duration-300">
              {/* Opponent point */}
              <circle
                cx={opp.x}
                cy={opp.z}
                r={sizeScalar}
                fill={opp.color || "#ef4444"}
                stroke="#020617"
                strokeWidth={sizeScalar * 0.25}
                className="animate-pulse"
              />
              {/* Mini tag label displaying first 3 letters of nickname */}
              <text
                x={opp.x}
                y={opp.z - sizeScalar * 1.8}
                fill="#ffffff"
                fontSize={bounds.width * 0.08}
                fontWeight="bold"
                fontFamily="sans-serif"
                textAnchor="middle"
                stroke="#09090b"
                strokeWidth={bounds.width * 0.02}
                paintOrder="stroke"
              >
                {opp.nickname ? opp.nickname.substring(0, 3) : "BOT"}
              </text>
            </g>
          );
        })}

        {/* Render Self player location with direction indicator */}
        <g
          transform={`translate(${playerPos.x}, ${playerPos.z}) rotate(${getPlayerRotationDeg(playerPos.heading)})`}
          className="transition-transform duration-75"
        >
          {/* Radial radar wave pulse */}
          <circle
            cx="0"
            cy="0"
            r={bounds.width * 0.095}
            fill="#3b82f6"
            opacity="0.25"
            className="animate-pulse"
          />

          {/* Core Player pointer shape */}
          <polygon
            points={`0,-${bounds.width * 0.08} -${bounds.width * 0.052},${bounds.width * 0.06} 0,${bounds.width * 0.022} ${bounds.width * 0.052},${bounds.width * 0.06}`}
            fill="#60a5fa"
            stroke="#ffffff"
            strokeWidth={bounds.width * 0.015}
            id="minimap-player-dot"
          />
        </g>
      </svg>

      {/* Speed & Biome Accent Indicator */}
      <div className="absolute bottom-1 right-3.5 font-mono text-[9px] uppercase tracking-wider text-slate-400">
        Biome: <span className="text-[#38bdf8]">{trackConfig.decorType}</span>
      </div>
    </div>
  );
}
