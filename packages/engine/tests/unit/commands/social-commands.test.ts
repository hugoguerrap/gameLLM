import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { UnitType } from '../../../src/types/units.js';
import { DiplomacyStatus } from '../../../src/types/diplomacy.js';
import {
  CreateAllianceCommand,
  JoinAllianceCommand,
  LeaveAllianceCommand,
  SetDiplomacyCommand,
  SpyCommand,
} from '../../../src/commands/social-commands.js';

describe('CreateAllianceCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('player1', 'TestPlayer', BiomeType.Forest);
  });

  it('should create an alliance successfully', () => {
    const cmd = new CreateAllianceCommand('Test Alliance');
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Test Alliance');
    expect(result.data?.allianceId).toBe('alliance-player1-0');
    expect(result.data?.allianceName).toBe('Test Alliance');

    const state = gs.getState();
    expect(state.alliance).not.toBeNull();
    expect(state.alliance!.name).toBe('Test Alliance');
    expect(state.alliance!.leaderId).toBe('player1');
    expect(state.alliance!.memberIds).toContain('player1');
  });

  it('should fail if already in an alliance', () => {
    const cmd = new CreateAllianceCommand('Alliance 1');
    cmd.execute(gs);

    const cmd2 = new CreateAllianceCommand('Alliance 2');
    const result = cmd2.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('already in an alliance');
  });
});

describe('JoinAllianceCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('player2', 'Player2', BiomeType.Desert);
  });

  it('should join an alliance successfully', () => {
    const cmd = new JoinAllianceCommand('alliance-player1-0', 'Cool Alliance', 'player1');
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Cool Alliance');
    expect(result.data?.allianceId).toBe('alliance-player1-0');

    const state = gs.getState();
    expect(state.alliance).not.toBeNull();
    expect(state.alliance!.id).toBe('alliance-player1-0');
    expect(state.alliance!.leaderId).toBe('player1');
    expect(state.alliance!.memberIds).toContain('player2');
  });

  it('should fail if already in an alliance', () => {
    const join1 = new JoinAllianceCommand('alliance-a', 'Alliance A', 'leaderA');
    join1.execute(gs);

    const join2 = new JoinAllianceCommand('alliance-b', 'Alliance B', 'leaderB');
    const result = join2.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('already in an alliance');
  });
});

describe('LeaveAllianceCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('player1', 'TestPlayer', BiomeType.Forest);
  });

  it('should leave an alliance successfully as a non-leader member', () => {
    // Join an alliance where someone else is leader
    const join = new JoinAllianceCommand('alliance-other-0', 'Other Alliance', 'otherPlayer');
    join.execute(gs);

    const leave = new LeaveAllianceCommand();
    const result = leave.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Left alliance');
    expect(result.data?.disbanded).toBe(false);
    expect(gs.getState().alliance).toBeNull();
  });

  it('should disband the alliance if the leader leaves', () => {
    const create = new CreateAllianceCommand('My Alliance');
    create.execute(gs);

    const leave = new LeaveAllianceCommand();
    const result = leave.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('disbanded');
    expect(result.data?.disbanded).toBe(true);
    expect(gs.getState().alliance).toBeNull();
  });

  it('should fail if not in an alliance', () => {
    const leave = new LeaveAllianceCommand();
    const result = leave.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not in an alliance');
  });
});

describe('SetDiplomacyCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('player1', 'TestPlayer', BiomeType.Forest);
  });

  it('should set diplomacy with another player', () => {
    const cmd = new SetDiplomacyCommand('player2', DiplomacyStatus.Allied);
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('player2');
    expect(result.message).toContain('allied');

    const state = gs.getState();
    expect(state.diplomacy).toHaveLength(1);
    expect(state.diplomacy[0].targetPlayerId).toBe('player2');
    expect(state.diplomacy[0].status).toBe(DiplomacyStatus.Allied);
  });

  it('should update an existing diplomacy relation', () => {
    const cmd1 = new SetDiplomacyCommand('player2', DiplomacyStatus.Allied);
    cmd1.execute(gs);

    // Advance tick
    gs.setTick(5);

    const cmd2 = new SetDiplomacyCommand('player2', DiplomacyStatus.War);
    const result = cmd2.execute(gs);

    expect(result.success).toBe(true);

    const state = gs.getState();
    expect(state.diplomacy).toHaveLength(1);
    expect(state.diplomacy[0].status).toBe(DiplomacyStatus.War);
    expect(state.diplomacy[0].changedAtTick).toBe(5);
  });

  it('should fail when targeting self', () => {
    const cmd = new SetDiplomacyCommand('player1', DiplomacyStatus.Allied);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('yourself');
  });
});

describe('SpyCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('player1', 'TestPlayer', BiomeType.Forest);
    // Give the player a spy unit
    gs.getMutableState().army.units[UnitType.Spy] = 1;
  });

  it('should create a spy report successfully', () => {
    gs.setTick(10);

    const cmd = new SpyCommand('player2', 'EnemyPlayer', 100, 500, 1);
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('EnemyPlayer');

    const state = gs.getState();
    expect(state.spyReports).toHaveLength(1);
    expect(state.spyReports[0].targetPlayerId).toBe('player2');
    expect(state.spyReports[0].targetName).toBe('EnemyPlayer');
    expect(state.spyReports[0].era).toBe(1);
    expect(state.spyReports[0].tick).toBe(10);

    // Estimated values should be within +/-20% of actual
    expect(state.spyReports[0].estimatedArmy).toBeGreaterThanOrEqual(80);
    expect(state.spyReports[0].estimatedArmy).toBeLessThanOrEqual(120);
    expect(state.spyReports[0].estimatedResources).toBeGreaterThanOrEqual(400);
    expect(state.spyReports[0].estimatedResources).toBeLessThanOrEqual(600);

    // Should update lastSpyTick
    expect(state.lastSpyTick).toBe(10);
  });

  it('should fail without a spy unit', () => {
    gs.getMutableState().army.units[UnitType.Spy] = 0;

    const cmd = new SpyCommand('player2', 'EnemyPlayer', 100, 500, 1);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Spy unit');
  });

  it('should fail on cooldown', () => {
    gs.setTick(10);

    const cmd1 = new SpyCommand('player2', 'Enemy', 100, 500, 1);
    cmd1.execute(gs);

    // Try again at tick 15 (only 5 ticks later, need 10)
    gs.setTick(15);

    const cmd2 = new SpyCommand('player3', 'Enemy2', 200, 1000, 2);
    const result = cmd2.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('cooldown');
    expect(result.message).toContain('5');
  });

  it('should succeed after cooldown expires', () => {
    gs.setTick(10);

    const cmd1 = new SpyCommand('player2', 'Enemy', 100, 500, 1);
    cmd1.execute(gs);

    // Try again at tick 20 (10 ticks later, cooldown is exactly met)
    gs.setTick(20);

    const cmd2 = new SpyCommand('player3', 'Enemy2', 200, 1000, 2);
    const result = cmd2.execute(gs);

    expect(result.success).toBe(true);
    expect(gs.getState().spyReports).toHaveLength(2);
  });

  it('should trim old reports when exceeding max', () => {
    // Create 12 spy reports (max is 10)
    for (let i = 0; i < 12; i++) {
      gs.setTick(i * 10); // ensure cooldown is met each time
      const cmd = new SpyCommand(`player-${i}`, `Enemy${i}`, 100, 500, 1);
      cmd.execute(gs);
    }

    const state = gs.getState();
    expect(state.spyReports).toHaveLength(10);

    // Should have kept the 10 most recent (indices 2-11)
    expect(state.spyReports[0].targetPlayerId).toBe('player-2');
    expect(state.spyReports[9].targetPlayerId).toBe('player-11');
  });
});
