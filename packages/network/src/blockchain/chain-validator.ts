import { Signer } from '../wallet/signer.js';
import { CommandSerializer } from './command-serializer.js';
import type { ActionBlock, ChainVerificationResult, ChainReplayFunction } from '../types/blockchain.js';

const encoder = new TextEncoder();

export class ChainValidator {
  static validateStructure(blocks: ActionBlock[]): ChainVerificationResult {
    if (blocks.length === 0) {
      return { valid: false, error: 'Chain is empty' };
    }

    // Genesis block checks
    const genesis = blocks[0];
    if (genesis.index !== 0) {
      return { valid: false, failedAtIndex: 0, error: 'Genesis block must have index 0' };
    }
    if (genesis.prevHash !== '') {
      return { valid: false, failedAtIndex: 0, error: 'Genesis block must have empty prevHash' };
    }

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      // Check index is sequential
      if (block.index !== i) {
        return {
          valid: false,
          failedAtIndex: i,
          error: `Expected index ${i} but got ${block.index}`,
        };
      }

      // Check playerId is consistent
      if (block.playerId !== genesis.playerId) {
        return {
          valid: false,
          failedAtIndex: i,
          error: `Player ID mismatch: expected ${genesis.playerId}, got ${block.playerId}`,
        };
      }

      // Check prevHash links
      if (i > 0 && block.prevHash !== blocks[i - 1].hash) {
        return {
          valid: false,
          failedAtIndex: i,
          error: `prevHash mismatch at block ${i}`,
        };
      }

      // Verify block hash
      const { hash: _hash, signature: _sig, ...partial } = block;
      const computedHash = CommandSerializer.computeBlockHash(partial);
      if (computedHash !== block.hash) {
        return {
          valid: false,
          failedAtIndex: i,
          error: `Block hash mismatch at block ${i}`,
        };
      }

      // Verify signature
      const signatureValid = Signer.verify(
        encoder.encode(block.hash),
        block.signature,
        block.publicKey,
      );
      if (!signatureValid) {
        return {
          valid: false,
          failedAtIndex: i,
          error: `Invalid signature at block ${i}`,
        };
      }
    }

    return { valid: true };
  }

  static validateWithReplay(
    blocks: ActionBlock[],
    replayFn: ChainReplayFunction,
  ): ChainVerificationResult {
    const structural = ChainValidator.validateStructure(blocks);
    if (!structural.valid) return structural;

    const genesis = blocks[0];
    const commands = blocks.slice(1).map((b) => ({
      command: b.command,
      expectedStateHash: b.stateHash,
    }));

    return replayFn(genesis.command, commands);
  }
}
