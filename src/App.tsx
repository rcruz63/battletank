/**
 * Vector Tank 1980 - Retro Vector Arcade First-Person Tank Game.
 * Complete Game Shell integrating Three.js WebGL simulation with phosphor CRT Cockpit HUD.
 */

import { useEffect, useRef, useState } from 'react';
import { GameManager, TargetedEnemyInfo } from './game/GameManager';
import { CockpitHUD } from './components/CockpitHUD';
import { TitleScreen, PauseModal, VictoryModal, GameOverModal } from './components/GameModals';
import { STAGE_CONFIGS } from './game/rules';
import { sound } from './game/audio';
import { RadarEntity } from './components/TacticalRadar';

type GameState = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<GameManager | null>(null);

  const [gameState, setGameState] = useState<GameState>('title');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('vector_tank_high_score') || '0', 10);
    } catch {
      return 0;
    }
  });
  const [stageNumber, setStageNumber] = useState<number>(1);
  const [playerHp, setPlayerHp] = useState<number>(200);
  const [playerMaxHp, setPlayerMaxHp] = useState<number>(200);
  const [reloadProgress, setReloadProgress] = useState<number>(1);

  const [playerPos, setPlayerPos] = useState({ x: 0, z: 0, chassisYaw: 0, turretYaw: 0, turretPitch: 0 });
  const [radarEntities, setRadarEntities] = useState<RadarEntity[]>([]);
  const [activePowerUps, setActivePowerUps] = useState<Array<{ type: string; remainingTime: number; totalDuration: number }>>([]);
  const [bossState, setBossState] = useState<{ active: boolean; name?: string; hp?: number; maxHp?: number }>({ active: false });
  const [targetedEnemy, setTargetedEnemy] = useState<TargetedEnemyInfo | null>(null);
  const [hitConfirmed, setHitConfirmed] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [controlMode, setControlMode] = useState<'solidary' | 'conic' | 'free'>('solidary');
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [matchSeed, setMatchSeed] = useState<number>(1980);

  // Sync gameState with document.body.dataset.state for ultra-mode compliance
  useEffect(() => {
    const stateStr = gameState === 'victory' ? 'gameover' : gameState;
    document.body.dataset.state = stateStr;
  }, [gameState]);

  // Initialize Three.js engine once
  useEffect(() => {
    if (!mountRef.current) return;

    const manager = new GameManager(mountRef.current, {
      onScoreUpdate: (newScore) => {
        setScore(newScore);
        setHighScore((prev) => {
          if (newScore > prev) {
            try {
              localStorage.setItem('vector_tank_high_score', newScore.toString());
            } catch {}
            return newScore;
          }
          return prev;
        });
      },
      onHpUpdate: (hp, maxHp) => {
        setPlayerHp(hp);
        setPlayerMaxHp(maxHp);
      },
      onReloadUpdate: (prog) => {
        setReloadProgress(prog);
      },
      onStateUpdate: (px, pz, cy, ty, tp) => {
        setPlayerPos({ x: px, z: pz, chassisYaw: cy, turretYaw: ty, turretPitch: tp });
      },
      onRadarUpdate: (ents) => {
        setRadarEntities(ents);
      },
      onActivePowerUpsUpdate: (pus) => {
        setActivePowerUps(pus);
      },
      onBossUpdate: (active, name, hp, maxHp) => {
        setBossState({ active, name, hp, maxHp });
      },
      onTargetedEnemyUpdate: (t) => {
        setTargetedEnemy(t);
      },
      onHitConfirmed: () => {
        setHitConfirmed(true);
        setTimeout(() => setHitConfirmed(false), 260);
      },
      onVictory: (_stgNum, isLastStage) => {
        setGameState(isLastStage ? 'victory' : 'victory');
      },
      onGameOver: () => {
        sound.stopAll();
        setGameState('gameover');
      },
      onControlModeUpdate: (m) => {
        setControlMode(m);
      },
      onRepairStatusUpdate: (rep) => {
        setIsRepairing(rep);
      },
      onSeedUpdate: (seed) => {
        setMatchSeed(seed);
      },
    });

    managerRef.current = manager;
    manager.startLoop();

    // Check pointer lock updates
    const onPLChange = () => {
      setIsPointerLocked(document.pointerLockElement === mountRef.current);
    };
    document.addEventListener('pointerlockchange', onPLChange);

    // Support ?autostart=1 query param
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startGame(1);
    }

    return () => {
      document.removeEventListener('pointerlockchange', onPLChange);
      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  // Keyboard shortcut listener for Title start, Pause toggle (Escape/P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame(1);
        }
      } else if (gameState === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          pauseGame();
        }
      } else if (gameState === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter') {
          e.preventDefault();
          resumeGame();
        }
      } else if (gameState === 'victory') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          const nextStg = stageNumber + 1;
          if (nextStg <= STAGE_CONFIGS.length) {
            startGame(nextStg);
          } else {
            startGame(1);
          }
        }
      } else if (gameState === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startGame(stageNumber);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, stageNumber]);

  const startGame = (stg = 1) => {
    setStageNumber(stg);
    setGameState('playing');
    if (managerRef.current) {
      managerRef.current.startStage(stg - 1);
      managerRef.current.requestPointerLock();
    }
  };

  const pauseGame = () => {
    setGameState('paused');
    if (managerRef.current) {
      managerRef.current.pause();
    }
  };

  const resumeGame = () => {
    setGameState('playing');
    if (managerRef.current) {
      managerRef.current.resume();
    }
  };

  const toggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const currentStageDef = STAGE_CONFIGS[stageNumber - 1] || STAGE_CONFIGS[0];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 3D WebGL Canvas Mount Container */}
      <div
        ref={mountRef}
        data-testid="webgl-canvas-mount"
        className="absolute inset-0 z-0 cursor-crosshair"
      />

      {/* Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          onStart={() => startGame(1)}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          highScore={highScore}
        />
      )}

      {/* First-Person Tank Cockpit HUD (Active while playing or paused) */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <CockpitHUD
          score={score}
          stageNumber={stageNumber}
          stageName={currentStageDef.name}
          playerHp={playerHp}
          playerMaxHp={playerMaxHp}
          reloadProgress={reloadProgress}
          playerX={playerPos.x}
          playerZ={playerPos.z}
          chassisYaw={playerPos.chassisYaw}
          turretYaw={playerPos.turretYaw}
          turretPitch={playerPos.turretPitch}
          radarEntities={radarEntities}
          activePowerUps={activePowerUps}
          bossActive={bossState.active}
          bossName={bossState.name}
          bossHp={bossState.hp}
          bossMaxHp={bossState.maxHp}
          targetedEnemy={targetedEnemy}
          hitConfirmed={hitConfirmed}
          isMuted={isMuted}
          isPointerLocked={isPointerLocked}
          controlMode={controlMode}
          isRepairing={isRepairing}
          matchSeed={matchSeed}
          onToggleMute={toggleMute}
          onPause={pauseGame}
          onRequestPointerLock={() => managerRef.current?.requestPointerLock()}
          onToggleControlMode={() => managerRef.current?.toggleControlMode()}
          onRecenterTurret={() => managerRef.current?.recenterTurret()}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          onResume={resumeGame}
          onRestart={() => startGame(stageNumber)}
          onNewMapSeed={() => {
            managerRef.current?.generateNewMapSeed();
            resumeGame();
          }}
          matchSeed={matchSeed}
          stageNumber={stageNumber}
          score={score}
        />
      )}

      {/* Victory / Stage Complete Modal */}
      {gameState === 'victory' && (
        <VictoryModal
          score={score}
          stageNumber={stageNumber}
          isLastStage={stageNumber >= STAGE_CONFIGS.length}
          onNextStage={() => startGame(stageNumber + 1)}
          onRestart={() => startGame(1)}
        />
      )}

      {/* Game Over Modal */}
      {gameState === 'gameover' && (
        <GameOverModal
          score={score}
          stageNumber={stageNumber}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onRestart={() => startGame(stageNumber)}
        />
      )}
    </div>
  );
}
