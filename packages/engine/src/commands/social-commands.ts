import { GameState } from '../core/game-state.js';
import type { CommandResult } from './command.js';
import { DiplomacyStatus } from '../types/diplomacy.js';
import { UnitType } from '../types/units.js';

const SPY_COOLDOWN_TICKS = 10;
const MAX_SPY_REPORTS = 10;

export class CreateAllianceCommand {
  constructor(private allianceName: string) {}

  execute(state: GameState): CommandResult {
    const player = state.getState();

    if (player.alliance !== null) {
      return { success: false, message: 'You are already in an alliance' };
    }

    const mutable = state.getMutableState();
    const allianceId = `alliance-${player.id}-${player.tick}`;

    mutable.alliance = {
      id: allianceId,
      name: this.allianceName,
      leaderId: player.id,
      memberIds: [player.id],
      createdAtTick: player.tick,
    };

    return {
      success: true,
      message: `Alliance "${this.allianceName}" created.`,
      data: { allianceId, allianceName: this.allianceName },
    };
  }
}

export class JoinAllianceCommand {
  constructor(
    private allianceId: string,
    private allianceName: string,
    private leaderId: string,
  ) {}

  execute(state: GameState): CommandResult {
    const player = state.getState();

    if (player.alliance !== null) {
      return { success: false, message: 'You are already in an alliance' };
    }

    const mutable = state.getMutableState();

    mutable.alliance = {
      id: this.allianceId,
      name: this.allianceName,
      leaderId: this.leaderId,
      memberIds: [player.id],
      createdAtTick: player.tick,
    };

    return {
      success: true,
      message: `Joined alliance "${this.allianceName}".`,
      data: { allianceId: this.allianceId, allianceName: this.allianceName },
    };
  }
}

export class LeaveAllianceCommand {
  execute(state: GameState): CommandResult {
    const player = state.getState();

    if (player.alliance === null) {
      return { success: false, message: 'You are not in an alliance' };
    }

    const allianceName = player.alliance.name;
    const wasLeader = player.alliance.leaderId === player.id;
    const mutable = state.getMutableState();

    mutable.alliance = null;

    if (wasLeader) {
      return {
        success: true,
        message: `Alliance "${allianceName}" disbanded (you were the leader).`,
        data: { disbanded: true, allianceName },
      };
    }

    return {
      success: true,
      message: `Left alliance "${allianceName}".`,
      data: { disbanded: false, allianceName },
    };
  }
}

export class SetDiplomacyCommand {
  constructor(
    private targetPlayerId: string,
    private status: DiplomacyStatus,
  ) {}

  execute(state: GameState): CommandResult {
    const player = state.getState();

    if (this.targetPlayerId === player.id) {
      return { success: false, message: 'Cannot set diplomacy with yourself' };
    }

    const mutable = state.getMutableState();
    const existing = mutable.diplomacy.find(
      (d) => d.targetPlayerId === this.targetPlayerId,
    );

    if (existing) {
      existing.status = this.status;
      existing.changedAtTick = player.tick;
    } else {
      mutable.diplomacy.push({
        targetPlayerId: this.targetPlayerId,
        status: this.status,
        changedAtTick: player.tick,
      });
    }

    return {
      success: true,
      message: `Diplomacy with ${this.targetPlayerId} set to ${this.status}.`,
      data: { targetPlayerId: this.targetPlayerId, status: this.status },
    };
  }
}

export class SpyCommand {
  constructor(
    private targetPlayerId: string,
    private targetName: string,
    private targetArmy: number,
    private targetResources: number,
    private targetEra: number,
  ) {}

  execute(state: GameState): CommandResult {
    const player = state.getState();

    // Check for spy unit
    if (player.army.units[UnitType.Spy] < 1) {
      return { success: false, message: 'You need at least 1 Spy unit to perform espionage' };
    }

    // Check cooldown
    const ticksSinceLastSpy = player.tick - player.lastSpyTick;
    if (player.lastSpyTick > 0 && ticksSinceLastSpy < SPY_COOLDOWN_TICKS) {
      const remaining = SPY_COOLDOWN_TICKS - ticksSinceLastSpy;
      return {
        success: false,
        message: `Spy cooldown active. ${remaining} tick(s) remaining.`,
      };
    }

    const mutable = state.getMutableState();

    // Apply +/-20% noise to army and resource values
    const armyNoise = 1 + (Math.random() * 0.4 - 0.2);
    const resourceNoise = 1 + (Math.random() * 0.4 - 0.2);

    const report = {
      targetPlayerId: this.targetPlayerId,
      targetName: this.targetName,
      estimatedArmy: Math.round(this.targetArmy * armyNoise),
      estimatedResources: Math.round(this.targetResources * resourceNoise),
      era: this.targetEra,
      tick: player.tick,
    };

    mutable.spyReports.push(report);

    // Trim to max reports, removing oldest first
    if (mutable.spyReports.length > MAX_SPY_REPORTS) {
      mutable.spyReports = mutable.spyReports.slice(-MAX_SPY_REPORTS);
    }

    mutable.lastSpyTick = player.tick;

    return {
      success: true,
      message: `Spy report on ${this.targetName} received.`,
      data: {
        report: report as unknown as Record<string, unknown>,
      },
    };
  }
}

// Re-export for backward compatibility
export { CreateAllianceCommand as AllianceCommand };
