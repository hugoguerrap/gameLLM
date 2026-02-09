import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GameController } from '../../../src/game-controller.js';
import {
  BiomeType,
  BuildingId,
  UnitType,
  CombatStrategy,
  UNIT_DEFINITIONS,
} from '@nodecoin/engine';

describe('Military Tools (via GameController)', () => {
  let tmpDir: string;
  let controller: GameController;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'mcp-military-test-'));
    controller = new GameController({
      dbPath: path.join(tmpDir, 'game.db'),
      playerId: 'military-test-player',
      playerName: 'MilitaryTestPlayer',
      biome: BiomeType.Forest,
      seed: 'military-seed',
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

  // ── game_recruit ──

  describe('game_recruit (recruit)', () => {
    it('should fail when no Cuartel exists', () => {
      const result = controller.recruit(UnitType.Soldier, 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cuartel');
      expect(result.message).toContain('Barracks');
    });

    it('should fail even for archers when no Cuartel exists', () => {
      const result = controller.recruit(UnitType.Archer, 2);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cuartel');
    });

    it('should fail for unknown unit type', () => {
      const result = controller.recruit('dragon_rider' as UnitType, 1);

      // No Cuartel, so it will fail on the Cuartel check first
      expect(result.success).toBe(false);
    });

    it('should not deduct resources when recruit fails', () => {
      const stateBefore = controller.getPlayerState();
      const foodBefore = stateBefore.resources.food;
      const ironBefore = stateBefore.resources.iron;

      controller.recruit(UnitType.Soldier, 1);

      const stateAfter = controller.getPlayerState();
      expect(stateAfter.resources.food).toBe(foodBefore);
      expect(stateAfter.resources.iron).toBe(ironBefore);
    });
  });

  // ── game_strategy ──

  describe('game_strategy (setStrategy)', () => {
    it('should set strategy to aggressive', () => {
      const result = controller.setStrategy(CombatStrategy.Aggressive);

      expect(result.success).toBe(true);
      expect(result.message).toContain('aggressive');

      const state = controller.getPlayerState();
      expect(state.army.strategy).toBe(CombatStrategy.Aggressive);
    });

    it('should set strategy to defensive', () => {
      const result = controller.setStrategy(CombatStrategy.Defensive);

      expect(result.success).toBe(true);
      expect(result.message).toContain('defensive');

      const state = controller.getPlayerState();
      expect(state.army.strategy).toBe(CombatStrategy.Defensive);
    });

    it('should set strategy to balanced', () => {
      const result = controller.setStrategy(CombatStrategy.Balanced);

      expect(result.success).toBe(true);
      expect(result.message).toContain('balanced');

      const state = controller.getPlayerState();
      expect(state.army.strategy).toBe(CombatStrategy.Balanced);
    });

    it('should start with balanced strategy by default', () => {
      const state = controller.getPlayerState();
      expect(state.army.strategy).toBe(CombatStrategy.Balanced);
    });

    it('should allow changing strategy multiple times', () => {
      controller.setStrategy(CombatStrategy.Aggressive);
      controller.setStrategy(CombatStrategy.Defensive);
      controller.setStrategy(CombatStrategy.Balanced);

      const state = controller.getPlayerState();
      expect(state.army.strategy).toBe(CombatStrategy.Balanced);
    });

    it('should persist strategy change', () => {
      controller.setStrategy(CombatStrategy.Aggressive);
      controller.shutdown();

      const controller2 = new GameController({
        dbPath: path.join(tmpDir, 'game.db'),
        playerId: 'military-test-player',
        playerName: 'MilitaryTestPlayer',
        biome: BiomeType.Forest,
        seed: 'military-seed',
      });

      const state = controller2.getPlayerState();
      expect(state.army.strategy).toBe(CombatStrategy.Aggressive);
      controller2.shutdown();
    });
  });

  // ── game_army (army info) ──

  describe('game_army (getAvailableUnits)', () => {
    it('should return empty when no Cuartel exists', () => {
      const units = controller.getAvailableUnits();
      expect(units).toHaveLength(0);
    });

    it('should show all unit counts as zero initially', () => {
      const state = controller.getPlayerState();

      expect(state.army.units[UnitType.Soldier]).toBe(0);
      expect(state.army.units[UnitType.Archer]).toBe(0);
      expect(state.army.units[UnitType.Cavalry]).toBe(0);
      expect(state.army.units[UnitType.Lancer]).toBe(0);
      expect(state.army.units[UnitType.Catapult]).toBe(0);
      expect(state.army.units[UnitType.Spy]).toBe(0);
      expect(state.army.units[UnitType.Mage]).toBe(0);
    });
  });

  // ── Explore/claim integration with military ──

  describe('exploration as military precursor', () => {
    it('should explore multiple zones', () => {
      controller.explore('zone_alpha');
      controller.explore('zone_beta');
      controller.explore('zone_gamma');

      const state = controller.getPlayerState();
      expect(state.exploredZones).toHaveLength(3);
      expect(state.exploredZones).toContain('zone_alpha');
      expect(state.exploredZones).toContain('zone_beta');
      expect(state.exploredZones).toContain('zone_gamma');
    });

    it('should claim only explored zones', () => {
      controller.explore('zone_alpha');
      controller.explore('zone_beta');

      controller.claim('zone_alpha');
      const failResult = controller.claim('zone_gamma'); // not explored

      expect(failResult.success).toBe(false);

      const state = controller.getPlayerState();
      expect(state.claimedZones).toHaveLength(1);
      expect(state.claimedZones).toContain('zone_alpha');
    });

    it('should not allow claiming the same zone twice', () => {
      controller.explore('zone_alpha');
      controller.claim('zone_alpha');

      const result = controller.claim('zone_alpha');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already claimed');
    });
  });

  // ── Unit definitions ──

  describe('unit definitions integrity', () => {
    it('should have definitions for all unit types', () => {
      const unitTypes = Object.values(UnitType);

      for (const type of unitTypes) {
        expect(UNIT_DEFINITIONS[type]).toBeDefined();
        expect(UNIT_DEFINITIONS[type].name).toBeTruthy();
        expect(UNIT_DEFINITIONS[type].attack).toBeGreaterThan(0);
        expect(UNIT_DEFINITIONS[type].defense).toBeGreaterThan(0);
        expect(UNIT_DEFINITIONS[type].health).toBeGreaterThan(0);
      }
    });

    it('should have training costs for all units', () => {
      const unitTypes = Object.values(UnitType);

      for (const type of unitTypes) {
        const def = UNIT_DEFINITIONS[type];
        const totalCost = Object.values(def.trainingCost).reduce(
          (sum, cost) => sum + (cost ?? 0),
          0,
        );
        expect(totalCost).toBeGreaterThan(0);
      }
    });

    it('should have era 1 units (soldier, archer)', () => {
      expect(UNIT_DEFINITIONS[UnitType.Soldier].era).toBe(1);
      expect(UNIT_DEFINITIONS[UnitType.Archer].era).toBe(1);
    });

    it('should have era 2 units (cavalry, lancer, spy)', () => {
      expect(UNIT_DEFINITIONS[UnitType.Cavalry].era).toBe(2);
      expect(UNIT_DEFINITIONS[UnitType.Lancer].era).toBe(2);
      expect(UNIT_DEFINITIONS[UnitType.Spy].era).toBe(2);
    });
  });
});
