import type { GossipSub } from '@chainsafe/libp2p-gossipsub';
import type { P2PMessage } from '../types/messages.js';

export const TOPICS = {
  GAME_STATE: 'nodecoin/game-state/1.0.0',
  TRANSACTIONS: 'nodecoin/transactions/1.0.0',
  COMBAT: 'nodecoin/combat/1.0.0',
  ANNOUNCE: 'nodecoin/announce/1.0.0',
  COMMANDS: 'nodecoin/commands/1.0.0',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];
export type MessageHandler = (message: P2PMessage) => void;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class PubSubService {
  private readonly pubsub: GossipSub;
  private readonly handlers: Map<string, Set<MessageHandler>> = new Map();
  private boundListener: ((evt: CustomEvent) => void) | null = null;

  constructor(pubsub: GossipSub) {
    this.pubsub = pubsub;
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    this.boundListener = (evt: CustomEvent) => {
      const { topic, data } = evt.detail;
      const topicHandlers = this.handlers.get(topic);
      if (!topicHandlers || topicHandlers.size === 0) return;

      try {
        const decoded = decoder.decode(data);
        const message = JSON.parse(decoded) as P2PMessage;
        for (const handler of topicHandlers) {
          handler(message);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.pubsub.addEventListener(
      'message',
      this.boundListener as EventListener,
    );
  }

  async publish(topic: TopicName, message: P2PMessage): Promise<void> {
    const data = encoder.encode(JSON.stringify(message));
    await this.pubsub.publish(topic, data);
  }

  subscribe(topic: TopicName, handler: MessageHandler): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, new Set());
      this.pubsub.subscribe(topic);
    }
    this.handlers.get(topic)!.add(handler);
  }

  unsubscribe(topic: TopicName, handler?: MessageHandler): void {
    const topicHandlers = this.handlers.get(topic);
    if (!topicHandlers) return;

    if (handler) {
      topicHandlers.delete(handler);
      if (topicHandlers.size === 0) {
        this.handlers.delete(topic);
        this.pubsub.unsubscribe(topic);
      }
    } else {
      // Remove all handlers for this topic
      this.handlers.delete(topic);
      this.pubsub.unsubscribe(topic);
    }
  }

  getSubscribedTopics(): string[] {
    return this.pubsub.getTopics();
  }

  destroy(): void {
    // Unsubscribe from all topics
    for (const topic of this.handlers.keys()) {
      this.pubsub.unsubscribe(topic);
    }
    this.handlers.clear();

    if (this.boundListener) {
      this.pubsub.removeEventListener(
        'message',
        this.boundListener as EventListener,
      );
      this.boundListener = null;
    }
  }
}
