/**
 * Retro Vector Arcade First-Person Tank Cockpit HUD.
 * Oscilloscope phosphor CRT aesthetic, authentic Battlezone reticle,
 * high-contrast segmented vitality bars, unobstructed view, and intuitive controls.
 */

import React from 'react';
import { Volume2, VolumeX, Pause, Crosshair, Shield, Zap, Flame, Compass, Target, RotateCcw } from 'lucide-react';
import { TacticalRadar, RadarEntity } from './TacticalRadar';
import { TargetedEnemyInfo } from '../game/GameManager';

interface ActivePowerUpState {
  type: string;
  remainingTime: number;
  totalDuration: number;
}

interface CockpitHUDProps {
  score: number;
  stageNumber: number;
  stageName: string;
  playerHp: number;
  playerMaxHp: number;
  reloadProgress: number; // 0 to 1 (1 = ready to fire)
  playerX: number;
  playerZ: number;
  chassisYaw: number;
  turretYaw: number;
  turretPitch: number;
  radarEntities: RadarEntity[];
  activePowerUps: ActivePowerUpState[];
  bossActive: boolean;
  bossName?: string;
  bossHp?: number;
  bossMaxHp?: number;
  targetedEnemy?: TargetedEnemyInfo | null;
  hitConfirmed: boolean;
  isMuted: boolean;
  isPointerLocked: boolean;
  controlMode?: 'solidary' | 'conic' | 'free';
  isRepairing?: boolean;
  matchSeed?: number;
  onToggleMute: () => void;
  onPause: () => void;
  onRequestPointerLock: () => void;
  onToggleControlMode?: () => void;
  onRecenterTurret?: () => void;
}

export const CockpitHUD: React.FC<CockpitHUDProps> = ({
  score,
  stageNumber,
  stageName,
  playerHp,
  playerMaxHp,
  reloadProgress,
  playerX,
  playerZ,
  chassisYaw,
  turretYaw,
  turretPitch,
  radarEntities,
  activePowerUps,
  bossActive,
  bossName,
  bossHp = 0,
  bossMaxHp = 1,
  targetedEnemy,
  hitConfirmed,
  isMuted,
  isPointerLocked,
  controlMode = 'solidary',
  isRepairing = false,
  matchSeed,
  onToggleMute,
  onPause,
  onRequestPointerLock,
  onToggleControlMode,
  onRecenterTurret,
}) => {
  // Convert angles to degrees [0..360)
  const turretDeg = Math.round(((-turretYaw * 180) / Math.PI + 360) % 360);
  const chassisDeg = Math.round(((-chassisYaw * 180) / Math.PI + 360) % 360);
  const pitchDeg = Math.round((turretPitch * 180) / Math.PI);

  // Angle difference between turret and chassis in degrees (-180..180)
  let angleDiff = turretDeg - chassisDeg;
  if (angleDiff > 180) angleDiff -= 360;
  if (angleDiff < -180) angleDiff += 360;

  const hpPercent = Math.max(0, Math.min(100, Math.round((playerHp / (playerMaxHp || 1)) * 100)));

  // 20 segments for player HP bar
  const totalSegments = 20;
  const activeSegments = Math.round((hpPercent / 100) * totalSegments);

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-3 sm:p-4 overflow-hidden font-mono text-[#00ff66]">
      {/* CRT Scanline and Vignette phosphor filter */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_65%,rgba(0,18,5,0.7)_100%)]" />
      <div className="absolute inset-0 pointer-events-none opacity-15 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#00ff66_3px)]" />

      {/* TOP STATUS BAR: Phase, Score, Compass, Enemy/Boss Info, & Audio/Pause Buttons */}
      <div className="relative flex flex-col z-10 w-full px-2 gap-1.5">
        <div className="flex items-start justify-between w-full">
          {/* Left: Phase & Score & Procedural Seed */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 border border-[#00ff66]/50 bg-black/75 rounded text-[#33ff88] tracking-widest uppercase font-bold">
                FASE {stageNumber}
              </span>
              <span className="text-xs text-[#00aa44] tracking-wider uppercase font-semibold">
                {stageName}
              </span>
              {matchSeed && (
                <span className="text-[10px] px-1.5 py-0.5 border border-[#00aa44]/40 bg-black/60 rounded text-[#00aa44] font-mono tracking-wider" title="Semilla de terreno procedural">
                  MAPA #{matchSeed}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold tracking-widest text-[#00ff66] drop-shadow-[0_0_8px_rgba(0,255,102,0.6)] tabular-nums mt-0.5">
              PUNTOS {score.toString().padStart(6, '0')}
            </div>
          </div>

          {/* Center: Compass Heading Tape & Ballistic Elevation */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 px-3 py-1 border border-[#00ff66]/50 bg-black/80 rounded text-xs tracking-widest shadow-[0_0_10px_rgba(0,255,102,0.15)]">
              <Compass className="w-4 h-4 text-[#00ff66]" />
              <span className="text-[#00aa44]">RUMBO:</span>
              <span className="font-bold text-[#00ff66] tabular-nums">{turretDeg.toString().padStart(3, '0')}°</span>
              <span className="text-[#00aa44] ml-1">ELEV:</span>
              <span className="font-bold text-[#33ff88] tabular-nums">{pitchDeg >= 0 ? `+${pitchDeg}` : pitchDeg}°</span>
            </div>

            {/* Slim Boss Health Bar (Positioned safely at the very top, NEVER obstructing center) */}
            {bossActive && (
              <div className="w-72 mt-1 px-3 py-1.5 border-2 border-[#ff0055] bg-black/95 rounded-lg shadow-[0_0_20px_rgba(255,0,85,0.45)]">
                <div className="flex items-center justify-between text-xs tracking-wider font-bold text-[#ff3377] mb-0.5">
                  <span className="flex items-center gap-1.5 truncate max-w-[160px] uppercase">
                    <Flame className="w-3.5 h-3.5 text-[#ffaa00] shrink-0" />
                    {bossName}
                  </span>
                  <span className="tabular-nums shrink-0 text-white font-bold">
                    {bossHp} / {bossMaxHp} HP
                  </span>
                </div>
                <div className="w-full h-2.5 bg-red-950/90 border border-[#ff0055]/60 rounded-sm overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-[#ff0055] via-[#ff5500] to-[#ffaa00] transition-all duration-150 rounded-xs"
                    style={{ width: `${Math.max(0, Math.min(100, (bossHp / (bossMaxHp || 1)) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: Audio & Pause Controls */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={onToggleMute}
              className="p-2 border border-[#00ff66]/40 hover:border-[#00ff66] bg-black/80 hover:bg-[#003311] rounded text-[#00ff66] transition-colors focus:outline-none cursor-pointer"
              title="Silenciar Sonido (M)"
              aria-label="Toggle Audio Mute"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#00ff66]" />}
            </button>
            <button
              onClick={onPause}
              className="p-2 border border-[#00ff66]/40 hover:border-[#00ff66] bg-black/80 hover:bg-[#003311] rounded text-[#00ff66] transition-colors focus:outline-none cursor-pointer"
              title="Pausar Juego (Esc / P)"
              aria-label="Pause Game"
            >
              <Pause className="w-4 h-4 text-[#00ff66]" />
            </button>
          </div>
        </div>

        {/* TARGETED ENEMY TACTICAL BANNER - Positioned safely at the TOP, NEVER BLOCKING CENTER SIGHT */}
        {targetedEnemy && targetedEnemy.inView && (
          <div className="self-center flex items-center gap-3 px-4 py-1.5 bg-black/90 border-2 border-[#ff3344] rounded-lg shadow-[0_0_20px_rgba(255,51,68,0.45)] text-[#ff3344] pointer-events-none max-w-lg w-full justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#ff3344] animate-pulse shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider uppercase text-white">
                  {targetedEnemy.name}
                </span>
                <span className="text-[10px] text-[#ff8899] tabular-nums font-semibold">
                  DISTANCIA: {Math.round(targetedEnemy.distance)}M
                </span>
              </div>
            </div>

            {/* Segmented Enemy Health Bar */}
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold tabular-nums">
                <span className="text-[10px] text-[#ff8899]">VIDA ENEMIGA:</span>
                <span className="text-white font-extrabold">{targetedEnemy.hp} / {targetedEnemy.maxHp} HP</span>
                <span className="text-[10px] text-amber-300">
                  ({Math.round((targetedEnemy.hp / (targetedEnemy.maxHp || 1)) * 100)}%)
                </span>
              </div>
              <div className="w-40 h-2 bg-black border border-[#ff3344]/70 rounded-xs overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-400 transition-all duration-100"
                  style={{ width: `${Math.max(0, Math.min(100, (targetedEnemy.hp / (targetedEnemy.maxHp || 1)) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICACIÓN DE ESTACIÓN DE REPARACIÓN / CURACIÓN EN CURSO */}
        {isRepairing && (
          <div className="self-center flex items-center gap-2 px-4 py-1.5 bg-black/95 border-2 border-[#00ff88] text-[#00ffaa] text-xs font-bold tracking-widest uppercase rounded-lg shadow-[0_0_20px_rgba(0,255,136,0.5)] animate-pulse">
            <Shield className="w-4 h-4 text-[#00ffaa]" />
            <span>✚ REPARANDO BLINDAJE EN ESTACIÓN (+25 HP/S)</span>
          </div>
        )}
      </div>

      {/* ENCUADRE ROJO DE BLANCO ENEMIGO FIJADO (Target Lock - encuadra al enemigo SIN taparlo ni obstaculizar) */}
      {targetedEnemy && targetedEnemy.inView && (
        <div
          className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-15 transition-all duration-75 flex items-center justify-center"
          style={{ left: `${targetedEnemy.screenX}%`, top: `${targetedEnemy.screenY}%` }}
        >
          {/* Tactical Target Lock Frame with corner brackets - open center, NO text covering the enemy */}
          <div className="w-14 h-14 relative flex items-center justify-center pointer-events-none">
            <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#ff3344] drop-shadow-[0_0_6px_#ff3344]" />
            <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#ff3344] drop-shadow-[0_0_6px_#ff3344]" />
            <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-[#ff3344] drop-shadow-[0_0_6px_#ff3344]" />
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-[#ff3344] drop-shadow-[0_0_6px_#ff3344]" />
          </div>
        </div>
      )}

      {/* CENTER RETICLE & AUTHENTIC BATTLEZONE VECTOR SIGHT (Verde = Tu cañón) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
        {/* Battlezone Arcade Crosshair */}
        <div className="relative flex items-center justify-center">
          <svg
            viewBox="0 0 160 80"
            className={`w-44 h-22 transition-all duration-100 ${
              hitConfirmed
                ? 'stroke-white drop-shadow-[0_0_16px_#ffffff] scale-110'
                : 'stroke-[#00ff66] drop-shadow-[0_0_6px_rgba(0,255,102,0.8)]'
            }`}
          >
            {/* Left Horizontal Ranging Graduation Ticks */}
            <line x1="10" y1="40" x2="26" y2="40" strokeWidth="1.5" />
            <line x1="32" y1="35" x2="32" y2="45" strokeWidth="1.5" />
            <line x1="40" y1="40" x2="56" y2="40" strokeWidth="1.5" />

            {/* Left Periscope Bracket [ */}
            <path d="M 64,28 L 64,52 M 64,28 L 71,28 M 64,52 L 71,52" fill="none" strokeWidth="2" />

            {/* Right Periscope Bracket ] */}
            <path d="M 96,28 L 96,52 M 96,28 L 89,28 M 96,52 L 89,52" fill="none" strokeWidth="2" />

            {/* Center Aiming Pip / Micro-cross */}
            <line x1="77" y1="40" x2="83" y2="40" strokeWidth="1.5" />
            <line x1="80" y1="37" x2="80" y2="43" strokeWidth="1.5" />

            {/* Iconic Battlezone Inverted Chevron ^ */}
            <polyline points="74,21 80,12 86,21" fill="none" strokeWidth="2" />

            {/* Ballistic Drop Gravity Notch below */}
            <line x1="76" y1="58" x2="84" y2="58" strokeWidth="1.5" />
            <line x1="78" y1="68" x2="82" y2="68" strokeWidth="1" />

            {/* Right Horizontal Ranging Graduation Ticks */}
            <line x1="104" y1="40" x2="120" y2="40" strokeWidth="1.5" />
            <line x1="128" y1="35" x2="128" y2="45" strokeWidth="1.5" />
            <line x1="134" y1="40" x2="150" y2="40" strokeWidth="1.5" />
          </svg>

          {/* HIGH-VISIBILITY ARCADE HITMARKER (Confirmación visual contundente de impacto en enemigo) */}
          {hitConfirmed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg viewBox="0 0 40 40" className="w-12 h-12 stroke-white drop-shadow-[0_0_12px_#ff2244]">
                {/* 4 Diagonal Hitmarker Ticks */}
                <line x1="8" y1="8" x2="15" y2="15" strokeWidth="2.5" stroke="#ffffff" />
                <line x1="32" y1="8" x2="25" y2="15" strokeWidth="2.5" stroke="#ffffff" />
                <line x1="8" y1="32" x2="15" y2="25" strokeWidth="2.5" stroke="#ffffff" />
                <line x1="32" y1="32" x2="25" y2="25" strokeWidth="2.5" stroke="#ffffff" />
              </svg>
              <div className="absolute top-14 px-2.5 py-0.5 bg-red-600/95 text-white font-mono text-[11px] font-black tracking-widest uppercase rounded shadow-[0_0_15px_#ff0033] animate-pulse whitespace-nowrap">
                ¡IMPACTO CONFIRMADO!
              </div>
            </div>
          )}
        </div>

        {/* Reload readiness / Ballistic firing cue */}
        <div className="mt-2 flex flex-col items-center">
          <div className="w-24 h-1.5 bg-black/80 border border-[#00ff66]/50 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full transition-all duration-75 ${
                reloadProgress >= 1 ? 'bg-[#00ff66] shadow-[0_0_8px_#00ff66]' : 'bg-[#008833]'
              }`}
              style={{ width: `${Math.round(reloadProgress * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-bold tracking-wider text-[#00ff66] mt-0.5 uppercase drop-shadow">
            {reloadProgress >= 1 ? '● CAÑÓN LISTO' : 'RECARGANDO BALÍSTICA...'}
          </span>
        </div>
      </div>

      {/* POINTER LOCK NOTIFICATION BADGE (If mouse unlocked) */}
      {!isPointerLocked && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <button
            onClick={onRequestPointerLock}
            className="px-5 py-2.5 bg-black/95 border-2 border-[#00ff66] hover:bg-[#003311] text-[#00ff66] text-xs font-mono font-bold rounded-lg tracking-wider shadow-[0_0_20px_rgba(0,255,102,0.5)] flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          >
            <Crosshair className="w-4 h-4 text-[#00ff66] animate-pulse" />
            HAZ CLIC AQUÍ PARA BLOQUEAR RATÓN Y APUNTAR
          </button>
        </div>
      )}

      {/* BOTTOM SECTION: Player Armor Integrity (HIGH VISIBILITY), Control Mode, Power-ups & Corner Radar */}
      <div className="relative z-10 w-full flex items-end justify-between px-2 gap-3 pointer-events-auto">
        {/* Left: Player Life ("Vida de mi tanque") & Hull Heading */}
        <div className="flex flex-col gap-2 w-80">
          {/* Prominent Player Life / Armor Meter */}
          <div
            className={`p-3 border-2 rounded-xl bg-black/90 shadow-[0_0_20px_rgba(0,255,102,0.2)] transition-colors ${
              hpPercent <= 25
                ? 'border-red-500 shadow-[0_0_25px_rgba(255,50,50,0.5)] animate-pulse'
                : hpPercent <= 50
                ? 'border-amber-400 shadow-[0_0_15px_rgba(255,180,0,0.3)]'
                : 'border-[#00ff66]'
            }`}
          >
            <div className="flex items-center justify-between text-xs tracking-wider mb-1.5 font-bold">
              <span className="flex items-center gap-1.5 text-white">
                <Shield
                  className={`w-4 h-4 ${
                    hpPercent <= 25 ? 'text-red-400' : hpPercent <= 50 ? 'text-amber-300' : 'text-[#00ff66]'
                  }`}
                />
                VIDA DE MI TANQUE
              </span>
              <span
                className={`text-sm tabular-nums font-black ${
                  hpPercent <= 25 ? 'text-red-400' : hpPercent <= 50 ? 'text-amber-300' : 'text-[#00ff66]'
                }`}
              >
                {playerHp} / {playerMaxHp} HP ({hpPercent}%)
              </span>
            </div>

            {/* 20 Distinct High-Visibility Segments */}
            <div className="w-full flex gap-0.5 p-1 bg-black/90 border border-white/20 rounded-md">
              {Array.from({ length: totalSegments }).map((_, idx) => {
                const isFilled = idx < activeSegments;
                let segColor = 'bg-[#00ff66] shadow-[0_0_6px_#00ff66]';
                if (hpPercent <= 25) {
                  segColor = 'bg-red-500 shadow-[0_0_6px_red]';
                } else if (hpPercent <= 50) {
                  segColor = 'bg-amber-400 shadow-[0_0_6px_#ffbb00]';
                }

                return (
                  <div
                    key={idx}
                    className={`h-4 flex-1 rounded-xs transition-all duration-150 ${
                      isFilled ? segColor : 'bg-zinc-900 border border-zinc-800'
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-1 text-[10px] font-semibold tracking-wider">
              <span
                className={`${
                  hpPercent <= 25 ? 'text-red-400 font-bold' : hpPercent <= 50 ? 'text-amber-300' : 'text-[#00aa44]'
                }`}
              >
                {hpPercent <= 25
                  ? '⚠ ¡BLINDAJE CRÍTICO!'
                  : hpPercent <= 50
                  ? '▲ ADVERTENCIA DE DAÑO'
                  : '● BLINDAJE ÓPTIMO'}
              </span>
              <span className="text-[#00aa44]">BLINDAJE VECTORIAL</span>
            </div>
          </div>

          {/* Control Steering Mode & Chassis Heading Clarification */}
          <div className="p-2.5 border border-[#00ff66]/50 bg-black/85 rounded-lg text-xs flex flex-col gap-1.5 pointer-events-auto">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#00aa44]">MODO DE MANEJO:</span>
              <button
                data-testid="toggle-control-mode"
                onClick={onToggleControlMode}
                className="px-2 py-0.5 bg-[#00ff66]/20 hover:bg-[#00ff66]/40 border border-[#00ff66] rounded text-[11px] font-bold text-white tracking-wider cursor-pointer transition-colors pointer-events-auto"
                title="Pulsa 'C' para alternar modo"
              >
                {controlMode === 'solidary'
                  ? 'DIRECTO SOLIDARIO (BATTLEZONE)'
                  : controlMode === 'conic'
                  ? 'MORRO FIJO + CONO ±35°'
                  : 'TORRETA LIBRE 360°'}
              </button>
            </div>

            {/* Clue message explaining direction */}
            <div className="text-[10px] text-[#33ff88] tracking-wide">
              {controlMode === 'solidary' ? (
                <span>W SIEMPRE avanza hacia la mira frontal. A/D gira chasis y vista juntos.</span>
              ) : controlMode === 'conic' ? (
                <div className="flex items-center justify-between">
                  <span>Morro gira con A/D · Cono de mira ±35°</span>
                  {onRecenterTurret && (
                    <button
                      onClick={onRecenterTurret}
                      className="text-[9px] px-1.5 py-0.5 border border-[#00ff66]/60 rounded text-[#00ff66] hover:bg-[#003311] cursor-pointer flex items-center gap-1"
                      title="Centrar cañón con morro (X o Clic Dch)"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> CENTRAR (X)
                    </button>
                  )}
                </div>
              ) : (
                <span>Torreta gira libre 360°. Chasis se orienta con A/D.</span>
              )}
            </div>

            {/* Heading readout */}
            <div className="flex items-center justify-between text-[10px] text-[#00aa44] border-t border-white/10 pt-1">
              <span>
                MORRO: <strong className="text-white tabular-nums">{chassisDeg}°</strong>
              </span>
              <span>
                MIRA: <strong className="text-[#33ff88] tabular-nums">{turretDeg}°</strong>
              </span>
              {controlMode !== 'solidary' && (
                <span>
                  DESVÍO:{' '}
                  <strong className={Math.abs(angleDiff) > 30 ? 'text-amber-300' : 'text-white'}>
                    {angleDiff >= 0 ? `+${angleDiff}` : angleDiff}°
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center Bottom: Active Power-ups Bar */}
        <div className="flex flex-col items-center gap-1.5 mb-2">
          {activePowerUps.length > 0 ? (
            <div className="flex items-center gap-2">
              {activePowerUps.map((p) => {
                let colorClass = 'border-yellow-400 text-yellow-300';
                let Icon = Zap;
                if (p.type === 'TURBO_SPEED') {
                  colorClass = 'border-cyan-400 text-cyan-300';
                  Icon = Zap;
                } else if (p.type === 'DAMAGE_BOOST') {
                  colorClass = 'border-red-400 text-red-300';
                  Icon = Flame;
                } else if (p.type === 'ENERGY_SHIELD') {
                  colorClass = 'border-blue-400 text-blue-300';
                  Icon = Shield;
                } else if (p.type === 'RAPID_FIRE') {
                  colorClass = 'border-amber-300 text-amber-200';
                  Icon = Crosshair;
                }

                return (
                  <div
                    key={p.type}
                    className={`flex items-center gap-1.5 px-3 py-1.5 bg-black/90 border-2 rounded-lg ${colorClass} text-xs tracking-wider shadow-[0_0_15px_currentColor]`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-bold">{p.type.replace('_', ' ')}</span>
                    <span className="font-extrabold tabular-nums">({p.remainingTime.toFixed(1)}s)</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="text-[10px] text-[#00ff66]/90 tracking-widest uppercase bg-black/80 px-3 py-0.5 rounded border border-[#00ff66]/30">
                WASD: CONDUCIR · RATÓN: MIRA · ESPACIO / CLIC: DISPARAR · C: MODO MIRA
              </div>
              <div className="text-[9px] font-mono tracking-wider bg-black/90 px-3 py-0.5 rounded border border-white/20 flex items-center gap-2">
                <span className="text-[#33ff88] font-bold">✚ MIRA VERDE: Tu Cañón</span>
                <span className="text-white/40">|</span>
                <span className="text-[#ff4455] font-bold">⛶ RECUADRO ROJO: Blanco Enemigo Fijado</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Corner Tactical Radar */}
        <div className="flex flex-col items-end">
          <TacticalRadar
            playerX={playerX}
            playerZ={playerZ}
            chassisYaw={chassisYaw}
            turretYaw={turretYaw}
            entities={radarEntities}
            radarRange={160}
          />
        </div>
      </div>
    </div>
  );
};
