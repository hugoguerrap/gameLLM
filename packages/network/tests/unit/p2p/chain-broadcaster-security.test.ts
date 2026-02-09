import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChainBroadcaster } from '../../../src/p2p/chain-broadcaster.js';
import { TOPICS } from '../../../src/p2p/pubsub.js';
import { MessageType, type P2PMessage } from '../../../src/types/messages.js';
import { CommandType } from '../../../src/types/blockchain.js';
import { Wallet } from '../../../src/wallet/wallet.js';
import { CommandChain } from '../../../src/blockchain/command-chain.js';

function createMockPubSub() {
  const handlers = new Map<string, Set<(msg: P2PMessage) => void>>();
  return {
    publish: vi.fn(async () => {}),
    subscribe: vi.fn((topic: string, handler: (msg: P2PMessage) => void) => {
      if (!handlers.has(topic)) handlers.set(topic, new Set());
      handlers.get(topic)!.add(handler);
    }),
    unsubscribe: vi.fn((topic: string, handler?: (msg: P2PMessage) => void) => {
      if (handler) handlers.get(topic)?.delete(handler);
      else handlers.delete(topic);
    }),
    _deliver(topic: string, msg: P2PMessage) {
      const topicHandlers = handlers.get(topic);
      if (topicHandlers) {
        for (const handler of topicHandlers) handler(msg);
      }
    },
  };
}

function createMockChainStore() {
  const blocks = new Map<string, Array<{ hash: string; playerId: string; index: number }>>();
  return {
    saveBlock: vi.fn((block: { hash: string; playerId: string; index: number }) => {
      const chain = blocks.get(block.playerId) ?? [];
      if (!chain.find((b) => b.hash === block.hash)) {
        chain.push(block);
        blocks.set(block.playerId, chain);
      }
    }),
    loadChain: vi.fn((playerId: string) => blocks.get(playerId) ?? []),
    hasBlock: vi.fn((hash: string) => {
      for (const chain of blocks.values()) {
        if (chain.find((b) => b.hash === hash)) return true;
      }
      return false;
    }),
    getChainLength: vi.fn(() => 0),
    loadBlockRange: vi.fn(() => []),
    getLatestBlock: vi.fn(),
  };
}

function createChainAndBlocks(wallet: Wallet, playerId: string, count: number) {
  const chain = new CommandChain(wallet, playerId);
  const genesis = chain.createGenesis('TestPlayer', 'Prairie', 'seed-1', 'state-hash-0');
  const blocks = [genesis];
  for (let i = 1; i < count; i++) {
    blocks.push(chain.appendBlock(
      { type: CommandType.Build, args: { buildingId: `granja` }, tick: i },
      `state-hash-${i}`,
    ));
  }
  return blocks;
}

describe('ChainBroadcaster Security', () => {
  let pubsub: ReturnType<typeof createMockPubSub>;
  let chainStore: ReturnType<typeof createMockChainStore>;
  let broadcaster: ChainBroadcaster;

  const wallet1 = new Wallet();
  const wallet2 = new Wallet();

  beforeEach(() => {
    pubsub = createMockPubSub();
    chainStore = createMockChainStore();
    broadcaster = new ChainBroadcaster(pubsub as any, chainStore as any, 'local-player');
    broadcaster.start();
  });

  describe('playerId ↔ publicKey registry', () => {
    it('registers key from genesis block', () => {
      const blocks = createChainAndBlocks(wallet1, 'player-1', 1);
      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: 'remote-node',
        timestamp: Date.now(),
        payload: { block: blocks[0] },
      });

      expect(broadcaster.getPlayerPublicKey('player-1')).toBe(wallet1.publicKeyHex);
      expect(broadcaster.getRemoteChain('player-1')).toHaveLength(1);
    });

    it('accepts subsequent blocks with matching key', () => {
      const blocks = createChainAndBlocks(wallet1, 'player-1', 3);
      for (const block of blocks) {
        pubsub._deliver(TOPICS.COMMANDS, {
          type: MessageType.CommandBlock,
          senderId: 'remote-node',
          timestamp: Date.now(),
          payload: { block },
        });
      }

      expect(broadcaster.getRemoteChain('player-1')).toHaveLength(3);
      expect(broadcaster.getPlayerPublicKey('player-1')).toBe(wallet1.publicKeyHex);
    });

    it('rejects second genesis from different key for same playerId', () => {
      // Send genesis from wallet1
      const blocks1 = createChainAndBlocks(wallet1, 'player-1', 1);
      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: 'remote-node',
        timestamp: Date.now(),
        payload: { block: blocks1[0] },
      });

      // Try to send genesis from wallet2 with same playerId
      const blocks2 = createChainAndBlocks(wallet2, 'player-1', 1);
      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: 'attacker-node',
        timestamp: Date.now(),
        payload: { block: blocks2[0] },
      });

      // Still only 1 block, from wallet1
      expect(broadcaster.getRemoteChain('player-1')).toHaveLength(1);
      expect(broadcaster.getPlayerPublicKey('player-1')).toBe(wallet1.publicKeyHex);
    });

    it('rejects non-genesis block from unknown player (no registered key)', () => {
      const blocks = createChainAndBlocks(wallet1, 'player-1', 2);

      // Skip genesis, send block index=1
      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: 'remote-node',
        timestamp: Date.now(),
        payload: { block: blocks[1] },
      });

      // Should not be accepted
      expect(broadcaster.getRemoteChain('player-1')).toHaveLength(0);
    });
  });

  describe('rate limiting', () => {
    it('accepts messages within rate limit', () => {
      const blocks = createChainAndBlocks(wallet1, 'player-1', 3);
      const received: unknown[] = [];
      broadcaster.onRemoteBlock((b) => received.push(b));

      for (const block of blocks) {
        pubsub._deliver(TOPICS.COMMANDS, {
          type: MessageType.CommandBlock,
          senderId: 'remote-node',
          timestamp: Date.now(),
          payload: { block },
        });
      }

      expect(received).toHaveLength(3);
    });
  });
});
