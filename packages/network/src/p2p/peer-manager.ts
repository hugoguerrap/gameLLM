import type { PeerInfo } from '../types/peer.js';

export class PeerManager {
  private peers: Map<string, PeerInfo> = new Map();

  addPeer(info: PeerInfo): void {
    this.peers.set(info.peerId, info);
  }

  removePeer(peerId: string): boolean {
    return this.peers.delete(peerId);
  }

  getPeer(peerId: string): PeerInfo | undefined {
    return this.peers.get(peerId);
  }

  getAllPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  updateLastSeen(peerId: string, timestamp?: number): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) return false;
    peer.lastSeen = timestamp ?? Date.now();
    return true;
  }

  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId);
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  clear(): void {
    this.peers.clear();
  }
}
