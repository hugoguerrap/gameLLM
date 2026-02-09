import { Era } from './buildings.js';

export interface TechDefinition {
  id: string;
  name: string;
  description: string;
  era: Era;
  researchTicks: number;
  cost: { gems?: number; mana?: number };
  prerequisites: string[];
  unlocks: string[]; // what this tech unlocks (building IDs, unit types, etc)
}
