export interface BetAmount {
  value: number;
}

export interface MultiplierHistoryItem {
  value: number;
  color: 'blue' | 'purple' | 'pink' | 'teal';
}

export enum GameStatus {
  WAITING = 'WAITING',
  FLYING = 'FLYING',
  CRASHED = 'CRASHED',
}

export interface PlayerBet {
  id: number;
  name: string;
  avatar: string;
  betAmount: number;
  targetMultiplier: number; // The multiplier at which this bot will cash out
  status: 'betting' | 'cashed';
}

export interface UserBetHistoryItem {
  id: number;
  time: string;
  betAmount: number;
  multiplier: number;
  winAmount: number;
  result: 'win' | 'loss';
}