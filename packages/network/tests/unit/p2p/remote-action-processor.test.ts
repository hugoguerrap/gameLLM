import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoteActionProcessor, type RemoteActionHandler } from '../../../src/p2p/remote-action-processor.js';
import { CommandType, type ActionBlock } from '../../../src/types/blockchain.js';

function createBlock(playerId: string, type: CommandType, args: Record<string, unknown>): ActionBlock {
  return {
    hash: `hash-${Math.random().toString(36).slice(2)}`,
    prevHash: 'prev-hash',
    index: 1,
    playerId,
    command: { type, args, tick: 10 },
    stateHash: 'state-hash',
    timestamp: Date.now(),
    signature: 'sig',
    publicKey: 'pub-key',
  };
}

describe('RemoteActionProcessor', () => {
  const localPlayerId = 'local-player';
  let handler: RemoteActionHandler;
  let processor: RemoteActionProcessor;

  beforeEach(() => {
    handler = {
      onRemoteAcceptTrade: vi.fn(),
      onRemotePvpAttack: vi.fn(),
      onRemoteDiplomacy: vi.fn(),
    };
    processor = new RemoteActionProcessor(localPlayerId, handler);
  });

  it('ignores blocks from the local player', () => {
    const block = createBlock(localPlayerId, CommandType.AcceptTrade, { offerId: '123' });
    processor.processBlock(block);
    expect(handler.onRemoteAcceptTrade).not.toHaveBeenCalled();
  });

  it('routes AcceptTrade blocks to onRemoteAcceptTrade', () => {
    const block = createBlock('remote-player', CommandType.AcceptTrade, { offerId: 'offer-1' });
    processor.processBlock(block);
    expect(handler.onRemoteAcceptTrade).toHaveBeenCalledWith(block);
  });

  it('routes PvpAttack blocks targeting local player to onRemotePvpAttack', () => {
    const block = createBlock('attacker', CommandType.PvpAttack, {
      targetPlayerId: localPlayerId,
      targetArmy: { soldier: 5 },
      targetStrategy: 'balanced',
      targetDefenseBonus: 0,
    });
    processor.processBlock(block);
    expect(handler.onRemotePvpAttack).toHaveBeenCalledWith(block);
  });

  it('ignores PvpAttack blocks targeting other players', () => {
    const block = createBlock('attacker', CommandType.PvpAttack, {
      targetPlayerId: 'some-other-player',
      targetArmy: { soldier: 5 },
    });
    processor.processBlock(block);
    expect(handler.onRemotePvpAttack).not.toHaveBeenCalled();
  });

  it('routes SetDiplomacy blocks targeting local player to onRemoteDiplomacy', () => {
    const block = createBlock('diplomat', CommandType.SetDiplomacy, {
      targetPlayerId: localPlayerId,
      status: 'war',
    });
    processor.processBlock(block);
    expect(handler.onRemoteDiplomacy).toHaveBeenCalledWith(block);
  });

  it('ignores SetDiplomacy blocks targeting other players', () => {
    const block = createBlock('diplomat', CommandType.SetDiplomacy, {
      targetPlayerId: 'some-other-player',
      status: 'allied',
    });
    processor.processBlock(block);
    expect(handler.onRemoteDiplomacy).not.toHaveBeenCalled();
  });

  it('ignores unrelated command types', () => {
    const block = createBlock('remote-player', CommandType.Build, { buildingId: 'granja' });
    processor.processBlock(block);
    expect(handler.onRemoteAcceptTrade).not.toHaveBeenCalled();
    expect(handler.onRemotePvpAttack).not.toHaveBeenCalled();
    expect(handler.onRemoteDiplomacy).not.toHaveBeenCalled();
  });

  it('ignores Genesis blocks', () => {
    const block = createBlock('remote-player', CommandType.Genesis, {});
    processor.processBlock(block);
    expect(handler.onRemoteAcceptTrade).not.toHaveBeenCalled();
    expect(handler.onRemotePvpAttack).not.toHaveBeenCalled();
    expect(handler.onRemoteDiplomacy).not.toHaveBeenCalled();
  });

  it('ignores Research blocks', () => {
    const block = createBlock('remote-player', CommandType.Research, { techId: 'agriculture' });
    processor.processBlock(block);
    expect(handler.onRemoteAcceptTrade).not.toHaveBeenCalled();
    expect(handler.onRemotePvpAttack).not.toHaveBeenCalled();
    expect(handler.onRemoteDiplomacy).not.toHaveBeenCalled();
  });

  it('handles multiple blocks in sequence', () => {
    const trade = createBlock('trader', CommandType.AcceptTrade, { offerId: 'o1' });
    const pvp = createBlock('warrior', CommandType.PvpAttack, {
      targetPlayerId: localPlayerId,
      targetArmy: { soldier: 3 },
    });
    const diplo = createBlock('diplomat', CommandType.SetDiplomacy, {
      targetPlayerId: localPlayerId,
      status: 'peace',
    });

    processor.processBlock(trade);
    processor.processBlock(pvp);
    processor.processBlock(diplo);

    expect(handler.onRemoteAcceptTrade).toHaveBeenCalledTimes(1);
    expect(handler.onRemotePvpAttack).toHaveBeenCalledTimes(1);
    expect(handler.onRemoteDiplomacy).toHaveBeenCalledTimes(1);
  });

  it('handles PvpAttack without targetPlayerId gracefully', () => {
    const block = createBlock('attacker', CommandType.PvpAttack, {
      targetArmy: { soldier: 5 },
    });
    processor.processBlock(block);
    expect(handler.onRemotePvpAttack).not.toHaveBeenCalled();
  });

  it('handles SetDiplomacy without targetPlayerId gracefully', () => {
    const block = createBlock('diplomat', CommandType.SetDiplomacy, {
      status: 'war',
    });
    processor.processBlock(block);
    expect(handler.onRemoteDiplomacy).not.toHaveBeenCalled();
  });
});
