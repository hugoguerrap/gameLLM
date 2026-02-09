import type { GameSystem } from '../core/tick-engine.js';
import type { GameState } from '../core/game-state.js';
import type { DeterministicRng } from '../core/rng.js';

export class PrestigeSystem implements GameSystem {
  readonly name = 'PrestigeSystem';

  process(_state: GameState, _rng: DeterministicRng, _tick: number): void {
    // Prestige is player-initiated via commands.
    // This system is a placeholder for future tick-based prestige logic.
  }
}
