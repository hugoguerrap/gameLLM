export interface PeerInfo {
  peerId: string;
  address: string; // wallet address
  name: string;
  era: number;
  connectedAt: number;
  lastSeen: number;
}
