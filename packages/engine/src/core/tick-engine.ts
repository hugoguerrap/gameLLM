import { GameState } from './game-state.js';
import { DeterministicRng } from './rng.js';

export interface GameSystem {
  name: string;
  process(state: GameState, rng: DeterministicRng, tick: number): void;
}

export class TickEngine {
  private systems: GameSystem[] = [];
  private rng: DeterministicRng;

  constructor(seed: string | number) {
    this.rng = new DeterministicRng(seed);
  }

  registerSystem(system: GameSystem): void {
    this.systems.push(system);
  }

  /** Process a single tick */
  processTick(state: GameState, tick: number): void {
    state.setTick(tick);
    for (const system of this.systems) {
      system.process(state, this.rng, tick);
    }
  }

  /** Process multiple ticks (catch-up) */
  processTickRange(state: GameState, fromTick: number, toTick: number): void {
    for (let tick = fromTick; tick <= toTick; tick++) {
      this.processTick(state, tick);
    }
  }

  getSystems(): readonly GameSystem[] {
    return this.systems;
  }

  getRng(): DeterministicRng {
    return this.rng;
  }
}
