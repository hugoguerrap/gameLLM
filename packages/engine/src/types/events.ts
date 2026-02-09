export enum GameEventType {
  VolcanicEruption = 'volcanic_eruption',
  BanditHorde = 'bandit_horde',
  ManaSurge = 'mana_surge',
  Famine = 'famine',
  Festival = 'festival',
  WanderingTrader = 'wandering_trader',
  ResourceDiscovery = 'resource_discovery',
  Plague = 'plague',
}

export interface GameEvent {
  id: string;
  type: GameEventType;
  tick: number;
  description: string;
  effects: EventEffect[];
  durationTicks: number;
}

export interface EventEffect {
  type: 'resource_change' | 'production_modifier' | 'population_change' | 'defense_modifier';
  resource?: string;
  value: number;
}

export interface EventDefinition {
  type: GameEventType;
  name: string;
  description: string;
  probability: number; // 0-1 chance per check
  effects: EventEffect[];
  durationTicks: number;
  minEra?: number;
}
