import { GameState } from '../core/game-state.js';
import type { CommandResult } from './command.js';
import { UnitType, CombatStrategy } from '../types/units.js';
import { ResourceType } from '../types/resources.js';
import { UNIT_DEFINITIONS } from '../config/units.js';
import { BuildingId } from '../types/buildings.js';

export class RecruitCommand {
  constructor(private unitType: UnitType, private count: number = 1) {}

  execute(state: GameState): CommandResult {
    const def = UNIT_DEFINITIONS[this.unitType];
    if (!def) return { success: false, message: `Unknown unit type: ${this.unitType}` };

    // Check if barracks exists
    if (!state.getBuilding(BuildingId.Cuartel)) {
      return { success: false, message: 'You need a Cuartel (Barracks) to recruit units' };
    }

    // Calculate total cost
    const costs: Partial<Record<ResourceType, number>> = {};
    for (const [res, unitCost] of Object.entries(def.trainingCost)) {
      costs[res as ResourceType] = (unitCost ?? 0) * this.count;
    }

    if (!state.hasResources(costs)) {
      return { success: false, message: `Insufficient resources to recruit ${this.count} ${def.name}(s)` };
    }

    state.deductResources(costs);

    const mutable = state.getMutableState();
    mutable.army.units[this.unitType] += this.count;

    return {
      success: true,
      message: `Recruited ${this.count} ${def.name}(s).`,
      data: { unitType: this.unitType, count: this.count },
    };
  }
}

export class SetStrategyCommand {
  constructor(private strategy: CombatStrategy) {}

  execute(state: GameState): CommandResult {
    const mutable = state.getMutableState();
    mutable.army.strategy = this.strategy;
    return {
      success: true,
      message: `Army strategy set to ${this.strategy}.`,
      data: { strategy: this.strategy },
    };
  }
}
