import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { DeterministicRng } from '../../../src/core/rng.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { BuildingId } from '../../../src/types/buildings.js';
import { ResourceType } from '../../../src/types/resources.js';
import { ResourceSystem } from '../../../src/systems/resource-system.js';
import { FOOD_PER_CITIZEN } from '../../../src/config/constants.js';

describe('ResourceSystem', () => {
  let gs: GameState;
  let rng: DeterministicRng;
  let system: ResourceSystem;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
    rng = new DeterministicRng('test-seed');
    system = new ResourceSystem();
  });

  describe('production calculation', () => {
    it('should produce food from a completed Granja', () => {
      // Granja produces 5 food base; Forest biome food modifier = 1.3; legacy = 1.0
      // Production = 5 * 1 * (1+0) * 1.0 * 1.3 = 6.5
      gs.addBuilding({ id: BuildingId.Granja, level: 1, constructionTicksRemaining: 0 });

      const foodBefore = gs.getResource(ResourceType.Food);
      system.process(gs, rng, 1);

      // Food after = foodBefore + production - foodConsumption
      // foodConsumption = population(10) * 2 = 20
      const expectedProduction = 5 * 1 * 1.0 * 1.3; // 6.5
      const expectedConsumption = 10 * FOOD_PER_CITIZEN; // 20
      const expectedFood = foodBefore + expectedProduction - expectedConsumption;
      expect(gs.getResource(ResourceType.Food)).toBeCloseTo(expectedFood, 5);
    });

    it('should produce wood from a completed Aserradero', () => {
      // Aserradero produces 4 wood base; Forest biome wood modifier = 1.5; legacy = 1.0
      gs.addBuilding({ id: BuildingId.Aserradero, level: 1, constructionTicksRemaining: 0 });

      const woodBefore = gs.getResource(ResourceType.Wood);
      system.process(gs, rng, 1);

      const expectedProduction = 4 * 1 * 1.0 * 1.5; // 6
      expect(gs.getResource(ResourceType.Wood)).toBeCloseTo(woodBefore + expectedProduction, 5);
    });

    it('should scale production with building level', () => {
      gs.addBuilding({ id: BuildingId.Aserradero, level: 3, constructionTicksRemaining: 0 });

      const woodBefore = gs.getResource(ResourceType.Wood);
      system.process(gs, rng, 1);

      // Production = 4 * 3 * 1.0 * 1.5 = 18
      const expectedProduction = 4 * 3 * 1.0 * 1.5;
      expect(gs.getResource(ResourceType.Wood)).toBeCloseTo(woodBefore + expectedProduction, 5);
    });

    it('should not produce from buildings still under construction', () => {
      gs.addBuilding({ id: BuildingId.Aserradero, level: 1, constructionTicksRemaining: 3 });

      const woodBefore = gs.getResource(ResourceType.Wood);
      system.process(gs, rng, 1);

      // No production, only food consumption
      expect(gs.getResource(ResourceType.Wood)).toBe(woodBefore);
    });

    it('should produce multiple resources from Mina', () => {
      // Mina produces stone:3, iron:1
      gs.addBuilding({ id: BuildingId.Mina, level: 1, constructionTicksRemaining: 0 });

      const stoneBefore = gs.getResource(ResourceType.Stone);
      const ironBefore = gs.getResource(ResourceType.Iron);
      system.process(gs, rng, 1);

      // Forest: stone modifier = 0.8, iron modifier = 0.7
      const expectedStone = 3 * 1 * 1.0 * 0.8; // 2.4
      const expectedIron = 1 * 1 * 1.0 * 0.7; // 0.7
      expect(gs.getResource(ResourceType.Stone)).toBeCloseTo(stoneBefore + expectedStone, 5);
      expect(gs.getResource(ResourceType.Iron)).toBeCloseTo(ironBefore + expectedIron, 5);
    });

    it('should apply legacy multiplier from prestige', () => {
      const mutableState = gs.getMutableState();
      mutableState.prestige.legacyMultiplier = 1.5;

      gs.addBuilding({ id: BuildingId.Aserradero, level: 1, constructionTicksRemaining: 0 });

      const woodBefore = gs.getResource(ResourceType.Wood);
      system.process(gs, rng, 1);

      // Production = 4 * 1 * 1.0 * 1.5 * 1.5 = 9
      const expectedProduction = 4 * 1 * 1.0 * 1.5 * 1.5;
      expect(gs.getResource(ResourceType.Wood)).toBeCloseTo(woodBefore + expectedProduction, 5);
    });
  });

  describe('food consumption', () => {
    it('should consume food based on population', () => {
      // Population is 10, FOOD_PER_CITIZEN = 2, so 20 food consumed
      const foodBefore = gs.getResource(ResourceType.Food); // 100
      system.process(gs, rng, 1);

      expect(gs.getResource(ResourceType.Food)).toBe(foodBefore - 20);
    });

    it('should set food to 0 and reduce happiness when food is insufficient', () => {
      const mutableState = gs.getMutableState();
      mutableState.resources[ResourceType.Food] = 5; // less than 20 needed
      const happinessBefore = mutableState.population.happiness;

      system.process(gs, rng, 1);

      expect(gs.getResource(ResourceType.Food)).toBe(0);
      expect(gs.getState().population.happiness).toBe(happinessBefore - 10);
    });

    it('should not reduce happiness below 0', () => {
      const mutableState = gs.getMutableState();
      mutableState.resources[ResourceType.Food] = 0;
      mutableState.population.happiness = 5;

      system.process(gs, rng, 1);

      expect(gs.getState().population.happiness).toBe(0);
    });
  });

  describe('storage caps', () => {
    it('should cap resources at storage limit', () => {
      // Set wood near cap
      const mutableState = gs.getMutableState();
      mutableState.resources[ResourceType.Wood] = 498;
      mutableState.resourceStorage[ResourceType.Wood] = 500;

      // Aserradero at Forest biome produces 4*1*1.0*1.5 = 6 wood
      gs.addBuilding({ id: BuildingId.Aserradero, level: 1, constructionTicksRemaining: 0 });

      system.process(gs, rng, 1);

      // Should be capped at 500, not 504
      expect(gs.getResource(ResourceType.Wood)).toBe(500);
    });
  });
});
