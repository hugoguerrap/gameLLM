import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChainBroadcaster } from '../../../src/p2p/chain-broadcaster.js';
import { TOPICS } from '../../../src/p2p/pubsub.js';
import { MessageType, type P2PMessage } from '../../../src/types/messages.js';
import { CommandType, type ActionBlock } from '../../../src/types/blockchain.js';
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
    getSubscribedTopics: vi.fn(() => Array.from(handlers.keys())),
    destroy: vi.fn(),
    // Test helper: simulate receiving a message
    _deliver(topic: string, msg: P2PMessage) {
      const topicHandlers = handlers.get(topic);
      if (topicHandlers) {
        for (const handler of topicHandlers) handler(msg);
      }
    },
  };
}

function createMockChainStore() {
  const blocks = new Map<string, ActionBlock[]>();
  return {
    saveBlock: vi.fn((block: ActionBlock) => {
      const chain = blocks.get(block.playerId) ?? [];
      if (!chain.find((b) => b.hash === block.hash)) {
        chain.push(block);
        blocks.set(block.playerId, chain);
      }
    }),
    loadChain: vi.fn((playerId: string) => blocks.get(playerId) ?? []),
    loadBlockRange: vi.fn(),
    getLatestBlock: vi.fn(),
    getChainLength: vi.fn((playerId: string) => (blocks.get(playerId) ?? []).length),
    hasBlock: vi.fn((hash: string) => {
      for (const chain of blocks.values()) {
        if (chain.find((b) => b.hash === hash)) return true;
      }
      return false;
    }),
    _blocks: blocks,
  };
}

function createRealBlock(wallet: Wallet, playerId: string, index: number, prevHash: string): ActionBlock {
  const chain = new CommandChain(wallet, playerId);
  if (index === 0) {
    return chain.createGenesis('TestPlayer', 'Prairie', 'seed-1', 'state-hash-0');
  }
  // Load previous blocks to build chain properly
  const genesis = chain.createGenesis('TestPlayer', 'Prairie', 'seed-1', 'state-hash-0');
  const blocks = [genesis];
  for (let i = 1; i <= index; i++) {
    const block = chain.appendBlock(
      { type: CommandType.Build, args: { buildingId: `building_${i}` }, tick: i },
      `state-hash-${i}`,
    );
    blocks.push(block);
  }
  return blocks[blocks.length - 1];
}

describe('ChainBroadcaster', () => {
  let pubsub: ReturnType<typeof createMockPubSub>;
  let chainStore: ReturnType<typeof createMockChainStore>;
  let broadcaster: ChainBroadcaster;
  const localPlayerId = 'local-player';

  beforeEach(() => {
    pubsub = createMockPubSub();
    chainStore = createMockChainStore();
    broadcaster = new ChainBroadcaster(pubsub as any, chainStore as any, localPlayerId);
  });

  it('subscribes to COMMANDS topic on start', () => {
    broadcaster.start();
    expect(pubsub.subscribe).toHaveBeenCalledWith(TOPICS.COMMANDS, expect.any(Function));
  });

  it('unsubscribes from COMMANDS topic on stop', () => {
    broadcaster.start();
    broadcaster.stop();
    expect(pubsub.unsubscribe).toHaveBeenCalledWith(TOPICS.COMMANDS, expect.any(Function));
  });

  it('start is idempotent', () => {
    broadcaster.start();
    broadcaster.start();
    expect(pubsub.subscribe).toHaveBeenCalledTimes(1);
  });

  it('stop is idempotent', () => {
    broadcaster.start();
    broadcaster.stop();
    broadcaster.stop();
    expect(pubsub.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('broadcasts a block to the COMMANDS topic', () => {
    const wallet = new Wallet();
    const chain = new CommandChain(wallet, localPlayerId);
    const block = chain.createGenesis('Test', 'Prairie', 'seed', 'hash0');

    broadcaster.broadcastBlock(block);

    expect(pubsub.publish).toHaveBeenCalledWith(TOPICS.COMMANDS, expect.objectContaining({
      type: MessageType.CommandBlock,
      senderId: localPlayerId,
      payload: { block },
    }));
  });

  it('sends a chain request', () => {
    broadcaster.requestChain('remote-player', 5);

    expect(pubsub.publish).toHaveBeenCalledWith(TOPICS.COMMANDS, expect.objectContaining({
      type: MessageType.ChainRequest,
      senderId: localPlayerId,
      payload: {
        playerId: 'remote-player',
        fromIndex: 5,
        requesterId: localPlayerId,
      },
    }));
  });

  describe('receiving remote blocks', () => {
    const remotePlayerId = 'remote-player';
    let remoteWallet: Wallet;
    let remoteChain: CommandChain;

    beforeEach(() => {
      remoteWallet = new Wallet();
      remoteChain = new CommandChain(remoteWallet, remotePlayerId);
      broadcaster.start();
    });

    it('stores a valid genesis block from a remote player', () => {
      const genesis = remoteChain.createGenesis('Remote', 'Prairie', 'seed', 'hash0');

      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: remotePlayerId,
        timestamp: Date.now(),
        payload: { block: genesis },
      });

      expect(chainStore.saveBlock).toHaveBeenCalledWith(genesis);
      expect(broadcaster.getRemoteChain(remotePlayerId)).toHaveLength(1);
    });

    it('ignores blocks from self', () => {
      const wallet = new Wallet();
      const chain = new CommandChain(wallet, localPlayerId);
      const block = chain.createGenesis('Local', 'Prairie', 'seed', 'hash0');

      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: localPlayerId,
        timestamp: Date.now(),
        payload: { block },
      });

      expect(chainStore.saveBlock).not.toHaveBeenCalled();
    });

    it('ignores blocks with own playerId', () => {
      const wallet = new Wallet();
      const chain = new CommandChain(wallet, localPlayerId);
      const block = chain.createGenesis('Local', 'Prairie', 'seed', 'hash0');

      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: 'other-sender',
        timestamp: Date.now(),
        payload: { block },
      });

      expect(chainStore.saveBlock).not.toHaveBeenCalled();
    });

    it('stores consecutive blocks and builds remote chain', () => {
      const genesis = remoteChain.createGenesis('Remote', 'Prairie', 'seed', 'hash0');
      const block1 = remoteChain.appendBlock(
        { type: CommandType.Build, args: { buildingId: 'granja' }, tick: 1 },
        'hash1',
      );

      // Deliver genesis first
      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: remotePlayerId,
        timestamp: Date.now(),
        payload: { block: genesis },
      });

      // Then block 1
      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: remotePlayerId,
        timestamp: Date.now(),
        payload: { block: block1 },
      });

      expect(broadcaster.getRemoteChain(remotePlayerId)).toHaveLength(2);
    });

    it('fires remoteBlockHandler for new blocks', () => {
      const handler = vi.fn();
      broadcaster.onRemoteBlock(handler);

      const genesis = remoteChain.createGenesis('Remote', 'Prairie', 'seed', 'hash0');
      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: remotePlayerId,
        timestamp: Date.now(),
        payload: { block: genesis },
      });

      expect(handler).toHaveBeenCalledWith(genesis);
    });

    it('ignores duplicate blocks (already in chain store)', () => {
      const genesis = remoteChain.createGenesis('Remote', 'Prairie', 'seed', 'hash0');

      // Deliver once
      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: remotePlayerId,
        timestamp: Date.now(),
        payload: { block: genesis },
      });

      // Deliver same block again
      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: remotePlayerId,
        timestamp: Date.now(),
        payload: { block: genesis },
      });

      // saveBlock should be called once for the first delivery
      // (second is skipped because hasBlock returns true)
      expect(broadcaster.getRemoteChain(remotePlayerId)).toHaveLength(1);
    });

    it('rejects blocks with invalid signature', () => {
      const genesis = remoteChain.createGenesis('Remote', 'Prairie', 'seed', 'hash0');
      const tamperedBlock = { ...genesis, signature: 'bad-sig' };

      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.CommandBlock,
        senderId: remotePlayerId,
        timestamp: Date.now(),
        payload: { block: tamperedBlock },
      });

      expect(chainStore.saveBlock).not.toHaveBeenCalled();
      expect(broadcaster.getRemoteChain(remotePlayerId)).toHaveLength(0);
    });
  });

  describe('chain request/response', () => {
    it('responds to chain requests for our own chain', () => {
      const wallet = new Wallet();
      const chain = new CommandChain(wallet, localPlayerId);
      const genesis = chain.createGenesis('Local', 'Prairie', 'seed', 'hash0');
      chainStore.saveBlock(genesis);
      broadcaster.start();

      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.ChainRequest,
        senderId: 'requester-id',
        timestamp: Date.now(),
        payload: {
          playerId: localPlayerId,
          fromIndex: 0,
          requesterId: 'requester-id',
        },
      });

      expect(pubsub.publish).toHaveBeenCalledWith(
        TOPICS.COMMANDS,
        expect.objectContaining({
          type: MessageType.ChainResponse,
          senderId: localPlayerId,
        }),
      );
    });

    it('ignores chain requests for other players chains', () => {
      broadcaster.start();

      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.ChainRequest,
        senderId: 'requester-id',
        timestamp: Date.now(),
        payload: {
          playerId: 'some-other-player',
          fromIndex: 0,
          requesterId: 'requester-id',
        },
      });

      expect(pubsub.publish).not.toHaveBeenCalled();
    });

    it('processes chain response and stores blocks', () => {
      const remoteWallet = new Wallet();
      const remoteChain = new CommandChain(remoteWallet, 'remote-player');
      const genesis = remoteChain.createGenesis('Remote', 'Prairie', 'seed', 'hash0');
      const block1 = remoteChain.appendBlock(
        { type: CommandType.Build, args: { buildingId: 'granja' }, tick: 1 },
        'hash1',
      );
      broadcaster.start();

      pubsub._deliver(TOPICS.COMMANDS, {
        type: MessageType.ChainResponse,
        senderId: 'remote-player',
        timestamp: Date.now(),
        payload: {
          playerId: 'remote-player',
          blocks: [genesis, block1],
        },
      });

      expect(broadcaster.getRemoteChain('remote-player')).toHaveLength(2);
    });
  });

  it('getKnownPlayerIds returns all remote player IDs', () => {
    const wallet1 = new Wallet();
    const chain1 = new CommandChain(wallet1, 'player-a');
    const genesis1 = chain1.createGenesis('A', 'Prairie', 'seed', 'hash0');

    const wallet2 = new Wallet();
    const chain2 = new CommandChain(wallet2, 'player-b');
    const genesis2 = chain2.createGenesis('B', 'Prairie', 'seed', 'hash0');

    broadcaster.start();

    pubsub._deliver(TOPICS.COMMANDS, {
      type: MessageType.CommandBlock,
      senderId: 'player-a',
      timestamp: Date.now(),
      payload: { block: genesis1 },
    });

    pubsub._deliver(TOPICS.COMMANDS, {
      type: MessageType.CommandBlock,
      senderId: 'player-b',
      timestamp: Date.now(),
      payload: { block: genesis2 },
    });

    const ids = broadcaster.getKnownPlayerIds();
    expect(ids).toContain('player-a');
    expect(ids).toContain('player-b');
  });
});
