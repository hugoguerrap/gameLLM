import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GameController } from '../../../src/game-controller.js';
import { BiomeType } from '@nodecoin/engine';
import { Wallet } from '@nodecoin/network';

describe('Blockchain tools (via GameController)', () => {
  let tmpDir: string;
  let controller: GameController;
  let wallet: Wallet;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'blockchain-test-'));
    wallet = new Wallet();
    controller = new GameController({
      dbPath: path.join(tmpDir, 'game.db'),
      playerId: 'player-test',
      playerName: 'TestPlayer',
      biome: BiomeType.Prairie,
      seed: 'test-seed',
      wallet,
    });
  });

  afterEach(() => {
    try { controller.shutdown(); } catch { /* ok */ }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getChainStatus', () => {
    it('returns chain with genesis block on new game', () => {
      const status = controller.getChainStatus();
      expect(status.length).toBe(1); // genesis
      expect(status.headHash).toBeTruthy();
      expect(status.genesisHash).toBeTruthy();
      expect(status.headHash).toBe(status.genesisHash);
    });

    it('chain grows when commands execute', () => {
      controller.build('granja');
      const status = controller.getChainStatus();
      expect(status.length).toBe(2); // genesis + build
    });
  });

  describe('verifyChain', () => {
    it('genesis-only chain is valid', () => {
      const result = controller.verifyChain();
      expect(result.valid).toBe(true);
    });

    it('chain with commands is valid', () => {
      controller.build('granja');
      controller.build('aserradero');
      controller.research('agriculture');

      const result = controller.verifyChain();
      expect(result.valid).toBe(true);
    });
  });

  describe('getChainBlocks', () => {
    it('returns genesis block', () => {
      const blocks = controller.getChainBlocks(10);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].command.type).toBe('genesis');
      expect(blocks[0].index).toBe(0);
    });

    it('returns all blocks after commands', () => {
      controller.build('granja');
      controller.build('aserradero');

      const blocks = controller.getChainBlocks(10);
      expect(blocks).toHaveLength(3);
      expect(blocks[0].command.type).toBe('genesis');
      expect(blocks[1].command.type).toBe('build');
      expect(blocks[2].command.type).toBe('build');
    });

    it('respects count limit', () => {
      controller.build('granja');
      controller.build('aserradero');
      controller.build('mina');

      const blocks = controller.getChainBlocks(2);
      expect(blocks).toHaveLength(2);
      // Should return the LAST 2
      expect(blocks[0].command.type).toBe('build');
      expect(blocks[1].command.type).toBe('build');
    });
  });

  describe('command recording', () => {
    it('failed commands are NOT recorded', () => {
      // Try to build something that doesn't exist
      controller.build('nonexistent_building');

      const status = controller.getChainStatus();
      expect(status.length).toBe(1); // only genesis
    });

    it('each command type is recorded correctly', () => {
      controller.build('granja');
      controller.research('agriculture');

      const blocks = controller.getChainBlocks(10);
      expect(blocks[1].command.type).toBe('build');
      expect(blocks[1].command.args).toEqual({ buildingId: 'granja' });
      expect(blocks[2].command.type).toBe('research');
      expect(blocks[2].command.args).toEqual({ techId: 'agriculture' });
    });

    it('blocks have valid hash chain', () => {
      controller.build('granja');
      controller.build('aserradero');

      const blocks = controller.getChainBlocks(10);
      expect(blocks[0].prevHash).toBe('');
      expect(blocks[1].prevHash).toBe(blocks[0].hash);
      expect(blocks[2].prevHash).toBe(blocks[1].hash);
    });

    it('blocks have state hashes', () => {
      controller.build('granja');
      const blocks = controller.getChainBlocks(10);

      for (const block of blocks) {
        expect(block.stateHash).toMatch(/^[0-9a-f]{64}$/);
      }
    });
  });

  describe('persistence', () => {
    it('chain survives restart', () => {
      controller.build('granja');
      controller.build('aserradero');
      const beforeStatus = controller.getChainStatus();

      controller.shutdown();

      const controller2 = new GameController({
        dbPath: path.join(tmpDir, 'game.db'),
        playerId: 'player-test',
        playerName: 'TestPlayer',
        biome: BiomeType.Prairie,
        seed: 'test-seed',
        wallet,
      });

      const afterStatus = controller2.getChainStatus();
      expect(afterStatus.length).toBe(beforeStatus.length);
      expect(afterStatus.headHash).toBe(beforeStatus.headHash);
      expect(afterStatus.genesisHash).toBe(beforeStatus.genesisHash);

      const result = controller2.verifyChain();
      expect(result.valid).toBe(true);

      controller2.shutdown();
    });
  });

  describe('no wallet mode', () => {
    it('works without wallet (no blockchain)', () => {
      const noWalletController = new GameController({
        dbPath: path.join(tmpDir, 'nowallet.db'),
        playerId: 'player-nowallet',
        playerName: 'NoWallet',
        biome: BiomeType.Prairie,
        seed: 'seed',
      });

      noWalletController.build('granja');
      const status = noWalletController.getChainStatus();
      expect(status.length).toBe(0);

      const blocks = noWalletController.getChainBlocks(10);
      expect(blocks).toHaveLength(0);

      noWalletController.shutdown();
    });
  });
});
