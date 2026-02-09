import type { GameSystem } from '../core/tick-engine.js';
import type { GameState } from '../core/game-state.js';
import type { DeterministicRng } from '../core/rng.js';

export class ExplorationSystem implements GameSystem {
  readonly name = 'ExplorationSystem';

  process(_state: GameState, _rng: DeterministicRng, _tick: number): void {
    // Exploration is handled via player commands.
    // This system is a placeholder for future tick-based exploration logic.
  }
}
