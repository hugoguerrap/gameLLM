import { GameState } from '../core/game-state.js';
import type { CommandResult } from './command.js';
import { Era } from '../types/buildings.js';
import { createInitialPlayerState } from '../types/player.js';
import { calculateLegacyMultiplier } from '../config/formulas.js';
import type { AscensionBonus } from '../types/prestige.js';

const ASCENSION_TOKEN_COST = 500;
const ASCENSION_MIN_TICKS = 50;

export class AscendCommand {
  execute(state: GameState): CommandResult {
    const current = state.getState();

    // Requirement: must be at least Era 2 (Pueblo)
    if (current.era < Era.Pueblo) {
      return {
        success: false,
        message: `Cannot ascend: must be at least Era Pueblo (era 2). Current era: ${current.era}.`,
      };
    }

    // Requirement: must have at least 500 tokens
    if (current.tokens < ASCENSION_TOKEN_COST) {
      return {
        success: false,
        message: `Cannot ascend: requires ${ASCENSION_TOKEN_COST} tokens. Current tokens: ${current.tokens}.`,
      };
    }

    // Requirement: must have played at least 50 ticks
    if (current.tick < ASCENSION_MIN_TICKS) {
      return {
        success: false,
        message: `Cannot ascend: must have played at least ${ASCENSION_MIN_TICKS} ticks. Current tick: ${current.tick}.`,
      };
    }

    const mutable = state.getMutableState();

    // 1. Increment prestige level
    const newLevel = mutable.prestige.level + 1;
    mutable.prestige.level = newLevel;

    // 2. Recalculate legacy multiplier
    mutable.prestige.legacyMultiplier = calculateLegacyMultiplier(newLevel);

    // 3. Deduct ascension cost
    mutable.tokens -= ASCENSION_TOKEN_COST;

    // 4. Add deterministic AscensionBonus based on level
    const bonus = getAscensionBonus(newLevel);
    mutable.prestige.bonuses.push(bonus);

    // Save values to preserve across reset
    const preservedPrestige = { ...mutable.prestige, bonuses: [...mutable.prestige.bonuses] };
    const preservedTokens = mutable.tokens;
    const preservedId = mutable.id;
    const preservedName = mutable.name;
    const preservedBiome = mutable.biome;
    const preservedCreatedAt = mutable.createdAt;

    // 5. Reset settlement to initial state
    const fresh = createInitialPlayerState(preservedId, preservedName, preservedBiome);

    // Apply fresh state
    mutable.era = fresh.era;
    mutable.tick = fresh.tick;
    mutable.resources = fresh.resources;
    mutable.resourceStorage = fresh.resourceStorage;
    mutable.buildings = fresh.buildings;
    mutable.buildQueue = fresh.buildQueue;
    mutable.population = fresh.population;
    mutable.army = fresh.army;
    mutable.research = fresh.research;
    mutable.exploredZones = fresh.exploredZones;
    mutable.claimedZones = fresh.claimedZones;
    mutable.activeEffects = fresh.activeEffects;
    mutable.lastTickProcessed = fresh.lastTickProcessed;

    // 6. Restore preserved values
    mutable.prestige = preservedPrestige;
    mutable.tokens = preservedTokens;
    mutable.id = preservedId;
    mutable.name = preservedName;
    mutable.biome = preservedBiome;
    mutable.createdAt = preservedCreatedAt;

    return {
      success: true,
      message: `Ascended to prestige level ${newLevel}! Received ${bonus.type} bonus (+${bonus.value}).`,
      data: {
        prestigeLevel: newLevel,
        bonus,
        legacyMultiplier: mutable.prestige.legacyMultiplier,
      },
    };
  }
}

function getAscensionBonus(level: number): AscensionBonus {
  const mod = level % 4;
  switch (mod) {
    case 0:
      return { type: 'production', value: 0.05 };
    case 1:
      return { type: 'combat', value: 0.03 };
    case 2:
      return { type: 'research', value: 0.05 };
    case 3:
      return { type: 'storage', value: 0.10 };
    default:
      return { type: 'production', value: 0.05 };
  }
}
