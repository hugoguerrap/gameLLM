import type { GameSystem } from '../core/tick-engine.js';
import type { GameState } from '../core/game-state.js';
import type { DeterministicRng } from '../core/rng.js';
import { ResourceType } from '../types/resources.js';
import { BUILDING_DEFINITIONS } from '../config/buildings.js';
import { BIOME_DEFINITIONS } from '../config/biomes.js';
import { calculateProduction } from '../config/formulas.js';
import { FOOD_PER_CITIZEN } from '../config/constants.js';

export class ResourceSystem implements GameSystem {
  readonly name = 'ResourceSystem';

  process(state: GameState, _rng: DeterministicRng, _tick: number): void {
    const playerState = state.getState();
    const mutableState = state.getMutableState();
    const biome = BIOME_DEFINITIONS[playerState.biome];
    const legacyMultiplier = playerState.prestige.legacyMultiplier;

    // Process production from completed buildings
    for (const building of playerState.buildings) {
      if (building.constructionTicksRemaining !== 0) continue;

      const definition = BUILDING_DEFINITIONS[building.id];
      if (!definition.production) continue;

      for (const [resource, baseProduction] of Object.entries(definition.production)) {
        if (baseProduction === undefined || baseProduction === 0) continue;

        const resourceType = resource as ResourceType;
        const biomeModifier = biome.resourceModifiers[resourceType];

        const production = calculateProduction(
          baseProduction,
          building.level,
          0, // techBonus
          legacyMultiplier,
          biomeModifier,
        );

        state.addResource(resourceType, production);
      }
    }

    // Food consumption: population * FOOD_PER_CITIZEN per tick
    const foodConsumption = playerState.population.current * FOOD_PER_CITIZEN;
    const currentFood = state.getResource(ResourceType.Food);

    if (currentFood >= foodConsumption) {
      state.removeResource(ResourceType.Food, foodConsumption);
    } else {
      // Not enough food - set to 0 and reduce happiness
      mutableState.resources[ResourceType.Food] = 0;
      mutableState.population.happiness = Math.max(
        0,
        mutableState.population.happiness - 10,
      );
    }
  }
}
