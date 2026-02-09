import type { GameSystem } from '../core/tick-engine.js';
import type { GameState } from '../core/game-state.js';
import type { DeterministicRng } from '../core/rng.js';
import { ResourceType } from '../types/resources.js';

export class TradeSystem implements GameSystem {
  readonly name = 'TradeSystem';

  process(state: GameState, _rng: DeterministicRng, tick: number): void {
    const mutable = state.getMutableState();

    // Expire old offers
    for (const offer of mutable.tradeOffers) {
      if (offer.status === 'open' && tick >= offer.expiresAtTick) {
        offer.status = 'expired';
        // Refund offered resources back to player
        for (const [resource, amount] of Object.entries(offer.offering)) {
          if (amount && amount > 0) {
            state.addResource(resource as ResourceType, amount);
          }
        }
      }
    }

    // Clean up old expired/cancelled offers (keep last 20)
    mutable.tradeOffers = mutable.tradeOffers
      .filter(o => o.status === 'open' || o.status === 'accepted')
      .concat(
        mutable.tradeOffers
          .filter(o => o.status === 'expired' || o.status === 'cancelled')
          .slice(-20)
      );
  }
}
