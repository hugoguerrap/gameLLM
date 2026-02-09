import { createLibp2p, type Libp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { gossipsub, type GossipSub } from '@chainsafe/libp2p-gossipsub';
import { identify, type Identify } from '@libp2p/identify';
import { mdns } from '@libp2p/mdns';
import { kadDHT, type KadDHT } from '@libp2p/kad-dht';
import { bootstrap } from '@libp2p/bootstrap';
import { ping, type Ping } from '@libp2p/ping';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { dcutr } from '@libp2p/dcutr';

/**
 * Public libp2p bootstrap nodes maintained by Protocol Labs.
 * These are used to join the global DHT and discover other NODECOIN peers.
 */
export const PUBLIC_BOOTSTRAP_NODES = [
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
];

/** NODECOIN DHT protocol prefix — only NODECOIN nodes match each other. */
const DHT_PROTOCOL = '/nodecoin/kad/1.0.0';

export type NodeServices = {
  identify: Identify;
  pubsub: GossipSub;
  ping: Ping;
  dht?: KadDHT;
  [key: string]: unknown;
};

export interface NodeOptions {
  listenPort?: number;
  enableMdns?: boolean;
  enableDht?: boolean;
  bootstrapPeers?: string[];
}

export class P2PNode {
  private node: Libp2p<NodeServices> | null = null;

  async start(opts: NodeOptions = {}): Promise<void> {
    if (this.node !== null && this.node.status === 'started') {
      return; // already started, idempotent
    }

    const port = opts.listenPort ?? 0; // 0 = random port
    const enableDht = opts.enableDht !== false; // default: true

    // Collect bootstrap addresses
    const allBootstrap: string[] = [];
    if (opts.bootstrapPeers?.length) {
      allBootstrap.push(...opts.bootstrapPeers);
    }
    if (enableDht) {
      allBootstrap.push(...PUBLIC_BOOTSTRAP_NODES);
    }

    // Build peer discovery modules
    const peerDiscovery: unknown[] = [];
    if (opts.enableMdns !== false) {
      peerDiscovery.push(mdns());
    }
    if (allBootstrap.length > 0) {
      peerDiscovery.push(bootstrap({ list: allBootstrap }));
    }

    // Build services
    const services: Record<string, unknown> = {
      identify: identify(),
      ping: ping(),
      pubsub: gossipsub({
        emitSelf: false,
        allowPublishToZeroTopicPeers: true,
      }),
    };

    if (enableDht) {
      services.dht = kadDHT({
        protocol: DHT_PROTOCOL,
        clientMode: false,
      });
    }

    // Add DCUtR for NAT hole punching
    services.dcutr = dcutr();

    this.node = await createLibp2p<NodeServices>({
      start: false,
      addresses: {
        listen: [
          `/ip4/0.0.0.0/tcp/${port}`,
          '/p2p-circuit',  // Listen for relay connections (NAT traversal)
        ],
      },
      transports: [
        tcp(),
        circuitRelayTransport(),  // Connect through relay nodes when direct fails
      ],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: peerDiscovery as any,
      services: services as any,
    });

    await this.node.start();
  }

  async stop(): Promise<void> {
    if (this.node) {
      await this.node.stop();
      this.node = null;
    }
  }

  getNode(): Libp2p<NodeServices> {
    if (!this.node) throw new Error('Node not started');
    return this.node;
  }

  getPeerId(): string {
    return this.getNode().peerId.toString();
  }

  getMultiaddrs(): string[] {
    return this.getNode().getMultiaddrs().map((ma) => ma.toString());
  }

  isStarted(): boolean {
    return this.node !== null && this.node.status === 'started';
  }
}
