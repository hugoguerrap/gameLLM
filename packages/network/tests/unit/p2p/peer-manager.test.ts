import { describe, it, expect, beforeEach } from 'vitest';
import { PeerManager } from '../../../src/p2p/peer-manager.js';
import type { PeerInfo } from '../../../src/types/peer.js';

function makePeer(overrides: Partial<PeerInfo> = {}): PeerInfo {
  return {
    peerId: 'peer-1',
    address: 'NC1234567890abcdef1234567890abcdef12345678',
    name: 'TestNode',
    era: 1,
    connectedAt: Date.now(),
    lastSeen: Date.now(),
    ...overrides,
  };
}

describe('PeerManager', () => {
  let manager: PeerManager;

  beforeEach(() => {
    manager = new PeerManager();
  });

  it('adds and retrieves a peer', () => {
    const peer = makePeer();
    manager.addPeer(peer);

    const retrieved = manager.getPeer('peer-1');
    expect(retrieved).toBeDefined();
    expect(retrieved!.peerId).toBe('peer-1');
    expect(retrieved!.name).toBe('TestNode');
    expect(retrieved!.address).toBe(
      'NC1234567890abcdef1234567890abcdef12345678',
    );
  });

  it('removes a peer', () => {
    manager.addPeer(makePeer());
    expect(manager.hasPeer('peer-1')).toBe(true);

    const removed = manager.removePeer('peer-1');
    expect(removed).toBe(true);
    expect(manager.hasPeer('peer-1')).toBe(false);
    expect(manager.getPeer('peer-1')).toBeUndefined();
  });

  it('removePeer returns false for unknown peer', () => {
    expect(manager.removePeer('nonexistent')).toBe(false);
  });

  it('updates last seen timestamp', () => {
    const now = Date.now();
    manager.addPeer(makePeer({ lastSeen: now }));

    const later = now + 5000;
    const updated = manager.updateLastSeen('peer-1', later);
    expect(updated).toBe(true);
    expect(manager.getPeer('peer-1')!.lastSeen).toBe(later);
  });

  it('updateLastSeen returns false for unknown peer', () => {
    expect(manager.updateLastSeen('nonexistent')).toBe(false);
  });

  it('gets all peers', () => {
    manager.addPeer(makePeer({ peerId: 'peer-1', name: 'Node1' }));
    manager.addPeer(makePeer({ peerId: 'peer-2', name: 'Node2' }));
    manager.addPeer(makePeer({ peerId: 'peer-3', name: 'Node3' }));

    const all = manager.getAllPeers();
    expect(all).toHaveLength(3);
    const names = all.map((p) => p.name).sort();
    expect(names).toEqual(['Node1', 'Node2', 'Node3']);
  });

  it('returns undefined for unknown peer', () => {
    expect(manager.getPeer('nonexistent')).toBeUndefined();
  });

  it('tracks peer count', () => {
    expect(manager.getPeerCount()).toBe(0);

    manager.addPeer(makePeer({ peerId: 'peer-1' }));
    expect(manager.getPeerCount()).toBe(1);

    manager.addPeer(makePeer({ peerId: 'peer-2' }));
    expect(manager.getPeerCount()).toBe(2);

    manager.removePeer('peer-1');
    expect(manager.getPeerCount()).toBe(1);
  });

  it('clears all peers', () => {
    manager.addPeer(makePeer({ peerId: 'peer-1' }));
    manager.addPeer(makePeer({ peerId: 'peer-2' }));
    expect(manager.getPeerCount()).toBe(2);

    manager.clear();
    expect(manager.getPeerCount()).toBe(0);
    expect(manager.getAllPeers()).toEqual([]);
  });
});
