import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { DeterministicRng } from '../../../src/core/rng.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { UnitType } from '../../../src/types/units.js';
import { ResourceType } from '../../../src/types/resources.js';
import { CombatSystem } from '../../../src/systems/combat-system.js';
import { UNIT_DEFINITIONS } from '../../../src/config/units.js';

describe('CombatSystem', () => {
  let gs: GameState;
  let rng: DeterministicRng;
  let system: CombatSystem;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
    rng = new DeterministicRng('test-seed');
    system = new CombatSystem();
  });

  describe('army food consumption', () => {
    it('should consume food for soldiers each tick', () => {
      const mutable = gs.getMutableState();
      mutable.army.units[UnitType.Soldier] = 5;

      const foodBefore = gs.getResource(ResourceType.Food);
      const expectedCost = 5 * UNIT_DEFINITIONS[UnitType.Soldier].foodPerTick; // 5 * 1 = 5

      system.process(gs, rng, 1);

      expect(gs.getResource(ResourceType.Food)).toBe(foodBefore - expectedCost);
    });

    it('should consume food for mixed army types', () => {
      const mutable = gs.getMutableState();
      mutable.army.units[UnitType.Soldier] = 3; // 3 * 1 = 3
      mutable.army.units[UnitType.Cavalry] = 2; // 2 * 2 = 4
      mutable.army.units[UnitType.Mage] = 1;    // 1 * 2 = 2
      // Total food cost = 9

      const foodBefore = gs.getResource(ResourceType.Food);
      system.process(gs, rng, 1);

      expect(gs.getResource(ResourceType.Food)).toBe(foodBefore - 9);
    });

    it('should not consume food when army is empty', () => {
      // Default army is all zeros
      const foodBefore = gs.getResource(ResourceType.Food);
      system.process(gs, rng, 1);

      expect(gs.getResource(ResourceType.Food)).toBe(foodBefore);
    });

    it('should kill weakest unit when food runs out', () => {
      const mutable = gs.getMutableState();
      mutable.resources[ResourceType.Food] = 0; // No food
      mutable.army.units[UnitType.Soldier] = 3; // HP: 100
      mutable.army.units[UnitType.Spy] = 2;     // HP: 50 (weakest)

      system.process(gs, rng, 1);

      // Spy should lose 1 unit (weakest by HP)
      expect(gs.getState().army.units[UnitType.Spy]).toBe(1);
      expect(gs.getState().army.units[UnitType.Soldier]).toBe(3);
      expect(gs.getResource(ResourceType.Food)).toBe(0);
    });

    it('should kill weakest unit type first when starving', () => {
      const mutable = gs.getMutableState();
      mutable.resources[ResourceType.Food] = 1; // Not enough for army
      mutable.army.units[UnitType.Soldier] = 2;  // HP: 100, foodPerTick: 1
      mutable.army.units[UnitType.Archer] = 2;   // HP: 70, foodPerTick: 1
      // Total cost = 4, only have 1

      system.process(gs, rng, 1);

      // Archer has lower HP, so it dies first
      expect(gs.getState().army.units[UnitType.Archer]).toBe(1);
      expect(gs.getState().army.units[UnitType.Soldier]).toBe(2);
      expect(gs.getResource(ResourceType.Food)).toBe(0);
    });

    it('should handle starvation over multiple ticks', () => {
      const mutable = gs.getMutableState();
      mutable.resources[ResourceType.Food] = 0;
      mutable.army.units[UnitType.Spy] = 2; // HP: 50

      // Tick 1: lose 1 spy
      system.process(gs, rng, 1);
      expect(gs.getState().army.units[UnitType.Spy]).toBe(1);

      // Tick 2: lose another spy
      system.process(gs, rng, 2);
      expect(gs.getState().army.units[UnitType.Spy]).toBe(0);

      // Tick 3: no units left, no crash
      system.process(gs, rng, 3);
      expect(gs.getState().army.units[UnitType.Spy]).toBe(0);
    });

    it('should consume food correctly for cavalry (2 food per tick)', () => {
      const mutable = gs.getMutableState();
      mutable.army.units[UnitType.Cavalry] = 4;

      const foodBefore = gs.getResource(ResourceType.Food);
      const expectedCost = 4 * UNIT_DEFINITIONS[UnitType.Cavalry].foodPerTick; // 4 * 2 = 8

      system.process(gs, rng, 1);

      expect(gs.getResource(ResourceType.Food)).toBe(foodBefore - expectedCost);
    });

    it('should not starve units if food exactly matches cost', () => {
      const mutable = gs.getMutableState();
      mutable.army.units[UnitType.Soldier] = 5; // cost: 5 * 1 = 5
      mutable.resources[ResourceType.Food] = 5;

      system.process(gs, rng, 1);

      expect(gs.getResource(ResourceType.Food)).toBe(0);
      expect(gs.getState().army.units[UnitType.Soldier]).toBe(5); // no starvation
    });
  });

  describe('defense bonus from active effects', () => {
    it('should return 0 defense bonus with no active effects', () => {
      const bonus = CombatSystem.getDefenseBonus(gs);
      expect(bonus).toBe(0);
    });

    it('should calculate defense bonus from defense_boost effects', () => {
      const mutable = gs.getMutableState();
      mutable.activeEffects.push({
        id: 'wall-bonus',
        type: 'defense_boost',
        modifier: 0.25,
        ticksRemaining: 100,
      });

      const bonus = CombatSystem.getDefenseBonus(gs);
      expect(bonus).toBeCloseTo(0.25);
    });

    it('should sum multiple defense_boost effects', () => {
      const mutable = gs.getMutableState();
      mutable.activeEffects.push(
        { id: 'wall-bonus', type: 'defense_boost', modifier: 0.25, ticksRemaining: 100 },
        { id: 'moat-bonus', type: 'defense_boost', modifier: 0.15, ticksRemaining: 50 },
      );

      const bonus = CombatSystem.getDefenseBonus(gs);
      expect(bonus).toBeCloseTo(0.40);
    });

    it('should ignore non-defense effects', () => {
      const mutable = gs.getMutableState();
      mutable.activeEffects.push(
        { id: 'production', type: 'production_boost', modifier: 0.5, ticksRemaining: 100 },
        { id: 'wall', type: 'defense_boost', modifier: 0.2, ticksRemaining: 100 },
        { id: 'research', type: 'research_boost', modifier: 0.3, ticksRemaining: 100 },
      );

      const bonus = CombatSystem.getDefenseBonus(gs);
      expect(bonus).toBeCloseTo(0.2);
    });
  });
});
