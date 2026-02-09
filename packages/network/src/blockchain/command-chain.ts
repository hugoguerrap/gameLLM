import type { Wallet } from '../wallet/wallet.js';
import type { ActionBlock, CommandPayload } from '../types/blockchain.js';
import { CommandType } from '../types/blockchain.js';
import { CommandSerializer } from './command-serializer.js';

const encoder = new TextEncoder();

export class CommandChain {
  private blocks: ActionBlock[] = [];
  private readonly wallet: Wallet;
  private readonly playerId: string;

  constructor(wallet: Wallet, playerId: string) {
    this.wallet = wallet;
    this.playerId = playerId;
  }

  createGenesis(
    playerName: string,
    biome: string,
    seed: string,
    initialStateHash: string,
  ): ActionBlock {
    if (this.blocks.length > 0) {
      throw new Error('Chain already has a genesis block');
    }

    const command: CommandPayload = {
      type: CommandType.Genesis,
      args: { playerName, biome, seed },
      tick: 0,
    };

    const block = this.buildBlock(command, initialStateHash, '', 0);
    this.blocks.push(block);
    return block;
  }

  appendBlock(command: CommandPayload, stateHash: string): ActionBlock {
    if (this.blocks.length === 0) {
      throw new Error('Chain has no genesis block. Call createGenesis first.');
    }

    const prevHash = this.blocks[this.blocks.length - 1].hash;
    const index = this.blocks.length;
    const block = this.buildBlock(command, stateHash, prevHash, index);
    this.blocks.push(block);
    return block;
  }

  loadChain(blocks: ActionBlock[]): void {
    this.blocks = [...blocks];
  }

  getBlocks(): readonly ActionBlock[] {
    return this.blocks;
  }

  getLatestBlock(): ActionBlock | undefined {
    return this.blocks[this.blocks.length - 1];
  }

  getLength(): number {
    return this.blocks.length;
  }

  getHeadHash(): string {
    const latest = this.getLatestBlock();
    return latest ? latest.hash : '';
  }

  private buildBlock(
    command: CommandPayload,
    stateHash: string,
    prevHash: string,
    index: number,
  ): ActionBlock {
    const partial = {
      prevHash,
      index,
      playerId: this.playerId,
      command,
      stateHash,
      timestamp: Date.now(),
      publicKey: this.wallet.publicKeyHex,
    };

    const hash = CommandSerializer.computeBlockHash(partial);
    const signature = this.wallet.sign(encoder.encode(hash));

    return { ...partial, hash, signature };
  }
}
