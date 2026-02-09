import type { GameSystem } from '../core/tick-engine.js';
import type { GameState } from '../core/game-state.js';
import type { DeterministicRng } from '../core/rng.js';
import { ResourceType } from '../types/resources.js';
import { BUILDING_DEFINITIONS } from '../config/buildings.js';

export class BuildingSystem implements GameSystem {
  readonly name = 'BuildingSystem';

  process(state: GameState, _rng: DeterministicRng, _tick: number): void {
    const mutableState = state.getMutableState();

    // Process active buildings under construction
    for (const building of mutableState.buildings) {
      if (building.constructionTicksRemaining > 0) {
        building.constructionTicksRemaining -= 1;
      }
    }

    // Process build queue
    const completedIndices: number[] = [];
    for (let i = 0; i < mutableState.buildQueue.length; i++) {
      const queued = mutableState.buildQueue[i];
      if (queued.constructionTicksRemaining > 0) {
        queued.constructionTicksRemaining -= 1;
      }

      if (queued.constructionTicksRemaining === 0) {
        completedIndices.push(i);

        // Move to buildings (merge if exists)
        const existing = mutableState.buildings.find(b => b.id === queued.id);
        if (existing) {
          existing.level = queued.level;
          existing.constructionTicksRemaining = 0;
        } else {
          mutableState.buildings.push({
            id: queued.id,
            level: queued.level,
            constructionTicksRemaining: 0,
          });
        }
      }
    }

    // Remove completed items from queue (in reverse to preserve indices)
    for (let i = completedIndices.length - 1; i >= 0; i--) {
      mutableState.buildQueue.splice(completedIndices[i], 1);
    }

    // Calculate total storage bonus from all completed buildings
    let totalStorageBonus = 0;
    for (const building of mutableState.buildings) {
      if (building.constructionTicksRemaining !== 0) continue;
      const definition = BUILDING_DEFINITIONS[building.id];
      if (definition.storageBonus) {
        totalStorageBonus += definition.storageBonus * building.level;
      }
    }

    // Apply storage bonuses to all resource types
    // We add the bonus on top of existing storage
    // The base storage values are set during player creation;
    // here we recalculate from base + bonus each tick
    const baseStorageMap: Record<string, number> = {
      [ResourceType.Wood]: 500,
      [ResourceType.Food]: 500,
      [ResourceType.Stone]: 300,
      [ResourceType.Iron]: 200,
      [ResourceType.Gems]: 100,
      [ResourceType.Mana]: 50,
    };

    for (const resourceType of Object.values(ResourceType)) {
      const base = baseStorageMap[resourceType] ?? 500;
      mutableState.resourceStorage[resourceType] = base + totalStorageBonus;
    }
  }
}
