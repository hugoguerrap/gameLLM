import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { ResourceType } from '../../../src/types/resources.js';
import {
  CreateTradeOfferCommand,
  AcceptTradeCommand,
  CancelTradeOfferCommand,
} from '../../../src/commands/economy-commands.js';

describe('CreateTradeOfferCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
  });

  it('should successfully create a trade offer', () => {
    const cmd = new CreateTradeOfferCommand(
      { [ResourceType.Wood]: 30 },
      { [ResourceType.Iron]: 10 },
    );
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.data?.offerId).toBeDefined();

    const offers = gs.getState().tradeOffers;
    expect(offers.length).toBe(1);
    expect(offers[0].status).toBe('open');
    expect(offers[0].sellerId).toBe('test');
    expect(offers[0].offering[ResourceType.Wood]).toBe(30);
    expect(offers[0].requesting[ResourceType.Iron]).toBe(10);
  });

  it('should deduct offered resources (escrow)', () => {
    const woodBefore = gs.getResource(ResourceType.Wood); // 100

    const cmd = new CreateTradeOfferCommand(
      { [ResourceType.Wood]: 30 },
      { [ResourceType.Iron]: 10 },
    );
    cmd.execute(gs);

    expect(gs.getResource(ResourceType.Wood)).toBe(woodBefore - 30);
  });

  it('should fail when player has insufficient resources', () => {
    const cmd = new CreateTradeOfferCommand(
      { [ResourceType.Wood]: 999 },
      { [ResourceType.Iron]: 10 },
    );
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient resources');

    // No offer should be created
    expect(gs.getState().tradeOffers.length).toBe(0);

    // Resources should not be deducted
    expect(gs.getResource(ResourceType.Wood)).toBe(100);
  });

  it('should set correct expiry tick based on expiresInTicks', () => {
    // Set tick to 10
    gs.setTick(10);

    const cmd = new CreateTradeOfferCommand(
      { [ResourceType.Wood]: 10 },
      { [ResourceType.Iron]: 5 },
      50,
    );
    cmd.execute(gs);

    const offer = gs.getState().tradeOffers[0];
    expect(offer.createdAtTick).toBe(10);
    expect(offer.expiresAtTick).toBe(60);
  });
});

describe('AcceptTradeCommand', () => {
  let gs: GameState;
  let offerId: string;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);

    // Create an offer first
    const createCmd = new CreateTradeOfferCommand(
      { [ResourceType.Wood]: 30 },
      { [ResourceType.Iron]: 10 },
    );
    const result = createCmd.execute(gs);
    offerId = result.data?.offerId as string;
  });

  it('should successfully accept a trade offer', () => {
    const cmd = new AcceptTradeCommand(offerId, {
      [ResourceType.Iron]: 10,
    });
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('accepted');
  });

  it('should mark the offer as accepted', () => {
    const cmd = new AcceptTradeCommand(offerId, {
      [ResourceType.Iron]: 10,
    });
    cmd.execute(gs);

    const offer = gs.getState().tradeOffers.find(o => o.id === offerId);
    expect(offer?.status).toBe('accepted');
  });

  it('should give the seller the requested resources', () => {
    const ironBefore = gs.getResource(ResourceType.Iron); // 20

    const cmd = new AcceptTradeCommand(offerId, {
      [ResourceType.Iron]: 10,
    });
    cmd.execute(gs);

    // Seller receives the requested iron
    expect(gs.getResource(ResourceType.Iron)).toBe(ironBefore + 10);
  });

  it('should fail if offer is not open', () => {
    // Accept the offer first
    const acceptCmd = new AcceptTradeCommand(offerId, {
      [ResourceType.Iron]: 10,
    });
    acceptCmd.execute(gs);

    // Try to accept again
    const result = new AcceptTradeCommand(offerId, {
      [ResourceType.Iron]: 10,
    }).execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not open');
  });

  it('should fail if buyer has insufficient resources', () => {
    const cmd = new AcceptTradeCommand(offerId, {
      [ResourceType.Iron]: 2, // Only 2, but needs 10
    });
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('insufficient');
  });

  it('should fail if offer does not exist', () => {
    const cmd = new AcceptTradeCommand('nonexistent_id', {
      [ResourceType.Iron]: 10,
    });
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});

describe('CancelTradeOfferCommand', () => {
  let gs: GameState;
  let offerId: string;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);

    // Create an offer first
    const createCmd = new CreateTradeOfferCommand(
      { [ResourceType.Wood]: 30 },
      { [ResourceType.Iron]: 10 },
    );
    const result = createCmd.execute(gs);
    offerId = result.data?.offerId as string;
  });

  it('should successfully cancel a trade offer', () => {
    const cmd = new CancelTradeOfferCommand(offerId);
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('cancelled');
  });

  it('should refund offered resources on cancellation', () => {
    // After creating the offer, wood was deducted: 100 - 30 = 70
    expect(gs.getResource(ResourceType.Wood)).toBe(70);

    const cmd = new CancelTradeOfferCommand(offerId);
    cmd.execute(gs);

    // After cancel, should be refunded: 70 + 30 = 100
    expect(gs.getResource(ResourceType.Wood)).toBe(100);
  });

  it('should mark the offer as cancelled', () => {
    const cmd = new CancelTradeOfferCommand(offerId);
    cmd.execute(gs);

    const offer = gs.getState().tradeOffers.find(o => o.id === offerId);
    expect(offer?.status).toBe('cancelled');
  });

  it('should fail if offer does not belong to current player', () => {
    // Manually change the sellerId to simulate another player's offer
    const mutable = gs.getMutableState();
    const offer = mutable.tradeOffers.find(o => o.id === offerId)!;
    offer.sellerId = 'other-player';

    const cmd = new CancelTradeOfferCommand(offerId);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('does not belong to you');
  });

  it('should fail if offer is not open', () => {
    // Cancel first
    new CancelTradeOfferCommand(offerId).execute(gs);

    // Try to cancel again
    const result = new CancelTradeOfferCommand(offerId).execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not open');
  });
});
