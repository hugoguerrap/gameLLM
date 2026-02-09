import { PubSubService, TOPICS } from './pubsub.js';
import { ChainStore } from '../persistence/chain-store.js';
import { Signer } from '../wallet/signer.js';
import { CommandSerializer } from '../blockchain/command-serializer.js';
import {
  MessageType,
  type P2PMessage,
  type CommandBlockPayload,
  type ChainRequestPayload,
  type ChainResponsePayload,
} from '../types/messages.js';
import type { ActionBlock } from '../types/blockchain.js';

const encoder = new TextEncoder();

/** Maximum allowed clock skew for incoming blocks (5 minutes). */
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

/** Maximum messages per peer per minute before rate limiting. */
const RATE_LIMIT_PER_MINUTE = 60;

export type RemoteBlockHandler = (block: ActionBlock) => void;

export class ChainBroadcaster {
  private readonly pubsub: PubSubService;
  private readonly chainStore: ChainStore;
  private readonly localPlayerId: string;
  private readonly remoteChains: Map<string, ActionBlock[]> = new Map();
  /** Registry: playerId → publicKey (hex). Established by genesis block. */
  private readonly playerKeyRegistry: Map<string, string> = new Map();
  /** Rate limiter: senderId → timestamps of recent messages. */
  private readonly peerMessageLog: Map<string, number[]> = new Map();
  private remoteBlockHandler: RemoteBlockHandler | null = null;
  private started = false;

  constructor(
    pubsub: PubSubService,
    chainStore: ChainStore,
    localPlayerId: string,
  ) {
    this.pubsub = pubsub;
    this.chainStore = chainStore;
    this.localPlayerId = localPlayerId;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.pubsub.subscribe(TOPICS.COMMANDS, this.handleMessage);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.pubsub.unsubscribe(TOPICS.COMMANDS, this.handleMessage);
  }

  onRemoteBlock(handler: RemoteBlockHandler): void {
    this.remoteBlockHandler = handler;
  }

  broadcastBlock(block: ActionBlock): void {
    const payload: CommandBlockPayload = { block };
    const message: P2PMessage = {
      type: MessageType.CommandBlock,
      senderId: this.localPlayerId,
      timestamp: Date.now(),
      payload,
    };
    void this.pubsub.publish(TOPICS.COMMANDS, message);
  }

  requestChain(playerId: string, fromIndex: number): void {
    const payload: ChainRequestPayload = {
      playerId,
      fromIndex,
      requesterId: this.localPlayerId,
    };
    const message: P2PMessage = {
      type: MessageType.ChainRequest,
      senderId: this.localPlayerId,
      timestamp: Date.now(),
      payload,
    };
    void this.pubsub.publish(TOPICS.COMMANDS, message);
  }

  getRemoteChain(playerId: string): ActionBlock[] {
    return this.remoteChains.get(playerId) ?? [];
  }

  getKnownPlayerIds(): string[] {
    return Array.from(this.remoteChains.keys());
  }

  private readonly handleMessage = (message: P2PMessage): void => {
    if (message.senderId === this.localPlayerId) return;

    // Rate limiting per sender
    if (this.isRateLimited(message.senderId)) return;

    switch (message.type) {
      case MessageType.CommandBlock:
        this.handleCommandBlock(message.payload as CommandBlockPayload);
        break;
      case MessageType.ChainRequest:
        this.handleChainRequest(message.payload as ChainRequestPayload);
        break;
      case MessageType.ChainResponse:
        this.handleChainResponse(message.payload as ChainResponsePayload);
        break;
    }
  };

  private handleCommandBlock(payload: CommandBlockPayload): void {
    const { block } = payload;
    if (!block || !block.hash || !block.playerId) return;

    // Ignore our own blocks
    if (block.playerId === this.localPlayerId) return;

    // Reject blocks with timestamps too far in the future
    if (block.command?.tick !== undefined) {
      const blockTimestamp = (block as unknown as Record<string, unknown>).timestamp as number | undefined;
      if (blockTimestamp && blockTimestamp > Date.now() + MAX_TIMESTAMP_DRIFT_MS) return;
    }

    // Validate signature + playerId↔publicKey binding
    if (!this.validateBlockSignature(block)) return;

    // Check if we already have this block
    if (this.chainStore.hasBlock(block.hash)) return;

    // Verify it links to our known chain for this player
    const existing = this.remoteChains.get(block.playerId) ?? [];

    if (block.index === 0) {
      // Genesis block
      if (existing.length === 0) {
        this.remoteChains.set(block.playerId, [block]);
        this.chainStore.saveBlock(block);
        this.remoteBlockHandler?.(block);
      }
    } else if (existing.length > 0 && block.index === existing.length) {
      // Next expected block
      const lastBlock = existing[existing.length - 1];
      if (block.prevHash === lastBlock.hash) {
        existing.push(block);
        this.chainStore.saveBlock(block);
        this.remoteBlockHandler?.(block);
      } else {
        // Gap or fork — request full chain
        this.requestChain(block.playerId, existing.length);
      }
    } else if (existing.length === 0 && block.index > 0) {
      // We have no chain for this player, request from genesis
      this.requestChain(block.playerId, 0);
    } else if (block.index > existing.length) {
      // We're behind, request missing blocks
      this.requestChain(block.playerId, existing.length);
    }
    // block.index < existing.length means we already have it, ignore
  }

  private handleChainRequest(payload: ChainRequestPayload): void {
    const { playerId, fromIndex, requesterId } = payload;
    if (!playerId || fromIndex === undefined || !requesterId) return;

    // Only respond if they're asking about our chain
    if (playerId !== this.localPlayerId) return;

    const blocks = this.chainStore.loadChain(this.localPlayerId);
    const requested = blocks.slice(fromIndex);

    if (requested.length === 0) return;

    const responsePayload: ChainResponsePayload = {
      playerId: this.localPlayerId,
      blocks: requested,
    };
    const message: P2PMessage = {
      type: MessageType.ChainResponse,
      senderId: this.localPlayerId,
      timestamp: Date.now(),
      payload: responsePayload,
    };
    void this.pubsub.publish(TOPICS.COMMANDS, message);
  }

  private handleChainResponse(payload: ChainResponsePayload): void {
    const { playerId, blocks } = payload;
    if (!playerId || !blocks || blocks.length === 0) return;
    if (playerId === this.localPlayerId) return;

    const existing = this.remoteChains.get(playerId) ?? [];

    for (const block of blocks) {
      // Validate each block's signature
      if (!this.validateBlockSignature(block)) continue;

      // Skip blocks we already have
      if (block.index < existing.length) continue;

      // Verify chain linkage
      if (block.index === 0) {
        if (existing.length === 0) {
          existing.push(block);
          this.chainStore.saveBlock(block);
          this.remoteBlockHandler?.(block);
        }
      } else if (block.index === existing.length) {
        const lastBlock = existing[existing.length - 1];
        if (block.prevHash === lastBlock.hash) {
          existing.push(block);
          this.chainStore.saveBlock(block);
          this.remoteBlockHandler?.(block);
        }
      }
    }

    this.remoteChains.set(playerId, existing);
  }

  private validateBlockSignature(block: ActionBlock): boolean {
    try {
      // Verify hash integrity
      const { hash: _hash, signature: _sig, ...partial } = block;
      const computedHash = CommandSerializer.computeBlockHash(partial);
      if (computedHash !== block.hash) return false;

      // Verify Ed25519 signature
      if (!Signer.verify(encoder.encode(block.hash), block.signature, block.publicKey)) {
        return false;
      }

      // Enforce playerId ↔ publicKey binding
      const registeredKey = this.playerKeyRegistry.get(block.playerId);
      if (registeredKey) {
        // Key already registered — must match
        if (block.publicKey !== registeredKey) return false;
      } else if (block.index === 0) {
        // Genesis block — register the key
        this.playerKeyRegistry.set(block.playerId, block.publicKey);
      } else {
        // Non-genesis block from unknown player — reject until we have their genesis
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /** Get the registered public key for a player (for external verification). */
  getPlayerPublicKey(playerId: string): string | undefined {
    return this.playerKeyRegistry.get(playerId);
  }

  /** Check and enforce per-peer rate limiting. Returns true if the peer should be throttled. */
  private isRateLimited(senderId: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    let timestamps = this.peerMessageLog.get(senderId);
    if (!timestamps) {
      timestamps = [];
      this.peerMessageLog.set(senderId, timestamps);
    }

    // Prune old entries
    while (timestamps.length > 0 && timestamps[0] < oneMinuteAgo) {
      timestamps.shift();
    }

    if (timestamps.length >= RATE_LIMIT_PER_MINUTE) {
      return true;
    }

    timestamps.push(now);
    return false;
  }
}
