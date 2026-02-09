import { GameState } from '../core/game-state.js';
import type { CommandResult } from './command.js';
import { BuildingId } from '../types/buildings.js';
import { ResourceType } from '../types/resources.js';
import { BUILDING_DEFINITIONS } from '../config/buildings.js';
import { calculateBuildingCost } from '../config/formulas.js';

export class BuildCommand {
  constructor(private buildingId: BuildingId) {}

  execute(state: GameState): CommandResult {
    const def = BUILDING_DEFINITIONS[this.buildingId];
    if (!def) return { success: false, message: `Unknown building: ${this.buildingId}` };

    // Check era requirement
    const playerState = state.getState();
    if (def.era > playerState.era) {
      return { success: false, message: `Building requires era ${def.era}, you are in era ${playerState.era}` };
    }

    // Check tech requirement
    if (def.techRequired && !state.hasResearched(def.techRequired)) {
      return { success: false, message: `Requires technology: ${def.techRequired}` };
    }

    // Check if already built (for unique buildings)
    const existing = state.getBuilding(this.buildingId);
    if (existing) {
      return { success: false, message: `${def.name} is already built. Use upgrade instead.` };
    }

    // Calculate cost for level 1
    const costs: Partial<Record<ResourceType, number>> = {};
    for (const [res, baseCost] of Object.entries(def.baseCost)) {
      costs[res as ResourceType] = calculateBuildingCost(baseCost ?? 0, 0, def.costMultiplier);
    }

    // Check and deduct resources
    if (!state.hasResources(costs)) {
      return { success: false, message: `Insufficient resources to build ${def.name}` };
    }

    state.deductResources(costs);

    // Add to buildings with construction time
    state.addBuilding({
      id: this.buildingId,
      level: 1,
      constructionTicksRemaining: def.constructionTicks,
    });

    return {
      success: true,
      message: `Started construction of ${def.name}. Will complete in ${def.constructionTicks} ticks.`,
      data: { buildingId: this.buildingId, ticks: def.constructionTicks },
    };
  }
}

export class UpgradeCommand {
  constructor(private buildingId: BuildingId) {}

  execute(state: GameState): CommandResult {
    const def = BUILDING_DEFINITIONS[this.buildingId];
    if (!def) return { success: false, message: `Unknown building: ${this.buildingId}` };

    const existing = state.getBuilding(this.buildingId);
    if (!existing) {
      return { success: false, message: `${def.name} not yet built` };
    }

    if (existing.constructionTicksRemaining > 0) {
      return { success: false, message: `${def.name} is still under construction` };
    }

    if (existing.level >= def.maxLevel) {
      return { success: false, message: `${def.name} is already at max level ${def.maxLevel}` };
    }

    // Calculate cost for next level
    const costs: Partial<Record<ResourceType, number>> = {};
    for (const [res, baseCost] of Object.entries(def.baseCost)) {
      costs[res as ResourceType] = calculateBuildingCost(baseCost ?? 0, existing.level, def.costMultiplier);
    }

    if (!state.hasResources(costs)) {
      return { success: false, message: `Insufficient resources to upgrade ${def.name}` };
    }

    state.deductResources(costs);

    // Upgrade in place
    existing.level += 1;
    existing.constructionTicksRemaining = def.constructionTicks;

    return {
      success: true,
      message: `Upgrading ${def.name} to level ${existing.level}. Will complete in ${def.constructionTicks} ticks.`,
      data: { buildingId: this.buildingId, newLevel: existing.level },
    };
  }
}

export class DemolishCommand {
  constructor(private buildingId: BuildingId) {}

  execute(state: GameState): CommandResult {
    const def = BUILDING_DEFINITIONS[this.buildingId];
    if (!def) return { success: false, message: `Unknown building: ${this.buildingId}` };

    const playerState = state.getMutableState();
    const idx = playerState.buildings.findIndex(b => b.id === this.buildingId);
    if (idx === -1) {
      return { success: false, message: `${def.name} is not built` };
    }

    // Refund 50% of level 1 cost
    for (const [res, baseCost] of Object.entries(def.baseCost)) {
      state.addResource(res as ResourceType, Math.floor((baseCost ?? 0) * 0.5));
    }

    playerState.buildings.splice(idx, 1);

    return {
      success: true,
      message: `${def.name} demolished. 50% resources refunded.`,
      data: { buildingId: this.buildingId },
    };
  }
}
