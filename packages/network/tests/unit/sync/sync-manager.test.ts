import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SyncManager, uint8ArrayToBase64, base64ToUint8Array, type SyncPayload } from '../../../src/sync/sync-manager.js';
import { PubSubService, TOPICS, type MessageHandler } from '../../../src/p2p/pubsub.js';
import { PeerManager } from '../../../src/p2p/peer-manager.js';
import { P2PNode } from '../../../src/p2p/node.js';
import { MessageType, type P2PMessage } from '../../../src/types/messages.js';
import {
  createSharedState,
  updateRanking,
  saveState,
  computeDataHash,
  type SharedWorldState,
  type RankingData,
} from '../../../src/sync/state-sync.js';
import { Wallet } from '../../../src/wallet/wallet.js';
import type { GossipSub } from '@chainsafe/libp2p-gossipsub';
import type { TopicName } from '../../../src/p2p/pubsub.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const encoder = new TextEncoder();

/** Helper: sign ranking data for tests. */
function signRanking(wallet: Wallet, data: RankingData): RankingData {
  const hash = computeDataHash(data as unknown as Record<string, unknown>);
  const signature = wallet.sign(encoder.encode(hash));
  return { ...data, signature, signedBy: wallet.publicKeyHex };
}

/**
 * Real PubSubService subclass that also records every published message.
 * No vi.fn() — just a real publish() with bookkeeping.
 */
class RecordingPubSubService extends PubSubService {
  readonly published: Array<{ topic: TopicName; message: P2PMessage }> = [];

  override async publish(topic: TopicName, message: P2PMessage): Promise<void> {
    this.published.push({ topic, message });
    return super.publish(topic, message);
  }

  clearRecords(): void {
    this.published.length = 0;
  }
}

/**
 * Deliver a message to a P2P node's PubSubService handlers as if it
 * arrived over GossipSub from a remote peer.
 *
 * This dispatches a real CustomEvent on the real GossipSub instance,
 * exercising the real PubSubService message listener and decoder.
 */
function deliverMessage(gs: GossipSub, topic: string, message: P2PMessage): void {
  const data = encoder.encode(JSON.stringify(message));
  gs.dispatchEvent(
    new CustomEvent('message', {
      detail: {
        topic,
        data,
      },
    }),
  );
}

describe('SyncManager', { timeout: 30_000 }, () => {
  // ── Single real P2P node ──
  let node: P2PNode;
  let gs: GossipSub;
  let pubsub: RecordingPubSubService;

  beforeAll(async () => {
    node = new P2PNode();
    await node.start({ enableMdns: false });
    gs = node.getNode().services.pubsub as GossipSub;
  }, 10_000);

  afterAll(async () => {
    await node.stop();
  });

  // ── Per-test state ──
  let peerManager: PeerManager;
  let syncManager: SyncManager;

  function addPeerToManager(): void {
    peerManager.addPeer({
      peerId: 'remote-peer-id',
      address: 'NC0001',
      name: 'RemoteNode',
      era: 1,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
    });
  }

  beforeEach(() => {
    peerManager = new PeerManager();
    pubsub = new RecordingPubSubService(gs);

    syncManager = new SyncManager(pubsub, peerManager, 'local-node', {
      broadcastIntervalMs: 100,
    });
  });

  afterEach(() => {
    syncManager.stop();
    pubsub.destroy();
  });

  // ── start / stop ──

  describe('start / stop', () => {
    it('subscribes to GAME_STATE topic on start', () => {
      syncManager.start();

      expect(syncManager.isRunning()).toBe(true);
      expect(pubsub.getSubscribedTopics()).toContain(TOPICS.GAME_STATE);
    });

    it('is idempotent - starting twice does not error', () => {
      syncManager.start();
      syncManager.start();

      expect(syncManager.isRunning()).toBe(true);
    });

    it('unsubscribes on stop', () => {
      syncManager.start();
      syncManager.stop();

      expect(syncManager.isRunning()).toBe(false);
    });

    it('stop is idempotent', () => {
      syncManager.start();
      syncManager.stop();
      syncManager.stop();

      expect(syncManager.isRunning()).toBe(false);
    });
  });

  // ── getSharedState ──

  describe('getSharedState', () => {
    it('returns an empty shared state initially', () => {
      const state = syncManager.getSharedState();
      expect(state.zones).toEqual({});
      expect(state.rankings).toEqual({});
      expect(state.tradeOffers).toEqual([]);
      expect(state.combatLogs).toEqual([]);
    });
  });

  // ── updateLocalPlayerData ──

  describe('updateLocalPlayerData', () => {
    it('updates ranking in the shared state', () => {
      syncManager.updateLocalPlayerData('player-1', {
        name: 'Ironforge',
        era: 2,
        prestige: 100,
        tokens: 500,
      });

      const state = syncManager.getSharedState();
      expect(state.rankings['player-1']).toBeDefined();
      expect(state.rankings['player-1'].name).toBe('Ironforge');
      expect(state.rankings['player-1'].era).toBe(2);
    });
  });

  // ── broadcastChanges ──

  describe('broadcastChanges', () => {
    it('does not broadcast when there are no peers', () => {
      // peerManager has 0 peers (no addPeer called)
      syncManager.updateLocalPlayerData('player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });

      syncManager.broadcastChanges();

      const fromUs = pubsub.published.filter(
        (p) => p.topic === TOPICS.GAME_STATE,
      );
      expect(fromUs).toHaveLength(0);
    });

    it('broadcasts full state on first broadcast', () => {
      addPeerToManager();

      syncManager.updateLocalPlayerData('player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });

      syncManager.broadcastChanges();

      const fromUs = pubsub.published.filter(
        (p) => p.topic === TOPICS.GAME_STATE,
      );
      expect(fromUs).toHaveLength(1);

      const msg = fromUs[0].message;
      expect(msg.type).toBe(MessageType.GameState);
      expect(msg.senderId).toBe('local-node');

      const payload = msg.payload as SyncPayload;
      expect(payload.syncType).toBe('full');
      expect(typeof payload.data).toBe('string');
    });

    it('broadcasts incremental changes on subsequent broadcasts', () => {
      addPeerToManager();

      syncManager.updateLocalPlayerData('player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });
      syncManager.broadcastChanges(); // first: full

      // Make more changes
      syncManager.updateLocalPlayerData('player-1', {
        name: 'Ironforge',
        era: 2,
        prestige: 50,
        tokens: 300,
      });
      syncManager.broadcastChanges(); // second: changes

      const fromUs = pubsub.published.filter(
        (p) => p.topic === TOPICS.GAME_STATE,
      );
      expect(fromUs).toHaveLength(2);

      expect((fromUs[0].message.payload as SyncPayload).syncType).toBe('full');
      expect((fromUs[1].message.payload as SyncPayload).syncType).toBe('changes');
    });

    it('does not broadcast when nothing changed since last broadcast', () => {
      addPeerToManager();

      syncManager.updateLocalPlayerData('player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });
      syncManager.broadcastChanges(); // first: full

      expect(pubsub.published).toHaveLength(1);

      syncManager.broadcastChanges(); // second: nothing changed

      expect(pubsub.published).toHaveLength(1); // no new publish
    });

    it('is triggered periodically by the real timer', async () => {
      addPeerToManager();
      syncManager.start();

      syncManager.updateLocalPlayerData('player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });

      // Wait for at least one timer-triggered broadcast (interval = 100ms)
      await sleep(250);

      const fromUs = pubsub.published.filter(
        (p) => p.topic === TOPICS.GAME_STATE,
      );
      expect(fromUs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── broadcastFullState ──

  describe('broadcastFullState', () => {
    it('always sends a full state payload', () => {
      addPeerToManager();

      syncManager.updateLocalPlayerData('player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });

      // Do a regular broadcast first
      syncManager.broadcastChanges();

      // Now explicitly broadcast full state
      syncManager.broadcastFullState();

      expect(pubsub.published).toHaveLength(2);

      const last = pubsub.published[1].message.payload as SyncPayload;
      expect(last.syncType).toBe('full');
    });
  });

  // ── incoming messages ──

  describe('incoming messages', () => {
    it('applies a full state from a remote peer', () => {
      syncManager.start();

      // Create remote state (signed)
      const remoteWallet = new Wallet();
      let remoteDoc = createSharedState();
      remoteDoc = updateRanking(remoteDoc, 'player-2', signRanking(remoteWallet, {
        name: 'Verdantia',
        era: 3,
        prestige: 200,
        tokens: 1000,
      }));
      const remoteBinary = saveState(remoteDoc);

      deliverMessage(gs, TOPICS.GAME_STATE, {
        type: MessageType.GameState,
        senderId: 'remote-node',
        timestamp: Date.now(),
        payload: {
          syncType: 'full',
          data: uint8ArrayToBase64(remoteBinary),
        } as SyncPayload,
      });

      const state = syncManager.getSharedState();
      expect(state.rankings['player-2']).toBeDefined();
      expect(state.rankings['player-2'].name).toBe('Verdantia');
    });

    it('ignores messages from self', () => {
      syncManager.start();

      let remoteDoc = createSharedState();
      remoteDoc = updateRanking(remoteDoc, 'player-x', {
        name: 'Ghost',
        era: 1,
        prestige: 0,
        tokens: 0,
      });

      deliverMessage(gs, TOPICS.GAME_STATE, {
        type: MessageType.GameState,
        senderId: 'local-node', // same as SyncManager's senderId
        timestamp: Date.now(),
        payload: {
          syncType: 'full',
          data: uint8ArrayToBase64(saveState(remoteDoc)),
        } as SyncPayload,
      });

      const state = syncManager.getSharedState();
      expect(state.rankings['player-x']).toBeUndefined();
    });

    it('ignores non-GameState messages', () => {
      syncManager.start();

      deliverMessage(gs, TOPICS.GAME_STATE, {
        type: MessageType.Transaction,
        senderId: 'remote-node',
        timestamp: Date.now(),
        payload: { some: 'data' },
      });

      const state = syncManager.getSharedState();
      expect(state.rankings).toEqual({});
    });

    it('ignores malformed sync payloads', () => {
      syncManager.start();

      // Should not crash
      deliverMessage(gs, TOPICS.GAME_STATE, {
        type: MessageType.GameState,
        senderId: 'remote-node',
        timestamp: Date.now(),
        payload: {
          syncType: 'full',
          data: 'not-valid-base64-automerge-data!!!',
        } as SyncPayload,
      });

      expect(syncManager.isRunning()).toBe(true);
    });

    it('ignores messages with missing payload', () => {
      syncManager.start();

      // Should not crash
      deliverMessage(gs, TOPICS.GAME_STATE, {
        type: MessageType.GameState,
        senderId: 'remote-node',
        timestamp: Date.now(),
        payload: undefined,
      });

      expect(syncManager.isRunning()).toBe(true);
    });

    it('merges remote full state with local state', () => {
      syncManager.start();

      // Add local data
      syncManager.updateLocalPlayerData('player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });

      // Receive remote data (signed)
      const remoteWallet = new Wallet();
      let remoteDoc = createSharedState();
      remoteDoc = updateRanking(remoteDoc, 'player-2', signRanking(remoteWallet, {
        name: 'Verdantia',
        era: 2,
        prestige: 50,
        tokens: 300,
      }));

      deliverMessage(gs, TOPICS.GAME_STATE, {
        type: MessageType.GameState,
        senderId: 'remote-node',
        timestamp: Date.now(),
        payload: {
          syncType: 'full',
          data: uint8ArrayToBase64(saveState(remoteDoc)),
        } as SyncPayload,
      });

      const state = syncManager.getSharedState();
      // Both local and remote data should be present
      expect(state.rankings['player-1']).toBeDefined();
      expect(state.rankings['player-2']).toBeDefined();
    });
  });

  // ── setDoc ──

  describe('setDoc', () => {
    it('replaces the internal document', () => {
      let doc = createSharedState();
      doc = updateRanking(doc, 'player-x', {
        name: 'External',
        era: 5,
        prestige: 999,
        tokens: 9999,
      });

      syncManager.setDoc(doc);

      const state = syncManager.getSharedState();
      expect(state.rankings['player-x'].name).toBe('External');
    });
  });
});

// ── Binary encoding helpers (pure functions, no network needed) ──

describe('binary encoding helpers', () => {
  it('round-trips uint8array through base64', () => {
    const original = new Uint8Array([1, 2, 3, 255, 0, 128]);
    const b64 = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(b64);

    expect(decoded).toEqual(original);
  });

  it('handles empty array', () => {
    const original = new Uint8Array([]);
    const b64 = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(b64);

    expect(decoded).toEqual(original);
  });

  it('handles large payloads', () => {
    const original = new Uint8Array(10000);
    for (let i = 0; i < original.length; i++) {
      original[i] = i % 256;
    }

    const b64 = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(b64);

    expect(decoded).toEqual(original);
  });
});
