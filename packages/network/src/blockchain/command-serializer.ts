import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import type { CommandPayload, ActionBlock, CommandType } from '../types/blockchain.js';

const encoder = new TextEncoder();

function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k]),
  );
  return '{' + pairs.join(',') + '}';
}

export class CommandSerializer {
  static serialize(
    type: CommandType,
    args: Record<string, unknown>,
    tick: number,
  ): CommandPayload {
    return { type, args, tick };
  }

  static canonicalize(
    block: Omit<ActionBlock, 'hash' | 'signature'>,
  ): string {
    return stableStringify({
      prevHash: block.prevHash,
      index: block.index,
      playerId: block.playerId,
      command: block.command,
      stateHash: block.stateHash,
      timestamp: block.timestamp,
      publicKey: block.publicKey,
    });
  }

  static computeBlockHash(
    block: Omit<ActionBlock, 'hash' | 'signature'>,
  ): string {
    const canonical = CommandSerializer.canonicalize(block);
    return bytesToHex(sha256(encoder.encode(canonical)));
  }
}

export function computeStateHash(state: unknown): string {
  const json = stableStringify(state);
  return bytesToHex(sha256(encoder.encode(json)));
}

export { stableStringify };
