import { ResourceMap } from './resources.js';

export interface TradeOffer {
  id: string;
  sellerId: string;
  offering: Partial<ResourceMap>;
  requesting: Partial<ResourceMap>;
  tokenPrice?: number;
  createdAtTick: number;
  expiresAtTick: number;
  status: 'open' | 'accepted' | 'expired' | 'cancelled';
  acceptedBy?: string;
}
