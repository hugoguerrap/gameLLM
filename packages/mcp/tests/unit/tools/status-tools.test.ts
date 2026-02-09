import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GameController } from '../../../src/game-controller.js';
import { createMcpServer } from '../../../src/server.js';
import {
  BiomeType,
  BuildingId,
  CombatStrategy,
  UnitType,
} from '@nodecoin/engine';

describe('Status Tools (via GameController)', () => {
  let tmpDir: string;
  let controller: GameController;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'mcp-status-test-'));
    controller = new GameController({
      dbPath: path.join(tmpDir, 'game.db'),
      playerId: 'status-test-player',
      playerName: 'StatusTestPlayer',
      biome: BiomeType.Forest,
      seed: 'status-seed',
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

  describe('game_status tool (getPlayerState)', () => {
    it('should return initial state for a new game', () => {
      const state = controller.getPlayerState();

      expect(state.id).toBe('status-test-player');
      expect(state.name).toBe('StatusTestPlayer');
      expect(state.biome).toBe(BiomeType.Forest);
      expect(state.era).toBe(1);
      expect(state.buildings).toHaveLength(0);
      expect(state.exploredZones).toHaveLength(0);
      expect(state.claimedZones).toHaveLength(0);
    });

    it('should reflect state changes after commands', () => {
      controller.build(BuildingId.Choza);
      controller.explore('zone_1');

      const state = controller.getPlayerState();
      expect(state.buildings).toHaveLength(1);
      expect(state.exploredZones).toContain('zone_1');
    });
  });

  describe('game_inventory tool (getPlayerState)', () => {
    it('should return resource values for a new game', () => {
      const state = controller.getPlayerState();

      expect(state.resources.wood).toBe(100);
      expect(state.resources.food).toBe(100);
      expect(state.resources.stone).toBe(50);
      expect(state.resources.iron).toBe(20);
      expect(state.resources.gems).toBe(5);
      expect(state.resources.mana).toBe(0);
      expect(state.tokens).toBe(100);
    });

    it('should reflect resource deductions after building', () => {
      // Granja costs: Wood:25, Stone:10
      controller.build(BuildingId.Granja);
      const state = controller.getPlayerState();

      expect(state.resources.wood).toBe(75);
      expect(state.resources.stone).toBe(40);
    });
  });

  describe('game_map tool (explored/claimed zones)', () => {
    it('should show no zones initially', () => {
      const state = controller.getPlayerState();
      expect(state.exploredZones).toHaveLength(0);
      expect(state.claimedZones).toHaveLength(0);
    });

    it('should track explored zones', () => {
      controller.explore('zone_north');
      controller.explore('zone_south');

      const state = controller.getPlayerState();
      expect(state.exploredZones).toHaveLength(2);
      expect(state.exploredZones).toContain('zone_north');
      expect(state.exploredZones).toContain('zone_south');
    });

    it('should track claimed zones separately from explored', () => {
      controller.explore('zone_east');
      controller.claim('zone_east');

      const state = controller.getPlayerState();
      expect(state.exploredZones).toContain('zone_east');
      expect(state.claimedZones).toContain('zone_east');
    });
  });

  describe('game_rankings tool (statistics)', () => {
    it('should provide statistics for an initial state', () => {
      const state = controller.getPlayerState();

      const totalUnits = Object.values(state.army.units).reduce((a, b) => a + b, 0);
      expect(totalUnits).toBe(0);
      expect(state.buildings).toHaveLength(0);
      expect(state.research.completed).toHaveLength(0);
      expect(state.prestige.level).toBe(0);
      expect(state.claimedZones).toHaveLength(0);
    });

    it('should update statistics after game actions', () => {
      controller.build(BuildingId.Choza);
      controller.build(BuildingId.Granja);
      controller.explore('zone_1');
      controller.explore('zone_1'); // duplicate should fail
      controller.claim('zone_1');

      const state = controller.getPlayerState();
      expect(state.buildings).toHaveLength(2);
      expect(state.exploredZones).toHaveLength(1);
      expect(state.claimedZones).toHaveLength(1);
    });
  });

  describe('game_node_status tool (clock)', () => {
    it('should provide access to the game clock', () => {
      const clock = controller.getClock();

      expect(clock).toBeDefined();
      expect(clock.getStartTime()).toBeGreaterThan(0);
      expect(clock.getTickDuration()).toBe(60_000); // 1 minute per tick
    });

    it('should return current tick as 0 or very small for newly created game', () => {
      const clock = controller.getClock();
      const currentTick = clock.getCurrentTick();

      // Since the game was just created, current tick should be 0
      expect(currentTick).toBeLessThanOrEqual(1);
    });
  });

  describe('MCP server creation', () => {
    it('should create an MCP server without errors', () => {
      const server = createMcpServer(controller);
      expect(server).toBeDefined();
    });
  });
});
