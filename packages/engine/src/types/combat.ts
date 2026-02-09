import { UnitType, CombatStrategy } from './units.js';

export interface BattleReport {
  attackerId: string;
  defenderId: string;
  attackerStrategy: CombatStrategy;
  defenderStrategy: CombatStrategy;
  rounds: BattleRound[];
  winner: 'attacker' | 'defender' | 'draw';
  attackerLosses: Partial<Record<UnitType, number>>;
  defenderLosses: Partial<Record<UnitType, number>>;
  loot: { tokens: number };
}

export interface BattleRound {
  roundNumber: number;
  attackerDamageDealt: number;
  defenderDamageDealt: number;
  attackerUnitsLost: number;
  defenderUnitsLost: number;
}
