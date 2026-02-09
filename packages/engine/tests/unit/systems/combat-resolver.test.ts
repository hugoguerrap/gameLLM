import { describe, it, expect } from 'vitest';
import { DeterministicRng } from '../../../src/core/rng.js';
import { UnitType, CombatStrategy } from '../../../src/types/units.js';
import { resolveBattle } from '../../../src/systems/combat-resolver.js';

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

describe('resolveBattle', () => {
  it('should produce a close battle with equal armies', () => {
    const rng = new DeterministicRng('equal-test');
    const units = { ...createEmptyUnits(), [UnitType.Soldier]: 10 };

    const report = resolveBattle(
      { units: { ...units }, strategy: CombatStrategy.Balanced },
      { units: { ...units }, strategy: CombatStrategy.Balanced, defenseBonus: 0 },
      rng,
    );

    // Both sides should take losses
    expect(report.rounds.length).toBe(1);
    expect(report.rounds[0].attackerUnitsLost).toBeGreaterThan(0);
    expect(report.rounds[0].defenderUnitsLost).toBeGreaterThan(0);
    // With equal armies, results should be close
    const diff = Math.abs(report.rounds[0].attackerUnitsLost - report.rounds[0].defenderUnitsLost);
    expect(diff).toBeLessThanOrEqual(5);
  });

  it('should let a stronger army win', () => {
    const rng = new DeterministicRng('strong-test');

    const report = resolveBattle(
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 20 },
        strategy: CombatStrategy.Balanced,
      },
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 3 },
        strategy: CombatStrategy.Balanced,
        defenseBonus: 0,
      },
      rng,
    );

    expect(report.winner).toBe('attacker');
    // Attacker should lose fewer units than defender
    expect(report.rounds[0].attackerUnitsLost).toBeLessThan(report.rounds[0].defenderUnitsLost);
  });

  it('should apply unit triangle bonus correctly', () => {
    // Soldier is strong against Archer
    const rng1 = new DeterministicRng('triangle-1');
    const rng2 = new DeterministicRng('triangle-1'); // same seed for comparison

    // Soldiers vs Archers (soldiers have triangle advantage)
    const reportWithAdvantage = resolveBattle(
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Balanced,
      },
      {
        units: { ...createEmptyUnits(), [UnitType.Archer]: 10 },
        strategy: CombatStrategy.Balanced,
        defenseBonus: 0,
      },
      rng1,
    );

    // Soldiers vs Soldiers (no triangle advantage, same seed)
    const reportWithoutAdvantage = resolveBattle(
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Balanced,
      },
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Balanced,
        defenseBonus: 0,
      },
      rng2,
    );

    // Soldier vs Archer should deal more damage (triangle bonus) than soldier vs soldier
    expect(reportWithAdvantage.rounds[0].attackerDamageDealt).toBeGreaterThan(
      reportWithoutAdvantage.rounds[0].attackerDamageDealt,
    );
  });

  it('should apply strategy modifiers', () => {
    // Aggressive strategy: +20% attack, -10% defense
    const rng1 = new DeterministicRng('strategy-test');
    const rng2 = new DeterministicRng('strategy-test');

    const aggressiveReport = resolveBattle(
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Aggressive,
      },
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Balanced,
        defenseBonus: 0,
      },
      rng1,
    );

    const balancedReport = resolveBattle(
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Balanced,
      },
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Balanced,
        defenseBonus: 0,
      },
      rng2,
    );

    // Aggressive attacker should deal more damage than balanced
    expect(aggressiveReport.rounds[0].attackerDamageDealt).toBeGreaterThan(
      balancedReport.rounds[0].attackerDamageDealt,
    );
  });

  it('should calculate loot correctly', () => {
    const rng = new DeterministicRng('loot-test');

    const report = resolveBattle(
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 30 },
        strategy: CombatStrategy.Balanced,
      },
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 5 },
        strategy: CombatStrategy.Balanced,
        defenseBonus: 0,
      },
      rng,
    );

    expect(report.winner).toBe('attacker');
    // Loot should be 5 * defender units lost
    expect(report.loot.tokens).toBe(5 * report.rounds[0].defenderUnitsLost);
  });

  it('should handle empty attacker army vs non-empty defender', () => {
    const rng = new DeterministicRng('empty-attacker');

    const report = resolveBattle(
      { units: createEmptyUnits(), strategy: CombatStrategy.Balanced },
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 5 },
        strategy: CombatStrategy.Balanced,
        defenseBonus: 0,
      },
      rng,
    );

    expect(report.winner).toBe('defender');
    expect(report.rounds.length).toBe(0);
  });

  it('should handle empty defender army vs non-empty attacker', () => {
    const rng = new DeterministicRng('empty-defender');

    const report = resolveBattle(
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 5 },
        strategy: CombatStrategy.Balanced,
      },
      {
        units: createEmptyUnits(),
        strategy: CombatStrategy.Balanced,
        defenseBonus: 0,
      },
      rng,
    );

    expect(report.winner).toBe('attacker');
    expect(report.rounds.length).toBe(0);
  });

  it('should handle both armies empty as a draw', () => {
    const rng = new DeterministicRng('both-empty');

    const report = resolveBattle(
      { units: createEmptyUnits(), strategy: CombatStrategy.Balanced },
      { units: createEmptyUnits(), strategy: CombatStrategy.Balanced, defenseBonus: 0 },
      rng,
    );

    expect(report.winner).toBe('draw');
    expect(report.rounds.length).toBe(0);
  });

  it('should apply defense bonus to defender', () => {
    const rng1 = new DeterministicRng('defense-bonus');
    const rng2 = new DeterministicRng('defense-bonus');

    // Defender with 50% defense bonus
    const reportWithBonus = resolveBattle(
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Balanced,
      },
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Balanced,
        defenseBonus: 0.5,
      },
      rng1,
    );

    // Defender without bonus
    const reportWithoutBonus = resolveBattle(
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Balanced,
      },
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 10 },
        strategy: CombatStrategy.Balanced,
        defenseBonus: 0,
      },
      rng2,
    );

    // With defense bonus, attacker should deal less damage
    expect(reportWithBonus.rounds[0].attackerDamageDealt).toBeLessThanOrEqual(
      reportWithoutBonus.rounds[0].attackerDamageDealt,
    );
  });

  it('should return correct attacker/defender IDs and strategies', () => {
    const rng = new DeterministicRng('ids-test');

    const report = resolveBattle(
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 5 },
        strategy: CombatStrategy.Aggressive,
      },
      {
        units: { ...createEmptyUnits(), [UnitType.Soldier]: 5 },
        strategy: CombatStrategy.Defensive,
        defenseBonus: 0,
      },
      rng,
      'player1',
      'npc-bandits',
    );

    expect(report.attackerId).toBe('player1');
    expect(report.defenderId).toBe('npc-bandits');
    expect(report.attackerStrategy).toBe(CombatStrategy.Aggressive);
    expect(report.defenderStrategy).toBe(CombatStrategy.Defensive);
  });
});
