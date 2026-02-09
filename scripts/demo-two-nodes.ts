#!/usr/bin/env npx tsx
/**
 * Demo: Two NODECOIN nodes communicating via P2P.
 *
 * Run with:  npx tsx scripts/demo-two-nodes.ts
 *
 * This script starts two real nodes connected via TCP, then:
 * 1. Both nodes build and recruit
 * 2. Node1 creates a trade offer
 * 3. Node2 sees the offer via shared state and accepts it
 * 4. Node1 receives the accepted trade via blockchain
 * 5. Node1 attacks Node2 via PvP
 * 6. Node2 receives the attack via blockchain
 * 7. Both nodes see each other in rankings
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GameController } from '../packages/mcp/src/game-controller.js';
import { BiomeType } from '@nodecoin/engine';
import {
  Wallet,
  NetworkManager,
  RemoteActionProcessor,
  ChainStore,
  GameDatabase,
} from '@nodecoin/network';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(prefix: string, msg: string) {
  const color = prefix === 'NODE1' ? '\x1b[36m' : '\x1b[33m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  console.error(`${color}[${prefix}]${reset} ${msg}`);
}

function section(title: string) {
  console.error(`\n\x1b[1m${'═'.repeat(60)}\x1b[0m`);
  console.error(`\x1b[1m  ${title}\x1b[0m`);
  console.error(`\x1b[1m${'═'.repeat(60)}\x1b[0m\n`);
}

async function main() {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'nodecoin-demo-'));
  console.error(`\x1b[2mTemp dir: ${tmpDir}\x1b[0m\n`);

  // Create wallets
  const wallet1 = new Wallet();
  const wallet2 = new Wallet();

  // Create game controllers
  const controller1 = new GameController({
    dbPath: path.join(tmpDir, 'node1.db'),
    playerId: 'player-1',
    playerName: 'Ironforge',
    biome: BiomeType.Mountain,
    seed: 'demo-seed-1',
    wallet: wallet1,
  });

  const controller2 = new GameController({
    dbPath: path.join(tmpDir, 'node2.db'),
    playerId: 'player-2',
    playerName: 'Verdantia',
    biome: BiomeType.Forest,
    seed: 'demo-seed-2',
    wallet: wallet2,
  });

  // Create network infrastructure
  const db1 = new GameDatabase(path.join(tmpDir, 'node1.db'));
  db1.migrate();
  const chainStore1 = new ChainStore(db1.getDb());

  const db2 = new GameDatabase(path.join(tmpDir, 'node2.db'));
  db2.migrate();
  const chainStore2 = new ChainStore(db2.getDb());

  // Start Node1
  const nm1 = new NetworkManager({
    playerId: 'player-1',
    playerName: 'Ironforge',
    wallet: wallet1,
    chainStore: chainStore1,
    listenPort: 0,
    enableMdns: false,
    broadcastIntervalMs: 500,
  });

  controller1.setNetworkManager(nm1);
  await nm1.start();

  const processor1 = new RemoteActionProcessor('player-1', controller1);
  nm1.getChainBroadcaster()?.onRemoteBlock((block) => processor1.processBlock(block));

  const node1Addrs = nm1.getStatus().multiaddrs;

  // Start Node2 (bootstrap to Node1)
  const nm2 = new NetworkManager({
    playerId: 'player-2',
    playerName: 'Verdantia',
    wallet: wallet2,
    chainStore: chainStore2,
    listenPort: 0,
    enableMdns: false,
    bootstrapPeers: node1Addrs,
    broadcastIntervalMs: 500,
  });

  controller2.setNetworkManager(nm2);
  await nm2.start();

  const processor2 = new RemoteActionProcessor('player-2', controller2);
  nm2.getChainBroadcaster()?.onRemoteBlock((block) => processor2.processBlock(block));

  // Wait for peer connection
  await delay(1500);

  section('1. PEER DISCOVERY');
  const status1 = nm1.getStatus();
  const status2 = nm2.getStatus();
  log('NODE1', `Peer ID: ${status1.peerId.slice(0, 20)}...`);
  log('NODE1', `Connected peers: ${status1.peerCount}`);
  log('NODE2', `Peer ID: ${status2.peerId.slice(0, 20)}...`);
  log('NODE2', `Connected peers: ${status2.peerCount}`);

  section('2. BUILD & RECRUIT');
  let r = controller1.build('granja');
  log('NODE1', `Build farm: ${r.message}`);
  r = controller1.build('cuartel');
  log('NODE1', `Build barracks: ${r.message}`);
  r = controller1.recruit('soldier', 5);
  log('NODE1', `Recruit 5 soldiers: ${r.message}`);

  r = controller2.build('granja');
  log('NODE2', `Build farm: ${r.message}`);
  r = controller2.build('cuartel');
  log('NODE2', `Build barracks: ${r.message}`);
  r = controller2.recruit('soldier', 3);
  log('NODE2', `Recruit 3 soldiers: ${r.message}`);
  r = controller2.recruit('archer', 2);
  log('NODE2', `Recruit 2 archers: ${r.message}`);

  // Wait for sync
  await delay(2000);

  section('3. RANKINGS (via Shared State)');
  const sm2 = nm2.getSyncManager()!;
  const shared = sm2.getSharedState();
  for (const [id, ranking] of Object.entries(shared.rankings)) {
    log('NODE2', `Ranking: ${ranking.name} (${id}) - Era ${ranking.era}, Army: ${ranking.totalArmy ?? '?'}, Tokens: ${ranking.tokens}`);
  }

  section('4. TRADE');
  r = controller1.createTradeOffer({ wood: 30 }, { stone: 20 }, 100);
  log('NODE1', `Create trade (30 wood for 20 stone): ${r.message}`);
  const offerId = (r.data as any)?.offerId;

  // Wait for shared state sync
  await delay(2000);

  // Node2 sees the trade in shared state
  const shared2 = nm2.getSyncManager()!.getSharedState();
  log('NODE2', `Network trade offers: ${shared2.tradeOffers.length}`);
  if (shared2.tradeOffers.length > 0) {
    const offer = shared2.tradeOffers[0];
    log('NODE2', `  Offer from ${offer.from}: ${JSON.stringify(offer.offer)} for ${JSON.stringify(offer.want)}`);

    // Node2 accepts the trade
    const state2Before = controller2.getPlayerState();
    r = controller2.acceptTrade(offer.id);
    log('NODE2', `Accept trade: ${r.message}`);

    if (r.success) {
      const state2After = controller2.getPlayerState();
      log('NODE2', `  Wood: ${state2Before.resources.wood} -> ${state2After.resources.wood} (+${state2After.resources.wood - state2Before.resources.wood})`);
      log('NODE2', `  Stone: ${state2Before.resources.stone} -> ${state2After.resources.stone} (${state2After.resources.stone - state2Before.resources.stone})`);
    }

    // Wait for block to propagate to Node1
    await delay(2000);

    const state1After = controller1.getPlayerState();
    const acceptedOffer = state1After.tradeOffers.find(o => o.id === offerId);
    log('NODE1', `Trade status: ${acceptedOffer?.status ?? 'unknown'}`);
    log('NODE1', `  Received stone from trade: ${state1After.resources.stone}`);
  }

  section('5. PVP COMBAT');
  // Get Node2's army from shared state for PvP
  const rankings = nm1.getSyncManager()!.getSharedState().rankings;
  const node2Ranking = rankings['player-2'];
  if (node2Ranking?.armyUnits) {
    log('NODE1', `Intel on Verdantia: ${JSON.stringify(node2Ranking.armyUnits)}`);

    const state1Before = controller1.getPlayerState();
    r = controller1.pvpAttack(
      'player-2',
      node2Ranking.armyUnits as any,
      node2Ranking.strategy ?? 'balanced',
      node2Ranking.defenseBonus ?? 0,
    );
    log('NODE1', `Attack Verdantia: ${r.message}`);

    if (r.data?.battleReport) {
      const report = r.data.battleReport as any;
      log('NODE1', `  Winner: ${report.winner}`);
      log('NODE1', `  Attacker losses: ${JSON.stringify(report.attackerLosses)}`);
      log('NODE1', `  Defender losses: ${JSON.stringify(report.defenderLosses)}`);
    }

    // Wait for block propagation
    await delay(2000);

    const state2After = controller2.getPlayerState();
    const totalArmy2 = Object.values(state2After.army.units).reduce((a, b) => a + b, 0);
    log('NODE2', `Army after attack: ${totalArmy2} units (received battle via blockchain)`);
  } else {
    log('NODE1', 'No army intel available for Node2 yet');
  }

  section('6. DIPLOMACY');
  r = controller1.setDiplomacy('player-2', 'war');
  log('NODE1', `Declare war on Verdantia: ${r.message}`);

  await delay(2000);

  const state2Final = controller2.getPlayerState();
  const relation = state2Final.diplomacy.find(d => d.targetPlayerId === 'player-1');
  log('NODE2', `Diplomacy from Ironforge: ${relation?.status ?? 'none'}`);

  section('7. BLOCKCHAIN');
  const chain1 = controller1.getChainStatus();
  const chain2 = controller2.getChainStatus();
  log('NODE1', `Chain: ${chain1.length} blocks, head: ${chain1.headHash.slice(0, 16)}...`);
  log('NODE2', `Chain: ${chain2.length} blocks, head: ${chain2.headHash.slice(0, 16)}...`);

  const verify1 = controller1.verifyChain();
  const verify2 = controller2.verifyChain();
  log('NODE1', `Chain valid: ${verify1.valid}`);
  log('NODE2', `Chain valid: ${verify2.valid}`);

  // Cleanup
  section('CLEANUP');
  await nm2.stop();
  await nm1.stop();
  try { controller1.shutdown(); } catch { /* */ }
  try { controller2.shutdown(); } catch { /* */ }
  try { db1.close(); } catch { /* */ }
  try { db2.close(); } catch { /* */ }
  rmSync(tmpDir, { recursive: true, force: true });
  console.error('Done. All nodes stopped.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
