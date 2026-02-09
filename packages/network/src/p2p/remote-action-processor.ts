import { CommandType, type ActionBlock } from '../types/blockchain.js';

export interface RemoteActionHandler {
  onRemoteAcceptTrade(block: ActionBlock): void;
  onRemotePvpAttack(block: ActionBlock): void;
  onRemoteDiplomacy(block: ActionBlock): void;
}

export class RemoteActionProcessor {
  private readonly localPlayerId: string;
  private readonly handler: RemoteActionHandler;

  constructor(localPlayerId: string, handler: RemoteActionHandler) {
    this.localPlayerId = localPlayerId;
    this.handler = handler;
  }

  processBlock(block: ActionBlock): void {
    // Only process blocks from other players
    if (block.playerId === this.localPlayerId) return;

    switch (block.command.type) {
      case CommandType.AcceptTrade:
        this.handleAcceptTrade(block);
        break;
      case CommandType.PvpAttack:
        this.handlePvpAttack(block);
        break;
      case CommandType.SetDiplomacy:
        this.handleDiplomacy(block);
        break;
    }
  }

  private handleAcceptTrade(block: ActionBlock): void {
    // The AcceptTrade block has args.offerId — we check if we're the offer creator
    // The handler decides if this offer is ours
    this.handler.onRemoteAcceptTrade(block);
  }

  private handlePvpAttack(block: ActionBlock): void {
    // The PvpAttack block has args.targetPlayerId — check if it's us
    const targetPlayerId = block.command.args.targetPlayerId as string | undefined;
    if (targetPlayerId === this.localPlayerId) {
      this.handler.onRemotePvpAttack(block);
    }
  }

  private handleDiplomacy(block: ActionBlock): void {
    // The SetDiplomacy block has args.targetPlayerId — check if it's us
    const targetPlayerId = block.command.args.targetPlayerId as string | undefined;
    if (targetPlayerId === this.localPlayerId) {
      this.handler.onRemoteDiplomacy(block);
    }
  }
}
