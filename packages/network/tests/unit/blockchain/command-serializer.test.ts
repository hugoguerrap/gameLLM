import { describe, it, expect } from 'vitest';
import { CommandSerializer, stableStringify, computeStateHash } from '../../../src/blockchain/command-serializer.js';
import { CommandType } from '../../../src/types/blockchain.js';

describe('CommandSerializer', () => {
  describe('serialize', () => {
    it('creates a CommandPayload from type, args, and tick', () => {
      const payload = CommandSerializer.serialize(
        CommandType.Build,
        { buildingId: 'granja' },
        5,
      );
      expect(payload.type).toBe(CommandType.Build);
      expect(payload.args).toEqual({ buildingId: 'granja' });
      expect(payload.tick).toBe(5);
    });

    it('handles empty args', () => {
      const payload = CommandSerializer.serialize(CommandType.Ascend, {}, 10);
      expect(payload.args).toEqual({});
    });

    it('handles complex args', () => {
      const payload = CommandSerializer.serialize(
        CommandType.PvpAttack,
        { targetPlayerId: 'p2', targetArmy: { soldier: 5 } },
        20,
      );
      expect(payload.args.targetPlayerId).toBe('p2');
      expect(payload.args.targetArmy).toEqual({ soldier: 5 });
    });
  });

  describe('canonicalize', () => {
    it('produces deterministic JSON with sorted keys', () => {
      const block = {
        prevHash: 'abc',
        index: 1,
        playerId: 'player-1',
        command: { type: CommandType.Build, args: { buildingId: 'granja' }, tick: 5 },
        stateHash: 'def',
        timestamp: 1000,
        publicKey: 'pub123',
      };

      const result1 = CommandSerializer.canonicalize(block);
      const result2 = CommandSerializer.canonicalize(block);
      expect(result1).toBe(result2);
    });

    it('key order does not affect output', () => {
      const block1 = {
        prevHash: 'abc',
        index: 0,
        playerId: 'p1',
        command: { type: CommandType.Genesis, args: { a: 1, b: 2 }, tick: 0 },
        stateHash: 'hash',
        timestamp: 100,
        publicKey: 'key',
      };

      // Same data, "different" object
      const block2 = {
        timestamp: 100,
        publicKey: 'key',
        prevHash: 'abc',
        playerId: 'p1',
        index: 0,
        stateHash: 'hash',
        command: { type: CommandType.Genesis, args: { b: 2, a: 1 }, tick: 0 },
      };

      expect(CommandSerializer.canonicalize(block1)).toBe(
        CommandSerializer.canonicalize(block2),
      );
    });
  });

  describe('computeBlockHash', () => {
    it('returns a hex string', () => {
      const block = {
        prevHash: '',
        index: 0,
        playerId: 'player-1',
        command: { type: CommandType.Genesis, args: { name: 'test' }, tick: 0 },
        stateHash: 'abc',
        timestamp: 1000,
        publicKey: 'pub',
      };

      const hash = CommandSerializer.computeBlockHash(block);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('same input produces same hash', () => {
      const block = {
        prevHash: '',
        index: 0,
        playerId: 'player-1',
        command: { type: CommandType.Genesis, args: {}, tick: 0 },
        stateHash: 'abc',
        timestamp: 1000,
        publicKey: 'pub',
      };

      expect(CommandSerializer.computeBlockHash(block)).toBe(
        CommandSerializer.computeBlockHash(block),
      );
    });

    it('different input produces different hash', () => {
      const block1 = {
        prevHash: '',
        index: 0,
        playerId: 'player-1',
        command: { type: CommandType.Genesis, args: {}, tick: 0 },
        stateHash: 'abc',
        timestamp: 1000,
        publicKey: 'pub',
      };

      const block2 = { ...block1, index: 1 };
      expect(CommandSerializer.computeBlockHash(block1)).not.toBe(
        CommandSerializer.computeBlockHash(block2),
      );
    });
  });

  describe('stableStringify', () => {
    it('sorts object keys', () => {
      const result = stableStringify({ z: 1, a: 2 });
      expect(result).toBe('{"a":2,"z":1}');
    });

    it('handles nested objects', () => {
      const result = stableStringify({ b: { z: 1, a: 2 }, a: 3 });
      expect(result).toBe('{"a":3,"b":{"a":2,"z":1}}');
    });

    it('handles arrays', () => {
      const result = stableStringify([3, 1, 2]);
      expect(result).toBe('[3,1,2]');
    });

    it('handles null and primitives', () => {
      expect(stableStringify(null)).toBe('null');
      expect(stableStringify(42)).toBe('42');
      expect(stableStringify('hello')).toBe('"hello"');
    });
  });

  describe('computeStateHash', () => {
    it('returns a hex SHA-256 hash', () => {
      const hash = computeStateHash({ foo: 'bar' });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic', () => {
      const state = { resources: { wood: 100 }, name: 'Test' };
      expect(computeStateHash(state)).toBe(computeStateHash(state));
    });
  });
});
