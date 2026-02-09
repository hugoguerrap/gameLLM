import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { UnitType, CombatStrategy } from '../../../src/types/units.js';
import { ResourceType } from '../../../src/types/resources.js';
import { AttackCommand } from '../../../src/commands/combat-commands.js';
import type { BattleReport } from '../../../src/types/combat.js';

describe('AttackCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
  });

  it('should fail with no army units', () => {
    const cmd = new AttackCommand('bandits');
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('no army units');
  });

  it('should fail with invalid target type', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 5;

    const cmd = new AttackCommand('goblins' as 'bandits');
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid target');
  });

  it('should win against bandits with a strong army', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 20;
    mutable.army.units[UnitType.Archer] = 10;

    const cmd = new AttackCommand('bandits', 'strong-army-seed');
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    const report = (result.data?.battleReport as unknown) as BattleReport;
    expect(report).toBeDefined();
    expect(report.winner).toBe('attacker');
    expect(result.message).toContain('Victory');
  });

  it('should potentially lose against bandits with a very weak army', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Spy] = 1; // Very weak: ATK 15, DEF 10, HP 50

    const cmd = new AttackCommand('bandits', 'weak-army-seed');
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    const report = (result.data?.battleReport as unknown) as BattleReport;
    expect(report).toBeDefined();
    // With 1 spy vs 5 soldiers + 3 archers, defender should win
    expect(report.winner).toBe('defender');
    expect(result.message).toContain('Defeat');
  });

  it('should add loot on victory', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 30;

    const tokensBefore = gs.getState().tokens;
    const foodBefore = gs.getResource(ResourceType.Food);
    const woodBefore = gs.getResource(ResourceType.Wood);

    const cmd = new AttackCommand('bandits', 'loot-test-seed');
    const result = cmd.execute(gs);

    const report = (result.data?.battleReport as unknown) as BattleReport;
    expect(report.winner).toBe('attacker');

    // Should gain tokens: battle loot + target reward (10)
    expect(gs.getState().tokens).toBeGreaterThan(tokensBefore);

    // Bandits reward: 20 food, 10 wood
    expect(gs.getResource(ResourceType.Food)).toBeGreaterThanOrEqual(foodBefore);
    expect(gs.getResource(ResourceType.Wood)).toBeGreaterThanOrEqual(woodBefore);
  });

  it('should deduct lost units from player army', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 10;

    const cmd = new AttackCommand('raiders', 'loss-test-seed');
    const result = cmd.execute(gs);

    const report = (result.data?.battleReport as unknown) as BattleReport;
    expect(report).toBeDefined();

    // Calculate total attacker losses
    let totalLosses = 0;
    for (const count of Object.values(report.attackerLosses)) {
      totalLosses += count ?? 0;
    }

    // Player army should be reduced by the losses
    const remainingSoldiers = gs.getState().army.units[UnitType.Soldier];
    expect(remainingSoldiers).toBe(10 - (report.attackerLosses[UnitType.Soldier] ?? 0));
  });

  it('should return BattleReport in data field', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 10;

    const cmd = new AttackCommand('bandits', 'report-test');
    const result = cmd.execute(gs);

    expect(result.data).toBeDefined();
    expect(result.data?.battleReport).toBeDefined();

    const report = (result.data?.battleReport as unknown) as BattleReport;
    expect(report.attackerId).toBe('test');
    expect(report.defenderId).toBe('bandits');
    expect(report.attackerStrategy).toBe(CombatStrategy.Balanced);
    expect(report.rounds).toBeDefined();
    expect(report.attackerLosses).toBeDefined();
    expect(report.defenderLosses).toBeDefined();
    expect(report.loot).toBeDefined();
  });

  it('should use player strategy in combat', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 15;
    mutable.army.strategy = CombatStrategy.Aggressive;

    const cmd = new AttackCommand('bandits', 'strategy-test');
    const result = cmd.execute(gs);

    const report = (result.data?.battleReport as unknown) as BattleReport;
    expect(report.attackerStrategy).toBe(CombatStrategy.Aggressive);
  });

  it('should handle attack against raiders (medium difficulty)', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 15;
    mutable.army.units[UnitType.Archer] = 10;
    mutable.army.units[UnitType.Cavalry] = 5;

    const cmd = new AttackCommand('raiders', 'raiders-test');
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    const report = (result.data?.battleReport as unknown) as BattleReport;
    expect(report).toBeDefined();
    expect(report.defenderId).toBe('raiders');
  });

  it('should handle attack against dragon (hard difficulty)', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Soldier] = 20;
    mutable.army.units[UnitType.Archer] = 15;
    mutable.army.units[UnitType.Cavalry] = 10;
    mutable.army.units[UnitType.Mage] = 5;

    const cmd = new AttackCommand('dragon', 'dragon-test');
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    const report = (result.data?.battleReport as unknown) as BattleReport;
    expect(report).toBeDefined();
    expect(report.defenderId).toBe('dragon');
  });

  it('should not give target reward tokens on defeat', () => {
    const mutable = gs.getMutableState();
    mutable.army.units[UnitType.Spy] = 1;

    const tokensBefore = gs.getState().tokens;

    const cmd = new AttackCommand('bandits', 'no-reward-test');
    const result = cmd.execute(gs);

    const report = (result.data?.battleReport as unknown) as BattleReport;
    expect(report.winner).toBe('defender');

    // Should not gain target reward tokens (bandits: 10)
    // Only battle loot could be gained, but since we lost, no loot
    expect(gs.getState().tokens).toBe(tokensBefore);
  });
});
