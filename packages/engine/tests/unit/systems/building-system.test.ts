import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { DeterministicRng } from '../../../src/core/rng.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { BuildingId } from '../../../src/types/buildings.js';
import { ResourceType } from '../../../src/types/resources.js';
import { BuildingSystem } from '../../../src/systems/building-system.js';

describe('BuildingSystem', () => {
  let gs: GameState;
  let rng: DeterministicRng;
  let system: BuildingSystem;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
    rng = new DeterministicRng('test-seed');
    system = new BuildingSystem();
  });

  describe('construction countdown', () => {
    it('should decrement constructionTicksRemaining for active buildings', () => {
      gs.addBuilding({ id: BuildingId.Granja, level: 1, constructionTicksRemaining: 3 });

      system.process(gs, rng, 1);

      const building = gs.getBuilding(BuildingId.Granja);
      expect(building?.constructionTicksRemaining).toBe(2);
    });

    it('should decrement constructionTicksRemaining to 0', () => {
      gs.addBuilding({ id: BuildingId.Granja, level: 1, constructionTicksRemaining: 1 });

      system.process(gs, rng, 1);

      const building = gs.getBuilding(BuildingId.Granja);
      expect(building?.constructionTicksRemaining).toBe(0);
    });

    it('should not decrement below 0 for completed buildings', () => {
      gs.addBuilding({ id: BuildingId.Granja, level: 1, constructionTicksRemaining: 0 });

      system.process(gs, rng, 1);

      const building = gs.getBuilding(BuildingId.Granja);
      expect(building?.constructionTicksRemaining).toBe(0);
    });
  });

  describe('queue to active', () => {
    it('should move completed queue item to buildings', () => {
      const mutableState = gs.getMutableState();
      mutableState.buildQueue.push({
        id: BuildingId.Aserradero,
        level: 1,
        constructionTicksRemaining: 1,
      });

      system.process(gs, rng, 1);

      // Should be in buildings now
      const building = gs.getBuilding(BuildingId.Aserradero);
      expect(building).toBeDefined();
      expect(building?.level).toBe(1);
      expect(building?.constructionTicksRemaining).toBe(0);

      // Should be removed from queue
      expect(mutableState.buildQueue.length).toBe(0);
    });

    it('should merge with existing building when queue item completes', () => {
      gs.addBuilding({ id: BuildingId.Granja, level: 1, constructionTicksRemaining: 0 });

      const mutableState = gs.getMutableState();
      mutableState.buildQueue.push({
        id: BuildingId.Granja,
        level: 2,
        constructionTicksRemaining: 1,
      });

      system.process(gs, rng, 1);

      const building = gs.getBuilding(BuildingId.Granja);
      expect(building?.level).toBe(2);
      expect(building?.constructionTicksRemaining).toBe(0);
      expect(mutableState.buildQueue.length).toBe(0);
    });

    it('should not move queue items that are still constructing', () => {
      const mutableState = gs.getMutableState();
      mutableState.buildQueue.push({
        id: BuildingId.Mina,
        level: 1,
        constructionTicksRemaining: 3,
      });

      system.process(gs, rng, 1);

      expect(gs.getBuilding(BuildingId.Mina)).toBeUndefined();
      expect(mutableState.buildQueue.length).toBe(1);
      expect(mutableState.buildQueue[0].constructionTicksRemaining).toBe(2);
    });

    it('should handle multiple queue items completing at once', () => {
      const mutableState = gs.getMutableState();
      mutableState.buildQueue.push(
        { id: BuildingId.Granja, level: 1, constructionTicksRemaining: 1 },
        { id: BuildingId.Aserradero, level: 1, constructionTicksRemaining: 1 },
      );

      system.process(gs, rng, 1);

      expect(gs.getBuilding(BuildingId.Granja)).toBeDefined();
      expect(gs.getBuilding(BuildingId.Aserradero)).toBeDefined();
      expect(mutableState.buildQueue.length).toBe(0);
    });
  });

  describe('storage bonus', () => {
    it('should add storage bonus from Almacen', () => {
      // Almacen has storageBonus: 200
      gs.addBuilding({ id: BuildingId.Almacen, level: 1, constructionTicksRemaining: 0 });

      system.process(gs, rng, 1);

      // Base wood storage = 500, bonus = 200*1 = 200, total = 700
      expect(gs.getStorage(ResourceType.Wood)).toBe(700);
      // Base food storage = 500, bonus = 200, total = 700
      expect(gs.getStorage(ResourceType.Food)).toBe(700);
      // Base iron storage = 200, bonus = 200, total = 400
      expect(gs.getStorage(ResourceType.Iron)).toBe(400);
    });

    it('should scale storage bonus with building level', () => {
      gs.addBuilding({ id: BuildingId.Almacen, level: 3, constructionTicksRemaining: 0 });

      system.process(gs, rng, 1);

      // Base wood storage = 500, bonus = 200*3 = 600, total = 1100
      expect(gs.getStorage(ResourceType.Wood)).toBe(1100);
    });

    it('should not add storage bonus from buildings under construction', () => {
      gs.addBuilding({ id: BuildingId.Almacen, level: 1, constructionTicksRemaining: 2 });

      system.process(gs, rng, 1);

      // No bonus applied - base storage only
      expect(gs.getStorage(ResourceType.Wood)).toBe(500);
    });

    it('should reset storage when buildings change', () => {
      // First tick: Almacen level 1
      gs.addBuilding({ id: BuildingId.Almacen, level: 1, constructionTicksRemaining: 0 });
      system.process(gs, rng, 1);
      expect(gs.getStorage(ResourceType.Wood)).toBe(700);

      // Storage is recalculated each tick from base + bonus
      // So the value stays correct
      system.process(gs, rng, 2);
      expect(gs.getStorage(ResourceType.Wood)).toBe(700);
    });
  });
});
