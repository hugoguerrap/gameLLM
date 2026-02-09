import { ResourceType } from './resources.js';

export enum BiomeType {
  Forest = 'forest',
  Mountain = 'mountain',
  Prairie = 'prairie',
  Desert = 'desert',
  Coast = 'coast',
  Volcanic = 'volcanic',
}

export interface BiomeDefinition {
  type: BiomeType;
  name: string;
  description: string;
  resourceModifiers: Record<ResourceType, number>; // multiplier: 1.5 = abundant, 0.5 = scarce
}
