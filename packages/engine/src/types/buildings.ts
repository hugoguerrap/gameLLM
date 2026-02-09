import { ResourceMap } from './resources.js';

export enum Era {
  Aldea = 1,
  Pueblo = 2,
  Ciudad = 3,
  Metropolis = 4,
}

export enum BuildingId {
  // Era 1
  Choza = 'choza',
  Granja = 'granja',
  Aserradero = 'aserradero',
  Mina = 'mina',
  Almacen = 'almacen',
  Muralla = 'muralla',
  Mercado = 'mercado',
  // Era 2
  Herreria = 'herreria',
  Cuartel = 'cuartel',
  Torre = 'torre',
  Puerto = 'puerto',
  Biblioteca = 'biblioteca',
  Templo = 'templo',
  // Era 3
  Universidad = 'universidad',
  Fortaleza = 'fortaleza',
  Banco = 'banco',
  Gremio = 'gremio',
  Arena = 'arena',
  Observatorio = 'observatorio',
  // Era 4
  Maravilla = 'maravilla',
  Portal = 'portal',
  Oraculo = 'oraculo',
  ForjaAncestral = 'forja_ancestral',
}

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  description: string;
  era: Era;
  baseCost: Partial<ResourceMap>;
  costMultiplier: number; // default 1.15
  maxLevel: number;
  constructionTicks: number;
  production?: Partial<ResourceMap>; // base production per tick at level 1
  storageBonus?: number;
  populationCapacity?: number;
  defenseBonus?: number;
  happinessBonus?: number;
  techRequired?: string;
}

export interface BuildingState {
  id: BuildingId;
  level: number;
  constructionTicksRemaining: number;
}
