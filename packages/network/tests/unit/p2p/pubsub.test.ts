import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { P2PNode } from '../../../src/p2p/node.js';
import { PubSubService, TOPICS } from '../../../src/p2p/pubsub.js';
import { MessageType, type P2PMessage } from '../../../src/types/messages.js';
import type { GossipSub } from '@chainsafe/libp2p-gossipsub';

describe('PubSubService', () => {
  let node: P2PNode;
  let pubsubService: PubSubService;

  beforeEach(async () => {
    node = new P2PNode();
    await node.start({ enableMdns: false });
    pubsubService = new PubSubService(
      node.getNode().services.pubsub as GossipSub,
    );
  });

  afterEach(async () => {
    pubsubService.destroy();
    await node.stop();
  });

  it('subscribes to a topic', () => {
    const handler = () => {};
    pubsubService.subscribe(TOPICS.GAME_STATE, handler);

    const topics = pubsubService.getSubscribedTopics();
    expect(topics).toContain(TOPICS.GAME_STATE);
  });

  it('unsubscribes from a topic', () => {
    const handler = () => {};
    pubsubService.subscribe(TOPICS.GAME_STATE, handler);
    expect(pubsubService.getSubscribedTopics()).toContain(TOPICS.GAME_STATE);

    pubsubService.unsubscribe(TOPICS.GAME_STATE, handler);
    expect(pubsubService.getSubscribedTopics()).not.toContain(
      TOPICS.GAME_STATE,
    );
  });

  it('unsubscribes all handlers when no handler specified', () => {
    const handler1 = () => {};
    const handler2 = () => {};
    pubsubService.subscribe(TOPICS.TRANSACTIONS, handler1);
    pubsubService.subscribe(TOPICS.TRANSACTIONS, handler2);

    pubsubService.unsubscribe(TOPICS.TRANSACTIONS);
    expect(pubsubService.getSubscribedTopics()).not.toContain(
      TOPICS.TRANSACTIONS,
    );
  });

  it('keeps subscription when removing one of multiple handlers', () => {
    const handler1 = () => {};
    const handler2 = () => {};
    pubsubService.subscribe(TOPICS.COMBAT, handler1);
    pubsubService.subscribe(TOPICS.COMBAT, handler2);

    pubsubService.unsubscribe(TOPICS.COMBAT, handler1);
    // Topic should still be subscribed because handler2 remains
    expect(pubsubService.getSubscribedTopics()).toContain(TOPICS.COMBAT);
  });

  it('can subscribe to multiple topics', () => {
    pubsubService.subscribe(TOPICS.GAME_STATE, () => {});
    pubsubService.subscribe(TOPICS.TRANSACTIONS, () => {});
    pubsubService.subscribe(TOPICS.COMBAT, () => {});

    const topics = pubsubService.getSubscribedTopics();
    expect(topics).toContain(TOPICS.GAME_STATE);
    expect(topics).toContain(TOPICS.TRANSACTIONS);
    expect(topics).toContain(TOPICS.COMBAT);
  });

  it('destroy cleans up all subscriptions', () => {
    pubsubService.subscribe(TOPICS.GAME_STATE, () => {});
    pubsubService.subscribe(TOPICS.TRANSACTIONS, () => {});
    expect(pubsubService.getSubscribedTopics().length).toBeGreaterThan(0);

    pubsubService.destroy();
    expect(pubsubService.getSubscribedTopics()).toEqual([]);
  });

  it('publishes a message without error', async () => {
    const message: P2PMessage = {
      type: MessageType.GameState,
      senderId: 'test-sender',
      timestamp: Date.now(),
      payload: { tick: 1, data: 'hello' },
    };

    pubsubService.subscribe(TOPICS.GAME_STATE, () => {});

    // Should not throw - publishes to zero peers which is allowed
    await expect(
      pubsubService.publish(TOPICS.GAME_STATE, message),
    ).resolves.not.toThrow();
  });

  it('TOPICS contains expected topic strings', () => {
    expect(TOPICS.GAME_STATE).toBe('nodecoin/game-state/1.0.0');
    expect(TOPICS.TRANSACTIONS).toBe('nodecoin/transactions/1.0.0');
    expect(TOPICS.COMBAT).toBe('nodecoin/combat/1.0.0');
    expect(TOPICS.ANNOUNCE).toBe('nodecoin/announce/1.0.0');
  });

  it('unsubscribe on non-subscribed topic does not throw', () => {
    expect(() =>
      pubsubService.unsubscribe(TOPICS.ANNOUNCE, () => {}),
    ).not.toThrow();
  });
});
