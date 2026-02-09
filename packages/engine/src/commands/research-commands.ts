import { GameState } from '../core/game-state.js';
import type { CommandResult } from './command.js';
import { TECH_DEFINITIONS } from '../config/tech-tree.js';
import { ResourceType } from '../types/resources.js';

export class StartResearchCommand {
  constructor(private techId: string) {}

  execute(state: GameState): CommandResult {
    const def = TECH_DEFINITIONS.find(t => t.id === this.techId);
    if (!def) return { success: false, message: `Unknown technology: ${this.techId}` };

    const playerState = state.getState();

    // Check if already researched
    if (state.hasResearched(this.techId)) {
      return { success: false, message: `${def.name} is already researched` };
    }

    // Check if already researching something
    if (playerState.research.current) {
      return { success: false, message: `Already researching: ${playerState.research.current}` };
    }

    // Check prerequisites
    for (const prereq of def.prerequisites) {
      if (!state.hasResearched(prereq)) {
        return { success: false, message: `Requires prerequisite technology: ${prereq}` };
      }
    }

    // Check gem/mana cost
    const costs: Partial<Record<ResourceType, number>> = {};
    if (def.cost.gems) costs[ResourceType.Gems] = def.cost.gems;
    if (def.cost.mana) costs[ResourceType.Mana] = def.cost.mana;

    if (!state.hasResources(costs)) {
      return { success: false, message: `Insufficient resources to research ${def.name}` };
    }

    state.deductResources(costs);

    const mutable = state.getMutableState();
    mutable.research.current = this.techId;
    mutable.research.progress = 0;

    return {
      success: true,
      message: `Started researching ${def.name}. Will complete in ${def.researchTicks} ticks.`,
      data: { techId: this.techId, ticks: def.researchTicks },
    };
  }
}
