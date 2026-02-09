import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChainStore } from '../../../src/persistence/chain-store.js';
import { GameDatabase } from '../../../src/persistence/database.js';
import { CommandChain } from '../../../src/blockchain/command-chain.js';
import { CommandSerializer } from '../../../src/blockchain/command-serializer.js';
import { CommandType } from '../../../src/types/blockchain.js';
import { Wallet } from '../../../src/wallet/wallet.js';

describe('ChainStore', () => {
  let db: GameDatabase;
  let store: ChainStore;
  let wallet: Wallet;

  beforeEach(() => {
    db = new GameDatabase(':memory:');
    db.migrate();
    store = new ChainStore(db.getDb());
    wallet = new Wallet();
  });

  afterEach(() => {
    db.close();
  });

  function createChainWithBlocks(playerId: string, count: number) {
    const chain = new CommandChain(wallet, playerId);
    chain.createGenesis('Test', 'plains', 'seed', 'h0');
    for (let i = 0; i < count; i++) {
      const payload = CommandSerializer.serialize(
        CommandType.Build,
        { buildingId: `b${i}` },
        i + 1,
      );
      chain.appendBlock(payload, `h${i + 1}`);
    }
    return [...chain.getBlocks()];
  }

  describe('saveBlock + loadChain', () => {
    it('saves and loads a single genesis block', () => {
      const blocks = createChainWithBlocks('player-1', 0);
      store.saveBlock(blocks[0]);

      const loaded = store.loadChain('player-1');
      expect(loaded).toHaveLength(1);
      expect(loaded[0].hash).toBe(blocks[0].hash);
      expect(loaded[0].command.type).toBe(CommandType.Genesis);
    });

    it('saves and loads multiple blocks in order', () => {
      const blocks = createChainWithBlocks('player-1', 3);
      for (const b of blocks) store.saveBlock(b);

      const loaded = store.loadChain('player-1');
      expect(loaded).toHaveLength(4);
      for (let i = 0; i < loaded.length; i++) {
        expect(loaded[i].index).toBe(i);
        expect(loaded[i].hash).toBe(blocks[i].hash);
      }
    });

    it('returns empty array for unknown player', () => {
      const loaded = store.loadChain('unknown');
      expect(loaded).toHaveLength(0);
    });

    it('preserves command args through round-trip', () => {
      const blocks = createChainWithBlocks('player-1', 1);
      for (const b of blocks) store.saveBlock(b);

      const loaded = store.loadChain('player-1');
      expect(loaded[1].command.args).toEqual({ buildingId: 'b0' });
    });
  });

  describe('loadBlockRange', () => {
    it('loads a range of blocks', () => {
      const blocks = createChainWithBlocks('player-1', 5);
      for (const b of blocks) store.saveBlock(b);

      const range = store.loadBlockRange('player-1', 2, 4);
      expect(range).toHaveLength(3);
      expect(range[0].index).toBe(2);
      expect(range[2].index).toBe(4);
    });
  });

  describe('getLatestBlock', () => {
    it('returns the highest index block', () => {
      const blocks = createChainWithBlocks('player-1', 3);
      for (const b of blocks) store.saveBlock(b);

      const latest = store.getLatestBlock('player-1');
      expect(latest).not.toBeNull();
      expect(latest!.index).toBe(3);
    });

    it('returns null for unknown player', () => {
      expect(store.getLatestBlock('unknown')).toBeNull();
    });
  });

  describe('getChainLength', () => {
    it('returns correct count', () => {
      const blocks = createChainWithBlocks('player-1', 4);
      for (const b of blocks) store.saveBlock(b);

      expect(store.getChainLength('player-1')).toBe(5);
    });

    it('returns 0 for unknown player', () => {
      expect(store.getChainLength('unknown')).toBe(0);
    });
  });

  describe('hasBlock', () => {
    it('returns true for existing block', () => {
      const blocks = createChainWithBlocks('player-1', 0);
      store.saveBlock(blocks[0]);

      expect(store.hasBlock(blocks[0].hash)).toBe(true);
    });

    it('returns false for missing block', () => {
      expect(store.hasBlock('nonexistent-hash')).toBe(false);
    });
  });

  describe('multi-player isolation', () => {
    it('different players have independent chains', () => {
      const wallet2 = new Wallet();
      const chain2 = new CommandChain(wallet2, 'player-2');
      chain2.createGenesis('Test2', 'forest', 'seed2', 'h0-2');

      const blocks1 = createChainWithBlocks('player-1', 2);
      const blocks2 = [...chain2.getBlocks()];

      for (const b of blocks1) store.saveBlock(b);
      for (const b of blocks2) store.saveBlock(b);

      expect(store.getChainLength('player-1')).toBe(3);
      expect(store.getChainLength('player-2')).toBe(1);
    });
  });

  describe('idempotency', () => {
    it('saving the same block twice does not error', () => {
      const blocks = createChainWithBlocks('player-1', 0);
      store.saveBlock(blocks[0]);
      expect(() => store.saveBlock(blocks[0])).not.toThrow();
      expect(store.getChainLength('player-1')).toBe(1);
    });
  });
});
