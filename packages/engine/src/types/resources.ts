export enum ResourceType {
  Wood = 'wood',
  Food = 'food',
  Stone = 'stone',
  Iron = 'iron',
  Gems = 'gems',
  Mana = 'mana',
}

export type ResourceMap = Record<ResourceType, number>;

export function createResourceMap(partial?: Partial<ResourceMap>): ResourceMap {
  return {
    [ResourceType.Wood]: 0,
    [ResourceType.Food]: 0,
    [ResourceType.Stone]: 0,
    [ResourceType.Iron]: 0,
    [ResourceType.Gems]: 0,
    [ResourceType.Mana]: 0,
    ...partial,
  };
}
