import { describe, it, expect } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { ResourceType } from '../../../src/types/resources.js';
import { BuildingId } from '../../../src/types/buildings.js';

describe('GameState', () => {
  describe('createNew()', () => {
    it('should create a new game state with initial values', () => {
      const gs = GameState.createNew('player-1', 'TestPlayer', BiomeType.Forest);
      const state = gs.getState();

      expect(state.id).toBe('player-1');
      expect(state.name).toBe('TestPlayer');
      expect(state.biome).toBe(BiomeType.Forest);
      expect(state.tick).toBe(0);
    });

    it('should start with initial resources', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Mountain);
      expect(gs.getResource(ResourceType.Wood)).toBe(100);
      expect(gs.getResource(ResourceType.Food)).toBe(100);
      expect(gs.getResource(ResourceType.Stone)).toBe(50);
      expect(gs.getResource(ResourceType.Iron)).toBe(20);
      expect(gs.getResource(ResourceType.Gems)).toBe(5);
      expect(gs.getResource(ResourceType.Mana)).toBe(0);
    });

    it('should start with initial storage values', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Prairie);
      expect(gs.getStorage(ResourceType.Wood)).toBe(500);
      expect(gs.getStorage(ResourceType.Food)).toBe(500);
      expect(gs.getStorage(ResourceType.Stone)).toBe(300);
      expect(gs.getStorage(ResourceType.Iron)).toBe(200);
      expect(gs.getStorage(ResourceType.Gems)).toBe(100);
      expect(gs.getStorage(ResourceType.Mana)).toBe(50);
    });

    it('should start with empty buildings', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Desert);
      expect(gs.getState().buildings).toEqual([]);
    });
  });

  describe('serialize() / deserialize()', () => {
    it('should round-trip state through JSON serialization', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Coast);
      gs.addResource(ResourceType.Wood, 50);
      gs.setTick(42);

      const json = gs.serialize();
      const restored = GameState.deserialize(json);

      expect(restored.getState().id).toBe('p1');
      expect(restored.getState().name).toBe('Test');
      expect(restored.getResource(ResourceType.Wood)).toBe(150);
      expect(restored.getTick()).toBe(42);
    });

    it('should produce valid JSON', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      const json = gs.serialize();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should preserve buildings through serialization', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      gs.addBuilding({ id: BuildingId.Choza, level: 3, constructionTicksRemaining: 0 });

      const restored = GameState.deserialize(gs.serialize());
      expect(restored.getBuildingLevel(BuildingId.Choza)).toBe(3);
    });
  });

  describe('resource helpers', () => {
    it('addResource should increase resource amount', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      const initial = gs.getResource(ResourceType.Wood);
      gs.addResource(ResourceType.Wood, 50);
      expect(gs.getResource(ResourceType.Wood)).toBe(initial + 50);
    });

    it('addResource should cap at storage limit', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      const storage = gs.getStorage(ResourceType.Wood); // 500
      gs.addResource(ResourceType.Wood, 10000);
      expect(gs.getResource(ResourceType.Wood)).toBe(storage);
    });

    it('removeResource should decrease resource amount', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      const initial = gs.getResource(ResourceType.Wood); // 100
      const result = gs.removeResource(ResourceType.Wood, 30);
      expect(result).toBe(true);
      expect(gs.getResource(ResourceType.Wood)).toBe(initial - 30);
    });

    it('removeResource should return false if insufficient resources', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      const result = gs.removeResource(ResourceType.Wood, 999);
      expect(result).toBe(false);
      // Resource should not be changed
      expect(gs.getResource(ResourceType.Wood)).toBe(100);
    });

    it('hasResources should return true when all costs are met', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      expect(gs.hasResources({ [ResourceType.Wood]: 50, [ResourceType.Food]: 50 })).toBe(true);
    });

    it('hasResources should return false when any cost is not met', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      expect(gs.hasResources({ [ResourceType.Wood]: 50, [ResourceType.Gems]: 999 })).toBe(false);
    });

    it('hasResources should return true for empty costs', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      expect(gs.hasResources({})).toBe(true);
    });

    it('hasResources should ignore zero or undefined costs', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      expect(gs.hasResources({ [ResourceType.Wood]: 0 })).toBe(true);
    });

    it('deductResources should subtract all costs when affordable', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      const result = gs.deductResources({ [ResourceType.Wood]: 30, [ResourceType.Food]: 20 });
      expect(result).toBe(true);
      expect(gs.getResource(ResourceType.Wood)).toBe(70);
      expect(gs.getResource(ResourceType.Food)).toBe(80);
    });

    it('deductResources should not subtract anything when unaffordable', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      const result = gs.deductResources({ [ResourceType.Wood]: 30, [ResourceType.Gems]: 999 });
      expect(result).toBe(false);
      // Wood should remain untouched since the whole operation failed
      expect(gs.getResource(ResourceType.Wood)).toBe(100);
      expect(gs.getResource(ResourceType.Gems)).toBe(5);
    });
  });

  describe('building helpers', () => {
    it('getBuilding should return undefined when building does not exist', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      expect(gs.getBuilding(BuildingId.Choza)).toBeUndefined();
    });

    it('getBuildingLevel should return 0 when building does not exist', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      expect(gs.getBuildingLevel(BuildingId.Choza)).toBe(0);
    });

    it('addBuilding should add a new building', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      gs.addBuilding({ id: BuildingId.Choza, level: 1, constructionTicksRemaining: 5 });

      const building = gs.getBuilding(BuildingId.Choza);
      expect(building).toBeDefined();
      expect(building!.level).toBe(1);
      expect(building!.constructionTicksRemaining).toBe(5);
    });

    it('addBuilding should update an existing building', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      gs.addBuilding({ id: BuildingId.Granja, level: 1, constructionTicksRemaining: 0 });
      gs.addBuilding({ id: BuildingId.Granja, level: 2, constructionTicksRemaining: 3 });

      expect(gs.getBuildingLevel(BuildingId.Granja)).toBe(2);
      expect(gs.getBuilding(BuildingId.Granja)!.constructionTicksRemaining).toBe(3);
      // Should not duplicate
      expect(gs.getState().buildings.filter(b => b.id === BuildingId.Granja)).toHaveLength(1);
    });

    it('should support multiple different buildings', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      gs.addBuilding({ id: BuildingId.Choza, level: 2, constructionTicksRemaining: 0 });
      gs.addBuilding({ id: BuildingId.Granja, level: 1, constructionTicksRemaining: 0 });
      gs.addBuilding({ id: BuildingId.Mina, level: 3, constructionTicksRemaining: 0 });

      expect(gs.getBuildingLevel(BuildingId.Choza)).toBe(2);
      expect(gs.getBuildingLevel(BuildingId.Granja)).toBe(1);
      expect(gs.getBuildingLevel(BuildingId.Mina)).toBe(3);
      expect(gs.getState().buildings).toHaveLength(3);
    });
  });

  describe('research helpers', () => {
    it('hasResearched should return false when tech is not completed', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      expect(gs.hasResearched('agriculture')).toBe(false);
    });

    it('hasResearched should return true when tech is completed', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      gs.getMutableState().research.completed.push('agriculture');
      expect(gs.hasResearched('agriculture')).toBe(true);
    });
  });

  describe('tick management', () => {
    it('should start at tick 0', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      expect(gs.getTick()).toBe(0);
    });

    it('setTick should update both tick and lastTickProcessed', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      gs.setTick(42);
      expect(gs.getTick()).toBe(42);
      expect(gs.getState().lastTickProcessed).toBe(42);
    });
  });

  describe('getMutableState()', () => {
    it('should return a mutable reference to the internal state', () => {
      const gs = GameState.createNew('p1', 'Test', BiomeType.Forest);
      const mutable = gs.getMutableState();
      mutable.tokens = 999;
      expect(gs.getState().tokens).toBe(999);
    });
  });
});
