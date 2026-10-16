/**
 * Tactical CRT Vector Radar.
 * Displays 360-degree radar sweep, terrain contours, player heading vs turret aim,
 * hostile tanks, fast surprise scouts, bosses, and tactical power-ups.
 */

import React, { useEffect, useRef } from 'react';

export interface RadarEntity {
  x: number;
  z: number;
  type: 'enemy' | 'scout' | 'boss' | 'powerup' | 'building';
  alive: boolean;
}

interface TacticalRadarProps {
  playerX: number;
  playerZ: number;
  chassisYaw: number;
  turretYaw: number;
  entities: RadarEntity[];
  radarRange?: number;
}

export const TacticalRadar: React.FC<TacticalRadarProps> = ({
  playerX,
  playerZ,
  chassisYaw,
  turretYaw,
  entities,
  radarRange = 160,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sweepAngleRef = useRef(0);

  useEffect(() => {
    let animId: number;
    const isHeadless = typeof navigator !== 'undefined' && (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    const targetInterval = isHeadless ? 1000 / 18 : 0;
    let lastTime = performance.now();

    const render = (time: number) => {
      animId = requestAnimationFrame(render);
      if (isHeadless && time - lastTime < targetInterval) {
        return;
      }
      lastTime = time;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = w * 0.44;

      // Advance radar sweep angle
      sweepAngleRef.current = (sweepAngleRef.current + 0.045) % (Math.PI * 2);
      const sweepAngle = sweepAngleRef.current;

      // Clear with dark phosphor glow
      ctx.fillStyle = '#020b05';
      ctx.fillRect(0, 0, w, h);

      // Outer bezel ring
      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Range rings (3 concentric rings: 50m, 100m, 150m)
      ctx.strokeStyle = '#005522';
      ctx.lineWidth = 1;
      [0.33, 0.66, 1.0].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Crosshairs & Compass ticks
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      // Cardinal direction letters
      ctx.fillStyle = '#00aa44';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', cx, cy - radius + 8);
      ctx.fillText('S', cx, cy + radius - 8);
      ctx.fillText('W', cx - radius + 8, cy);
      ctx.fillText('E', cx + radius - 8, cy);

      // Radar sweep wedge with phosphor gradient
      const gradient = ctx.createConicGradient(sweepAngle, cx, cy);
      gradient.addColorStop(0, 'rgba(0, 255, 100, 0.28)');
      gradient.addColorStop(0.12, 'rgba(0, 255, 100, 0.0)');
      gradient.addColorStop(1, 'rgba(0, 255, 100, 0.0)');

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Sweep leading beam line
      ctx.strokeStyle = '#33ff88';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * radius, cy + Math.sin(sweepAngle) * radius);
      ctx.stroke();

      // Render Detected Entities
      entities.forEach((ent) => {
        if (!ent.alive) return;
        const dx = ent.x - playerX;
        const dz = ent.z - playerZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > radarRange) return;

        const screenDist = (dist / radarRange) * radius;
        // Radar coordinate system: +X is East, -Z is North
        const entAngle = Math.atan2(dz, dx);
        const ex = cx + Math.cos(entAngle) * screenDist;
        const ey = cy + Math.sin(entAngle) * screenDist;

        if (ent.type === 'enemy') {
          // Hostile Regular Tank: Red square
          ctx.strokeStyle = '#ff3344';
          ctx.fillStyle = '#ff1122';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(ex - 3, ey - 3, 6, 6);
          ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3);
        } else if (ent.type === 'scout') {
          // Surprise Fast Enemy: Flashing Cyan diamond
          const blink = Math.sin(Date.now() * 0.015) > 0;
          ctx.strokeStyle = blink ? '#00ffff' : '#ffffff';
          ctx.fillStyle = '#00f5ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ex, ey - 4.5);
          ctx.lineTo(ex + 4.5, ey);
          ctx.lineTo(ex, ey + 4.5);
          ctx.lineTo(ex - 4.5, ey);
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        } else if (ent.type === 'boss') {
          // Boss: Large pulsating gold/crimson hexagon
          const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.25;
          ctx.strokeStyle = '#ffaa00';
          ctx.fillStyle = '#ff0055';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            const bx = ex + Math.cos(a) * 6 * pulse;
            const by = ey + Math.sin(a) * 6 * pulse;
            if (i === 0) ctx.moveTo(bx, by);
            else ctx.lineTo(bx, by);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.fill();
        } else if (ent.type === 'powerup') {
          // Power-up: Yellow star marker
          ctx.fillStyle = '#ffff00';
          ctx.beginPath();
          ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        } else if (ent.type === 'building') {
          // Obstacle building / house: Vector outline square on radar
          ctx.strokeStyle = '#00bb44';
          ctx.lineWidth = 1;
          ctx.strokeRect(ex - 2.5, ey - 2.5, 5, 5);
        }
      });

      // Player center symbol
      // 1. Tank Chassis direction arrow (blue/green)
      const chassisAngle = chassisYaw - Math.PI / 2;
      ctx.strokeStyle = '#00aa55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(chassisAngle) * 5, cy - Math.sin(chassisAngle) * 5);
      ctx.lineTo(cx + Math.cos(chassisAngle) * 9, cy + Math.sin(chassisAngle) * 9);
      ctx.stroke();

      // 2. Turret Gun Aim direction line (bright phosphor green)
      const gunAngle = turretYaw - Math.PI / 2;
      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(gunAngle) * 16, cy + Math.sin(gunAngle) * 16);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [playerX, playerZ, chassisYaw, turretYaw, entities, radarRange]);

  return (
    <div className="relative p-1.5 border border-[#00ff66]/40 bg-black/80 rounded-lg shadow-[0_0_15px_rgba(0,255,102,0.15)] pointer-events-none select-none">
      <div className="text-[10px] text-[#00ff66] font-mono tracking-widest uppercase mb-1 flex items-center justify-between">
        <span>RADAR 360°</span>
        <span className="text-[9px] text-[#00aa44]">{radarRange}M SCAN</span>
      </div>
      <canvas
        ref={canvasRef}
        width={140}
        height={140}
        className="block rounded border border-[#00ff66]/20"
      />
    </div>
  );
};
