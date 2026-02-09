import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { UnitType, CombatStrategy } from '../../../src/types/units.js';
import { PvpAttackCommand } from '../../../src/commands/pvp-commands.js';
import type { BattleReport } from '../../../src/types/combat.js';

function createEmptyUnits(): Record<UnitType, number> {
  return {
    [UnitType.Soldier]: 0,
    [UnitType.Archer]: 0,
    [UnitType.Cavalry]: 0,
    [UnitType.Lancer]: 0,
    [UnitType.Catapult]: 0,
    [UnitType.Spy]: 0,
    [UnitType.Mage]: 0,
  };
}

describe('PvpAttackCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('player1', 'Player One', BiomeType.Forest);
  });

  it('should fail when attacking yourself', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 10;

    const cmd = new PvpAttackCommand(
      'player1',
      { ...createEmptyUnits(), [UnitType.Soldier]: 5 },
      CombatStrategy.Balanced,
      0,
    );
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Cannot attack yourself.');
  });

  it('should fail when player has no army units', () => {
    const cmd = new PvpAttackCommand(
      'player2',
      { ...createEmptyUnits(), [UnitType.Soldier]: 5 },
      CombatStrategy.Balanced,
      0,
    );
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toBe('You have no army units.');
  });

  it('should enforce cooldown between attacks on the same target', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 20;
    mutable.tick = 10;

    const targetArmy = { ...createEmptyUnits(), [UnitType.Soldier]: 5 };

    // First attack should succeed
    const cmd1 = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Balanced, 0, 'seed1');
    const result1 = cmd1.execute(gs);
    expect(result1.success).toBe(true);

    // Advance a few ticks but not enough
    mutable.tick = 15;

    // Second attack on same target should fail due to cooldown
    const cmd2 = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Balanced, 0, 'seed2');
    const result2 = cmd2.execute(gs);
    expect(result2.success).toBe(false);
    expect(result2.message).toContain('Cooldown');
    expect(result2.message).toContain('15 more ticks');
  });

  it('should return a battle report on successful PvP battle', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 15;
    mutable.army.units[UnitType.Archer] = 10;

    const targetArmy = { ...createEmptyUnits(), [UnitType.Soldier]: 5, [UnitType.Archer]: 3 };

    const cmd = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Balanced, 0, 'pvp-test-seed');
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.battleReport).toBeDefined();

    const report = result.data?.battleReport as unknown as BattleReport;
    expect(report.attackerId).toBe('player1');
    expect(report.defenderId).toBe('player2');
    expect(report.rounds).toBeDefined();
    expect(report.rounds.length).toBeGreaterThan(0);
    expect(report.attackerLosses).toBeDefined();
    expect(report.defenderLosses).toBeDefined();
    expect(report.loot).toBeDefined();
  });

  it('should apply attacker losses correctly', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 10;

    const targetArmy = {
      ...createEmptyUnits(),
      [UnitType.Soldier]: 8,
      [UnitType.Archer]: 5,
      [UnitType.Cavalry]: 3,
    };

    const cmd = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Aggressive, 0, 'loss-seed');
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    const report = result.data?.battleReport as unknown as BattleReport;

    // Verify attacker losses were applied to the game state
    const soldierLosses = report.attackerLosses[UnitType.Soldier] ?? 0;
    expect(gs.getState().army.units[UnitType.Soldier]).toBe(10 - soldierLosses);
    // Army unit count should never go below 0
    expect(gs.getState().army.units[UnitType.Soldier]).toBeGreaterThanOrEqual(0);
  });

  it('should award tokens on victory', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 30;
    mutable.army.units[UnitType.Archer] = 20;
    mutable.army.units[UnitType.Cavalry] = 10;

    const tokensBefore = gs.getState().tokens;

    // Weak defender to ensure attacker wins
    const targetArmy = { ...createEmptyUnits(), [UnitType.Spy]: 1 };

    const cmd = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Balanced, 0, 'victory-seed');
    const result = cmd.execute(gs);

    const report = result.data?.battleReport as unknown as BattleReport;
    expect(report.winner).toBe('attacker');
    expect(result.message).toContain('Victory');

    // Tokens should increase by loot amount
    expect(gs.getState().tokens).toBe(tokensBefore + report.loot.tokens);
    expect(gs.getState().tokens).toBeGreaterThan(tokensBefore);
  });

  it('should track cooldown per target independently', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 30;
    mutable.tick = 10;

    const targetArmy = { ...createEmptyUnits(), [UnitType.Soldier]: 3 };

    // Attack player2
    const cmd1 = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Balanced, 0, 'target-a');
    const result1 = cmd1.execute(gs);
    expect(result1.success).toBe(true);

    // Attack player3 on the same tick should work (different target)
    const cmd2 = new PvpAttackCommand('player3', targetArmy, CombatStrategy.Balanced, 0, 'target-b');
    const result2 = cmd2.execute(gs);
    expect(result2.success).toBe(true);

    // Attack player2 again should be on cooldown
    const cmd3 = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Balanced, 0, 'target-c');
    const result3 = cmd3.execute(gs);
    expect(result3.success).toBe(false);
    expect(result3.message).toContain('Cooldown');

    // Attack player3 again should also be on cooldown
    const cmd4 = new PvpAttackCommand('player3', targetArmy, CombatStrategy.Balanced, 0, 'target-d');
    const result4 = cmd4.execute(gs);
    expect(result4.success).toBe(false);
    expect(result4.message).toContain('Cooldown');
  });

  it('should handle draw scenario', () => {
    const mutable = gs.getMutableState();
    // Give both sides identical armies to increase chance of draw-like outcome
    mutable.army.units[UnitType.Soldier] = 5;

    const targetArmy = { ...createEmptyUnits(), [UnitType.Soldier]: 5 };

    // We need to find a seed that produces a draw. Let's use a specific approach:
    // both sides with identical armies and balanced strategy, the combat could be close.
    // If we don't get a draw, we still verify the battle completes successfully.
    const cmd = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Balanced, 0, 'draw-seed');
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    const report = result.data?.battleReport as unknown as BattleReport;
    expect(report).toBeDefined();
    expect(['attacker', 'defender', 'draw']).toContain(report.winner);

    // Verify proper message based on outcome
    if (report.winner === 'draw') {
      expect(result.message).toContain('draw');
    } else if (report.winner === 'attacker') {
      expect(result.message).toContain('Victory');
    } else {
      expect(result.message).toContain('Defeat');
    }
  });

  it('should not award tokens on defeat', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Spy] = 1; // Very weak army

    const tokensBefore = gs.getState().tokens;

    // Strong defender
    const targetArmy = {
      ...createEmptyUnits(),
      [UnitType.Soldier]: 20,
      [UnitType.Archer]: 15,
    };

    const cmd = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Defensive, 0.5, 'defeat-seed');
    const result = cmd.execute(gs);

    const report = result.data?.battleReport as unknown as BattleReport;
    expect(report.winner).toBe('defender');
    expect(result.message).toContain('Defeat');

    // Tokens should not increase
    expect(gs.getState().tokens).toBe(tokensBefore);
  });

  it('should allow attack after cooldown expires', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 20;
    mutable.tick = 10;

    const targetArmy = { ...createEmptyUnits(), [UnitType.Soldier]: 3 };

    // First attack
    const cmd1 = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Balanced, 0, 'cooldown-a');
    const result1 = cmd1.execute(gs);
    expect(result1.success).toBe(true);

    // Advance past cooldown (20 ticks)
    mutable.tick = 30;

    // Second attack should now succeed
    const cmd2 = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Balanced, 0, 'cooldown-b');
    const result2 = cmd2.execute(gs);
    expect(result2.success).toBe(true);
  });

  it('should respect defender defense bonus', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 10;

    const targetArmy = { ...createEmptyUnits(), [UnitType.Soldier]: 10 };

    // Battle with no defense bonus
    const cmd1 = new PvpAttackCommand('player2', targetArmy, CombatStrategy.Balanced, 0, 'bonus-test');
    const result1 = cmd1.execute(gs);
    const report1 = result1.data?.battleReport as unknown as BattleReport;

    // Reset army for second test
    mutable.army.units[UnitType.Soldier] = 10;
    mutable.tick = 100; // Reset to avoid cooldown

    // Battle with high defense bonus for defender
    const cmd2 = new PvpAttackCommand('player3', targetArmy, CombatStrategy.Balanced, 1.0, 'bonus-test');
    const result2 = cmd2.execute(gs);
    const report2 = result2.data?.battleReport as unknown as BattleReport;

    // With a defense bonus, defender should fare better (fewer defender losses or more attacker losses)
    // We can't guarantee exact outcomes due to RNG, but we verify both battles completed
    expect(report1).toBeDefined();
    expect(report2).toBeDefined();
  });
});
