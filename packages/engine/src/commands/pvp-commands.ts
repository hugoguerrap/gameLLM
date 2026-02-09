import type { GameState } from '../core/game-state.js';
import type { CommandResult } from './command.js';
import { DeterministicRng } from '../core/rng.js';
import { UnitType, CombatStrategy } from '../types/units.js';
import { resolveBattle } from '../systems/combat-resolver.js';

const PVP_COOLDOWN = 20;

/**
 * PvP attack command that resolves a battle from the attacker's perspective.
 *
 * Since we can't access the target player's state directly (they're on another
 * node), the command receives the defender's data as parameters. The
 * network/MCP layer is responsible for providing this data.
 */
export class PvpAttackCommand {
  constructor(
    private targetPlayerId: string,
    private targetArmy: Record<UnitType, number>,
    private targetStrategy: CombatStrategy,
    private targetDefenseBonus: number,
    private rngSeed?: string,
  ) {}

  execute(state: GameState): CommandResult {
    const playerState = state.getState();

    // Validate: can't attack self
    if (this.targetPlayerId === playerState.id) {
      return { success: false, message: 'Cannot attack yourself.' };
    }

    // Validate: player has army units
    const totalUnits = Object.values(playerState.army.units).reduce((a, b) => a + b, 0);
    if (totalUnits === 0) {
      return { success: false, message: 'You have no army units.' };
    }

    // Validate: cooldown (20 ticks between attacks on same target)
    const lastAttack = playerState.lastAttackTicks[this.targetPlayerId] ?? 0;
    if (playerState.tick - lastAttack < PVP_COOLDOWN && lastAttack > 0) {
      const remaining = PVP_COOLDOWN - (playerState.tick - lastAttack);
      return {
        success: false,
        message: `Cooldown: can't attack this player for ${remaining} more ticks.`,
      };
    }

    // Resolve battle
    const rng = new DeterministicRng(
      this.rngSeed ?? `pvp-${playerState.id}-${this.targetPlayerId}-${playerState.tick}`,
    );
    const report = resolveBattle(
      { units: { ...playerState.army.units }, strategy: playerState.army.strategy },
      {
        units: { ...this.targetArmy },
        strategy: this.targetStrategy,
        defenseBonus: this.targetDefenseBonus,
      },
      rng,
      playerState.id,
      this.targetPlayerId,
    );

    const mutable = state.getMutableState();

    // Record cooldown
    mutable.lastAttackTicks[this.targetPlayerId] = playerState.tick;

    // Apply attacker losses
    for (const [unitType, count] of Object.entries(report.attackerLosses)) {
      if (count > 0) {
        mutable.army.units[unitType as UnitType] = Math.max(
          0,
          mutable.army.units[unitType as UnitType] - count,
        );
      }
    }

    // Award loot if won
    if (report.winner === 'attacker') {
      mutable.tokens += report.loot.tokens;

      return {
        success: true,
        message: `Victory against player ${this.targetPlayerId}! Earned ${report.loot.tokens} tokens.`,
        data: { battleReport: report as unknown as Record<string, unknown> },
      };
    } else if (report.winner === 'draw') {
      return {
        success: true,
        message: `Battle against player ${this.targetPlayerId} ended in a draw.`,
        data: { battleReport: report as unknown as Record<string, unknown> },
      };
    } else {
      return {
        success: true,
        message: `Defeat against player ${this.targetPlayerId}. Your army suffered losses.`,
        data: { battleReport: report as unknown as Record<string, unknown> },
      };
    }
  }
}
