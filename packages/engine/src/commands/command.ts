import type { GameState } from '../core/game-state.js';

export interface CommandResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface Command {
  execute(state: GameState): CommandResult;
}
