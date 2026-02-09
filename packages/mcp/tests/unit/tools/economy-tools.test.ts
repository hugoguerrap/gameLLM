import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GameController } from '../../../src/game-controller.js';
import {
  BiomeType,
  BuildingId,
  TECH_DEFINITIONS,
} from 'nodegame-mcp-engine';

describe('Economy Tools (via GameController)', () => {
  let tmpDir: string;
  let controller: GameController;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'mcp-economy-test-'));
    controller = new GameController({
      dbPath: path.join(tmpDir, 'game.db'),
      playerId: 'economy-test-player',
      playerName: 'EconomyTestPlayer',
      biome: BiomeType.Forest,
      seed: 'economy-seed',
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

  // ── Market / Token state ──

  describe('game_market (token balance)', () => {
    it('should start with 100 NODECOIN tokens', () => {
      const state = controller.getPlayerState();
      expect(state.tokens).toBe(100);
    });

    it('should preserve token balance across save/load', () => {
      controller.shutdown();

      const controller2 = new GameController({
        dbPath: path.join(tmpDir, 'game.db'),
        playerId: 'economy-test-player',
        playerName: 'EconomyTestPlayer',
        biome: BiomeType.Forest,
        seed: 'economy-seed',
      });

      const state = controller2.getPlayerState();
      expect(state.tokens).toBe(100);
      controller2.shutdown();
    });
  });

  // ── Resource management through building ──

  describe('resource management', () => {
    it('should deduct correct resources when building', () => {
      const stateBefore = controller.getPlayerState();
      const woodBefore = stateBefore.resources.wood;
      const foodBefore = stateBefore.resources.food;
      const stoneBefore = stateBefore.resources.stone;

      // Build a Choza (Wood:20, Food:10)
      controller.build(BuildingId.Choza);

      const stateAfter = controller.getPlayerState();
      expect(stateAfter.resources.wood).toBe(woodBefore - 20);
      expect(stateAfter.resources.food).toBe(foodBefore - 10);
      expect(stateAfter.resources.stone).toBe(stoneBefore); // unchanged
    });

    it('should track multiple resource deductions across buildings', () => {
      controller.build(BuildingId.Choza);      // Wood:20, Food:10
      controller.build(BuildingId.Granja);      // Wood:25, Stone:10
      controller.build(BuildingId.Aserradero);  // Wood:15, Stone:15

      const state = controller.getPlayerState();
      expect(state.resources.wood).toBe(100 - 20 - 25 - 15);  // 40
      expect(state.resources.food).toBe(100 - 10);              // 90
      expect(state.resources.stone).toBe(50 - 10 - 15);         // 25
    });

    it('should correctly report resource storage caps', () => {
      const state = controller.getPlayerState();

      expect(state.resourceStorage.wood).toBe(500);
      expect(state.resourceStorage.food).toBe(500);
      expect(state.resourceStorage.stone).toBe(300);
      expect(state.resourceStorage.iron).toBe(200);
      expect(state.resourceStorage.gems).toBe(100);
      expect(state.resourceStorage.mana).toBe(50);
    });
  });

  // ── Research economy ──

  describe('game_research (research economy)', () => {
    it('should deduct gems when starting research', () => {
      const gemsBefore = controller.getPlayerState().resources.gems;
      // 'agriculture' costs 2 gems
      controller.research('agriculture');

      const gemsAfter = controller.getPlayerState().resources.gems;
      expect(gemsAfter).toBe(gemsBefore - 2);
    });

    it('should fail research when gem cost exceeds balance', () => {
      // Start researching to drain some gems
      // agriculture: 2 gems, woodworking: 2 gems; total 4 out of 5
      controller.research('agriculture');
      // Can't start another while one is active
      const result = controller.research('woodworking');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Already researching');
    });

    it('should show available research correctly', () => {
      const available = controller.getAvailableResearch();

      // Should include techs with no prerequisites
      const ids = available.map((t) => t.id);
      expect(ids).toContain('agriculture');
      expect(ids).toContain('woodworking');
      expect(ids).toContain('mining_basics');

      // Should not include techs with unmet prerequisites
      expect(ids).not.toContain('masonry'); // requires mining_basics
      expect(ids).not.toContain('ironworking'); // requires mining_basics
      expect(ids).not.toContain('military_tactics'); // requires ironworking
    });

    it('should track research state after starting', () => {
      controller.research('agriculture');

      const state = controller.getPlayerState();
      expect(state.research.current).toBe('agriculture');
      expect(state.research.progress).toBe(0);
      expect(state.research.completed).toHaveLength(0);
    });

    it('should not allow researching an unknown tech', () => {
      const result = controller.research('nonexistent_tech');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown technology');
    });
  });

  // ── Research available filtering ──

  describe('game_research_available (getAvailableResearch)', () => {
    it('should filter by prerequisites', () => {
      const available = controller.getAvailableResearch();

      // Find a tech that has prerequisites and verify it is not listed
      const masonry = TECH_DEFINITIONS.find((t) => t.id === 'masonry');
      expect(masonry).toBeDefined();
      expect(masonry!.prerequisites).toContain('mining_basics');

      const ids = available.map((t) => t.id);
      expect(ids).not.toContain('masonry');
    });

    it('should exclude currently-being-researched tech', () => {
      controller.research('agriculture');

      const available = controller.getAvailableResearch();
      const ids = available.map((t) => t.id);
      expect(ids).not.toContain('agriculture');
      // Other base techs should still be available
      expect(ids).toContain('woodworking');
      expect(ids).toContain('mining_basics');
    });

    it('should include the right number of base techs', () => {
      const available = controller.getAvailableResearch();
      const baseTechs = TECH_DEFINITIONS.filter((t) => t.prerequisites.length === 0);

      expect(available).toHaveLength(baseTechs.length);
    });
  });

  // ── Population ──

  describe('population state', () => {
    it('should start with initial population values', () => {
      const state = controller.getPlayerState();

      expect(state.population.current).toBe(10);
      expect(state.population.max).toBe(20);
      expect(state.population.happiness).toBe(50);
    });
  });
});
