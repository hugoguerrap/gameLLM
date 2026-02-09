import * as Automerge from '@automerge/automerge';
import { PubSubService, TOPICS } from '../p2p/pubsub.js';
import { PeerManager } from '../p2p/peer-manager.js';
import { Signer } from '../wallet/signer.js';
import { MessageType, type P2PMessage } from '../types/messages.js';
import {
  createSharedState,
  saveState,
  loadState,
  updateRanking,
  addZoneDiscovery,
  claimZone,
  addCombatLog,
  addTradeOffer,
  upsertAlliance,
  verifySignedData,
  type SharedWorldState,
  type RankingData,
} from './state-sync.js';

/** Default broadcast interval in milliseconds (5 seconds) */
const DEFAULT_BROADCAST_INTERVAL_MS = 5_000;

/**
 * Payload shape for GAME_STATE sync messages sent over GossipSub.
 *
 * `type` discriminates between:
 *  - "full"    : a complete Automerge document binary (used for initial sync)
 *  - "changes" : incremental binary changes
 */
export interface SyncPayload {
  syncType: 'full' | 'changes';
  /** base64-encoded binary data */
  data: string;
}

/**
 * Orchestrates Automerge state synchronization between P2P peers.
 *
 * Responsibilities:
 *  - Subscribes to the GAME_STATE GossipSub topic
 *  - Applies incoming Automerge data (full docs or changes)
 *  - Periodically broadcasts local state to the network
 *  - Provides methods to mutate local shared state
 */
export class SyncManager {
  private doc: Automerge.Doc<SharedWorldState>;
  private readonly pubsub: PubSubService;
  private readonly peerManager: PeerManager;
  private readonly senderId: string;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private broadcastIntervalMs: number;
  private lastBroadcastHeads: Automerge.Heads | null = null;
  private running = false;

  constructor(
    pubsub: PubSubService,
    peerManager: PeerManager,
    senderId: string,
    options: { broadcastIntervalMs?: number } = {},
  ) {
    this.pubsub = pubsub;
    this.peerManager = peerManager;
    this.senderId = senderId;
    this.broadcastIntervalMs =
      options.broadcastIntervalMs ?? DEFAULT_BROADCAST_INTERVAL_MS;
    this.doc = createSharedState();
  }

  /**
   * Start listening for incoming sync messages and begin periodic broadcasts.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    this.pubsub.subscribe(TOPICS.GAME_STATE, this.handleMessage);

    this.broadcastTimer = setInterval(() => {
      this.broadcastChanges();
    }, this.broadcastIntervalMs);
  }

  /**
   * Stop the sync manager: unsubscribe and clear the broadcast timer.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    this.pubsub.unsubscribe(TOPICS.GAME_STATE, this.handleMessage);

    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }

  /**
   * Return the current shared world state (read-only Automerge doc).
   */
  getSharedState(): Automerge.Doc<SharedWorldState> {
    return this.doc;
  }

  /**
   * Convenience: update the local player's ranking data in the shared state.
   */
  updateLocalPlayerData(playerId: string, data: RankingData): void {
    this.doc = updateRanking(this.doc, playerId, data);
  }

  /**
   * Replace the internal doc (used when applying external changes or merging).
   */
  setDoc(doc: Automerge.Doc<SharedWorldState>): void {
    this.doc = doc;
  }

  /**
   * Broadcast the current state to peers.
   *
   * Strategy:
   *  - If there are no peers, skip.
   *  - If we have never broadcast, send a full state.
   *  - Otherwise, send only changes since the last broadcast heads.
   */
  broadcastChanges(): void {
    if (this.peerManager.getPeerCount() === 0) return;

    const currentHeads = Automerge.getHeads(this.doc);

    // Check if anything actually changed since last broadcast
    if (this.lastBroadcastHeads !== null) {
      const changesSince = Automerge.getChanges(
        Automerge.view(this.doc, this.lastBroadcastHeads),
        this.doc,
      );
      if (changesSince.length === 0) return;

      // Send incremental changes
      const mergedChanges = concatUint8Arrays(changesSince);
      const payload: SyncPayload = {
        syncType: 'changes',
        data: uint8ArrayToBase64(mergedChanges),
      };

      this.publishSync(payload);
    } else {
      // First broadcast: send full state
      const fullState = saveState(this.doc);
      const payload: SyncPayload = {
        syncType: 'full',
        data: uint8ArrayToBase64(fullState),
      };

      this.publishSync(payload);
    }

    this.lastBroadcastHeads = currentHeads;
  }

  /**
   * Broadcast a full state snapshot (useful when a new peer connects).
   */
  broadcastFullState(): void {
    const fullState = saveState(this.doc);
    const payload: SyncPayload = {
      syncType: 'full',
      data: uint8ArrayToBase64(fullState),
    };

    this.publishSync(payload);
    this.lastBroadcastHeads = Automerge.getHeads(this.doc);
  }

  isRunning(): boolean {
    return this.running;
  }

  // ---------------------------------------------------------------------------
  //  Private helpers
  // ---------------------------------------------------------------------------

  private readonly handleMessage = (message: P2PMessage): void => {
    if (message.type !== MessageType.GameState) return;
    if (message.senderId === this.senderId) return; // ignore our own messages

    const payload = message.payload as SyncPayload | undefined;
    if (!payload || !payload.data || !payload.syncType) return;

    try {
      const binary = base64ToUint8Array(payload.data);

      if (payload.syncType === 'full') {
        // Load the remote state, then re-apply our local data on top.
        // Automerge.merge() requires a common ancestor, which independent
        // peers don't have.  Instead we adopt the remote doc and replay
        // local mutations so both sides' data is preserved.
        const localSnapshot = this.doc;
        const remoteDoc = loadState(binary);

        // Start fresh — we'll selectively merge verified data
        this.doc = createSharedState();

        // Re-apply remote rankings (only if signed and valid)
        for (const [pid, data] of Object.entries(remoteDoc.rankings)) {
          const rankData = data as RankingData;
          if (rankData.signature && rankData.signedBy) {
            if (verifySignedData(rankData as unknown as Record<string, unknown>, Signer.verify)) {
              this.doc = updateRanking(this.doc, pid, rankData);
            }
          }
        }

        // Re-apply remote trade offers (only if signed)
        for (const offer of remoteDoc.tradeOffers) {
          if (offer.signature && offer.signedBy) {
            if (verifySignedData(offer as unknown as Record<string, unknown>, Signer.verify)) {
              this.doc = addTradeOffer(this.doc, { ...offer });
            }
          }
        }

        // Re-apply remote alliances (only if signed)
        for (const [aid, alliance] of Object.entries(remoteDoc.alliances)) {
          if (alliance.signature && alliance.signedBy) {
            if (verifySignedData(alliance as unknown as Record<string, unknown>, Signer.verify)) {
              this.doc = upsertAlliance(this.doc, { ...alliance });
            }
          }
        }

        // Re-apply remote zones (unsigned — low-risk informational data)
        for (const [zid, zone] of Object.entries(remoteDoc.zones)) {
          for (const discoverer of (zone as { discoveredBy: string[] }).discoveredBy) {
            this.doc = addZoneDiscovery(this.doc, zid, discoverer);
          }
          const claimedBy = (zone as { claimedBy: string | null }).claimedBy;
          if (claimedBy) {
            this.doc = claimZone(this.doc, zid, claimedBy);
          }
        }

        // Re-apply remote combat logs (unsigned — informational only)
        for (const log of remoteDoc.combatLogs) {
          this.doc = addCombatLog(this.doc, { ...log });
        }

        // Re-apply local rankings (overrides remote for same player)
        for (const [pid, data] of Object.entries(localSnapshot.rankings)) {
          this.doc = updateRanking(this.doc, pid, data as RankingData);
        }

        // Re-apply local zones
        for (const [zid, zone] of Object.entries(localSnapshot.zones)) {
          for (const discoverer of (zone as { discoveredBy: string[] }).discoveredBy) {
            this.doc = addZoneDiscovery(this.doc, zid, discoverer);
          }
          const claimedBy = (zone as { claimedBy: string | null }).claimedBy;
          if (claimedBy) {
            this.doc = claimZone(this.doc, zid, claimedBy);
          }
        }

        // Re-apply local combat logs
        for (const log of localSnapshot.combatLogs) {
          this.doc = addCombatLog(this.doc, { ...log });
        }

        // Re-apply local trade offers
        for (const offer of localSnapshot.tradeOffers) {
          this.doc = addTradeOffer(this.doc, { ...offer });
        }

        // Re-apply local alliances
        for (const [, alliance] of Object.entries(localSnapshot.alliances)) {
          this.doc = upsertAlliance(this.doc, { ...alliance });
        }
      } else if (payload.syncType === 'changes') {
        // Apply incremental changes
        const changes = splitConcatenatedChanges(binary);
        const [newDoc] = Automerge.applyChanges(this.doc, changes);
        this.doc = newDoc;
      }
    } catch {
      // Ignore malformed sync messages
    }
  };

  private publishSync(payload: SyncPayload): void {
    const message: P2PMessage = {
      type: MessageType.GameState,
      senderId: this.senderId,
      timestamp: Date.now(),
      payload,
    };

    // Fire and forget -- pubsub.publish is async but we don't await
    void this.pubsub.publish(TOPICS.GAME_STATE, message);
  }
}

// ---------------------------------------------------------------------------
//  Binary encoding helpers
// ---------------------------------------------------------------------------

/**
 * Encode Uint8Array to base64 string.
 */
export function uint8ArrayToBase64(data: Uint8Array): string {
  // Use Buffer in Node.js for best performance
  return Buffer.from(data).toString('base64');
}

/**
 * Decode base64 string to Uint8Array.
 */
export function base64ToUint8Array(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/**
 * Concatenate multiple Uint8Arrays into a single one,
 * prepending each with a 4-byte length prefix (big-endian).
 */
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += 4 + arr.length; // 4 bytes for length prefix
  }

  const result = new Uint8Array(totalLength);
  const view = new DataView(result.buffer);
  let offset = 0;

  for (const arr of arrays) {
    view.setUint32(offset, arr.length, false); // big-endian
    offset += 4;
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

/**
 * Split a length-prefixed concatenated buffer back into individual Uint8Arrays.
 */
function splitConcatenatedChanges(data: Uint8Array): Uint8Array[] {
  const changes: Uint8Array[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  while (offset < data.length) {
    if (offset + 4 > data.length) break;
    const length = view.getUint32(offset, false); // big-endian
    offset += 4;
    if (offset + length > data.length) break;
    changes.push(data.slice(offset, offset + length));
    offset += length;
  }

  return changes;
}
