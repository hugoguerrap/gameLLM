import { ResourceMap, ResourceType, createResourceMap } from './resources.js';
import { BiomeType } from './biomes.js';
import { Era, BuildingState } from './buildings.js';
import { ArmyState, UnitType, CombatStrategy } from './units.js';
import { PrestigeState } from './prestige.js';
import type { AllianceInfo, DiplomacyRelation, SpyReport } from './diplomacy.js';
import type { TradeOffer } from './economy.js';

export interface PopulationState {
  current: number;
  max: number;
  happiness: number;
}

export interface ResearchState {
  completed: string[];
  current: string | null;
  progress: number;
}

export interface ActiveEffect {
  id: string;
  type: 'production_boost' | 'defense_boost' | 'research_boost' | 'disaster';
  modifier: number;
  ticksRemaining: number;
}

export interface PlayerState {
  id: string;
  name: string;
  biome: BiomeType;
  era: Era;
  tick: number;

  resources: ResourceMap;
  resourceStorage: ResourceMap;

  buildings: BuildingState[];
  buildQueue: BuildingState[];

  population: PopulationState;
  army: ArmyState;

  research: ResearchState;

  prestige: PrestigeState;

  tokens: number;

  exploredZones: string[];
  claimedZones: string[];

  activeEffects: ActiveEffect[];

  alliance: AllianceInfo | null;
  diplomacy: DiplomacyRelation[];
  spyReports: SpyReport[];
  lastSpyTick: number;

  tradeOffers: TradeOffer[];

  lastAttackTicks: Record<string, number>;

  lastTickProcessed: number;
  createdAt: number;
}

export function createInitialPlayerState(id: string, name: string, biome: BiomeType): PlayerState {
  return {
    id,
    name,
    biome,
    era: Era.Aldea,
    tick: 0,
    resources: createResourceMap({
      [ResourceType.Wood]: 100,
      [ResourceType.Food]: 100,
      [ResourceType.Stone]: 50,
      [ResourceType.Iron]: 20,
      [ResourceType.Gems]: 5,
      [ResourceType.Mana]: 0,
    }),
    resourceStorage: createResourceMap({
      [ResourceType.Wood]: 500,
      [ResourceType.Food]: 500,
      [ResourceType.Stone]: 300,
      [ResourceType.Iron]: 200,
      [ResourceType.Gems]: 100,
      [ResourceType.Mana]: 50,
    }),
    buildings: [],
    buildQueue: [],
    population: { current: 10, max: 20, happiness: 50 },
    army: {
      units: {
        [UnitType.Soldier]: 0,
        [UnitType.Archer]: 0,
        [UnitType.Cavalry]: 0,
        [UnitType.Lancer]: 0,
        [UnitType.Catapult]: 0,
        [UnitType.Spy]: 0,
        [UnitType.Mage]: 0,
      },
      strategy: CombatStrategy.Balanced,
    },
    research: { completed: [], current: null, progress: 0 },
    prestige: { level: 0, totalTokensEarned: 0, legacyMultiplier: 1.0, bonuses: [] },
    tokens: 100,
    exploredZones: [],
    claimedZones: [],
    activeEffects: [],
    alliance: null,
    diplomacy: [],
    spyReports: [],
    lastSpyTick: 0,
    tradeOffers: [],
    lastAttackTicks: {},
    lastTickProcessed: 0,
    createdAt: Date.now(),
  };
}
