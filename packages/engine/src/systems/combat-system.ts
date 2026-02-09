import type { GameSystem } from '../core/tick-engine.js';
import type { GameState } from '../core/game-state.js';
import type { DeterministicRng } from '../core/rng.js';
import { UnitType } from '../types/units.js';
import { ResourceType } from '../types/resources.js';
import { UNIT_DEFINITIONS } from '../config/units.js';

export class CombatSystem implements GameSystem {
  readonly name = 'CombatSystem';

  process(state: GameState, _rng: DeterministicRng, _tick: number): void {
    const playerState = state.getState();
    const mutableState = state.getMutableState();

    // Calculate total army food consumption
    let totalFoodCost = 0;
    for (const type of Object.values(UnitType)) {
      const count = playerState.army.units[type] ?? 0;
      if (count > 0) {
        totalFoodCost += count * UNIT_DEFINITIONS[type].foodPerTick;
      }
    }

    if (totalFoodCost <= 0) return;

    const currentFood = state.getResource(ResourceType.Food);

    if (currentFood >= totalFoodCost) {
      // Enough food: deduct it
      state.removeResource(ResourceType.Food, totalFoodCost);
    } else {
      // Not enough food: consume whatever is available, then starve units
      mutableState.resources[ResourceType.Food] = 0;

      // Kill weakest unit (lowest health first), 1 per tick of starvation
      const unitTypes = Object.values(UnitType)
        .filter(t => (mutableState.army.units[t] ?? 0) > 0)
        .sort((a, b) => UNIT_DEFINITIONS[a].health - UNIT_DEFINITIONS[b].health);

      if (unitTypes.length > 0) {
        mutableState.army.units[unitTypes[0]] -= 1;
      }
    }
  }

  /**
   * Calculate the total defense bonus from active defense_boost effects.
   */
  static getDefenseBonus(state: GameState): number {
    const effects = state.getState().activeEffects;
    let bonus = 0;
    for (const effect of effects) {
      if (effect.type === 'defense_boost') {
        bonus += effect.modifier;
      }
    }
    return bonus;
  }
}
