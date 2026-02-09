import { GameState } from '../core/game-state.js';
import type { CommandResult } from './command.js';
import type { ResourceMap } from '../types/resources.js';
import { ResourceType } from '../types/resources.js';
import type { TradeOffer } from '../types/economy.js';

let tradeOfferCounter = 0;

function generateTradeId(playerId: string): string {
  tradeOfferCounter++;
  return `trade_${playerId}_${Date.now()}_${tradeOfferCounter}`;
}

export class CreateTradeOfferCommand {
  constructor(
    private offering: Partial<ResourceMap>,
    private requesting: Partial<ResourceMap>,
    private expiresInTicks: number = 100,
  ) {}

  execute(state: GameState): CommandResult {
    const playerState = state.getState();

    // Validate player has enough resources for offering
    if (!state.hasResources(this.offering)) {
      return { success: false, message: 'Insufficient resources to create trade offer' };
    }

    // Deduct offered resources from player (escrow)
    state.deductResources(this.offering);

    // Create trade offer
    const offer: TradeOffer = {
      id: generateTradeId(playerState.id),
      sellerId: playerState.id,
      offering: { ...this.offering },
      requesting: { ...this.requesting },
      createdAtTick: playerState.tick,
      expiresAtTick: playerState.tick + this.expiresInTicks,
      status: 'open',
    };

    // Add to player's tradeOffers array
    const mutable = state.getMutableState();
    mutable.tradeOffers.push(offer);

    return {
      success: true,
      message: `Trade offer created: offering resources for requested resources`,
      data: { offerId: offer.id, offer: offer as unknown as Record<string, unknown> },
    };
  }
}

export class AcceptTradeCommand {
  constructor(
    private offerId: string,
    private buyerResources: Partial<ResourceMap>,
  ) {}

  execute(state: GameState): CommandResult {
    const mutable = state.getMutableState();

    // Find offer by id
    const offer = mutable.tradeOffers.find(o => o.id === this.offerId);
    if (!offer) {
      return { success: false, message: `Trade offer not found: ${this.offerId}` };
    }

    // Must be open status
    if (offer.status !== 'open') {
      return { success: false, message: `Trade offer is not open (status: ${offer.status})` };
    }

    // Verify the buyer has enough of the requested resources
    for (const [resource, amount] of Object.entries(offer.requesting)) {
      if (amount && amount > 0) {
        const buyerAmount = this.buyerResources[resource as ResourceType] ?? 0;
        if (buyerAmount < amount) {
          return { success: false, message: `Buyer has insufficient ${resource} (needs ${amount}, has ${buyerAmount})` };
        }
      }
    }

    // Mark offer as accepted
    offer.status = 'accepted';

    // Give seller the requested resources (add to local state)
    for (const [resource, amount] of Object.entries(offer.requesting)) {
      if (amount && amount > 0) {
        state.addResource(resource as ResourceType, amount);
      }
    }

    return {
      success: true,
      message: `Trade offer accepted: ${this.offerId}`,
      data: { offerId: offer.id, offer: offer as unknown as Record<string, unknown> },
    };
  }
}

export class CancelTradeOfferCommand {
  constructor(private offerId: string) {}

  execute(state: GameState): CommandResult {
    const mutable = state.getMutableState();

    // Find offer by id
    const offer = mutable.tradeOffers.find(o => o.id === this.offerId);
    if (!offer) {
      return { success: false, message: `Trade offer not found: ${this.offerId}` };
    }

    // Must belong to current player
    if (offer.sellerId !== mutable.id) {
      return { success: false, message: 'Cannot cancel a trade offer that does not belong to you' };
    }

    // Must be open status
    if (offer.status !== 'open') {
      return { success: false, message: `Trade offer is not open (status: ${offer.status})` };
    }

    // Mark as cancelled
    offer.status = 'cancelled';

    // Refund offered resources
    for (const [resource, amount] of Object.entries(offer.offering)) {
      if (amount && amount > 0) {
        state.addResource(resource as ResourceType, amount);
      }
    }

    return {
      success: true,
      message: `Trade offer cancelled and resources refunded: ${this.offerId}`,
      data: { offerId: offer.id },
    };
  }
}
