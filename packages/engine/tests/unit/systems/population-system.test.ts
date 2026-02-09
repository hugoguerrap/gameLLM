import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { DeterministicRng } from '../../../src/core/rng.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { BuildingId } from '../../../src/types/buildings.js';
import { ResourceType } from '../../../src/types/resources.js';
import { PopulationSystem } from '../../../src/systems/population-system.js';
import { calculateFoodForGrowth } from '../../../src/config/formulas.js';

describe('PopulationSystem', () => {
  let gs: GameState;
  let rng: DeterministicRng;
  let system: PopulationSystem;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
    rng = new DeterministicRng('test-seed');
    system = new PopulationSystem();
  });

  describe('max population', () => {
    it('should default to 20 when no chozas exist', () => {
      system.process(gs, rng, 1);
      expect(gs.getState().population.max).toBe(20);
    });

    it('should calculate max from choza levels', () => {
      // Choza level 2 = 2 * 5 = 10
      gs.addBuilding({ id: BuildingId.Choza, level: 2, constructionTicksRemaining: 0 });

      system.process(gs, rng, 1);
      expect(gs.getState().population.max).toBe(10);
    });

    it('should not count chozas under construction', () => {
      gs.addBuilding({ id: BuildingId.Choza, level: 3, constructionTicksRemaining: 2 });

      system.process(gs, rng, 1);
      // No completed chozas, should default to 20
      expect(gs.getState().population.max).toBe(20);
    });
  });

  describe('population growth', () => {
    it('should grow by 1 when food exceeds growth cost and below max', () => {
      const mutableState = gs.getMutableState();
      mutableState.population.current = 5;
      mutableState.population.max = 20;

      // Need food > calculateFoodForGrowth(5)
      // = ceil(15 + 8*4 + 4^1.5) = ceil(15 + 32 + 8) = 55
      const foodNeeded = calculateFoodForGrowth(5);
      mutableState.resources[ResourceType.Food] = foodNeeded + 10;

      system.process(gs, rng, 1);

      expect(gs.getState().population.current).toBe(6);
    });

    it('should deduct food cost when growing', () => {
      const mutableState = gs.getMutableState();
      mutableState.population.current = 5;
      mutableState.population.max = 20;

      const foodNeeded = calculateFoodForGrowth(5);
      mutableState.resources[ResourceType.Food] = foodNeeded + 10;

      system.process(gs, rng, 1);

      expect(gs.getResource(ResourceType.Food)).toBe(10);
    });

    it('should not grow when food is insufficient', () => {
      const mutableState = gs.getMutableState();
      mutableState.population.current = 10;

      const foodNeeded = calculateFoodForGrowth(10);
      mutableState.resources[ResourceType.Food] = foodNeeded - 1; // not enough

      system.process(gs, rng, 1);

      expect(gs.getState().population.current).toBe(10);
    });

    it('should not grow beyond max population', () => {
      const mutableState = gs.getMutableState();
      mutableState.population.current = 20;
      mutableState.population.max = 20;
      mutableState.resources[ResourceType.Food] = 9999;

      // Add a choza to keep max at 20
      gs.addBuilding({ id: BuildingId.Choza, level: 4, constructionTicksRemaining: 0 });

      system.process(gs, rng, 1);

      expect(gs.getState().population.current).toBe(20);
    });
  });

  describe('population decline', () => {
    it('should lose 1 population when happiness < 20 and pop > 5', () => {
      const mutableState = gs.getMutableState();
      mutableState.population.current = 10;
      mutableState.population.happiness = 15; // below 20
      mutableState.resources[ResourceType.Food] = 0; // prevent growth

      system.process(gs, rng, 1);

      // Happiness is recalculated during process, so we need to check
      // if the decline condition was met before recalculation.
      // The happiness check uses the *current* happiness value at process time.
      // Starting happiness is 15, which is < 20 and pop is 10 > 5, so decline happens.
      expect(gs.getState().population.current).toBe(9);
    });

    it('should not lose population when pop <= 5 even with low happiness', () => {
      const mutableState = gs.getMutableState();
      mutableState.population.current = 5;
      mutableState.population.happiness = 10;
      mutableState.resources[ResourceType.Food] = 0;

      system.process(gs, rng, 1);

      expect(gs.getState().population.current).toBe(5);
    });
  });

  describe('happiness calculation', () => {
    it('should have base happiness of 50', () => {
      system.process(gs, rng, 1);
      // Base 50, minus 5 if food < 50% storage
      // Initial food is 100, storage is 500, 100 < 250 = true, so -5
      expect(gs.getState().population.happiness).toBe(45);
    });

    it('should add happiness bonus from completed buildings', () => {
      // Choza has happinessBonus: 1, populationCapacity: 5 per level
      // Need enough choza capacity so population (10) is not overcrowded
      gs.addBuilding({ id: BuildingId.Choza, level: 3, constructionTicksRemaining: 0 }); // max = 15
      // Mercado has happinessBonus: 3
      gs.addBuilding({ id: BuildingId.Mercado, level: 1, constructionTicksRemaining: 0 });

      // Set food high enough that even after growth deduction it stays above 50% storage
      // Pop=10, max=15, foodForGrowth(10)=114, so set food to 500 (after growth: 386 > 250)
      const mutableState = gs.getMutableState();
      mutableState.resources[ResourceType.Food] = 500;

      system.process(gs, rng, 1);

      // Base 50 + 1 (Choza) + 3 (Mercado) = 54
      // Pop grew from 10 to 11, food = 500 - 114 = 386 > 250, no food penalty
      // Pop 11 <= max 15, no overcrowding
      expect(gs.getState().population.happiness).toBe(54);
    });

    it('should penalize -5 when food is below 50% storage', () => {
      const mutableState = gs.getMutableState();
      mutableState.resources[ResourceType.Food] = 100; // 100 < 500 * 0.5 = 250

      system.process(gs, rng, 1);

      // Base 50 - 5 = 45
      expect(gs.getState().population.happiness).toBe(45);
    });

    it('should not penalize food when above 50% storage', () => {
      const mutableState = gs.getMutableState();
      // Pop=10, max=20 (default no chozas). foodForGrowth(10)=114
      // After growth: food = 500 - 114 = 386. 386 > 250. No food penalty.
      mutableState.resources[ResourceType.Food] = 500;

      system.process(gs, rng, 1);

      // Base 50, no buildings, no food penalty, not overcrowded (11 <= 20)
      expect(gs.getState().population.happiness).toBe(50);
    });

    it('should penalize -10 when overcrowded', () => {
      const mutableState = gs.getMutableState();
      mutableState.population.current = 25;
      mutableState.population.max = 20;
      mutableState.resources[ResourceType.Food] = 300; // above 50% to avoid food penalty

      system.process(gs, rng, 1);

      // Base 50 - 10 (overcrowded) = 40
      // Note: max gets recalculated, no chozas defaults to 20, 25 > 20 = overcrowded
      expect(gs.getState().population.happiness).toBe(40);
    });

    it('should clamp happiness to 0-100', () => {
      // Force very negative happiness scenario
      const mutableState = gs.getMutableState();
      mutableState.population.current = 25;
      mutableState.resources[ResourceType.Food] = 0;

      system.process(gs, rng, 1);

      const happiness = gs.getState().population.happiness;
      expect(happiness).toBeGreaterThanOrEqual(0);
      expect(happiness).toBeLessThanOrEqual(100);
    });
  });
});
