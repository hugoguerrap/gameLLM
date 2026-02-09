import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { BuildingId } from '../../../src/types/buildings.js';
import { UnitType, CombatStrategy } from '../../../src/types/units.js';
import { ResourceType } from '../../../src/types/resources.js';
import { RecruitCommand, SetStrategyCommand } from '../../../src/commands/military-commands.js';

describe('RecruitCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
  });

  it('should fail without a Cuartel (Barracks)', () => {
    const cmd = new RecruitCommand(UnitType.Soldier, 1);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Cuartel');
  });

  it('should succeed with barracks and sufficient resources', () => {
    // Add a Cuartel to the game state
    gs.addBuilding({
      id: BuildingId.Cuartel,
      level: 1,
      constructionTicksRemaining: 0,
    });

    // Soldier costs: Food=20, Iron=10. Starting: Food=100, Iron=20
    const cmd = new RecruitCommand(UnitType.Soldier, 2);
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Recruited 2 Soldado(s)');
    expect(result.data?.unitType).toBe(UnitType.Soldier);
    expect(result.data?.count).toBe(2);

    // Verify units added
    const state = gs.getState();
    expect(state.army.units[UnitType.Soldier]).toBe(2);

    // Verify resources deducted: Food=100-40=60, Iron=20-20=0
    expect(state.resources[ResourceType.Food]).toBe(60);
    expect(state.resources[ResourceType.Iron]).toBe(0);
  });

  it('should fail with insufficient resources', () => {
    gs.addBuilding({
      id: BuildingId.Cuartel,
      level: 1,
      constructionTicksRemaining: 0,
    });

    // Try to recruit 10 soldiers: needs Food=200, Iron=100 (way more than starting resources)
    const cmd = new RecruitCommand(UnitType.Soldier, 10);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient resources');

    // No units should be added
    expect(gs.getState().army.units[UnitType.Soldier]).toBe(0);
  });

  it('should recruit a single unit by default', () => {
    gs.addBuilding({
      id: BuildingId.Cuartel,
      level: 1,
      constructionTicksRemaining: 0,
    });

    const cmd = new RecruitCommand(UnitType.Archer);
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(gs.getState().army.units[UnitType.Archer]).toBe(1);
  });
});

describe('SetStrategyCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
  });

  it('should change the army strategy', () => {
    // Default strategy is Balanced
    expect(gs.getState().army.strategy).toBe(CombatStrategy.Balanced);

    const cmd = new SetStrategyCommand(CombatStrategy.Aggressive);
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('aggressive');
    expect(gs.getState().army.strategy).toBe(CombatStrategy.Aggressive);
  });

  it('should support all strategy types', () => {
    for (const strategy of [
      CombatStrategy.Aggressive,
      CombatStrategy.Defensive,
      CombatStrategy.Balanced,
      CombatStrategy.Guerrilla,
    ]) {
      const cmd = new SetStrategyCommand(strategy);
      const result = cmd.execute(gs);
      expect(result.success).toBe(true);
      expect(gs.getState().army.strategy).toBe(strategy);
    }
  });
});
