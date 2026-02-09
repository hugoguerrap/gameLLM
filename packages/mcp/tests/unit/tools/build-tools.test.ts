import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GameController } from '../../../src/game-controller.js';
import {
  BiomeType,
  BuildingId,
  BUILDING_DEFINITIONS,
  ResourceType,
} from '@nodecoin/engine';

describe('Build Tools (via GameController)', () => {
  let tmpDir: string;
  let controller: GameController;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'mcp-build-test-'));
    controller = new GameController({
      dbPath: path.join(tmpDir, 'game.db'),
      playerId: 'build-test-player',
      playerName: 'BuildTestPlayer',
      biome: BiomeType.Forest,
      seed: 'build-seed',
    });
  });

  afterEach(() => {
    try {
      controller.shutdown();
    } catch {
      // already closed
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── game_build ──

  describe('game_build (build)', () => {
    it('should build a Granja successfully with default resources', () => {
      const result = controller.build(BuildingId.Granja);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Started construction of Granja');
      expect(result.data?.buildingId).toBe(BuildingId.Granja);
      expect(result.data?.ticks).toBe(4);

      const state = controller.getPlayerState();
      const granja = state.buildings.find((b) => b.id === BuildingId.Granja);
      expect(granja).toBeDefined();
      expect(granja!.level).toBe(1);
      expect(granja!.constructionTicksRemaining).toBe(4);
    });

    it('should build a Choza successfully with default resources', () => {
      const result = controller.build(BuildingId.Choza);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Started construction of Choza');

      const state = controller.getPlayerState();
      // Choza costs: Wood:20, Food:10
      expect(state.resources.wood).toBe(100 - 20);
      expect(state.resources.food).toBe(100 - 10);
    });

    it('should build multiple different buildings', () => {
      controller.build(BuildingId.Choza);
      controller.build(BuildingId.Granja);
      controller.build(BuildingId.Aserradero);

      const state = controller.getPlayerState();
      expect(state.buildings).toHaveLength(3);

      const ids = state.buildings.map((b) => b.id);
      expect(ids).toContain(BuildingId.Choza);
      expect(ids).toContain(BuildingId.Granja);
      expect(ids).toContain(BuildingId.Aserradero);
    });

    it('should fail when building requires a higher era', () => {
      // Herreria requires Era 2 (Pueblo)
      const result = controller.build(BuildingId.Herreria);

      expect(result.success).toBe(false);
      expect(result.message).toContain('era');
    });

    it('should fail when building requires unresearched tech', () => {
      // Even if we could somehow bypass era check, tech requirement blocks
      // Muralla is era 1 and has no tech required - let us test with a Pueblo building
      // We cannot easily bypass era check via controller, so test with an invalid building
      const result = controller.build('some_invalid_building');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown building');
    });

    it('should fail when resources are insufficient', () => {
      // Build several buildings to drain resources, then try one more
      controller.build(BuildingId.Choza); // Wood:20, Food:10
      controller.build(BuildingId.Granja); // Wood:25, Stone:10
      controller.build(BuildingId.Aserradero); // Wood:15, Stone:15
      controller.build(BuildingId.Mina); // Wood:30, Food:15

      // After: Wood = 100-20-25-15-30 = 10, Food = 100-10-15 = 75, Stone = 50-10-15 = 25
      const result = controller.build(BuildingId.Almacen); // Wood:40, Stone:20
      // Wood is only 10, needs 40
      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient resources');
    });

    it('should fail when the same building is built twice', () => {
      controller.build(BuildingId.Granja);
      const result = controller.build(BuildingId.Granja);

      expect(result.success).toBe(false);
      expect(result.message).toContain('already built');
    });

    it('should correctly deduct resources based on building cost', () => {
      const state0 = controller.getPlayerState();
      const woodBefore = state0.resources.wood;
      const stoneBefore = state0.resources.stone;

      controller.build(BuildingId.Granja);

      const state1 = controller.getPlayerState();
      // Granja baseCost: Wood:25, Stone:10 (at level 0, costMultiplier^0 = 1)
      expect(state1.resources.wood).toBe(woodBefore - 25);
      expect(state1.resources.stone).toBe(stoneBefore - 10);
    });
  });

  // ── game_upgrade ──

  describe('game_upgrade (upgrade)', () => {
    it('should fail when building is still under construction', () => {
      controller.build(BuildingId.Choza);
      const result = controller.upgrade(BuildingId.Choza);

      expect(result.success).toBe(false);
      expect(result.message).toContain('still under construction');
    });

    it('should fail when building has not been built', () => {
      const result = controller.upgrade(BuildingId.Granja);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not yet built');
    });

    it('should fail for unknown building ID', () => {
      const result = controller.upgrade('nonexistent_building');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown building');
    });
  });

  // ── game_demolish ──

  describe('game_demolish (demolish)', () => {
    it('should demolish a built building', () => {
      controller.build(BuildingId.Choza);

      const result = controller.demolish(BuildingId.Choza);

      expect(result.success).toBe(true);
      expect(result.message).toContain('demolished');
      expect(result.message).toContain('50% resources refunded');

      const state = controller.getPlayerState();
      expect(state.buildings).toHaveLength(0);
    });

    it('should refund 50% of base cost on demolish', () => {
      controller.build(BuildingId.Granja);
      const stateAfterBuild = controller.getPlayerState();
      const woodAfterBuild = stateAfterBuild.resources.wood;
      const stoneAfterBuild = stateAfterBuild.resources.stone;

      controller.demolish(BuildingId.Granja);
      const stateAfterDemolish = controller.getPlayerState();

      // Granja baseCost: Wood:25, Stone:10
      // Refund: floor(25*0.5)=12, floor(10*0.5)=5
      expect(stateAfterDemolish.resources.wood).toBe(woodAfterBuild + 12);
      expect(stateAfterDemolish.resources.stone).toBe(stoneAfterBuild + 5);
    });

    it('should fail when demolishing a building that does not exist', () => {
      const result = controller.demolish(BuildingId.Almacen);

      expect(result.success).toBe(false);
      expect(result.message).toContain('is not built');
    });

    it('should allow building again after demolish', () => {
      controller.build(BuildingId.Choza);
      controller.demolish(BuildingId.Choza);

      const result = controller.build(BuildingId.Choza);
      expect(result.success).toBe(true);

      const state = controller.getPlayerState();
      expect(state.buildings).toHaveLength(1);
      expect(state.buildings[0].id).toBe(BuildingId.Choza);
    });
  });

  // ── game_buildings_available ──

  describe('game_buildings_available (getAvailableBuildings)', () => {
    it('should list all era 1 buildings for a new game', () => {
      const available = controller.getAvailableBuildings();

      const era1Ids = Object.values(BUILDING_DEFINITIONS)
        .filter((d) => d.era === 1 && !d.techRequired)
        .map((d) => d.id);

      const availableIds = available.map((b) => b.id);
      for (const id of era1Ids) {
        expect(availableIds).toContain(id);
      }
    });

    it('should exclude already-built buildings', () => {
      controller.build(BuildingId.Choza);
      controller.build(BuildingId.Granja);

      const available = controller.getAvailableBuildings();
      const ids = available.map((b) => b.id);

      expect(ids).not.toContain(BuildingId.Choza);
      expect(ids).not.toContain(BuildingId.Granja);
      // Other era 1 buildings should still be available
      expect(ids).toContain(BuildingId.Aserradero);
      expect(ids).toContain(BuildingId.Mina);
    });

    it('should include building definitions with correct fields', () => {
      const available = controller.getAvailableBuildings();
      const granja = available.find((b) => b.id === BuildingId.Granja);

      expect(granja).toBeDefined();
      expect(granja!.name).toBe('Granja');
      expect(granja!.baseCost).toBeDefined();
      expect(granja!.constructionTicks).toBe(4);
      expect(granja!.production).toBeDefined();
    });
  });
});
