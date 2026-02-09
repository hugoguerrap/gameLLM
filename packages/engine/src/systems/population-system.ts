import type { GameSystem } from '../core/tick-engine.js';
import type { GameState } from '../core/game-state.js';
import type { DeterministicRng } from '../core/rng.js';
import { ResourceType } from '../types/resources.js';
import { BuildingId } from '../types/buildings.js';
import { BUILDING_DEFINITIONS } from '../config/buildings.js';
import { calculateFoodForGrowth } from '../config/formulas.js';
import { MAX_POPULATION_PER_CHOZA } from '../config/constants.js';

export class PopulationSystem implements GameSystem {
  readonly name = 'PopulationSystem';

  process(state: GameState, _rng: DeterministicRng, _tick: number): void {
    const playerState = state.getState();
    const mutableState = state.getMutableState();

    // Calculate max population from Choza buildings
    let maxPop = 0;
    for (const building of playerState.buildings) {
      if (building.id === BuildingId.Choza && building.constructionTicksRemaining === 0) {
        maxPop += building.level * MAX_POPULATION_PER_CHOZA;
      }
    }
    if (maxPop === 0) {
      maxPop = 20; // default if no chozas
    }
    mutableState.population.max = maxPop;

    // Population growth
    const currentPop = mutableState.population.current;
    const foodNeeded = calculateFoodForGrowth(currentPop);
    const currentFood = state.getResource(ResourceType.Food);

    if (currentFood > foodNeeded && currentPop < maxPop) {
      mutableState.population.current += 1;
      state.removeResource(ResourceType.Food, foodNeeded);
    }

    // Population decline from low happiness
    if (mutableState.population.happiness < 20 && mutableState.population.current > 5) {
      mutableState.population.current -= 1;
    }

    // Calculate happiness
    let happiness = 50; // base

    // Add happiness bonus from completed buildings
    for (const building of playerState.buildings) {
      if (building.constructionTicksRemaining !== 0) continue;
      const definition = BUILDING_DEFINITIONS[building.id];
      if (definition.happinessBonus) {
        happiness += definition.happinessBonus;
      }
    }

    // Penalty if food is below 50% of storage
    const foodStorage = state.getStorage(ResourceType.Food);
    if (state.getResource(ResourceType.Food) < foodStorage * 0.5) {
      happiness -= 5;
    }

    // Penalty if overcrowded
    if (mutableState.population.current > mutableState.population.max) {
      happiness -= 10;
    }

    // Clamp happiness 0-100
    mutableState.population.happiness = Math.max(0, Math.min(100, happiness));
  }
}
