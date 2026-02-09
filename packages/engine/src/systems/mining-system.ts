import type { GameSystem } from '../core/tick-engine.js';
import type { GameState } from '../core/game-state.js';
import type { DeterministicRng } from '../core/rng.js';
import { BASE_MINING_REWARD } from '../config/constants.js';

/** Ticks per halving epoch (approximately 1 year of minutes) */
const HALVING_INTERVAL = 525_600;

export class MiningSystem implements GameSystem {
  readonly name = 'MiningSystem';

  process(state: GameState, _rng: DeterministicRng, tick: number): void {
    const mutable = state.getMutableState();

    // Calculate reward with halving: base halves every 525600 ticks
    const halvings = Math.floor(tick / HALVING_INTERVAL);
    const reward = BASE_MINING_REWARD / Math.pow(2, halvings);

    mutable.tokens += reward;
    mutable.prestige.totalTokensEarned += reward;
  }
}
