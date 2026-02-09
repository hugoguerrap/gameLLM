import { ResourceMap } from './resources.js';
import { Era } from './buildings.js';

export enum UnitType {
  Soldier = 'soldier',
  Archer = 'archer',
  Cavalry = 'cavalry',
  Lancer = 'lancer',
  Catapult = 'catapult',
  Spy = 'spy',
  Mage = 'mage',
}

export enum CombatStrategy {
  Aggressive = 'aggressive',
  Defensive = 'defensive',
  Balanced = 'balanced',
  Guerrilla = 'guerrilla',
}

export interface UnitDefinition {
  type: UnitType;
  name: string;
  attack: number;
  defense: number;
  health: number;
  speed: number;
  foodPerTick: number;
  trainingCost: Partial<ResourceMap>;
  trainingTicks: number;
  era: Era;
  strongAgainst?: UnitType;
  weakAgainst?: UnitType;
}

export interface ArmyState {
  units: Record<UnitType, number>;
  strategy: CombatStrategy;
}
