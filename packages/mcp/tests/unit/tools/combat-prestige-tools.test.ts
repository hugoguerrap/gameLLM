import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GameController } from '../../../src/game-controller.js';
import { BiomeType, UnitType } from 'nodegame-mcp-engine';

describe('Combat & Prestige Tools (via GameController)', () => {
  let tmpDir: string;
  let controller: GameController;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'mcp-combat-prestige-test-'));
    controller = new GameController({
      dbPath: path.join(tmpDir, 'game.db'),
      playerId: 'combat-prestige-test',
      playerName: 'CombatPrestigeTest',
      biome: BiomeType.Plains,
      seed: 'combat-prestige-seed',
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

  // ── game_attack ──

  describe('game_attack (attack)', () => {
    it('should fail when player has no army units', () => {
      const result = controller.attack('bandits');

      expect(result.success).toBe(false);
      expect(result.message).toContain('no army units');
    });

    it('should fail for invalid target', () => {
      const result = controller.attack('goblins');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid target');
    });

    it('should return appropriate message when no army', () => {
      const result = controller.attack('bandits');

      expect(result.success).toBe(false);
      expect(result.message).toContain('no army units');
      expect(result.message).toContain('Recruit');
    });

    it('should accept bandits target', () => {
      const result = controller.attack('bandits');
      // Will fail because no units, but the target itself is valid
      expect(result.message).not.toContain('Invalid target');
    });

    it('should accept raiders target', () => {
      const result = controller.attack('raiders');
      expect(result.message).not.toContain('Invalid target');
    });

    it('should accept dragon target', () => {
      const result = controller.attack('dragon');
      expect(result.message).not.toContain('Invalid target');
    });
  });

  // ── game_prestige / game_ascend ──

  describe('game_ascend (ascend)', () => {
    it('should fail when era is too low', () => {
      const result = controller.ascend();

      expect(result.success).toBe(false);
      expect(result.message).toContain('era');
    });

    it('should start at prestige level 0', () => {
      const state = controller.getPlayerState();
      expect(state.prestige.level).toBe(0);
    });

    it('should have legacy multiplier of 1.0 at level 0', () => {
      const state = controller.getPlayerState();
      expect(state.prestige.legacyMultiplier).toBe(1.0);
    });

    it('should track total tokens earned', () => {
      const state = controller.getPlayerState();
      expect(state.prestige.totalTokensEarned).toBeDefined();
    });

    it('should have empty bonuses initially', () => {
      const state = controller.getPlayerState();
      expect(state.prestige.bonuses).toHaveLength(0);
    });

    it('should fail when tokens insufficient', () => {
      const result = controller.ascend();

      expect(result.success).toBe(false);
      // Should mention era or tokens requirement
      expect(result.message).toMatch(/era|token/i);
    });
  });

  // ── MiningSystem integration ──

  describe('mining system integration', () => {
    it('should start with initial token balance', () => {
      const state = controller.getPlayerState();
      expect(state.tokens).toBeGreaterThanOrEqual(0);
    });

    it('should have tokens field in state', () => {
      const state = controller.getPlayerState();
      expect(typeof state.tokens).toBe('number');
    });
  });

  // ── Persistence of combat/prestige state ──

  describe('persistence', () => {
    it('should persist prestige state across restarts', () => {
      const state1 = controller.getPlayerState();
      const level1 = state1.prestige.level;
      controller.shutdown();

      const controller2 = new GameController({
        dbPath: path.join(tmpDir, 'game.db'),
        playerId: 'combat-prestige-test',
        playerName: 'CombatPrestigeTest',
        biome: BiomeType.Plains,
        seed: 'combat-prestige-seed',
      });

      const state2 = controller2.getPlayerState();
      expect(state2.prestige.level).toBe(level1);
      controller2.shutdown();
    });

    it('should persist token balance across restarts', () => {
      const state1 = controller.getPlayerState();
      const tokens1 = state1.tokens;
      controller.shutdown();

      const controller2 = new GameController({
        dbPath: path.join(tmpDir, 'game.db'),
        playerId: 'combat-prestige-test',
        playerName: 'CombatPrestigeTest',
        biome: BiomeType.Plains,
        seed: 'combat-prestige-seed',
      });

      const state2 = controller2.getPlayerState();
      expect(state2.tokens).toBe(tokens1);
      controller2.shutdown();
    });
  });
});
