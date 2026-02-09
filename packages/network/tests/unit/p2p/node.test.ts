import { describe, it, expect, afterEach } from 'vitest';
import { P2PNode } from '../../../src/p2p/node.js';

describe('P2PNode', () => {
  let node: P2PNode;

  afterEach(async () => {
    if (node) {
      await node.stop();
    }
  });

  it('starts successfully', async () => {
    node = new P2PNode();
    await node.start({ enableMdns: false });
    expect(node.isStarted()).toBe(true);
  });

  it('has a peerId after start', async () => {
    node = new P2PNode();
    await node.start({ enableMdns: false });
    const peerId = node.getPeerId();
    expect(typeof peerId).toBe('string');
    expect(peerId.length).toBeGreaterThan(0);
    // libp2p peer IDs typically start with "12D3Koo"
    expect(peerId).toMatch(/^12D3Koo/);
  });

  it('has multiaddrs after start', async () => {
    node = new P2PNode();
    await node.start({ enableMdns: false });
    const addrs = node.getMultiaddrs();
    expect(Array.isArray(addrs)).toBe(true);
    expect(addrs.length).toBeGreaterThan(0);
    // Each address should contain the peer ID
    for (const addr of addrs) {
      expect(addr).toContain('/p2p/');
      expect(addr).toContain(node.getPeerId());
    }
  });

  it('stops cleanly', async () => {
    node = new P2PNode();
    await node.start({ enableMdns: false });
    expect(node.isStarted()).toBe(true);

    await node.stop();
    expect(node.isStarted()).toBe(false);
  });

  it('isStarted returns correct state', async () => {
    node = new P2PNode();
    expect(node.isStarted()).toBe(false);

    await node.start({ enableMdns: false });
    expect(node.isStarted()).toBe(true);

    await node.stop();
    expect(node.isStarted()).toBe(false);
  });

  it('multiple starts are idempotent', async () => {
    node = new P2PNode();
    await node.start({ enableMdns: false });
    const peerId = node.getPeerId();

    // Second start should not error and should keep the same node
    await node.start({ enableMdns: false });
    expect(node.getPeerId()).toBe(peerId);
    expect(node.isStarted()).toBe(true);
  });

  it('getNode throws when not started', () => {
    node = new P2PNode();
    expect(() => node.getNode()).toThrow('Node not started');
  });

  it('stop is safe to call when not started', async () => {
    node = new P2PNode();
    // Should not throw
    await node.stop();
    expect(node.isStarted()).toBe(false);
  });
});
