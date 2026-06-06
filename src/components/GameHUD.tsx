import { useEffect, useState } from "react";
import { formatTime } from "./MainMenu";
import { Trophy, RefreshCw, LogOut, Disc, Zap, Flame, MoveLeft, MoveRight, Compass } from "lucide-react";

interface GameHUDProps {
  trackName: string;
  speed: number;
  elapsedTimeMs: number;
  currentLap: number;
  totalLaps: number;
  isDrifting: boolean;
  isMultiplayer: boolean;
  opponents: Array<{ nickname: string; speed: number; x: number; z: number }>;
  onRespawn: () => void;
  onExit: () => void;
  countdown: number | null;
  driftCombo: number;
  // Touch event callbacks (for mobile support)
  onTouchControl: (control: string, active: boolean) => void;
  boosterCharge?: number;
  isBoosting?: boolean;
}

export function GameHUD({
  trackName,
  speed,
  elapsedTimeMs,
  currentLap,
  totalLaps,
  isDrifting,
  isMultiplayer,
  opponents,
  onRespawn,
  onExit,
  countdown,
  driftCombo,
  onTouchControl,
  boosterCharge = 0,
  isBoosting = false,
}: GameHUDProps) {
  // Convert standard internal speed to realistic KM/H for visual effect
  const displaySpeed = Math.round(Math.abs(speed) * 3.6);
  const showDriftAlert = isDrifting && displaySpeed > 15;

  return (
    <div id="game-hud" className="absolute inset-0 pointer-events-none select-none z-30 flex flex-col justify-between p-4 sm:p-6 font-mono text-white">
      
      {/* Top Header - Lap Statistics & Back Navigation */}
      <div className="flex justify-between items-start w-full">
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          {/* Back button */}
          <button
            onClick={onExit}
            className="flex items-center gap-2 bg-slate-950/80 border border-slate-900 hover:border-slate-800 hover:bg-slate-900 text-slate-300 text-xs font-bold py-2 px-4 rounded-xl shadow-lg cursor-pointer transition-all uppercase tracking-wider"
          >
            <LogOut className="w-3.5 h-3.5" /> Return Menu
          </button>
          
          {/* Track name & stats */}
          <div className="bg-slate-950/80 border border-slate-900/60 p-4 rounded-2xl shadow-xl mt-2">
            <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase block mb-1">Active Circuit</span>
            <span className="text-sm font-bold tracking-wide font-sans">{trackName}</span>
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-900 text-xs">
              <div>
                <span className="text-slate-500">Lap: </span>
                <span className="text-yellow-400 font-black">{currentLap > totalLaps ? totalLaps : currentLap}</span>
                <span className="text-slate-500">/{totalLaps}</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
              <div>
                <span className="text-slate-500">Mode: </span>
                <span className={isMultiplayer ? "text-indigo-400 font-bold" : "text-green-400 font-bold"}>
                  {isMultiplayer ? "MULTIPLAYER" : "SINGLE"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic High-precision Timer Panel */}
        <div className="flex flex-col items-end gap-2">
          <div className="bg-slate-950/85 border border-slate-900 p-4 rounded-2xl shadow-xl text-right min-w-[140px]">
            <span className="text-[10px] text-rose-400 font-bold tracking-widest uppercase block mb-0.5">Race Timer</span>
            <span className="text-2xl font-black tabular-nums text-rose-100 tracking-wider">
              {formatTime(elapsedTimeMs)}
            </span>
          </div>

          {/* Quick manual Respawn button */}
          <button
            onClick={onRespawn}
            className="pointer-events-auto flex items-center gap-2 bg-slate-950/80 border border-slate-900 hover:border-orange-500/30 hover:bg-orange-950/10 hover:text-orange-400 text-orange-200 text-xs font-bold py-2 px-3.5 rounded-xl shadow-lg cursor-pointer transition-all"
            title="Press R on keyboard to reset car alignment on the center of the road"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Respawn (R)
          </button>
        </div>
      </div>

      {/* Center Screen Overlays (Countdowns and Drift Combos) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Startup Countdown Overlay */}
        {countdown !== null && (
          <div className="bg-slate-950/60 backdrop-blur-sm border border-slate-900 rounded-full w-28 h-28 flex items-center justify-center animate-pulse shadow-2xl scale-125">
            <span className="text-5xl font-black italic select-none text-white animate-scale flex items-center justify-center">
              {countdown === 0 ? "GO!" : countdown}
            </span>
          </div>
        )}

        {/* Drift Sparks Indicator visual */}
        {showDriftAlert && (
          <div className="flex flex-col items-center bg-purple-950/20 shadow-purple-500/5 shadow-2xl border border-purple-500/20 px-6 py-2.5 rounded-2xl backdrop-blur-xs scale-105 animate-bounce">
            <span className="flex items-center gap-1.5 text-xs font-black tracking-widest text-fuchsia-400">
              <Flame className="w-4 h-4 fill-fuchsia-400 animate-pulse text-fuchsia-400" />
              DRIFT ANGLE MAX
            </span>
            {driftCombo > 10 && (
              <span className="text-[10px] text-fuchsia-300/80 font-bold tracking-wider mt-0.5 uppercase">
                +{driftCombo} XP COMBO
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Layer - Speedometer & Mobile Steering Overlays */}
      <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 pointer-events-auto mt-auto">
        
        {/* Interactive Multiplayer Leaders list */}
        {isMultiplayer && (
          <div className="bg-slate-950/80 border border-slate-900/60 p-4 rounded-2xl w-full max-w-[280px] shadow-lg text-xs font-sans">
            <span className="text-[10px] font-mono text-indigo-400 font-bold tracking-widest uppercase block mb-2 flex items-center gap-1">
              <Compass className="w-3 h-3 text-indigo-400" />
              Active Connected Racers
            </span>
            <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
              {opponents.length === 0 ? (
                <span className="text-slate-500 italic block py-0.5 text-[11px]">Synced, waiting for others to join track...</span>
              ) : (
                opponents.map((opp, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-900/40 px-2 py-1.5 rounded-lg border border-slate-900">
                    <span className="text-slate-200 font-medium truncate max-w-[120px]">{opp.nickname || "Racer"}</span>
                    <span className="font-mono text-[11px] text-indigo-300 font-semibold">{Math.round(opp.speed * 3.6)} KM/H</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {!isMultiplayer && <div className="hidden md:block w-3" />}

        {/* Speedometer & Booster Gauges Cluster */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          
          {/* Speedometer Gauges */}
          <div className="bg-slate-950/85 border border-slate-900/80 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 min-w-[210px] relative overflow-hidden">
            {/* Aesthetic speed arc background */}
            <div className="absolute left-0 bottom-0 top-0 w-2.5 bg-gradient-to-t from-blue-600 via-indigo-500 to-rose-400" />
            
            <div className="pl-1">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tighter tabular-nums text-white">
                  {displaySpeed}
                </span>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">KM/H</span>
              </div>
              
              {/* Speed level progression bar */}
              <div className="w-36 h-2 bg-slate-900 rounded-full mt-2 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500 rounded-full transition-all duration-75"
                  style={{ width: `${Math.min(100, (displaySpeed / 200) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-l border-slate-900 pl-4 py-1.5">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-0.5">RPM</span>
              <span className="text-sm font-black text-indigo-400">
                {Math.round(2000 + (displaySpeed / 200) * 6000)}
              </span>
            </div>
          </div>

          {/* Booster Gauge Card */}
          <div className="bg-slate-950/85 border border-slate-900/80 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 min-w-[245px] relative overflow-hidden">
            {/* Accent colored side indicator */}
            <div className={`absolute left-0 bottom-0 top-0 w-2.5 transition-all duration-300 ${
              isBoosting
                ? "bg-gradient-to-t from-cyan-400 to-blue-500 animate-pulse"
                : boosterCharge >= 100
                ? "bg-gradient-to-t from-amber-500 to-yellow-400 animate-pulse"
                : "bg-slate-800"
            }`} />
            
            <div className="pl-1 flex-1">
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {isBoosting ? "🚀 NITRO BOOST!" : boosterCharge >= 100 ? "🔥 BOOSTER FULL" : "⚡ BOOSTER CHARGE"}
                </span>
                <span className={`text-[10px] font-black ${isBoosting ? "text-cyan-400 animate-pulse" : boosterCharge >= 100 ? "text-amber-400 animate-bounce" : "text-slate-400"}`}>
                  {isBoosting ? "BURNING" : boosterCharge >= 100 ? "READY" : `${Math.round(boosterCharge)}%`}
                </span>
              </div>
              
              {/* Boost level progression bar */}
              <div className="w-40 h-2 bg-slate-900 rounded-full mt-2 overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${
                    isBoosting
                      ? "bg-gradient-to-r from-cyan-400 to-blue-500 animate-pulse"
                      : boosterCharge >= 100
                      ? "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 animate-pulse"
                      : "bg-gradient-to-r from-slate-600 via-indigo-600 to-fuchsia-500"
                  }`}
                  style={{ width: `${boosterCharge}%` }}
                />
              </div>
              
              <span className="text-[10px] text-slate-500 mt-1.5 block font-sans">
                {isBoosting ? (
                  <span className="text-cyan-400 font-bold">WARP SPEED ACTIVE</span>
                ) : boosterCharge >= 100 ? (
                  <span className="text-amber-300 font-bold animate-pulse">PRESS SHIFT TO ACTIVATE</span>
                ) : (
                  "Drift through curves to charge"
                )}
              </span>
            </div>
          </div>

        </div>

        {/* Touch Button Controls (visible on screens, usable for steering on mobile) */}
        <div className="flex items-center gap-3 bg-slate-950/40 p-2 rounded-2xl border border-slate-900/30">
          <div className="flex items-center gap-1.5">
            <button
              onMouseDown={() => onTouchControl("left", true)}
              onMouseUp={() => onTouchControl("left", false)}
              onMouseLeave={() => onTouchControl("left", false)}
              onTouchStart={(e) => { e.preventDefault(); onTouchControl("left", true); }}
              onTouchEnd={(e) => { e.preventDefault(); onTouchControl("left", false); }}
              className="w-12 h-12 bg-slate-950/80 hover:bg-slate-900 text-slate-300 font-bold rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            >
              <MoveLeft className="w-5 h-5" />
            </button>
            <button
              onMouseDown={() => onTouchControl("right", true)}
              onMouseUp={() => onTouchControl("right", false)}
              onMouseLeave={() => onTouchControl("right", false)}
              onTouchStart={(e) => { e.preventDefault(); onTouchControl("right", true); }}
              onTouchEnd={(e) => { e.preventDefault(); onTouchControl("right", false); }}
              className="w-12 h-12 bg-slate-950/80 hover:bg-slate-900 text-slate-300 font-bold rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            >
              <MoveRight className="w-5 h-5" />
            </button>
          </div>

          <div className="w-px h-8 bg-slate-800" />

          <div className="flex items-center gap-1.5">
            <button
              onMouseDown={() => onTouchControl("handbrake", true)}
              onMouseUp={() => onTouchControl("handbrake", false)}
              onMouseLeave={() => onTouchControl("handbrake", false)}
              onTouchStart={(e) => { e.preventDefault(); onTouchControl("handbrake", true); }}
              onTouchEnd={(e) => { e.preventDefault(); onTouchControl("handbrake", false); }}
              className="w-14 h-12 bg-purple-950/50 hover:bg-purple-900/50 text-fuchsia-300 font-bold text-xs uppercase rounded-xl border border-purple-900/60 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            >
              <Disc className="w-4 h-4 mr-0.5 animate-spin" /> Drift
            </button>

            {/* Dynamic Boost Tap Button */}
            <button
              onMouseDown={() => { if (boosterCharge >= 100 || isBoosting) onTouchControl("boost", true); }}
              onMouseUp={() => onTouchControl("boost", false)}
              onMouseLeave={() => onTouchControl("boost", false)}
              onTouchStart={(e) => { e.preventDefault(); if (boosterCharge >= 100 || isBoosting) onTouchControl("boost", true); }}
              onTouchEnd={(e) => { e.preventDefault(); onTouchControl("boost", false); }}
              className={`w-14 h-12 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                isBoosting
                  ? "bg-gradient-to-br from-cyan-400 to-blue-600 text-white font-extrabold border-cyan-300 animate-pulse"
                  : boosterCharge >= 100
                  ? "bg-gradient-to-br from-amber-500 to-yellow-500 text-white font-extrabold border-amber-300 animate-bounce"
                  : "bg-slate-950/40 text-slate-600 border-slate-900/40 cursor-not-allowed"
              }`}
            >
              <Flame className={`w-4 h-4 ${isBoosting || boosterCharge >= 100 ? "animate-pulse" : ""}`} />
              <span className="text-[9px] uppercase tracking-wider font-extrabold mt-0.5">Boost</span>
            </button>

            <button
              onMouseDown={() => onTouchControl("forward", true)}
              onMouseUp={() => onTouchControl("forward", false)}
              onMouseLeave={() => onTouchControl("forward", false)}
              onTouchStart={(e) => { e.preventDefault(); onTouchControl("forward", true); }}
              onTouchEnd={(e) => { e.preventDefault(); onTouchControl("forward", false); }}
              className="w-16 h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase rounded-xl shadow-lg shadow-blue-600/10 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            >
              <Zap className="w-4 h-4 mr-0.5 fill-white" /> Gas
            </button>
            <button
              onMouseDown={() => onTouchControl("backward", true)}
              onMouseUp={() => onTouchControl("backward", false)}
              onMouseLeave={() => onTouchControl("backward", false)}
              onTouchStart={(e) => { e.preventDefault(); onTouchControl("backward", true); }}
              onTouchEnd={(e) => { e.preventDefault(); onTouchControl("backward", false); }}
              className="w-12 h-12 bg-slate-950/80 hover:bg-slate-900 text-rose-400 font-bold text-xs uppercase rounded-xl border border-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            >
              Brake
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
