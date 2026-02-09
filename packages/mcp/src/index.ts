#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { GameController } from './game-controller.js';
import { createMcpServer, startServer } from './server.js';
import { BiomeType } from '@nodecoin/engine';
import { TICK_DURATION_MS } from '@nodecoin/engine';
import { Wallet, WalletStore, NetworkManager, RemoteActionProcessor, ChainStore, PeerStore, GameDatabase } from '@nodecoin/network';
import { existsSync } from 'node:fs';

// ── Configuration from env vars ──

const BIOME_ALIASES: Record<string, BiomeType> = {
  plains: BiomeType.Prairie,
  prairie: BiomeType.Prairie,
  forest: BiomeType.Forest,
  mountain: BiomeType.Mountain,
  desert: BiomeType.Desert,
  coast: BiomeType.Coast,
  coastal: BiomeType.Coast,
  volcanic: BiomeType.Volcanic,
  tundra: BiomeType.Volcanic,
};

function parseBiome(raw: string): BiomeType {
  const key = raw.toLowerCase().trim();
  return BIOME_ALIASES[key] ?? BiomeType.Prairie;
}

const PLAYER_NAME = process.env.NODECOIN_PLAYER_NAME ?? 'Adventurer';
const PLAYER_ID = process.env.NODECOIN_PLAYER_ID ?? randomUUID();
const BIOME = parseBiome(process.env.NODECOIN_BIOME ?? 'plains');
const SEED = process.env.NODECOIN_SEED ?? PLAYER_ID;
const DB_DIR = process.env.NODECOIN_DATA_DIR ?? path.join(os.homedir(), '.nodecoin');
const DB_PATH = path.join(DB_DIR, 'game.db');

// P2P config
const P2P_ENABLED = process.env.NODECOIN_P2P_ENABLED !== 'false';
const P2P_PORT = parseInt(process.env.NODECOIN_P2P_PORT ?? '0', 10);
const BOOTSTRAP_PEERS = (process.env.NODECOIN_BOOTSTRAP_PEERS ?? '').split(',').filter(Boolean);

// ── Ensure data directory exists ──

import { mkdirSync } from 'node:fs';
mkdirSync(DB_DIR, { recursive: true });

// ── Load or create wallet ──

const WALLET_PATH = path.join(DB_DIR, 'wallet.json');

function loadOrCreateWallet(): Wallet {
  try {
    if (existsSync(WALLET_PATH)) {
      return WalletStore.load(WALLET_PATH);
    }
  } catch (err) {
    console.error('Warning: could not load wallet, creating new one:', err);
  }
  const w = new Wallet();
  WalletStore.save(w, WALLET_PATH);
  return w;
}

const wallet = loadOrCreateWallet();

// ── Initialize ──

console.error(`NODECOIN v0.1.0`);
console.error(`Player: ${PLAYER_NAME} (${PLAYER_ID})`);
console.error(`Biome: ${BIOME}`);
console.error(`Wallet: ${wallet.address}`);
console.error(`Data: ${DB_PATH}`);
console.error(`P2P: ${P2P_ENABLED ? 'enabled' : 'disabled'}`);

const controller = new GameController({
  dbPath: DB_PATH,
  playerId: PLAYER_ID,
  playerName: PLAYER_NAME,
  biome: BIOME,
  seed: SEED,
  wallet,
});

// ── Catch-up any pending ticks from while we were offline ──

const catchUp = controller.catchUpTicks();
if (catchUp > 0) {
  console.error(`Caught up ${catchUp} ticks from while offline`);
}

// ── Tick loop (background) ──

const tickInterval = setInterval(() => {
  try {
    const processed = controller.catchUpTicks();
    if (processed > 0) {
      console.error(`Processed ${processed} tick(s)`);
    }
  } catch (err) {
    console.error('Tick error:', err);
  }
}, TICK_DURATION_MS);

// ── Start P2P networking ──

let networkManager: NetworkManager | null = null;

async function startP2P(): Promise<void> {
  if (!P2P_ENABLED) return;

  try {
    // Create a separate DB instance for network manager (shares same file via WAL)
    const gameDb = new GameDatabase(DB_PATH);
    gameDb.migrate();
    const chainStore = new ChainStore(gameDb.getDb());
    const peerStore = new PeerStore(gameDb.getDb());

    networkManager = new NetworkManager({
      playerId: PLAYER_ID,
      playerName: PLAYER_NAME,
      wallet,
      chainStore,
      peerStore,
      listenPort: P2P_PORT,
      enableMdns: true,
      enableDht: true,
      bootstrapPeers: BOOTSTRAP_PEERS,
    });

    controller.setNetworkManager(networkManager);
    await networkManager.start();

    // Wire remote action processing (after start, when broadcaster is available)
    const processor = new RemoteActionProcessor(PLAYER_ID, controller);
    networkManager.getChainBroadcaster()?.onRemoteBlock((block) => processor.processBlock(block));

    const status = networkManager.getStatus();
    console.error(`P2P node started, peer ID: ${status.peerId}`);
    if (status.multiaddrs.length > 0) {
      console.error(`Listening on: ${status.multiaddrs.join(', ')}`);
    }
  } catch (err) {
    console.error('Failed to start P2P:', err);
    networkManager = null;
  }
}

// ── Start MCP server ──

const server = createMcpServer(controller);

async function main(): Promise<void> {
  await startP2P();

  await startServer(server).catch((err) => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// ── Graceful shutdown ──

async function shutdown(signal: string): Promise<void> {
  console.error(`\nReceived ${signal}. Shutting down...`);
  clearInterval(tickInterval);
  await networkManager?.stop();
  controller.shutdown();
  console.error('State saved. Goodbye!');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
