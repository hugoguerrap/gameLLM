import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { DeterministicRng } from '../../../src/core/rng.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { ResourceType } from '../../../src/types/resources.js';
import { TradeSystem } from '../../../src/systems/trade-system.js';
import type { TradeOffer } from '../../../src/types/economy.js';

describe('TradeSystem', () => {
  let gs: GameState;
  let rng: DeterministicRng;
  let system: TradeSystem;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
    rng = new DeterministicRng('test-seed');
    system = new TradeSystem();
  });

  it('should expire offers when tick >= expiresAtTick', () => {
    const mutable = gs.getMutableState();
    const offer: TradeOffer = {
      id: 'trade_1',
      sellerId: 'test',
      offering: { [ResourceType.Wood]: 20 },
      requesting: { [ResourceType.Iron]: 10 },
      createdAtTick: 0,
      expiresAtTick: 5,
      status: 'open',
    };
    mutable.tradeOffers.push(offer);

    system.process(gs, rng, 5);

    expect(offer.status).toBe('expired');
  });

  it('should refund resources on expiry', () => {
    const mutable = gs.getMutableState();
    const woodBefore = mutable.resources[ResourceType.Wood];

    const offer: TradeOffer = {
      id: 'trade_1',
      sellerId: 'test',
      offering: { [ResourceType.Wood]: 20 },
      requesting: { [ResourceType.Iron]: 10 },
      createdAtTick: 0,
      expiresAtTick: 5,
      status: 'open',
    };
    mutable.tradeOffers.push(offer);

    system.process(gs, rng, 5);

    expect(gs.getResource(ResourceType.Wood)).toBe(woodBefore + 20);
  });

  it('should not expire open offers before deadline', () => {
    const mutable = gs.getMutableState();
    const offer: TradeOffer = {
      id: 'trade_1',
      sellerId: 'test',
      offering: { [ResourceType.Wood]: 20 },
      requesting: { [ResourceType.Iron]: 10 },
      createdAtTick: 0,
      expiresAtTick: 10,
      status: 'open',
    };
    mutable.tradeOffers.push(offer);

    system.process(gs, rng, 5);

    expect(offer.status).toBe('open');
  });

  it('should clean up old expired offers keeping last 20', () => {
    const mutable = gs.getMutableState();

    // Add 25 expired offers
    for (let i = 0; i < 25; i++) {
      mutable.tradeOffers.push({
        id: `trade_expired_${i}`,
        sellerId: 'test',
        offering: { [ResourceType.Wood]: 1 },
        requesting: { [ResourceType.Iron]: 1 },
        createdAtTick: 0,
        expiresAtTick: 0,
        status: 'expired',
      });
    }

    // Add 1 open offer
    mutable.tradeOffers.push({
      id: 'trade_open',
      sellerId: 'test',
      offering: { [ResourceType.Wood]: 1 },
      requesting: { [ResourceType.Iron]: 1 },
      createdAtTick: 0,
      expiresAtTick: 100,
      status: 'open',
    });

    system.process(gs, rng, 1);

    // Should have 1 open + 20 expired = 21
    expect(mutable.tradeOffers.length).toBe(21);
    expect(mutable.tradeOffers.filter(o => o.status === 'open').length).toBe(1);
    expect(mutable.tradeOffers.filter(o => o.status === 'expired').length).toBe(20);

    // The first 5 expired offers should have been removed (kept last 20)
    const expiredIds = mutable.tradeOffers
      .filter(o => o.status === 'expired')
      .map(o => o.id);
    expect(expiredIds).not.toContain('trade_expired_0');
    expect(expiredIds).not.toContain('trade_expired_4');
    expect(expiredIds).toContain('trade_expired_5');
    expect(expiredIds).toContain('trade_expired_24');
  });
});
