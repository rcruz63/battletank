/**
 * Game Shell Modals: Title Screen, Pause, Victory, and Game Over.
 * Implements ultra-mode and game craft guidelines with bespoke SVG logo lockups.
 */

import React from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Shield, Crosshair, Award } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  highScore: number;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  isMuted,
  onToggleMute,
  highScore,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between items-center p-8 bg-black/80 font-mono text-[#00ff66] select-none">
      {/* Top bar with high score & audio toggle */}
      <div className="w-full flex justify-between items-center text-xs tracking-widest text-[#00aa44]">
        <div className="flex items-center gap-2">
          <span>COCKPIT OS v1.98</span>
          <span className="text-[#00ff66]">· VECTOR SIMULATION</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="tabular-nums">TOP RECORD: {highScore.toString().padStart(6, '0')}</span>
          <button
            onClick={onToggleMute}
            className="p-1.5 border border-[#00ff66]/40 hover:border-[#00ff66] rounded cursor-pointer transition-colors"
            aria-label="Toggle Audio"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#00ff66]" />}
          </button>
        </div>
      </div>

      {/* Hero Centerpiece: Bespoke Vector SVG Logo Lockup */}
      <div className="flex flex-col items-center max-w-xl text-center my-auto">
        <svg
          viewBox="0 0 420 130"
          className="w-full max-w-md h-auto drop-shadow-[0_0_18px_rgba(0,255,102,0.6)]"
        >
          {/* Wireframe Tank Silhouette Icon */}
          <g stroke="#00ff66" strokeWidth="2" fill="none">
            {/* Turret */}
            <polygon points="170,40 250,40 240,24 180,24" />
            {/* Long Cannon Barrel */}
            <line x1="210" y1="30" x2="295" y2="20" strokeWidth="2.5" />
            <line x1="295" y1="17" x2="305" y2="15" strokeWidth="3" />
            {/* Hull */}
            <polygon points="140,58 280,58 300,75 120,75" />
            {/* Treads */}
            <rect x="110" y="75" width="200" height="20" rx="4" />
            <circle cx="135" cy="85" r="6" />
            <circle cx="165" cy="85" r="6" />
            <circle cx="195" cy="85" r="6" />
            <circle cx="225" cy="85" r="6" />
            <circle cx="255" cy="85" r="6" />
            <circle cx="285" cy="85" r="6" />
          </g>
          {/* Display Typography */}
          <text
            x="210"
            y="118"
            textAnchor="middle"
            fill="#00ff66"
            fontSize="26"
            fontFamily="monospace"
            fontWeight="900"
            letterSpacing="6"
          >
            VECTOR TANK
          </text>
        </svg>

        <p className="text-xs text-[#00cc55] tracking-widest mt-2 uppercase">
          1980 VECTOR ARCADE FIRST-PERSON COMBAT
        </p>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-3 my-6 w-full max-w-lg text-[11px] text-[#00aa44]">
          <div className="p-2 border border-[#00ff66]/30 bg-black/60 rounded flex flex-col items-center">
            <Crosshair className="w-4 h-4 text-[#00ff66] mb-1" />
            <span className="font-bold text-[#00ff66]">BALLISTIC SIGHT</span>
            <span className="text-[10px]">Real gravity & drop</span>
          </div>
          <div className="p-2 border border-[#00ff66]/30 bg-black/60 rounded flex flex-col items-center">
            <Shield className="w-4 h-4 text-[#00ff66] mb-1" />
            <span className="font-bold text-[#00ff66]">HOUSES & COVER</span>
            <span className="text-[10px]">Destructible obstacles</span>
          </div>
          <div className="p-2 border border-[#00ff66]/30 bg-black/60 rounded flex flex-col items-center">
            <Award className="w-4 h-4 text-[#00ff66] mb-1" />
            <span className="font-bold text-[#00ff66]">BOSS PHASES</span>
            <span className="text-[10px]">Goliath · Hydra · Titan</span>
          </div>
        </div>

        {/* Primary Start CTA */}
        <button
          onClick={onStart}
          data-start="true"
          className="px-8 py-3.5 bg-[#00ff66] hover:bg-[#33ff88] text-black font-bold text-sm tracking-widest rounded transition-transform hover:scale-105 active:scale-95 shadow-[0_0_25px_rgba(0,255,102,0.7)] flex items-center gap-2 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-black" />
          START MISSION (ENTER / SPACE)
        </button>
      </div>

      {/* Flat Control Hints */}
      <div className="text-[11px] text-[#00aa44] tracking-widest text-center">
        WASD Move Chassis · Mouse Aim Turret · L-Click / Space Fire · Esc Pause · M Mute
      </div>
    </div>
  );
};

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  stageNumber: number;
  score: number;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  stageNumber,
  score,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/85 font-mono text-[#00ff66] select-none">
      <div className="w-full max-w-sm p-6 border-2 border-[#00ff66] bg-black/95 rounded-xl shadow-[0_0_30px_rgba(0,255,102,0.4)] flex flex-col items-center text-center">
        <h2 className="text-xl font-bold tracking-widest text-[#00ff66] mb-2 uppercase">
          SYSTEM PAUSED
        </h2>
        <div className="text-xs text-[#00aa44] tracking-widest mb-6">
          PHASE {stageNumber} · SCORE {score}
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onResume}
            className="w-full py-2.5 bg-[#00ff66] hover:bg-[#33ff88] text-black font-bold text-xs tracking-widest rounded transition-colors cursor-pointer"
          >
            RESUME COMBAT (ESC)
          </button>
          <button
            onClick={onRestart}
            className="w-full py-2.5 border border-[#00ff66]/60 hover:bg-[#003311] text-[#00ff66] text-xs tracking-widest rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESTART MISSION
          </button>
        </div>
      </div>
    </div>
  );
};

interface VictoryModalProps {
  score: number;
  stageNumber: number;
  isLastStage: boolean;
  onNextStage: () => void;
  onRestart: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  score,
  stageNumber,
  isLastStage,
  onNextStage,
  onRestart,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/90 font-mono text-[#00ff66] select-none">
      <div className="w-full max-w-md p-6 border-2 border-[#00ff66] bg-black/95 rounded-xl shadow-[0_0_40px_rgba(0,255,102,0.5)] flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#00ff66] flex items-center justify-center mb-3 shadow-[0_0_15px_#00ff66]">
          <Award className="w-7 h-7 text-[#00ff66]" />
        </div>
        <h2 className="text-2xl font-black tracking-widest text-[#00ff66] mb-1 uppercase">
          {isLastStage ? 'CAMPAIGN COMPLETE!' : `PHASE ${stageNumber} SECURED!`}
        </h2>
        <p className="text-xs text-[#00aa44] tracking-widest mb-6 uppercase">
          Hostile vector battalion neutralized
        </p>

        <div className="w-full p-4 border border-[#00ff66]/40 bg-black/80 rounded-lg mb-6 flex justify-around">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#00aa44]">FINAL SCORE</span>
            <span className="text-xl font-bold text-[#00ff66] tabular-nums">{score}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#00aa44]">STATUS</span>
            <span className="text-xl font-bold text-[#33ff88]">VICTORY</span>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          {!isLastStage ? (
            <button
              onClick={onNextStage}
              data-start="true"
              className="w-full py-3 bg-[#00ff66] hover:bg-[#33ff88] text-black font-bold text-xs tracking-widest rounded transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(0,255,102,0.6)] cursor-pointer"
            >
              PROCEED TO NEXT PHASE (ENTER)
            </button>
          ) : (
            <button
              onClick={onRestart}
              data-start="true"
              className="w-full py-3 bg-[#00ff66] hover:bg-[#33ff88] text-black font-bold text-xs tracking-widest rounded transition-transform hover:scale-105 cursor-pointer"
            >
              PLAY AGAIN (ENTER)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  score: number;
  stageNumber: number;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  stageNumber,
  isMuted = false,
  onToggleMute,
  onRestart,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/90 font-mono text-[#ff3344] select-none">
      <div className="w-full max-w-md p-6 border-2 border-[#ff3344] bg-black/95 rounded-xl shadow-[0_0_40px_rgba(255,51,68,0.5)] flex flex-col items-center text-center">
        <h2 className="text-2xl font-black tracking-widest text-[#ff3344] mb-1 uppercase">
          TANQUE DESTRUIDO
        </h2>
        <p className="text-xs text-[#ff6677] tracking-widest mb-6 uppercase">
          Brecha en el blindaje · Misión Fallida
        </p>

        <div className="w-full p-4 border border-[#ff3344]/40 bg-black/80 rounded-lg mb-6 flex justify-around text-[#ff3344]">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#ff8899]">FASE ALCANZADA</span>
            <span className="text-xl font-bold tabular-nums">SECTOR {stageNumber}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#ff8899]">PUNTUACIÓN FINAL</span>
            <span className="text-xl font-bold tabular-nums">{score}</span>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onRestart}
            data-start="true"
            className="w-full py-3 bg-[#ff3344] hover:bg-[#ff5566] text-black font-bold text-xs tracking-widest rounded transition-transform hover:scale-105 shadow-[0_0_20px_rgba(255,51,68,0.6)] cursor-pointer uppercase"
          >
            REINTENTAR MISIÓN (ENTER / ESPACIO)
          </button>

          {onToggleMute && (
            <button
              onClick={onToggleMute}
              className="w-full py-2 bg-black/80 hover:bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-xs font-semibold rounded flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              {isMuted ? 'SONIDO SILENCIADO (PULSA PARA ACTIVAR)' : 'SILENCIAR SONIDO / APAGAR AUDIO (M)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
