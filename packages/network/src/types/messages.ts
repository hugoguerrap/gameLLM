import type { ActionBlock } from './blockchain.js';

export enum MessageType {
  GameState = 'game_state',
  Transaction = 'transaction',
  CombatLog = 'combat_log',
  PeerAnnounce = 'peer_announce',
  CommandBlock = 'command_block',
  ChainRequest = 'chain_request',
  ChainResponse = 'chain_response',
}

export interface P2PMessage {
  type: MessageType;
  senderId: string;
  timestamp: number;
  payload: unknown;
}

export interface PeerAnnouncePayload {
  playerId: string;
  playerName: string;
  era: number;
  chainLength: number;
}

export interface CommandBlockPayload {
  block: ActionBlock;
}

export interface ChainRequestPayload {
  playerId: string;
  fromIndex: number;
  requesterId: string;
}

export interface ChainResponsePayload {
  playerId: string;
  blocks: ActionBlock[];
}
