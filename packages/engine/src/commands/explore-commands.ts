import { GameState } from '../core/game-state.js';
import type { CommandResult } from './command.js';

export class ExploreCommand {
  constructor(private zoneId: string) {}

  execute(state: GameState): CommandResult {
    const mutable = state.getMutableState();

    if (mutable.exploredZones.includes(this.zoneId)) {
      return { success: false, message: `Zone ${this.zoneId} already explored` };
    }

    mutable.exploredZones.push(this.zoneId);

    return {
      success: true,
      message: `Explored zone ${this.zoneId}.`,
      data: { zoneId: this.zoneId },
    };
  }
}

export class ClaimCommand {
  constructor(private zoneId: string) {}

  execute(state: GameState): CommandResult {
    const mutable = state.getMutableState();

    if (!mutable.exploredZones.includes(this.zoneId)) {
      return { success: false, message: `Zone ${this.zoneId} must be explored first` };
    }

    if (mutable.claimedZones.includes(this.zoneId)) {
      return { success: false, message: `Zone ${this.zoneId} already claimed` };
    }

    mutable.claimedZones.push(this.zoneId);

    return {
      success: true,
      message: `Claimed zone ${this.zoneId}.`,
      data: { zoneId: this.zoneId },
    };
  }
}
