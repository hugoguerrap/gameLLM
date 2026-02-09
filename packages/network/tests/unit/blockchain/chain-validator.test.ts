import { describe, it, expect, beforeEach } from 'vitest';
import { ChainValidator } from '../../../src/blockchain/chain-validator.js';
import { CommandChain } from '../../../src/blockchain/command-chain.js';
import { CommandSerializer } from '../../../src/blockchain/command-serializer.js';
import { CommandType, type ActionBlock, type ChainVerificationResult } from '../../../src/types/blockchain.js';
import { Wallet } from '../../../src/wallet/wallet.js';

describe('ChainValidator', () => {
  let wallet: Wallet;

  function buildChain(numCommands: number = 2): ActionBlock[] {
    const chain = new CommandChain(wallet, 'player-1');
    chain.createGenesis('Test', 'plains', 'seed', 'h0');
    for (let i = 0; i < numCommands; i++) {
      const payload = CommandSerializer.serialize(
        CommandType.Build,
        { buildingId: `building_${i}` },
        i + 1,
      );
      chain.appendBlock(payload, `h${i + 1}`);
    }
    return [...chain.getBlocks()];
  }

  beforeEach(() => {
    wallet = new Wallet();
  });

  describe('validateStructure', () => {
    it('valid chain passes', () => {
      const blocks = buildChain();
      const result = ChainValidator.validateStructure(blocks);
      expect(result.valid).toBe(true);
    });

    it('empty chain fails', () => {
      const result = ChainValidator.validateStructure([]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('genesis-only chain passes', () => {
      const blocks = buildChain(0);
      expect(blocks).toHaveLength(1);
      const result = ChainValidator.validateStructure(blocks);
      expect(result.valid).toBe(true);
    });

    it('detects broken hash link', () => {
      const blocks = buildChain();
      // Tamper with prevHash of block 1
      blocks[1] = { ...blocks[1], prevHash: 'tampered-hash' };

      const result = ChainValidator.validateStructure(blocks);
      expect(result.valid).toBe(false);
      expect(result.failedAtIndex).toBe(1);
      expect(result.error).toContain('prevHash');
    });

    it('detects tampered block hash', () => {
      const blocks = buildChain();
      // Tamper with block content but keep original hash
      blocks[1] = { ...blocks[1], stateHash: 'tampered' };

      const result = ChainValidator.validateStructure(blocks);
      expect(result.valid).toBe(false);
      expect(result.failedAtIndex).toBe(1);
      expect(result.error).toContain('hash mismatch');
    });

    it('detects invalid signature', () => {
      const blocks = buildChain();
      // Replace signature with garbage
      blocks[1] = { ...blocks[1], signature: 'a'.repeat(128) };

      const result = ChainValidator.validateStructure(blocks);
      expect(result.valid).toBe(false);
      expect(result.failedAtIndex).toBe(1);
      expect(result.error).toContain('signature');
    });

    it('detects non-sequential indices', () => {
      const blocks = buildChain();
      blocks[1] = { ...blocks[1], index: 5 };

      const result = ChainValidator.validateStructure(blocks);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('index');
    });

    it('detects mismatched playerId', () => {
      const blocks = buildChain();
      blocks[1] = { ...blocks[1], playerId: 'different-player' };

      const result = ChainValidator.validateStructure(blocks);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Player ID');
    });

    it('detects genesis with non-zero index', () => {
      const blocks = buildChain();
      blocks[0] = { ...blocks[0], index: 1 };

      const result = ChainValidator.validateStructure(blocks);
      expect(result.valid).toBe(false);
      expect(result.failedAtIndex).toBe(0);
    });

    it('detects genesis with non-empty prevHash', () => {
      const blocks = buildChain(0);
      blocks[0] = { ...blocks[0], prevHash: 'should-be-empty' };

      const result = ChainValidator.validateStructure(blocks);
      expect(result.valid).toBe(false);
      expect(result.failedAtIndex).toBe(0);
      expect(result.error).toContain('prevHash');
    });

    it('longer chain validates correctly', () => {
      const blocks = buildChain(10);
      expect(blocks).toHaveLength(11); // genesis + 10
      const result = ChainValidator.validateStructure(blocks);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateWithReplay', () => {
    it('calls replayFn and returns its result on valid structure', () => {
      const blocks = buildChain();
      const mockResult: ChainVerificationResult = { valid: true };

      const result = ChainValidator.validateWithReplay(blocks, () => mockResult);
      expect(result.valid).toBe(true);
    });

    it('returns structural error before calling replayFn', () => {
      const result = ChainValidator.validateWithReplay([], () => ({
        valid: true,
      }));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('passes genesis and commands to replayFn', () => {
      const blocks = buildChain(2);
      let receivedGenesis: unknown;
      let receivedCommands: unknown[];

      ChainValidator.validateWithReplay(blocks, (genesis, commands) => {
        receivedGenesis = genesis;
        receivedCommands = commands;
        return { valid: true };
      });

      expect(receivedGenesis).toBeDefined();
      expect((receivedGenesis as { type: string }).type).toBe(CommandType.Genesis);
      expect(receivedCommands!).toHaveLength(2);
    });

    it('replayFn can report failure at specific index', () => {
      const blocks = buildChain(3);
      const result = ChainValidator.validateWithReplay(blocks, () => ({
        valid: false,
        failedAtIndex: 2,
        error: 'State hash mismatch',
        computedStateHash: 'computed',
        claimedStateHash: 'claimed',
      }));

      expect(result.valid).toBe(false);
      expect(result.failedAtIndex).toBe(2);
      expect(result.computedStateHash).toBe('computed');
    });
  });
});
