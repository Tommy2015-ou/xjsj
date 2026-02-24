export enum GameMode {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  ULTRA = 'ULTRA',
  FUTURE = 'FUTURE'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Point;
  target?: Point;
  speed: number;
  radius: number;
  color: string;
  active: boolean;
}

export interface Missile extends Entity {
  startPos: Point;
}

export interface Enemy extends Entity {
  startPos: Point;
}

export interface Explosion extends Entity {
  maxRadius: number;
  growthRate: number;
  isShrinking: boolean;
}

export interface Battery {
  id: string;
  pos: Point;
  missiles: number;
  maxMissiles: number;
  destroyed: boolean;
}

export interface City {
  id: string;
  pos: Point;
  destroyed: boolean;
}

export interface GameState {
  score: number;
  level: number;
  mode: GameMode;
  status: 'START' | 'PLAYING' | 'WON' | 'LOST';
}
