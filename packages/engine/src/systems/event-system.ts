import type { GameSystem } from '../core/tick-engine.js';
import type { GameState } from '../core/game-state.js';
import type { DeterministicRng } from '../core/rng.js';
import { EVENT_CHECK_INTERVAL } from '../config/constants.js';
import { EVENT_DEFINITIONS } from '../config/events.js';

export class EventSystem implements GameSystem {
  readonly name = 'EventSystem';

  process(state: GameState, rng: DeterministicRng, tick: number): void {
    const mutableState = state.getMutableState();

    // Process active effects: decrement ticksRemaining, remove expired
    for (let i = mutableState.activeEffects.length - 1; i >= 0; i--) {
      mutableState.activeEffects[i].ticksRemaining -= 1;
      if (mutableState.activeEffects[i].ticksRemaining <= 0) {
        mutableState.activeEffects.splice(i, 1);
      }
    }

    // Only check for new events every EVENT_CHECK_INTERVAL ticks
    if (tick % EVENT_CHECK_INTERVAL !== 0) return;

    // Try to trigger one event
    for (const eventDef of EVENT_DEFINITIONS) {
      const minEra = eventDef.minEra ?? 1;
      if (mutableState.era < minEra) continue;

      if (rng.chance(eventDef.probability)) {
        // Trigger this event: create an ActiveEffect for production_modifier effects
        for (const effect of eventDef.effects) {
          if (effect.type === 'production_modifier' || effect.type === 'defense_modifier') {
            mutableState.activeEffects.push({
              id: `${eventDef.type}_${tick}`,
              type: effect.type === 'production_modifier' ? 'production_boost' : 'defense_boost',
              modifier: effect.value,
              ticksRemaining: eventDef.durationTicks,
            });
          }
        }

        // Only trigger one event per check
        break;
      }
    }
  }
}
