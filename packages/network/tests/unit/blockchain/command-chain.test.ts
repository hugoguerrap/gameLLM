import { describe, it, expect, beforeEach } from 'vitest';
import { CommandChain } from '../../../src/blockchain/command-chain.js';
import { CommandSerializer } from '../../../src/blockchain/command-serializer.js';
import { CommandType } from '../../../src/types/blockchain.js';
import { Wallet } from '../../../src/wallet/wallet.js';
import { Signer } from '../../../src/wallet/signer.js';

describe('CommandChain', () => {
  let wallet: Wallet;
  let chain: CommandChain;

  beforeEach(() => {
    wallet = new Wallet();
    chain = new CommandChain(wallet, 'player-1');
  });

  describe('createGenesis', () => {
    it('creates a genesis block with index 0', () => {
      const block = chain.createGenesis('Ironforge', 'mountain', 'seed-1', 'stateHash0');
      expect(block.index).toBe(0);
      expect(block.prevHash).toBe('');
      expect(block.playerId).toBe('player-1');
      expect(block.command.type).toBe(CommandType.Genesis);
      expect(block.command.args.playerName).toBe('Ironforge');
      expect(block.stateHash).toBe('stateHash0');
    });

    it('genesis block has valid hash', () => {
      const block = chain.createGenesis('Test', 'plains', 'seed', 'hash0');
      expect(block.hash).toMatch(/^[0-9a-f]{64}$/);

      // Verify hash is correct
      const { hash: _h, signature: _s, ...partial } = block;
      const computed = CommandSerializer.computeBlockHash(partial);
      expect(computed).toBe(block.hash);
    });

    it('genesis block has valid signature', () => {
      const block = chain.createGenesis('Test', 'plains', 'seed', 'hash0');
      const encoder = new TextEncoder();
      const valid = Signer.verify(
        encoder.encode(block.hash),
        block.signature,
        block.publicKey,
      );
      expect(valid).toBe(true);
    });

    it('throws if called twice', () => {
      chain.createGenesis('Test', 'plains', 'seed', 'hash0');
      expect(() => chain.createGenesis('Test2', 'forest', 'seed2', 'hash1')).toThrow(
        'already has a genesis',
      );
    });
  });

  describe('appendBlock', () => {
    it('appends block with correct prevHash', () => {
      const genesis = chain.createGenesis('Test', 'plains', 'seed', 'hash0');
      const payload = CommandSerializer.serialize(CommandType.Build, { buildingId: 'granja' }, 5);
      const block = chain.appendBlock(payload, 'hash1');

      expect(block.index).toBe(1);
      expect(block.prevHash).toBe(genesis.hash);
    });

    it('chain grows sequentially', () => {
      chain.createGenesis('Test', 'plains', 'seed', 'h0');

      const p1 = CommandSerializer.serialize(CommandType.Build, { buildingId: 'granja' }, 1);
      const b1 = chain.appendBlock(p1, 'h1');

      const p2 = CommandSerializer.serialize(CommandType.Recruit, { unitType: 'soldier', count: 5 }, 2);
      const b2 = chain.appendBlock(p2, 'h2');

      expect(b1.index).toBe(1);
      expect(b2.index).toBe(2);
      expect(b2.prevHash).toBe(b1.hash);
    });

    it('throws without genesis', () => {
      const payload = CommandSerializer.serialize(CommandType.Build, {}, 0);
      expect(() => chain.appendBlock(payload, 'hash')).toThrow('no genesis');
    });

    it('each block has valid signature', () => {
      chain.createGenesis('Test', 'plains', 'seed', 'h0');
      const payload = CommandSerializer.serialize(CommandType.Build, {}, 5);
      const block = chain.appendBlock(payload, 'h1');

      const encoder = new TextEncoder();
      const valid = Signer.verify(
        encoder.encode(block.hash),
        block.signature,
        block.publicKey,
      );
      expect(valid).toBe(true);
    });
  });

  describe('loadChain', () => {
    it('loads an existing chain', () => {
      chain.createGenesis('Test', 'plains', 'seed', 'h0');
      const payload = CommandSerializer.serialize(CommandType.Build, {}, 5);
      chain.appendBlock(payload, 'h1');

      const blocks = [...chain.getBlocks()];

      const chain2 = new CommandChain(wallet, 'player-1');
      chain2.loadChain(blocks);
      expect(chain2.getLength()).toBe(2);
      expect(chain2.getHeadHash()).toBe(blocks[1].hash);
    });
  });

  describe('getters', () => {
    it('getLength returns block count', () => {
      expect(chain.getLength()).toBe(0);
      chain.createGenesis('Test', 'plains', 'seed', 'h0');
      expect(chain.getLength()).toBe(1);
    });

    it('getHeadHash returns empty for empty chain', () => {
      expect(chain.getHeadHash()).toBe('');
    });

    it('getLatestBlock returns undefined for empty chain', () => {
      expect(chain.getLatestBlock()).toBeUndefined();
    });

    it('getLatestBlock returns the last block', () => {
      const genesis = chain.createGenesis('Test', 'plains', 'seed', 'h0');
      expect(chain.getLatestBlock()).toEqual(genesis);
    });

    it('getBlocks returns readonly array', () => {
      chain.createGenesis('Test', 'plains', 'seed', 'h0');
      const blocks = chain.getBlocks();
      expect(blocks).toHaveLength(1);
    });
  });
});
