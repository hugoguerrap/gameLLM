import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { DeterministicRng } from '../../../src/core/rng.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { MiningSystem } from '../../../src/systems/mining-system.js';
import { BASE_MINING_REWARD, INITIAL_TOKENS } from '../../../src/config/constants.js';

describe('MiningSystem', () => {
  let gs: GameState;
  let rng: DeterministicRng;
  let system: MiningSystem;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
    rng = new DeterministicRng('test-seed');
    system = new MiningSystem();
  });

  it('should award BASE_MINING_REWARD tokens per tick', () => {
    const tokensBefore = gs.getState().tokens;
    system.process(gs, rng, 1);

    expect(gs.getState().tokens).toBeCloseTo(tokensBefore + BASE_MINING_REWARD, 10);
  });

  it('should accumulate tokens over multiple ticks', () => {
    const tokensBefore = gs.getState().tokens;
    const ticks = 10;

    for (let i = 1; i <= ticks; i++) {
      system.process(gs, rng, i);
    }

    expect(gs.getState().tokens).toBeCloseTo(tokensBefore + BASE_MINING_REWARD * ticks, 10);
  });

  it('should update totalTokensEarned in prestige', () => {
    const earnedBefore = gs.getState().prestige.totalTokensEarned;
    system.process(gs, rng, 1);

    expect(gs.getState().prestige.totalTokensEarned).toBeCloseTo(
      earnedBefore + BASE_MINING_REWARD,
      10,
    );
  });

  it('should accumulate totalTokensEarned over multiple ticks', () => {
    const earnedBefore = gs.getState().prestige.totalTokensEarned;
    const ticks = 5;

    for (let i = 1; i <= ticks; i++) {
      system.process(gs, rng, i);
    }

    expect(gs.getState().prestige.totalTokensEarned).toBeCloseTo(
      earnedBefore + BASE_MINING_REWARD * ticks,
      10,
    );
  });

  it('should halve reward after 525600 ticks', () => {
    const tokensBefore = gs.getState().tokens;
    // Process at tick 525600 (exactly at halving boundary)
    system.process(gs, rng, 525600);

    // At tick 525600: halvings = floor(525600 / 525600) = 1, reward = 0.1 / 2 = 0.05
    expect(gs.getState().tokens).toBeCloseTo(tokensBefore + BASE_MINING_REWARD / 2, 10);
  });

  it('should give full reward before first halving', () => {
    const tokensBefore = gs.getState().tokens;
    // Process at tick 525599 (just before halving)
    system.process(gs, rng, 525599);

    // At tick 525599: halvings = floor(525599 / 525600) = 0, reward = 0.1
    expect(gs.getState().tokens).toBeCloseTo(tokensBefore + BASE_MINING_REWARD, 10);
  });

  it('should apply multiple halvings correctly', () => {
    const tokensBefore = gs.getState().tokens;
    // Process at tick 1051200 (2 halvings: 525600 * 2)
    system.process(gs, rng, 1051200);

    // halvings = floor(1051200 / 525600) = 2, reward = 0.1 / 4 = 0.025
    expect(gs.getState().tokens).toBeCloseTo(tokensBefore + BASE_MINING_REWARD / 4, 10);
  });

  it('should work with initial token balance', () => {
    // Initial tokens should be INITIAL_TOKENS (100)
    expect(gs.getState().tokens).toBe(INITIAL_TOKENS);

    system.process(gs, rng, 1);

    expect(gs.getState().tokens).toBeCloseTo(INITIAL_TOKENS + BASE_MINING_REWARD, 10);
  });

  it('should award reward at tick 0', () => {
    const tokensBefore = gs.getState().tokens;
    system.process(gs, rng, 0);

    // At tick 0: halvings = 0, reward = BASE_MINING_REWARD
    expect(gs.getState().tokens).toBeCloseTo(tokensBefore + BASE_MINING_REWARD, 10);
  });

  it('should apply third halving correctly', () => {
    const tokensBefore = gs.getState().tokens;
    // Process at tick 1576800 (3 halvings: 525600 * 3)
    system.process(gs, rng, 1576800);

    // halvings = 3, reward = 0.1 / 8 = 0.0125
    expect(gs.getState().tokens).toBeCloseTo(tokensBefore + BASE_MINING_REWARD / 8, 10);
  });
});
