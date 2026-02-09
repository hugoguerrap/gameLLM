import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NetworkManager } from '../../../src/p2p/network-manager.js';
import { Wallet } from '../../../src/wallet/wallet.js';
import { ChainStore } from '../../../src/persistence/chain-store.js';
import { GameDatabase } from '../../../src/persistence/database.js';

describe('NetworkManager', () => {
  let tmpDir: string;
  let wallet: Wallet;
  let chainStore: ChainStore;
  let gameDb: GameDatabase;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'nm-test-'));
    wallet = new Wallet();
    gameDb = new GameDatabase(path.join(tmpDir, 'game.db'));
    gameDb.migrate();
    chainStore = new ChainStore(gameDb.getDb());
  });

  afterEach(async () => {
    try {
      gameDb.close();
    } catch { /* already closed */ }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createNetworkManager(opts?: Partial<{ listenPort: number; enableMdns: boolean }>) {
    return new NetworkManager({
      playerId: 'test-player',
      playerName: 'TestPlayer',
      wallet,
      chainStore,
      listenPort: opts?.listenPort ?? 0,
      enableMdns: opts?.enableMdns ?? false,
      bootstrapPeers: [],
    });
  }

  it('starts and stops without error', async () => {
    const nm = createNetworkManager();
    await nm.start();

    expect(nm.isRunning()).toBe(true);
    expect(nm.getStatus().running).toBe(true);
    expect(nm.getStatus().peerId).toBeTruthy();
    expect(nm.getStatus().multiaddrs.length).toBeGreaterThan(0);

    await nm.stop();
    expect(nm.isRunning()).toBe(false);
  });

  it('start is idempotent', async () => {
    const nm = createNetworkManager();
    await nm.start();
    await nm.start(); // Should not throw

    expect(nm.isRunning()).toBe(true);
    await nm.stop();
  });

  it('stop is idempotent', async () => {
    const nm = createNetworkManager();
    await nm.start();
    await nm.stop();
    await nm.stop(); // Should not throw

    expect(nm.isRunning()).toBe(false);
  });

  it('provides PubSub service after start', async () => {
    const nm = createNetworkManager();
    expect(nm.getPubSub()).toBeNull();

    await nm.start();
    expect(nm.getPubSub()).not.toBeNull();

    await nm.stop();
  });

  it('provides SyncManager after start', async () => {
    const nm = createNetworkManager();
    expect(nm.getSyncManager()).toBeNull();

    await nm.start();
    expect(nm.getSyncManager()).not.toBeNull();

    await nm.stop();
  });

  it('provides ChainBroadcaster after start', async () => {
    const nm = createNetworkManager();
    expect(nm.getChainBroadcaster()).toBeNull();

    await nm.start();
    expect(nm.getChainBroadcaster()).not.toBeNull();

    await nm.stop();
  });

  it('provides PeerManager always', () => {
    const nm = createNetworkManager();
    expect(nm.getPeerManager()).toBeTruthy();
    expect(nm.getPeerManager().getPeerCount()).toBe(0);
  });

  it('getStatus returns empty values before start', () => {
    const nm = createNetworkManager();
    const status = nm.getStatus();

    expect(status.running).toBe(false);
    expect(status.peerId).toBe('');
    expect(status.multiaddrs).toEqual([]);
    expect(status.peerCount).toBe(0);
    expect(status.peers).toEqual([]);
  });

  it('clears peers on stop', async () => {
    const nm = createNetworkManager();
    await nm.start();

    // Manually add a peer
    nm.getPeerManager().addPeer({
      peerId: 'fake-peer',
      address: '',
      name: 'Fake',
      era: 1,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
    });
    expect(nm.getStatus().peerCount).toBe(1);

    await nm.stop();
    expect(nm.getPeerManager().getPeerCount()).toBe(0);
  });

  it('nullifies services on stop', async () => {
    const nm = createNetworkManager();
    await nm.start();
    expect(nm.getPubSub()).not.toBeNull();
    expect(nm.getSyncManager()).not.toBeNull();
    expect(nm.getChainBroadcaster()).not.toBeNull();

    await nm.stop();
    expect(nm.getPubSub()).toBeNull();
    expect(nm.getSyncManager()).toBeNull();
    expect(nm.getChainBroadcaster()).toBeNull();
  });
});
