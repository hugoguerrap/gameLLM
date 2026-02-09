import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { Era, BuildingId } from '../../../src/types/buildings.js';
import { ResourceType } from '../../../src/types/resources.js';
import { AscendCommand } from '../../../src/commands/prestige-commands.js';
import { calculateLegacyMultiplier } from '../../../src/config/formulas.js';
import { INITIAL_TOKENS } from '../../../src/config/constants.js';

describe('AscendCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
  });

  function makeAscendable(state: GameState, tokens = 600): void {
    const mutable = state.getMutableState();
    mutable.era = Era.Pueblo;
    mutable.tokens = tokens;
    state.setTick(100);
  }

  it('should fail when era < 2', () => {
    const mutable = gs.getMutableState();
    mutable.tokens = 600;
    gs.setTick(100);
    // era stays at Era.Aldea (1)

    const cmd = new AscendCommand();
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Era Pueblo');
  });

  it('should fail when tokens < 500', () => {
    const mutable = gs.getMutableState();
    mutable.era = Era.Pueblo;
    mutable.tokens = 499;
    gs.setTick(100);

    const cmd = new AscendCommand();
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('500 tokens');
  });

  it('should fail when ticks < 50', () => {
    const mutable = gs.getMutableState();
    mutable.era = Era.Pueblo;
    mutable.tokens = 600;
    gs.setTick(49);

    const cmd = new AscendCommand();
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('50 ticks');
  });

  it('should succeed with valid state', () => {
    makeAscendable(gs);

    const cmd = new AscendCommand();
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Ascended to prestige level');
  });

  it('should increment prestige level on ascend', () => {
    makeAscendable(gs);

    const cmd = new AscendCommand();
    cmd.execute(gs);

    expect(gs.getState().prestige.level).toBe(1);
  });

  it('should update legacy multiplier correctly', () => {
    makeAscendable(gs);

    const cmd = new AscendCommand();
    cmd.execute(gs);

    const expectedMultiplier = calculateLegacyMultiplier(1);
    expect(gs.getState().prestige.legacyMultiplier).toBeCloseTo(expectedMultiplier, 10);
  });

  it('should deduct 500 tokens', () => {
    makeAscendable(gs, 600);

    const cmd = new AscendCommand();
    cmd.execute(gs);

    expect(gs.getState().tokens).toBe(100); // 600 - 500
  });

  it('should add AscensionBonus based on level', () => {
    makeAscendable(gs);

    const cmd = new AscendCommand();
    cmd.execute(gs);

    // New level is 1: 1 % 4 == 1 -> combat bonus (+0.03)
    const bonuses = gs.getState().prestige.bonuses;
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0].type).toBe('combat');
    expect(bonuses[0].value).toBe(0.03);
  });

  it('should reset buildings to empty', () => {
    makeAscendable(gs);
    // Add a building before ascension
    gs.addBuilding({ id: BuildingId.Choza, level: 3, constructionTicksRemaining: 0 });
    expect(gs.getState().buildings).toHaveLength(1);

    const cmd = new AscendCommand();
    cmd.execute(gs);

    expect(gs.getState().buildings).toHaveLength(0);
  });

  it('should reset resources back to initial values', () => {
    makeAscendable(gs);
    // Modify resources before ascension
    const mutable = gs.getMutableState();
    mutable.resources[ResourceType.Wood] = 999;
    mutable.resources[ResourceType.Food] = 999;

    const cmd = new AscendCommand();
    cmd.execute(gs);

    const state = gs.getState();
    expect(state.resources[ResourceType.Wood]).toBe(100);
    expect(state.resources[ResourceType.Food]).toBe(100);
    expect(state.resources[ResourceType.Stone]).toBe(50);
    expect(state.resources[ResourceType.Iron]).toBe(20);
    expect(state.resources[ResourceType.Gems]).toBe(5);
    expect(state.resources[ResourceType.Mana]).toBe(0);
  });

  it('should reset era to Aldea', () => {
    makeAscendable(gs);

    const cmd = new AscendCommand();
    cmd.execute(gs);

    expect(gs.getState().era).toBe(Era.Aldea);
  });

  it('should preserve prestige state after reset', () => {
    makeAscendable(gs);

    const cmd = new AscendCommand();
    cmd.execute(gs);

    const prestige = gs.getState().prestige;
    expect(prestige.level).toBe(1);
    expect(prestige.legacyMultiplier).toBeCloseTo(calculateLegacyMultiplier(1), 10);
    expect(prestige.bonuses).toHaveLength(1);
  });

  it('should handle multiple ascensions and increment level correctly', () => {
    // First ascension
    makeAscendable(gs, 1100);
    const cmd = new AscendCommand();
    cmd.execute(gs);

    expect(gs.getState().prestige.level).toBe(1);
    expect(gs.getState().tokens).toBe(600); // 1100 - 500

    // Second ascension: set era and tick again (they were reset)
    const mutable = gs.getMutableState();
    mutable.era = Era.Pueblo;
    gs.setTick(100);

    cmd.execute(gs);

    expect(gs.getState().prestige.level).toBe(2);
    expect(gs.getState().tokens).toBe(100); // 600 - 500
    expect(gs.getState().prestige.legacyMultiplier).toBeCloseTo(calculateLegacyMultiplier(2), 10);
    expect(gs.getState().prestige.bonuses).toHaveLength(2);
  });

  it('should keep tokens (minus cost) after ascend', () => {
    makeAscendable(gs, 750);

    const cmd = new AscendCommand();
    cmd.execute(gs);

    expect(gs.getState().tokens).toBe(250); // 750 - 500
  });
});
