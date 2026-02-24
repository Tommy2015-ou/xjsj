/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, AlertTriangle, RefreshCw, Languages, Settings2, Activity, Zap } from 'lucide-react';
import { GameMode, Point, Missile, Enemy, Explosion, Battery, City, GameState } from './types';
import { GAME_WIDTH, GAME_HEIGHT, MODE_CONFIGS, COLORS, WIN_SCORE } from './constants';
import { sounds } from './services/sounds';

const INITIAL_BATTERIES: Battery[] = [
  { id: 'b1', pos: { x: 100, y: 560 }, missiles: 20, maxMissiles: 20, destroyed: false },
  { id: 'b2', pos: { x: 400, y: 560 }, missiles: 40, maxMissiles: 40, destroyed: false },
  { id: 'b3', pos: { x: 700, y: 560 }, missiles: 20, maxMissiles: 20, destroyed: false },
];

const INITIAL_CITIES: City[] = [
  { id: 'c1', pos: { x: 200, y: 570 }, destroyed: false },
  { id: 'c2', pos: { x: 300, y: 570 }, destroyed: false },
  { id: 'c3', pos: { x: 500, y: 570 }, destroyed: false },
  { id: 'c4', pos: { x: 600, y: 570 }, destroyed: false },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    level: 1,
    mode: GameMode.NORMAL,
    status: 'START',
  });

  const [batteries, setBatteries] = useState<Battery[]>(INITIAL_BATTERIES);
  const [cities, setCities] = useState<City[]>(INITIAL_CITIES);
  
  // Refs for game loop to avoid re-renders
  const missilesRef = useRef<Missile[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);

  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const startGame = (mode: GameMode) => {
    setGameState({ score: 0, level: 1, mode, status: 'PLAYING' });
    scoreRef.current = 0;
    lastTimeRef.current = 0;
    setBatteries(INITIAL_BATTERIES.map(b => ({ ...b, missiles: b.maxMissiles, destroyed: false })));
    setCities(INITIAL_CITIES.map(c => ({ ...c, destroyed: false })));
    missilesRef.current = [];
    enemiesRef.current = [];
    explosionsRef.current = [];
    spawnTimerRef.current = 0;
  };

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState.status !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const targetX = (clientX - rect.left) * scaleX;
    const targetY = (clientY - rect.top) * scaleY;

    // Find closest active battery with missiles
    let bestBattery: Battery | null = null;
    let minDist = Infinity;

    batteries.forEach(b => {
      if (!b.destroyed && b.missiles > 0) {
        const dist = Math.abs(b.pos.x - targetX);
        if (dist < minDist) {
          minDist = dist;
          bestBattery = b;
        }
      }
    });

    if (bestBattery) {
      const b = bestBattery as Battery;
      setBatteries(prev => prev.map(pb => pb.id === b.id ? { ...pb, missiles: pb.missiles - 1 } : pb));
      
      sounds.playLaunch();
      const config = MODE_CONFIGS[gameState.mode];
      missilesRef.current.push({
        id: Math.random().toString(36),
        pos: { ...b.pos },
        startPos: { ...b.pos },
        target: { x: targetX, y: targetY },
        speed: 5 * config.speedMult,
        radius: 2,
        color: COLORS.PLAYER_MISSILE,
        active: true,
      });
    }
  };

  const update = useCallback((time: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = time;
    }
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Always draw to keep animations (like fire) smooth
    draw();

    if (gameState.status !== 'PLAYING') {
      return;
    }

    const config = MODE_CONFIGS[gameState.mode];
    const speedScale = deltaTime / 16.67; // Normalize to 60fps

    // Spawn enemies
    spawnTimerRef.current += deltaTime;
    const spawnInterval = Math.max(500, 2000 - (scoreRef.current / 100) * 100);
    if (spawnTimerRef.current > spawnInterval) {
      spawnTimerRef.current = 0;
      const targetOptions = [...cities.filter(c => !c.destroyed), ...batteries.filter(b => !b.destroyed)];
      if (targetOptions.length > 0) {
        const target = targetOptions[Math.floor(Math.random() * targetOptions.length)].pos;
        enemiesRef.current.push({
          id: Math.random().toString(36),
          pos: { x: Math.random() * GAME_WIDTH, y: -20 },
          startPos: { x: Math.random() * GAME_WIDTH, y: -20 },
          target: { ...target },
          speed: (0.8 + Math.random() * 0.6) * config.speedMult,
          radius: 2,
          color: COLORS.ENEMY_MISSILE,
          active: true,
        });
      }
    }

    // Update Player Missiles
    missilesRef.current.forEach(m => {
      if (!m.active) return;
      const dx = m.target!.x - m.pos.x;
      const dy = m.target!.y - m.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveDist = m.speed * speedScale;

      if (dist <= moveDist || dist === 0) {
        m.active = false;
        sounds.playExplosion();
        explosionsRef.current.push({
          id: Math.random().toString(36),
          pos: { ...m.target! },
          speed: 0,
          radius: 2,
          maxRadius: 96 * config.powerMult,
          growthRate: 3.0 * speedScale,
          isShrinking: false,
          color: COLORS.EXPLOSION,
          active: true,
        });
      } else {
        m.pos.x += (dx / dist) * moveDist;
        m.pos.y += (dy / dist) * moveDist;
      }
    });

    // Update Enemies
    enemiesRef.current.forEach(e => {
      if (!e.active) return;
      const dx = e.target!.x - e.pos.x;
      const dy = e.target!.y - e.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveDist = e.speed * speedScale;

      if (dist <= moveDist || dist === 0) {
        e.active = false;
        sounds.playImpact();
        // Impact!
        setCities(prev => prev.map(c => {
          if (Math.abs(c.pos.x - e.pos.x) < 25 && Math.abs(c.pos.y - e.pos.y) < 25) {
            return { ...c, destroyed: true };
          }
          return c;
        }));
        setBatteries(prev => prev.map(b => {
          if (Math.abs(b.pos.x - e.pos.x) < 35 && Math.abs(b.pos.y - e.pos.y) < 35) {
            return { ...b, destroyed: true };
          }
          return b;
        }));
        explosionsRef.current.push({
          id: Math.random().toString(36),
          pos: { ...e.pos },
          speed: 0,
          radius: 2,
          maxRadius: 36,
          growthRate: 2.4 * speedScale,
          isShrinking: false,
          color: COLORS.ENEMY_MISSILE,
          active: true,
        });
      } else {
        e.pos.x += (dx / dist) * moveDist;
        e.pos.y += (dy / dist) * moveDist;
      }

      // Check collision with player explosions
      explosionsRef.current.forEach(exp => {
        if (exp.color === COLORS.EXPLOSION && exp.active) {
          const edx = e.pos.x - exp.pos.x;
          const edy = e.pos.y - exp.pos.y;
          const edist = Math.sqrt(edx * edx + edy * edy);
          if (edist < exp.radius + 10) { // Increased hit box for better feel
            e.active = false;
            scoreRef.current += 20;
            setGameState(prev => ({ ...prev, score: scoreRef.current }));
          }
        }
      });
    });

    // Update Explosions
    explosionsRef.current.forEach(exp => {
      if (!exp.active) return;
      if (!exp.isShrinking) {
        exp.radius += exp.growthRate;
        if (exp.radius >= exp.maxRadius) {
          exp.isShrinking = true;
        }
      } else {
        exp.radius -= exp.growthRate * 0.5;
        if (exp.radius <= 0) {
          exp.active = false;
        }
      }
    });

    // Cleanup
    missilesRef.current = missilesRef.current.filter(m => m.active);
    enemiesRef.current = enemiesRef.current.filter(e => e.active);
    explosionsRef.current = explosionsRef.current.filter(exp => exp.active);

    // Check Game Over / Win
    // Only check if we have cities or batteries left to avoid immediate game over on restart
    const activeCities = cities.filter(c => !c.destroyed).length;
    const activeBatteries = batteries.filter(b => !b.destroyed).length;

    if (scoreRef.current >= WIN_SCORE) {
      sounds.playWin();
      setGameState(prev => ({ ...prev, status: 'WON' }));
    } else if (activeBatteries === 0 && enemiesRef.current.length === 0 && explosionsRef.current.length === 0) {
      // Small delay or check to ensure we don't snap to lost immediately
      sounds.playLose();
      setGameState(prev => ({ ...prev, status: 'LOST' }));
    }
  }, [gameState.status, gameState.mode, WIN_SCORE, cities, batteries]); // Removed score from dependencies to avoid loop recreation every hit

  const drawFire = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const time = Date.now() * 0.01;
    for (let i = 0; i < 5; i++) {
      const size = 5 + Math.sin(time + i) * 3;
      const offsetX = Math.sin(time * 0.5 + i) * 5;
      const offsetY = -Math.abs(Math.cos(time * 0.3 + i)) * 15;
      
      ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#ef4444';
      ctx.beginPath();
      ctx.arc(x + offsetX, y + offsetY, size, 0, Math.PI * 2);
      ctx.fill();
    }
    // Smoke
    ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
    ctx.beginPath();
    ctx.arc(x, y - 25, 10 + Math.sin(time) * 5, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawMissile = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, isPlayer: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    
    const scale = 3.0; // Increased scale to better reflect the "10x larger" request
    
    // Body
    ctx.fillStyle = isPlayer ? '#94a3b8' : '#7f1d1d';
    ctx.fillRect(-4 * scale, -10 * scale, 8 * scale, 20 * scale);
    
    // Nose
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-4 * scale, -10 * scale);
    ctx.lineTo(4 * scale, -10 * scale);
    ctx.lineTo(0, -18 * scale);
    ctx.closePath();
    ctx.fill();
    
    // Fins
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-4 * scale, 5 * scale);
    ctx.lineTo(-8 * scale, 10 * scale);
    ctx.lineTo(-4 * scale, 10 * scale);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(4 * scale, 5 * scale);
    ctx.lineTo(8 * scale, 10 * scale);
    ctx.lineTo(4 * scale, 10 * scale);
    ctx.closePath();
    ctx.fill();

    // Engine Flame
    const flicker = Math.random() * 5;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(-3 * scale, 10 * scale);
    ctx.lineTo(3 * scale, 10 * scale);
    ctx.lineTo(0, (15 + flicker) * scale);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Ground
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 550, GAME_WIDTH, 50);

    // Draw Cities
    cities.forEach(c => {
      if (!c.destroyed) {
        ctx.fillStyle = COLORS.CITY;
        ctx.fillRect(c.pos.x - 15, c.pos.y - 10, 30, 10);
        ctx.fillRect(c.pos.x - 10, c.pos.y - 20, 20, 10);
      } else {
        ctx.fillStyle = '#333';
        ctx.fillRect(c.pos.x - 15, c.pos.y - 5, 30, 5);
        drawFire(ctx, c.pos.x, c.pos.y);
      }
    });

    // Draw Batteries
    batteries.forEach(b => {
      if (!b.destroyed) {
        ctx.fillStyle = COLORS.BATTERY;
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, 20, Math.PI, 0);
        ctx.fill();
        // Barrel
        ctx.fillRect(b.pos.x - 5, b.pos.y - 30, 10, 15);
      } else {
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, 15, Math.PI, 0);
        ctx.fill();
        drawFire(ctx, b.pos.x, b.pos.y);
      }
    });

    // Draw Player Missiles
    missilesRef.current.forEach(m => {
      const dx = m.target!.x - m.pos.x;
      const dy = m.target!.y - m.pos.y;
      const angle = Math.atan2(dy, dx);
      
      drawMissile(ctx, m.pos.x, m.pos.y, angle, m.color, true);
      
      // Target X
      ctx.strokeStyle = COLORS.X_MARK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.target!.x - 3, m.target!.y - 3);
      ctx.lineTo(m.target!.x + 3, m.target!.y + 3);
      ctx.moveTo(m.target!.x + 3, m.target!.y - 3);
      ctx.lineTo(m.target!.x - 3, m.target!.y + 3);
      ctx.stroke();
    });

    // Draw Enemies
    enemiesRef.current.forEach(e => {
      const dx = e.target!.x - e.pos.x;
      const dy = e.target!.y - e.pos.y;
      const angle = Math.atan2(dy, dx);
      
      drawMissile(ctx, e.pos.x, e.pos.y, angle, e.color, false);
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      ctx.fillStyle = exp.color;
      ctx.beginPath();
      ctx.arc(exp.pos.x, exp.pos.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  useEffect(() => {
    let animId: number;
    const loop = (time: number) => {
      update(time);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [update]);

  return (
    <div ref={containerRef} className="relative w-full h-screen flex bg-black overflow-hidden font-sans">
      {/* Left Sidebar (Black Background) */}
      <div className="w-64 h-full bg-black border-r border-zinc-800 flex flex-col p-6 z-20 shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-lg font-display font-bold text-white leading-tight">
            {t('Tommy新星射击', 'Tommy Nova Shooting')}
          </h1>
        </div>

        <div className="space-y-8 flex-1">
          <div className="space-y-2">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-3 h-3" />
              {t('系统状态', 'System Status')}
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="text-[10px] font-mono text-emerald-500 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t('防御系统在线', 'Defense Online')}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Target className="w-3 h-3" />
              {t('作战数据', 'Combat Data')}
            </div>
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-4">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase">{t('当前得分', 'Current Score')}</div>
                <div className="text-2xl font-display font-bold text-blue-400">{gameState.score}</div>
              </div>
              <div className="h-px bg-zinc-800" />
              <div>
                <div className="text-[10px] text-zinc-500 uppercase">{t('难度级别', 'Difficulty')}</div>
                <div className="text-sm font-mono text-zinc-300">{MODE_CONFIGS[gameState.mode].label[lang]}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-3 h-3" />
              {t('控制', 'Controls')}
            </div>
            <button 
              onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
              className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 hover:text-white hover:border-zinc-600 transition-all flex items-center justify-between"
            >
              <span>{t('语言', 'Language')}</span>
              <span className="text-blue-400">{lang.toUpperCase()}</span>
            </button>
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-800/50">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{t('图例', 'Legend')}</div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span className="text-[10px] font-mono uppercase text-zinc-400">{t('城市', 'City')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                <span className="text-[10px] font-mono uppercase text-zinc-400">{t('炮台', 'Battery')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
                <span className="text-[10px] font-mono uppercase text-zinc-400">{t('威胁', 'Threat')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-800">
          <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest leading-relaxed">
            {t('新星防御系统 v1.0.5', 'Nova Defense v1.0.5')}
            <br />
            {t('目标: ', 'Target: ')} {WIN_SCORE}
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-8">
        {/* Background Effect */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,transparent_100%)]" />
        </div>

        {/* Game Area Container */}
        <div className="relative flex flex-col items-center gap-8">
          <div className="relative group">
            {/* Decorative Corners */}
            <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-blue-500/40" />
            <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-blue-500/40" />
            <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-blue-500/40" />
            <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-blue-500/40" />

            <div className="relative aspect-[4/3] w-[70vw] max-w-[800px] bg-black shadow-[0_0_100px_-20px_rgba(59,130,246,0.2)] border border-zinc-800 rounded-sm overflow-hidden">
              <canvas
                ref={canvasRef}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
                onMouseDown={handleCanvasClick}
                onTouchStart={handleCanvasClick}
                className="w-full h-full cursor-crosshair game-canvas"
              />
              
              {/* CRT Scanline Effect */}
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_2px,3px_100%] z-10" />

            {/* Overlays */}
            <AnimatePresence>
              {gameState.status === 'START' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between py-16 px-8 z-20"
                >
                  <motion.div
                    initial={{ y: -40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-center"
                  >
                    <div className="inline-block p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 mb-6">
                      <Shield className="w-16 h-16 text-blue-400" />
                    </div>
                    <h2 className="text-7xl font-display font-bold text-white mb-4 tracking-tighter uppercase">
                      {t('Tommy新星射击', 'Tommy Nova Shooting')}
                    </h2>
                    <p className="text-zinc-400 text-lg font-mono tracking-widest uppercase">
                      {t('// 城市防御协议已启动 //', '// CITY DEFENSE PROTOCOL ACTIVE //')}
                    </p>
                  </motion.div>

                  <motion.div 
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full max-w-4xl"
                  >
                    <div className="text-center mb-6">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.4em]">
                        {t('选择作战模式', 'Select Combat Mode')}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      {(Object.keys(MODE_CONFIGS) as GameMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => startGame(mode)}
                          className="group relative flex flex-col items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-blue-500 hover:bg-blue-500/10 transition-all"
                        >
                          <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                            {MODE_CONFIGS[mode].label[lang]}
                          </span>
                          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-zinc-700 group-hover:bg-blue-500 transition-colors" 
                              style={{ width: `${(MODE_CONFIGS[mode].speedMult / 2.6) * 100}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-zinc-500 uppercase">
                            x{MODE_CONFIGS[mode].speedMult.toFixed(1)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {gameState.status === 'WON' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-blue-900/40 backdrop-blur-md flex flex-col items-center justify-center p-8 z-20"
                >
                  <Trophy className="w-20 h-20 text-yellow-400 mb-4" />
                  <h2 className="text-5xl font-display font-bold text-white mb-2">{t('任务成功!', 'Mission Success!')}</h2>
                  <p className="text-blue-100 mb-8 text-lg">{t('你成功保卫了新星城。', 'You successfully defended Nova City.')}</p>
                  <button
                    onClick={() => setGameState(prev => ({ ...prev, status: 'START' }))}
                    className="px-8 py-4 rounded-full bg-white text-blue-900 font-bold text-xl hover:scale-105 transition-transform flex items-center gap-2"
                  >
                    <RefreshCw className="w-6 h-6" />
                    {t('再玩一次', 'Play Again')}
                  </button>
                </motion.div>
              )}

              {gameState.status === 'LOST' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-red-900/60 backdrop-blur-md flex flex-col items-center justify-center p-8 z-30"
                >
                  <AlertTriangle className="w-20 h-20 text-red-500 mb-4" />
                  <h2 className="text-5xl font-display font-bold text-white mb-2">{t('防线崩溃', 'Defense Collapsed')}</h2>
                  <p className="text-red-100 mb-8 text-lg">{t('所有炮台已被摧毁。', 'All batteries have been destroyed.')}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setGameState(prev => ({ ...prev, status: 'START' }));
                      setBatteries(INITIAL_BATTERIES);
                      setCities(INITIAL_CITIES);
                    }}
                    className="px-8 py-4 rounded-full bg-red-600 text-white font-bold text-xl hover:bg-red-500 transition-colors flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
                  >
                    <RefreshCw className="w-6 h-6" />
                    {t('重试', 'Retry')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Missile Control Panel (Instrument Style) */}
        <div className="w-full max-w-[800px] grid grid-cols-3 gap-4 px-4">
          {batteries.map((b, i) => (
            <div key={b.id} className={`relative p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50 flex flex-col gap-2 transition-all ${b.destroyed ? 'grayscale opacity-40' : 'hover:border-blue-500/30'}`}>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-tighter">Unit 0{i + 1}</span>
                {b.destroyed ? (
                  <span className="text-[9px] font-mono text-red-500 uppercase tracking-tighter">Offline</span>
                ) : (
                  <div className="flex gap-0.5">
                    {[...Array(3)].map((_, idx) => (
                      <div key={idx} className="w-1 h-1 rounded-full bg-blue-500/40" />
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex items-end justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-mono text-zinc-400 leading-none">{t('弹药', 'Ammo')}</span>
                  <span className={`text-2xl font-display font-bold leading-none mt-1 ${b.missiles < 5 && !b.destroyed ? 'text-red-500 animate-pulse' : 'text-zinc-100'}`}>
                    {b.missiles.toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="flex-1 ml-4 mb-1">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      initial={false}
                      animate={{ width: `${(b.missiles / b.maxMissiles) * 100}%` }}
                      className={`h-full ${b.missiles < 5 ? 'bg-red-500' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
}
