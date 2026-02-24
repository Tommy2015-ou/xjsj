import { GameMode } from './types';

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const MODE_CONFIGS = {
  [GameMode.LOW]: { speedMult: 1.0, powerMult: 1.0, label: { zh: '低', en: 'Low' } },
  [GameMode.NORMAL]: { speedMult: 1.4, powerMult: 1.1, label: { zh: '正常', en: 'Normal' } },
  [GameMode.HIGH]: { speedMult: 1.8, powerMult: 1.2, label: { zh: '偏高', en: 'High' } },
  [GameMode.ULTRA]: { speedMult: 2.2, powerMult: 1.3, label: { zh: '超高', en: 'Ultra' } },
  [GameMode.FUTURE]: { speedMult: 2.6, powerMult: 1.4, label: { zh: '未来星', en: 'Future Star' } },
};

export const COLORS = {
  PLAYER_MISSILE: '#00ffcc',
  ENEMY_MISSILE: '#ff4444',
  EXPLOSION: 'rgba(255, 255, 255, 0.8)',
  CITY: '#4ade80',
  BATTERY: '#60a5fa',
  X_MARK: '#ffffff',
};

export const WIN_SCORE = 1000;
