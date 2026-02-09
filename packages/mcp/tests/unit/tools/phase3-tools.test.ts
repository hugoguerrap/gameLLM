import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GameController } from '../../../src/game-controller.js';
import { BiomeType, UnitType, CombatStrategy } from '@nodecoin/engine';

describe('Phase 3 Tools (via GameController)', () => {
  let tmpDir: string;
  let controller: GameController;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'mcp-phase3-test-'));
    controller = new GameController({
      dbPath: path.join(tmpDir, 'game.db'),
      playerId: 'phase3-test',
      playerName: 'Phase3Test',
      biome: BiomeType.Plains,
      seed: 'phase3-seed',
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

  // ── Alliance Tools ──

  describe('game_alliance_create (createAlliance)', () => {
    it('should create an alliance successfully', () => {
      const result = controller.createAlliance('Iron Pact');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Iron Pact');
      expect(result.data?.allianceId).toBeDefined();
    });

    it('should fail when already in an alliance', () => {
      controller.createAlliance('Iron Pact');
      const result = controller.createAlliance('Another Alliance');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already in an alliance');
    });

    it('should set alliance info in player state', () => {
      controller.createAlliance('Iron Pact');
      const state = controller.getPlayerState();

      expect(state.alliance).not.toBeNull();
      expect(state.alliance!.name).toBe('Iron Pact');
      expect(state.alliance!.leaderId).toBe('phase3-test');
    });
  });

  describe('game_alliance_join (joinAlliance)', () => {
    it('should join an alliance successfully', () => {
      const result = controller.joinAlliance('alliance-123', 'Steel Guard', 'leader-1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Steel Guard');
    });

    it('should fail when already in an alliance', () => {
      controller.createAlliance('Iron Pact');
      const result = controller.joinAlliance('alliance-123', 'Steel Guard', 'leader-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already in an alliance');
    });
  });

  describe('game_alliance_leave (leaveAlliance)', () => {
    it('should fail when not in an alliance', () => {
      const result = controller.leaveAlliance();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not in an alliance');
    });

    it('should leave an alliance successfully', () => {
      controller.joinAlliance('alliance-123', 'Steel Guard', 'other-leader');
      const result = controller.leaveAlliance();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Left alliance');
    });

    it('should disband when leader leaves', () => {
      controller.createAlliance('Iron Pact');
      const result = controller.leaveAlliance();

      expect(result.success).toBe(true);
      expect(result.message).toContain('disbanded');
    });

    it('should clear alliance from state', () => {
      controller.createAlliance('Iron Pact');
      controller.leaveAlliance();
      const state = controller.getPlayerState();

      expect(state.alliance).toBeNull();
    });
  });

  describe('game_alliance_info', () => {
    it('should show no alliance when not in one', () => {
      const state = controller.getPlayerState();
      expect(state.alliance).toBeNull();
    });

    it('should show alliance details when in one', () => {
      controller.createAlliance('Iron Pact');
      const state = controller.getPlayerState();

      expect(state.alliance).not.toBeNull();
      expect(state.alliance!.name).toBe('Iron Pact');
      expect(state.alliance!.memberIds).toContain('phase3-test');
    });
  });

  // ── Diplomacy Tools ──

  describe('game_diplomacy (setDiplomacy)', () => {
    it('should set diplomacy with another player', () => {
      const result = controller.setDiplomacy('player-2', 'war');

      expect(result.success).toBe(true);
      expect(result.message).toContain('war');
    });

    it('should fail when targeting self', () => {
      const result = controller.setDiplomacy('phase3-test', 'allied');

      expect(result.success).toBe(false);
      expect(result.message).toContain('yourself');
    });

    it('should update existing relation', () => {
      controller.setDiplomacy('player-2', 'war');
      controller.setDiplomacy('player-2', 'peace');
      const state = controller.getPlayerState();

      const relation = state.diplomacy.find((d) => d.targetPlayerId === 'player-2');
      expect(relation).toBeDefined();
      expect(relation!.status).toBe('peace');
    });

    it('should track multiple relations', () => {
      controller.setDiplomacy('player-2', 'war');
      controller.setDiplomacy('player-3', 'allied');
      const state = controller.getPlayerState();

      expect(state.diplomacy).toHaveLength(2);
    });
  });

  describe('game_diplomacy_status', () => {
    it('should start with no diplomatic relations', () => {
      const state = controller.getPlayerState();
      expect(state.diplomacy).toHaveLength(0);
    });
  });

  // ── Spy Tools ──

  describe('game_spy (spy)', () => {
    it('should fail without a spy unit', () => {
      const result = controller.spy('player-2', 'Enemy', 100, 5000, 2);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Spy unit');
    });
  });

  describe('game_spy_reports', () => {
    it('should start with no spy reports', () => {
      const state = controller.getPlayerState();
      expect(state.spyReports).toHaveLength(0);
    });
  });

  // ── Trade Tools ──

  describe('game_trade_create (createTradeOffer)', () => {
    it('should create a trade offer successfully', () => {
      const result = controller.createTradeOffer({ wood: 50 }, { stone: 30 }, 100);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Trade offer created');
      expect(result.data?.offerId).toBeDefined();
    });

    it('should fail with insufficient resources', () => {
      const result = controller.createTradeOffer({ wood: 99999 }, { stone: 1 }, 100);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient');
    });

    it('should escrow offered resources', () => {
      const stateBefore = controller.getPlayerState();
      const woodBefore = stateBefore.resources.wood;

      controller.createTradeOffer({ wood: 50 }, { stone: 30 }, 100);

      const stateAfter = controller.getPlayerState();
      expect(stateAfter.resources.wood).toBe(woodBefore - 50);
    });

    it('should add offer to tradeOffers list', () => {
      controller.createTradeOffer({ wood: 50 }, { stone: 30 }, 100);
      const state = controller.getPlayerState();

      expect(state.tradeOffers).toHaveLength(1);
      expect(state.tradeOffers[0].status).toBe('open');
    });
  });

  describe('game_trade_cancel (cancelTrade)', () => {
    it('should cancel an open trade offer', () => {
      const createResult = controller.createTradeOffer({ wood: 50 }, { stone: 30 }, 100);
      const offerId = createResult.data!.offerId as string;

      const result = controller.cancelTrade(offerId);

      expect(result.success).toBe(true);
      expect(result.message).toContain('cancelled');
    });

    it('should refund escrowed resources on cancel', () => {
      const stateBefore = controller.getPlayerState();
      const woodBefore = stateBefore.resources.wood;

      const createResult = controller.createTradeOffer({ wood: 50 }, { stone: 30 }, 100);
      const offerId = createResult.data!.offerId as string;
      controller.cancelTrade(offerId);

      const stateAfter = controller.getPlayerState();
      expect(stateAfter.resources.wood).toBe(woodBefore);
    });

    it('should fail for non-existent offer', () => {
      const result = controller.cancelTrade('nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('game_trade_accept (acceptTrade)', () => {
    it('should fail for non-existent offer', () => {
      const result = controller.acceptTrade('nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('game_trade_list', () => {
    it('should start with no trade offers', () => {
      const state = controller.getPlayerState();
      expect(state.tradeOffers).toHaveLength(0);
    });

    it('should show created offers', () => {
      controller.createTradeOffer({ wood: 50 }, { stone: 30 }, 100);
      controller.createTradeOffer({ food: 20 }, { iron: 10 }, 50);
      const state = controller.getPlayerState();

      expect(state.tradeOffers).toHaveLength(2);
    });
  });

  // ── PvP Tools ──

  describe('game_pvp_attack (pvpAttack)', () => {
    const emptyArmy: Record<UnitType, number> = {
      [UnitType.Soldier]: 5,
      [UnitType.Archer]: 0,
      [UnitType.Cavalry]: 0,
      [UnitType.Lancer]: 0,
      [UnitType.Catapult]: 0,
      [UnitType.Spy]: 0,
      [UnitType.Mage]: 0,
    };

    it('should fail when player has no army', () => {
      const result = controller.pvpAttack('target-1', emptyArmy, 'balanced', 0);

      expect(result.success).toBe(false);
      expect(result.message).toContain('no army units');
    });

    it('should fail when attacking self', () => {
      const result = controller.pvpAttack('phase3-test', emptyArmy, 'balanced', 0);

      expect(result.success).toBe(false);
      expect(result.message).toContain('yourself');
    });
  });

  // ── Persistence ──

  describe('persistence of Phase 3 state', () => {
    it('should persist alliance across restarts', () => {
      controller.createAlliance('Iron Pact');
      controller.shutdown();

      const controller2 = new GameController({
        dbPath: path.join(tmpDir, 'game.db'),
        playerId: 'phase3-test',
        playerName: 'Phase3Test',
        biome: BiomeType.Plains,
        seed: 'phase3-seed',
      });

      const state = controller2.getPlayerState();
      expect(state.alliance).not.toBeNull();
      expect(state.alliance!.name).toBe('Iron Pact');
      controller2.shutdown();
    });

    it('should persist diplomacy across restarts', () => {
      controller.setDiplomacy('player-2', 'war');
      controller.shutdown();

      const controller2 = new GameController({
        dbPath: path.join(tmpDir, 'game.db'),
        playerId: 'phase3-test',
        playerName: 'Phase3Test',
        biome: BiomeType.Plains,
        seed: 'phase3-seed',
      });

      const state = controller2.getPlayerState();
      expect(state.diplomacy).toHaveLength(1);
      expect(state.diplomacy[0].status).toBe('war');
      controller2.shutdown();
    });

    it('should persist trade offers across restarts', () => {
      controller.createTradeOffer({ wood: 50 }, { stone: 30 }, 100);
      controller.shutdown();

      const controller2 = new GameController({
        dbPath: path.join(tmpDir, 'game.db'),
        playerId: 'phase3-test',
        playerName: 'Phase3Test',
        biome: BiomeType.Plains,
        seed: 'phase3-seed',
      });

      const state = controller2.getPlayerState();
      expect(state.tradeOffers).toHaveLength(1);
      controller2.shutdown();
    });
  });
});
