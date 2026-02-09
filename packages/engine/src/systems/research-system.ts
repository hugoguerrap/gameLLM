import type { GameSystem } from '../core/tick-engine.js';
import type { GameState } from '../core/game-state.js';
import type { DeterministicRng } from '../core/rng.js';
import { Era } from '../types/buildings.js';
import { TECH_DEFINITIONS } from '../config/tech-tree.js';

export class ResearchSystem implements GameSystem {
  readonly name = 'ResearchSystem';

  process(state: GameState, _rng: DeterministicRng, _tick: number): void {
    const mutableState = state.getMutableState();

    if (mutableState.research.current === null) return;

    // Increment progress
    mutableState.research.progress += 1;

    // Look up the tech definition
    const techDef = TECH_DEFINITIONS.find(t => t.id === mutableState.research.current);
    if (!techDef) return;

    // Check if research is complete
    if (mutableState.research.progress >= techDef.researchTicks) {
      // Complete the research
      mutableState.research.completed.push(mutableState.research.current);
      mutableState.research.current = null;
      mutableState.research.progress = 0;

      // Check if all techs of the current era are completed -> era upgrade
      const currentEra = mutableState.era;
      const techsInEra = TECH_DEFINITIONS.filter(t => t.era === currentEra);
      const allCompleted = techsInEra.every(t =>
        mutableState.research.completed.includes(t.id),
      );

      if (allCompleted && currentEra < Era.Metropolis) {
        mutableState.era = (currentEra + 1) as Era;
      }
    }
  }
}
