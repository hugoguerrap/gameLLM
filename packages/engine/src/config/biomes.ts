import { BiomeType, BiomeDefinition } from '../types/biomes.js';
import { ResourceType } from '../types/resources.js';

export const BIOME_DEFINITIONS: Record<BiomeType, BiomeDefinition> = {
  [BiomeType.Forest]: {
    type: BiomeType.Forest,
    name: 'Bosque',
    description: 'Dense woodland rich in timber and wildlife. Excellent for wood and food gathering.',
    resourceModifiers: {
      [ResourceType.Wood]: 1.5,
      [ResourceType.Food]: 1.3,
      [ResourceType.Stone]: 0.8,
      [ResourceType.Iron]: 0.7,
      [ResourceType.Gems]: 0.6,
      [ResourceType.Mana]: 1.0,
    },
  },
  [BiomeType.Mountain]: {
    type: BiomeType.Mountain,
    name: 'Montana',
    description: 'Rugged peaks with abundant mineral deposits. Ideal for mining stone and iron.',
    resourceModifiers: {
      [ResourceType.Wood]: 0.5,
      [ResourceType.Food]: 0.6,
      [ResourceType.Stone]: 1.5,
      [ResourceType.Iron]: 1.5,
      [ResourceType.Gems]: 1.2,
      [ResourceType.Mana]: 0.8,
    },
  },
  [BiomeType.Prairie]: {
    type: BiomeType.Prairie,
    name: 'Pradera',
    description: 'Vast open grasslands perfect for farming and raising livestock.',
    resourceModifiers: {
      [ResourceType.Wood]: 0.8,
      [ResourceType.Food]: 1.6,
      [ResourceType.Stone]: 0.9,
      [ResourceType.Iron]: 0.8,
      [ResourceType.Gems]: 0.7,
      [ResourceType.Mana]: 0.9,
    },
  },
  [BiomeType.Desert]: {
    type: BiomeType.Desert,
    name: 'Desierto',
    description: 'Arid wasteland hiding precious gems beneath the sands. Harsh but rewarding.',
    resourceModifiers: {
      [ResourceType.Wood]: 0.3,
      [ResourceType.Food]: 0.4,
      [ResourceType.Stone]: 1.2,
      [ResourceType.Iron]: 1.0,
      [ResourceType.Gems]: 1.8,
      [ResourceType.Mana]: 1.1,
    },
  },
  [BiomeType.Coast]: {
    type: BiomeType.Coast,
    name: 'Costa',
    description: 'Fertile shoreline with access to maritime trade and abundant seafood.',
    resourceModifiers: {
      [ResourceType.Wood]: 0.9,
      [ResourceType.Food]: 1.4,
      [ResourceType.Stone]: 0.7,
      [ResourceType.Iron]: 0.6,
      [ResourceType.Gems]: 1.1,
      [ResourceType.Mana]: 1.0,
    },
  },
  [BiomeType.Volcanic]: {
    type: BiomeType.Volcanic,
    name: 'Volcanico',
    description: 'Dangerous volcanic terrain infused with raw magical energy and rare minerals.',
    resourceModifiers: {
      [ResourceType.Wood]: 0.3,
      [ResourceType.Food]: 0.3,
      [ResourceType.Stone]: 1.3,
      [ResourceType.Iron]: 1.4,
      [ResourceType.Gems]: 1.3,
      [ResourceType.Mana]: 1.8,
    },
  },
};
