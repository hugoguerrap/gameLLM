import { P2PNode } from './node.js';
import { PubSubService, TOPICS } from './pubsub.js';
import { PeerManager } from './peer-manager.js';
import { ChainBroadcaster } from './chain-broadcaster.js';
import { SyncManager } from '../sync/sync-manager.js';
import { ChainStore } from '../persistence/chain-store.js';
import { PeerStore } from '../persistence/peer-store.js';
import { Wallet } from '../wallet/wallet.js';
import {
  MessageType,
  type P2PMessage,
  type PeerAnnouncePayload,
} from '../types/messages.js';
import type { PeerInfo } from '../types/peer.js';

export interface NetworkManagerOptions {
  playerId: string;
  playerName: string;
  wallet: Wallet;
  chainStore: ChainStore;
  peerStore?: PeerStore;
  listenPort?: number;
  enableMdns?: boolean;
  enableDht?: boolean;
  bootstrapPeers?: string[];
  broadcastIntervalMs?: number;
}

export interface NetworkStatus {
  running: boolean;
  peerId: string;
  multiaddrs: string[];
  peerCount: number;
  peers: Array<{ peerId: string; name: string; lastSeen: number }>;
}

export class NetworkManager {
  private readonly p2pNode: P2PNode;
  private readonly peerManager: PeerManager;
  private readonly options: NetworkManagerOptions;
  private pubsub: PubSubService | null = null;
  private syncManager: SyncManager | null = null;
  private chainBroadcaster: ChainBroadcaster | null = null;
  private running = false;

  constructor(options: NetworkManagerOptions) {
    this.options = options;
    this.p2pNode = new P2PNode();
    this.peerManager = new PeerManager();
  }

  async start(): Promise<void> {
    if (this.running) return;

    // 0. Load saved peers from disk and merge with configured bootstrap
    const savedAddrs = this.options.peerStore?.getBootstrapAddrs(20) ?? [];
    const configuredPeers = this.options.bootstrapPeers ?? [];
    const allBootstrapPeers = [...new Set([...configuredPeers, ...savedAddrs])];

    // Prune peers older than 7 days
    this.options.peerStore?.pruneOlderThan(7 * 24 * 60 * 60 * 1000);

    // 1. Start the libp2p node (with DHT + bootstrap)
    await this.p2pNode.start({
      listenPort: this.options.listenPort ?? 0,
      enableMdns: this.options.enableMdns ?? true,
      enableDht: this.options.enableDht ?? true,
      bootstrapPeers: allBootstrapPeers.length > 0 ? allBootstrapPeers : undefined,
    });

    const node = this.p2pNode.getNode();

    // 2. Create PubSubService from the node's GossipSub instance
    this.pubsub = new PubSubService(node.services.pubsub);

    // 3. Wire peer connect/disconnect events
    node.addEventListener('peer:connect', (evt) => {
      const peerId = evt.detail.toString();
      const now = Date.now();
      const peerInfo: PeerInfo = {
        peerId,
        address: '',
        name: '',
        era: 0,
        connectedAt: now,
        lastSeen: now,
      };
      this.peerManager.addPeer(peerInfo);

      // Persist peer address for future reconnection
      try {
        const peerConnections = node.getConnections(evt.detail);
        if (peerConnections.length > 0) {
          const remoteAddr = peerConnections[0].remoteAddr.toString();
          const multiaddr = `${remoteAddr}/p2p/${peerId}`;
          this.options.peerStore?.upsert(multiaddr, peerId);
        }
      } catch {
        // Non-critical: peer persistence is best-effort
      }

      // Broadcast our announce to let the new peer know who we are
      this.broadcastAnnounce();

      // Send full state to the new peer
      this.syncManager?.broadcastFullState();

      // Request their chain
      this.chainBroadcaster?.requestChain(peerId, 0);
    });

    node.addEventListener('peer:disconnect', (evt) => {
      const peerId = evt.detail.toString();
      this.peerManager.removePeer(peerId);
    });

    // 4. Subscribe to ANNOUNCE topic for peer discovery
    this.pubsub.subscribe(TOPICS.ANNOUNCE, this.handleAnnounce);

    // 5. Create and start SyncManager
    this.syncManager = new SyncManager(
      this.pubsub,
      this.peerManager,
      this.options.playerId,
      { broadcastIntervalMs: this.options.broadcastIntervalMs ?? 5000 },
    );
    this.syncManager.start();

    // 6. Create and start ChainBroadcaster
    this.chainBroadcaster = new ChainBroadcaster(
      this.pubsub,
      this.options.chainStore,
      this.options.playerId,
    );
    this.chainBroadcaster.start();

    this.running = true;

    // Broadcast initial announce
    this.broadcastAnnounce();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    this.chainBroadcaster?.stop();
    this.chainBroadcaster = null;

    this.syncManager?.stop();
    this.syncManager = null;

    if (this.pubsub) {
      this.pubsub.unsubscribe(TOPICS.ANNOUNCE, this.handleAnnounce);
      this.pubsub.destroy();
      this.pubsub = null;
    }

    this.peerManager.clear();

    await this.p2pNode.stop();
  }

  getPubSub(): PubSubService | null {
    return this.pubsub;
  }

  getPeerManager(): PeerManager {
    return this.peerManager;
  }

  getSyncManager(): SyncManager | null {
    return this.syncManager;
  }

  getChainBroadcaster(): ChainBroadcaster | null {
    return this.chainBroadcaster;
  }

  getStatus(): NetworkStatus {
    const peers = this.peerManager.getAllPeers().map((p) => ({
      peerId: p.peerId,
      name: p.name,
      lastSeen: p.lastSeen,
    }));

    return {
      running: this.running,
      peerId: this.running ? this.p2pNode.getPeerId() : '',
      multiaddrs: this.running ? this.p2pNode.getMultiaddrs() : [],
      peerCount: this.peerManager.getPeerCount(),
      peers,
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  private broadcastAnnounce(): void {
    if (!this.pubsub) return;

    const chainLength = this.options.chainStore.getChainLength(this.options.playerId);
    const payload: PeerAnnouncePayload = {
      playerId: this.options.playerId,
      playerName: this.options.playerName,
      era: 1,
      chainLength,
    };
    const message: P2PMessage = {
      type: MessageType.PeerAnnounce,
      senderId: this.options.playerId,
      timestamp: Date.now(),
      payload,
    };
    void this.pubsub.publish(TOPICS.ANNOUNCE, message);
  }

  private readonly handleAnnounce = (message: P2PMessage): void => {
    if (message.type !== MessageType.PeerAnnounce) return;
    if (message.senderId === this.options.playerId) return;

    const payload = message.payload as PeerAnnouncePayload;
    if (!payload || !payload.playerId) return;

    // Update peer info with the announced data
    const existingPeers = this.peerManager.getAllPeers();
    const existing = existingPeers.find(
      (p) => p.name === '' && p.address === '',
    ) ?? existingPeers.find((p) => p.peerId === message.senderId);

    if (existing) {
      existing.name = payload.playerName;
      existing.era = payload.era;
      existing.lastSeen = Date.now();

      // Update player name in peer store
      if (this.options.peerStore && existing.peerId) {
        try {
          const node = this.p2pNode.getNode();
          const connections = node.getConnections();
          const conn = connections.find((c) => c.remotePeer.toString() === existing.peerId);
          if (conn) {
            const multiaddr = `${conn.remoteAddr.toString()}/p2p/${existing.peerId}`;
            this.options.peerStore.upsert(multiaddr, existing.peerId, payload.playerName);
          }
        } catch {
          // Best-effort
        }
      }
    } else {
      // This may come before peer:connect for the libp2p peerId,
      // so use the playerId as peerId for now
      this.peerManager.addPeer({
        peerId: message.senderId,
        address: '',
        name: payload.playerName,
        era: payload.era,
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });
    }

    // If their chain is longer than what we have, request missing blocks
    const remoteBlocks = this.chainBroadcaster?.getRemoteChain(payload.playerId) ?? [];
    if (payload.chainLength > remoteBlocks.length) {
      this.chainBroadcaster?.requestChain(payload.playerId, remoteBlocks.length);
    }
  };
}
