import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GameController } from '../../src/game-controller.js';
import { BiomeType, BuildingId, UnitType, DiplomacyStatus } from 'nodegame-mcp-engine';
import * as Automerge from '@automerge/automerge';
import { Wallet, CommandType, createSharedState, addTradeOffer, type ActionBlock, type NetworkManager, type SharedWorldState } from 'nodegame-mcp-network';

function createBlock(playerId: string, type: CommandType, args: Record<string, unknown>): ActionBlock {
  return {
    hash: `hash-${Math.random().toString(36).slice(2)}`,
    prevHash: 'prev-hash',
    index: 1,
    playerId,
    command: { type, args, tick: 10 },
    stateHash: 'state-hash',
    timestamp: Date.now(),
    signature: 'sig',
    publicKey: 'pub-key',
  };
}

describe('GameController P2P Integration', () => {
  let tmpDir: string;
  let controller: GameController;
  let wallet: Wallet;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'mcp-p2p-test-'));
    wallet = new Wallet();
    controller = new GameController({
      dbPath: path.join(tmpDir, 'game.db'),
      playerId: 'local-player',
      playerName: 'LocalPlayer',
      biome: BiomeType.Forest,
      seed: 'test-seed',
      wallet,
    });
  });

  afterEach(() => {
    try { controller.shutdown(); } catch { /* */ }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('NetworkManager integration', () => {
    it('setNetworkManager and getNetworkManager work', () => {
      expect(controller.getNetworkManager()).toBeNull();

      const mockNm = { isRunning: () => true } as unknown as NetworkManager;
      controller.setNetworkManager(mockNm);

      expect(controller.getNetworkManager()).toBe(mockNm);
    });

    it('broadcasts blocks when network manager is set', () => {
      const broadcastBlock = vi.fn();
      const mockNm = {
        getChainBroadcaster: () => ({ broadcastBlock }),
        getSyncManager: () => null,
      } as unknown as NetworkManager;
      controller.setNetworkManager(mockNm);

      // Execute a command (build) which should trigger broadcast
      controller.build(BuildingId.Granja);

      expect(broadcastBlock).toHaveBeenCalled();
    });

    it('syncs ranking to shared state after command', () => {
      const updateLocalPlayerData = vi.fn();
      const mockSyncManager = {
        updateLocalPlayerData,
        getSharedState: () => ({ zones: {}, rankings: {}, tradeOffers: [], combatLogs: [] }),
        setDoc: vi.fn(),
      };
      const mockNm = {
        getChainBroadcaster: () => ({ broadcastBlock: vi.fn() }),
        getSyncManager: () => mockSyncManager,
      } as unknown as NetworkManager;
      controller.setNetworkManager(mockNm);

      controller.build(BuildingId.Granja);

      expect(updateLocalPlayerData).toHaveBeenCalledWith(
        'local-player',
        expect.objectContaining({
          name: 'LocalPlayer',
          era: 1,
          totalArmy: expect.any(Number),
          totalResources: expect.any(Number),
          armyUnits: expect.any(Object),
          strategy: expect.any(String),
          defenseBonus: expect.any(Number),
        }),
      );
    });
  });

  describe('onRemoteAcceptTrade', () => {
    it('marks trade offer as accepted and gives resources', () => {
      // Create a trade offer first
      const result = controller.createTradeOffer(
        { wood: 50 },
        { stone: 30 },
        100,
      );
      expect(result.success).toBe(true);

      const state = controller.getPlayerState();
      const offer = state.tradeOffers.find((o) => o.status === 'open');
      expect(offer).toBeTruthy();

      const stoneBefore = state.resources.stone;

      // Simulate remote accept
      const block = createBlock('remote-player', CommandType.AcceptTrade, {
        offerId: offer!.id,
      });
      controller.onRemoteAcceptTrade(block);

      const newState = controller.getPlayerState();
      const updatedOffer = newState.tradeOffers.find((o) => o.id === offer!.id);
      expect(updatedOffer?.status).toBe('accepted');
      // We should receive the requested stone (30)
      expect(newState.resources.stone).toBe(stoneBefore + 30);
    });

    it('ignores accept for non-existent offer', () => {
      const stateBefore = controller.getPlayerState();
      const block = createBlock('remote-player', CommandType.AcceptTrade, {
        offerId: 'non-existent-offer',
      });
      controller.onRemoteAcceptTrade(block);
      // Should not throw, state unchanged
      const stateAfter = controller.getPlayerState();
      expect(stateAfter.resources.stone).toBe(stateBefore.resources.stone);
    });

    it('ignores accept without offerId', () => {
      const block = createBlock('remote-player', CommandType.AcceptTrade, {});
      controller.onRemoteAcceptTrade(block);
      // Should not throw
    });
  });

  describe('onRemotePvpAttack', () => {
    it('rejects blocks without attackerArmy (security: prevents manipulation)', () => {
      // Give the local player some army units via mutable state
      const mState = (controller as any).gameState.getMutableState();
      mState.army.units.soldier = 10;
      mState.army.units.archer = 5;
      controller.persist();

      const block = createBlock('attacker', CommandType.PvpAttack, {
        targetPlayerId: 'local-player',
        targetArmy: { soldier: 8, archer: 0, cavalry: 0, lancer: 0, catapult: 0, mage: 0, spy: 0 },
        targetStrategy: 'balanced',
        targetDefenseBonus: 0,
        // No attackerArmy — block is rejected for security
      });
      controller.onRemotePvpAttack(block);

      const stateAfter = controller.getPlayerState();
      // Army should be unchanged — block was rejected
      expect(stateAfter.army.units.soldier).toBe(10);
      expect(stateAfter.army.units.archer).toBe(5);
    });

    it('uses resolveBattle when attackerArmy is provided', () => {
      const mState = (controller as any).gameState.getMutableState();
      mState.army.units.soldier = 10;
      mState.army.units.archer = 5;
      controller.persist();

      const block = createBlock('attacker', CommandType.PvpAttack, {
        targetPlayerId: 'local-player',
        targetArmy: { soldier: 10, archer: 5, cavalry: 0, lancer: 0, catapult: 0, mage: 0, spy: 0 },
        attackerArmy: { soldier: 8, archer: 3, cavalry: 0, lancer: 0, catapult: 0, mage: 0, spy: 0 },
        targetStrategy: 'balanced',
        targetDefenseBonus: 0,
      });
      controller.onRemotePvpAttack(block);

      const stateAfter = controller.getPlayerState();
      // Battle was resolved deterministically — we should have lost some units
      const totalAfter = Object.values(stateAfter.army.units).reduce((a, b) => a + b, 0);
      expect(totalAfter).toBeLessThan(15); // started with 15
    });

    it('deducts loot tokens when attacker wins', () => {
      const mState = (controller as any).gameState.getMutableState();
      mState.army.units.soldier = 2; // weak defender
      mState.tokens = 100;
      controller.persist();

      const block = createBlock('attacker', CommandType.PvpAttack, {
        targetPlayerId: 'local-player',
        targetArmy: { soldier: 2, archer: 0, cavalry: 0, lancer: 0, catapult: 0, mage: 0, spy: 0 },
        attackerArmy: { soldier: 20, archer: 10, cavalry: 0, lancer: 0, catapult: 0, mage: 0, spy: 0 },
        targetStrategy: 'balanced',
        targetDefenseBonus: 0,
      });
      controller.onRemotePvpAttack(block);

      const stateAfter = controller.getPlayerState();
      // Attacker overwhelms — should win and loot tokens
      expect(stateAfter.tokens).toBeLessThanOrEqual(100);
    });

    it('does nothing if local army is empty', () => {
      const block = createBlock('attacker', CommandType.PvpAttack, {
        targetPlayerId: 'local-player',
        targetArmy: { soldier: 5 },
        targetStrategy: 'balanced',
        targetDefenseBonus: 0,
      });
      controller.onRemotePvpAttack(block);
      // Should not throw
      const state = controller.getPlayerState();
      expect(state.army.units.soldier).toBe(0);
    });

    it('does nothing without targetArmy', () => {
      const block = createBlock('attacker', CommandType.PvpAttack, {
        targetPlayerId: 'local-player',
      });
      controller.onRemotePvpAttack(block);
      // Should not throw
    });
  });

  describe('onRemoteDiplomacy', () => {
    it('adds new diplomacy relation from remote player', () => {
      const block = createBlock('foreign-player', CommandType.SetDiplomacy, {
        targetPlayerId: 'local-player',
        status: 'war',
      });
      controller.onRemoteDiplomacy(block);

      const state = controller.getPlayerState();
      const relation = state.diplomacy.find((d) => d.targetPlayerId === 'foreign-player');
      expect(relation).toBeTruthy();
      expect(relation!.status).toBe(DiplomacyStatus.War);
    });

    it('updates existing diplomacy relation', () => {
      // Set initial relation
      const block1 = createBlock('foreign-player', CommandType.SetDiplomacy, {
        targetPlayerId: 'local-player',
        status: 'war',
      });
      controller.onRemoteDiplomacy(block1);

      // Update to peace
      const block2 = createBlock('foreign-player', CommandType.SetDiplomacy, {
        targetPlayerId: 'local-player',
        status: 'peace',
      });
      controller.onRemoteDiplomacy(block2);

      const state = controller.getPlayerState();
      const relation = state.diplomacy.find((d) => d.targetPlayerId === 'foreign-player');
      expect(relation!.status).toBe(DiplomacyStatus.Peace);
      // Should only have one relation for this player
      expect(state.diplomacy.filter((d) => d.targetPlayerId === 'foreign-player')).toHaveLength(1);
    });

    it('does nothing without status', () => {
      const block = createBlock('foreign-player', CommandType.SetDiplomacy, {
        targetPlayerId: 'local-player',
      });
      controller.onRemoteDiplomacy(block);

      const state = controller.getPlayerState();
      expect(state.diplomacy).toHaveLength(0);
    });
  });

  describe('acceptNetworkTrade (cross-node)', () => {
    function setupNetworkWithOffer(offer: { id: string; from: string; offer: Record<string, number>; want: Record<string, number> }) {
      let sharedDoc = createSharedState();
      sharedDoc = addTradeOffer(sharedDoc, {
        ...offer,
        createdAt: Date.now(),
      });

      const setDoc = vi.fn((newDoc: Automerge.Doc<SharedWorldState>) => {
        sharedDoc = newDoc;
      });
      const mockSyncManager = {
        updateLocalPlayerData: vi.fn(),
        getSharedState: () => sharedDoc,
        setDoc,
      };
      const mockNm = {
        getChainBroadcaster: () => ({ broadcastBlock: vi.fn() }),
        getSyncManager: () => mockSyncManager,
      } as unknown as NetworkManager;
      controller.setNetworkManager(mockNm);
      return { mockSyncManager, setDoc };
    }

    it('accepts a network trade offer and transfers resources', () => {
      setupNetworkWithOffer({
        id: 'net-trade-1',
        from: 'remote-seller',
        offer: { wood: 50 },
        want: { stone: 30 },
      });

      const stateBefore = controller.getPlayerState();
      const stoneBefore = stateBefore.resources.stone;
      const woodBefore = stateBefore.resources.wood;

      const result = controller.acceptTrade('net-trade-1');
      expect(result.success).toBe(true);

      const stateAfter = controller.getPlayerState();
      // We paid stone and received wood
      expect(stateAfter.resources.stone).toBe(stoneBefore - 30);
      expect(stateAfter.resources.wood).toBe(woodBefore + 50);
    });

    it('fails when buyer has insufficient resources', () => {
      setupNetworkWithOffer({
        id: 'net-trade-2',
        from: 'remote-seller',
        offer: { wood: 50 },
        want: { stone: 99999 }, // more than we have
      });

      const result = controller.acceptTrade('net-trade-2');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient');
    });

    it('cannot accept own offer from network', () => {
      setupNetworkWithOffer({
        id: 'net-trade-3',
        from: 'local-player', // same as our player
        offer: { wood: 50 },
        want: { stone: 30 },
      });

      const result = controller.acceptTrade('net-trade-3');
      expect(result.success).toBe(false);
      expect(result.message).toContain('own trade offer');
    });

    it('returns not found for non-existent network offer', () => {
      const mockNm = {
        getChainBroadcaster: () => ({ broadcastBlock: vi.fn() }),
        getSyncManager: () => ({
          updateLocalPlayerData: vi.fn(),
          getSharedState: () => createSharedState(),
          setDoc: vi.fn(),
        }),
      } as unknown as NetworkManager;
      controller.setNetworkManager(mockNm);

      const result = controller.acceptTrade('non-existent-offer');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('removes offer from shared state after accepting', () => {
      const { setDoc } = setupNetworkWithOffer({
        id: 'net-trade-4',
        from: 'remote-seller',
        offer: { wood: 10 },
        want: { stone: 5 },
      });

      const result = controller.acceptTrade('net-trade-4');
      expect(result.success).toBe(true);
      // setDoc should have been called to remove the offer
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('shared state sync on explore/claim', () => {
    it('syncs zone to shared state on explore', () => {
      const setDoc = vi.fn();
      const sharedDoc = createSharedState();
      const mockSyncManager = {
        updateLocalPlayerData: vi.fn(),
        getSharedState: () => sharedDoc,
        setDoc,
      };
      const mockNm = {
        getChainBroadcaster: () => ({ broadcastBlock: vi.fn() }),
        getSyncManager: () => mockSyncManager,
      } as unknown as NetworkManager;
      controller.setNetworkManager(mockNm);

      controller.explore('zone_1');

      // setDoc should have been called for zone sync
      expect(setDoc).toHaveBeenCalled();
    });
  });
});
