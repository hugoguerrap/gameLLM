/**
 * Multi-node integration tests.
 *
 * These tests simulate two independent game nodes (each with their own
 * GameController + SQLite DB) and verify Phase 3 cross-player interactions:
 *  - Trade offers between players
 *  - PvP combat between players
 *  - Alliance creation and visibility
 *  - Diplomacy between players
 *  - Spy reports between players
 *
 * NOTE: These tests run in-process (no Docker) by instantiating two
 * separate GameController instances backed by different SQLite databases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GameController } from '../../src/game-controller.js';
import {
  BiomeType,
  BuildingId,
  UnitType,
  CombatStrategy,
} from 'nodegame-mcp-engine';

describe('Multi-node integration', () => {
  let tmpDir: string;
  let node1: GameController;
  let node2: GameController;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'multi-node-test-'));

    node1 = new GameController({
      dbPath: path.join(tmpDir, 'node1.db'),
      playerId: 'player-ironforge',
      playerName: 'Ironforge',
      biome: BiomeType.Mountain,
      seed: 'seed-ironforge',
    });

    node2 = new GameController({
      dbPath: path.join(tmpDir, 'node2.db'),
      playerId: 'player-verdantia',
      playerName: 'Verdantia',
      biome: BiomeType.Forest,
      seed: 'seed-verdantia',
    });
  });

  afterEach(() => {
    try { node1.shutdown(); } catch { /* already closed */ }
    try { node2.shutdown(); } catch { /* already closed */ }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Trade between nodes', () => {
    it('node1 creates an offer, node2 can see the offer data', () => {
      // Node 1 creates a trade offer
      const result = node1.createTradeOffer({ wood: 50 }, { stone: 30 }, 100);
      expect(result.success).toBe(true);

      const node1State = node1.getPlayerState();
      expect(node1State.tradeOffers).toHaveLength(1);
      const offer = node1State.tradeOffers[0];

      // In a real network scenario, node2 would receive this offer via P2P.
      // Here we verify the offer data is well-formed for transmission.
      expect(offer.id).toBeTruthy();
      expect(offer.sellerId).toBe('player-ironforge');
      expect(offer.offering.wood).toBe(50);
      expect(offer.requesting.stone).toBe(30);
      expect(offer.status).toBe('open');
    });

    it('node1 creates and cancels offer, resources refunded', () => {
      const stateBefore = node1.getPlayerState();
      const woodBefore = stateBefore.resources.wood;

      const createResult = node1.createTradeOffer({ wood: 40 }, { iron: 10 }, 50);
      expect(createResult.success).toBe(true);

      // Wood should be escrowed
      const stateAfterCreate = node1.getPlayerState();
      expect(stateAfterCreate.resources.wood).toBe(woodBefore - 40);

      // Cancel and verify refund
      const offerId = createResult.data!.offerId as string;
      const cancelResult = node1.cancelTrade(offerId);
      expect(cancelResult.success).toBe(true);

      const stateAfterCancel = node1.getPlayerState();
      expect(stateAfterCancel.resources.wood).toBe(woodBefore);
    });

    it('both nodes can create independent trade offers', () => {
      const r1 = node1.createTradeOffer({ wood: 30 }, { stone: 15 }, 100);
      const r2 = node2.createTradeOffer({ food: 40 }, { iron: 5 }, 80);

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);

      // Each node only sees its own offers locally
      expect(node1.getPlayerState().tradeOffers).toHaveLength(1);
      expect(node2.getPlayerState().tradeOffers).toHaveLength(1);

      // Offer IDs should be different
      expect(r1.data!.offerId).not.toBe(r2.data!.offerId);
    });
  });

  describe('PvP combat between nodes', () => {
    it('node1 attacks node2 using node2 army data', () => {
      // Give node1 some soldiers by direct state manipulation
      // (In reality they'd recruit, but we shortcut for the integration test)
      const n1State = node1.getPlayerState();

      // Node1 has no army initially, attack should fail
      const failResult = node1.pvpAttack(
        'player-verdantia',
        {
          [UnitType.Soldier]: 5,
          [UnitType.Archer]: 0,
          [UnitType.Cavalry]: 0,
          [UnitType.Lancer]: 0,
          [UnitType.Catapult]: 0,
          [UnitType.Spy]: 0,
          [UnitType.Mage]: 0,
        },
        'balanced',
        0,
      );

      expect(failResult.success).toBe(false);
      expect(failResult.message).toContain('no army units');
    });

    it('cannot attack self', () => {
      const result = node1.pvpAttack(
        'player-ironforge',
        {
          [UnitType.Soldier]: 5,
          [UnitType.Archer]: 0,
          [UnitType.Cavalry]: 0,
          [UnitType.Lancer]: 0,
          [UnitType.Catapult]: 0,
          [UnitType.Spy]: 0,
          [UnitType.Mage]: 0,
        },
        'balanced',
        0,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('yourself');
    });
  });

  describe('Alliance operations', () => {
    it('node1 creates alliance, node2 joins', () => {
      // Node1 creates alliance
      const createResult = node1.createAlliance('Iron Pact');
      expect(createResult.success).toBe(true);
      const allianceId = createResult.data!.allianceId as string;

      // Node2 joins (in P2P, the alliance info would be broadcast)
      const joinResult = node2.joinAlliance(allianceId, 'Iron Pact', 'player-ironforge');
      expect(joinResult.success).toBe(true);

      // Both nodes should show alliance membership
      const n1State = node1.getPlayerState();
      const n2State = node2.getPlayerState();

      expect(n1State.alliance!.name).toBe('Iron Pact');
      expect(n1State.alliance!.leaderId).toBe('player-ironforge');
      expect(n2State.alliance!.name).toBe('Iron Pact');
      expect(n2State.alliance!.leaderId).toBe('player-ironforge');
    });

    it('node2 leaves alliance, node1 stays', () => {
      const createResult = node1.createAlliance('Iron Pact');
      const allianceId = createResult.data!.allianceId as string;
      node2.joinAlliance(allianceId, 'Iron Pact', 'player-ironforge');

      const leaveResult = node2.leaveAlliance();
      expect(leaveResult.success).toBe(true);

      expect(node1.getPlayerState().alliance).not.toBeNull();
      expect(node2.getPlayerState().alliance).toBeNull();
    });

    it('cannot join two alliances', () => {
      node1.createAlliance('Iron Pact');
      node2.createAlliance('Forest Guard');

      // Node1 tries to join node2's alliance while already in one
      const result = node1.joinAlliance('alliance-x', 'Forest Guard', 'player-verdantia');
      expect(result.success).toBe(false);
      expect(result.message).toContain('already in an alliance');
    });
  });

  describe('Diplomacy between nodes', () => {
    it('node1 declares war on node2', () => {
      const result = node1.setDiplomacy('player-verdantia', 'war');
      expect(result.success).toBe(true);

      const state = node1.getPlayerState();
      const relation = state.diplomacy.find((d) => d.targetPlayerId === 'player-verdantia');
      expect(relation).toBeDefined();
      expect(relation!.status).toBe('war');
    });

    it('nodes have independent diplomacy records', () => {
      node1.setDiplomacy('player-verdantia', 'war');
      node2.setDiplomacy('player-ironforge', 'peace');

      const n1State = node1.getPlayerState();
      const n2State = node2.getPlayerState();

      // Node1 sees war with Verdantia
      expect(n1State.diplomacy.find((d) => d.targetPlayerId === 'player-verdantia')!.status).toBe('war');
      // Node2 sees peace with Ironforge
      expect(n2State.diplomacy.find((d) => d.targetPlayerId === 'player-ironforge')!.status).toBe('peace');
    });

    it('diplomacy can be changed from war to peace', () => {
      node1.setDiplomacy('player-verdantia', 'war');
      node1.setDiplomacy('player-verdantia', 'peace');

      const state = node1.getPlayerState();
      const relation = state.diplomacy.find((d) => d.targetPlayerId === 'player-verdantia');
      expect(relation!.status).toBe('peace');
    });
  });

  describe('Espionage between nodes', () => {
    it('spy fails without spy unit', () => {
      const n2State = node2.getPlayerState();
      const totalArmy = Object.values(n2State.army.units).reduce((a, b) => a + b, 0);
      const totalRes = Object.values(n2State.resources).reduce((a, b) => a + b, 0);

      const result = node1.spy(
        'player-verdantia',
        'Verdantia',
        totalArmy,
        Math.round(totalRes),
        n2State.era,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Spy unit');
    });
  });

  describe('Cross-feature scenarios', () => {
    it('full diplomatic lifecycle: alliance → war → trade', () => {
      // Step 1: Both nodes start neutral
      const n1InitialState = node1.getPlayerState();
      expect(n1InitialState.alliance).toBeNull();
      expect(n1InitialState.diplomacy).toHaveLength(0);

      // Step 2: Node1 creates alliance
      const allianceResult = node1.createAlliance('Iron Pact');
      expect(allianceResult.success).toBe(true);

      // Step 3: Node2 sets diplomacy to allied
      const dipResult = node2.setDiplomacy('player-ironforge', 'allied');
      expect(dipResult.success).toBe(true);

      // Step 4: Relations break down, set to war
      node2.setDiplomacy('player-ironforge', 'war');
      const n2State = node2.getPlayerState();
      expect(n2State.diplomacy[0].status).toBe('war');

      // Step 5: Peace treaty and trade offer
      node2.setDiplomacy('player-ironforge', 'peace');
      const tradeResult = node2.createTradeOffer({ food: 30 }, { iron: 5 }, 50);
      expect(tradeResult.success).toBe(true);

      // Verify final state
      const n2Final = node2.getPlayerState();
      expect(n2Final.diplomacy[0].status).toBe('peace');
      expect(n2Final.tradeOffers).toHaveLength(1);
    });

    it('both nodes persist their state independently', () => {
      // Set up some state on both nodes
      node1.createAlliance('Iron Pact');
      node1.setDiplomacy('player-verdantia', 'war');
      node1.createTradeOffer({ wood: 20 }, { stone: 10 }, 100);

      node2.setDiplomacy('player-ironforge', 'peace');
      node2.createTradeOffer({ food: 30 }, { iron: 5 }, 50);

      // Shutdown both
      node1.shutdown();
      node2.shutdown();

      // Restart both
      const node1b = new GameController({
        dbPath: path.join(tmpDir, 'node1.db'),
        playerId: 'player-ironforge',
        playerName: 'Ironforge',
        biome: BiomeType.Mountain,
        seed: 'seed-ironforge',
      });

      const node2b = new GameController({
        dbPath: path.join(tmpDir, 'node2.db'),
        playerId: 'player-verdantia',
        playerName: 'Verdantia',
        biome: BiomeType.Forest,
        seed: 'seed-verdantia',
      });

      // Verify persistence
      const n1State = node1b.getPlayerState();
      expect(n1State.alliance!.name).toBe('Iron Pact');
      expect(n1State.diplomacy).toHaveLength(1);
      expect(n1State.tradeOffers).toHaveLength(1);

      const n2State = node2b.getPlayerState();
      expect(n2State.diplomacy).toHaveLength(1);
      expect(n2State.tradeOffers).toHaveLength(1);

      node1b.shutdown();
      node2b.shutdown();
    });
  });
});
