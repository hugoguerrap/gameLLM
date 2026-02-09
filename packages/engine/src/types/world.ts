import { BiomeType } from './biomes.js';
import { ResourceMap } from './resources.js';

export interface Region {
  id: string;
  name: string;
  biome: BiomeType;
  position: { x: number; y: number };
  ownerId: string | null;
  discoveredBy: string[];
  deposits: Partial<ResourceMap>;
  dangerLevel: number;
}
