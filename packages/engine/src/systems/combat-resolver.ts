import type { DeterministicRng } from '../core/rng.js';
import type { BattleReport, BattleRound } from '../types/combat.js';
import { UnitType, CombatStrategy } from '../types/units.js';
import { UNIT_DEFINITIONS } from '../config/units.js';
import { calculateCombatDamage } from '../config/formulas.js';
import {
  COMBAT_RANDOM_MIN,
  COMBAT_RANDOM_MAX,
  UNIT_TRIANGLE_BONUS,
} from '../config/constants.js';

export interface ArmySide {
  units: Record<UnitType, number>;
  strategy: CombatStrategy;
}

export interface DefenderSide extends ArmySide {
  defenseBonus: number;
}

/**
 * Count total units in an army.
 */
function totalUnits(units: Record<UnitType, number>): number {
  let sum = 0;
  for (const type of Object.values(UnitType)) {
    sum += units[type] ?? 0;
  }
  return sum;
}

/**
 * Calculate total HP for an army.
 */
function totalHp(units: Record<UnitType, number>): number {
  let hp = 0;
  for (const type of Object.values(UnitType)) {
    const count = units[type] ?? 0;
    if (count > 0) {
      hp += count * UNIT_DEFINITIONS[type].health;
    }
  }
  return hp;
}

/**
 * Calculate a side's total attack strength, accounting for triangle bonuses
 * against a specific enemy army composition.
 */
function calculateAttackStrength(
  units: Record<UnitType, number>,
  enemyUnits: Record<UnitType, number>,
): number {
  let strength = 0;
  for (const type of Object.values(UnitType)) {
    const count = units[type] ?? 0;
    if (count <= 0) continue;
    const def = UNIT_DEFINITIONS[type];
    let perUnit = def.attack;

    // Triangle bonus: if this unit type is strong against any type the enemy has
    if (def.strongAgainst && (enemyUnits[def.strongAgainst] ?? 0) > 0) {
      perUnit += UNIT_TRIANGLE_BONUS;
    }

    strength += count * perUnit;
  }
  return strength;
}

/**
 * Calculate a side's total defense strength.
 */
function calculateDefenseStrength(units: Record<UnitType, number>): number {
  let strength = 0;
  for (const type of Object.values(UnitType)) {
    const count = units[type] ?? 0;
    if (count > 0) {
      strength += count * UNIT_DEFINITIONS[type].defense;
    }
  }
  return strength;
}

/**
 * Apply strategy modifiers to attack and defense values.
 */
function applyStrategy(
  attack: number,
  defense: number,
  strategy: CombatStrategy,
): { attack: number; defense: number } {
  switch (strategy) {
    case CombatStrategy.Aggressive:
      return { attack: attack * 1.2, defense: defense * 0.9 };
    case CombatStrategy.Defensive:
      return { attack: attack * 0.9, defense: defense * 1.2 };
    case CombatStrategy.Balanced:
    case CombatStrategy.Guerrilla:
    default:
      return { attack, defense };
  }
}

/**
 * Distribute casualties proportionally across unit types, removing weaker units first.
 * Returns the losses per unit type.
 */
function distributeCasualties(
  units: Record<UnitType, number>,
  unitsToLose: number,
): Partial<Record<UnitType, number>> {
  const losses: Partial<Record<UnitType, number>> = {};
  let remaining = unitsToLose;

  // Sort unit types by health (weakest first) to kill off weaker units first
  const sortedTypes = Object.values(UnitType)
    .filter(t => (units[t] ?? 0) > 0)
    .sort((a, b) => UNIT_DEFINITIONS[a].health - UNIT_DEFINITIONS[b].health);

  for (const type of sortedTypes) {
    if (remaining <= 0) break;
    const available = units[type] ?? 0;
    const lost = Math.min(available, remaining);
    if (lost > 0) {
      losses[type] = lost;
      remaining -= lost;
    }
  }

  return losses;
}

/**
 * Resolve a battle between an attacker and a defender.
 * Single-round resolution using the combat damage formula.
 */
export function resolveBattle(
  attacker: ArmySide,
  defender: DefenderSide,
  rng: DeterministicRng,
  attackerId: string = 'attacker',
  defenderId: string = 'defender',
): BattleReport {
  const attackerTotal = totalUnits(attacker.units);
  const defenderTotal = totalUnits(defender.units);

  // Handle empty army edge cases
  if (attackerTotal === 0 && defenderTotal === 0) {
    return {
      attackerId,
      defenderId,
      attackerStrategy: attacker.strategy,
      defenderStrategy: defender.strategy,
      rounds: [],
      winner: 'draw',
      attackerLosses: {},
      defenderLosses: {},
      loot: { tokens: 0 },
    };
  }

  if (attackerTotal === 0) {
    return {
      attackerId,
      defenderId,
      attackerStrategy: attacker.strategy,
      defenderStrategy: defender.strategy,
      rounds: [],
      winner: 'defender',
      attackerLosses: {},
      defenderLosses: {},
      loot: { tokens: 0 },
    };
  }

  if (defenderTotal === 0) {
    return {
      attackerId,
      defenderId,
      attackerStrategy: attacker.strategy,
      defenderStrategy: defender.strategy,
      rounds: [],
      winner: 'attacker',
      attackerLosses: {},
      defenderLosses: {},
      loot: { tokens: 0 },
    };
  }

  // Calculate raw strengths
  const attackerRawAtk = calculateAttackStrength(attacker.units, defender.units);
  const attackerRawDef = calculateDefenseStrength(attacker.units);
  const defenderRawAtk = calculateAttackStrength(defender.units, attacker.units);
  const defenderRawDef = calculateDefenseStrength(defender.units);

  // Apply strategy modifiers
  const atkMods = applyStrategy(attackerRawAtk, attackerRawDef, attacker.strategy);
  const defMods = applyStrategy(defenderRawAtk, defenderRawDef, defender.strategy);

  // Apply defender's defense bonus (from fortifications, active effects, etc.)
  defMods.defense *= (1 + defender.defenseBonus);

  // Calculate strength difference for damage formula
  // Attacker damage to defender: attacker's attack vs defender's defense
  const atkStrengthDiff = atkMods.attack - defMods.defense;
  // Defender damage to attacker: defender's attack vs attacker's defense
  const defStrengthDiff = defMods.attack - atkMods.defense;

  // Calculate damage with random factors
  const atkRandomFactor = rng.next(COMBAT_RANDOM_MIN, COMBAT_RANDOM_MAX);
  const defRandomFactor = rng.next(COMBAT_RANDOM_MIN, COMBAT_RANDOM_MAX);

  const damageToDefender = calculateCombatDamage(atkStrengthDiff, atkRandomFactor);
  const damageToAttacker = calculateCombatDamage(defStrengthDiff, defRandomFactor);

  // Calculate casualties based on damage vs total HP
  const attackerTotalHp = totalHp(attacker.units);
  const defenderTotalHp = totalHp(defender.units);

  // Units lost = proportion of damage to total HP * total units, at least 0
  const attackerUnitsLost = Math.min(
    attackerTotal,
    Math.max(0, Math.round((damageToAttacker / attackerTotalHp) * attackerTotal)),
  );
  const defenderUnitsLost = Math.min(
    defenderTotal,
    Math.max(0, Math.round((damageToDefender / defenderTotalHp) * defenderTotal)),
  );

  // Distribute losses across unit types
  const attackerLosses = distributeCasualties(attacker.units, attackerUnitsLost);
  const defenderLosses = distributeCasualties(defender.units, defenderUnitsLost);

  // Build the battle round
  const round: BattleRound = {
    roundNumber: 1,
    attackerDamageDealt: damageToDefender,
    defenderDamageDealt: damageToAttacker,
    attackerUnitsLost,
    defenderUnitsLost,
  };

  // Determine winner
  const attackerSurvivors = attackerTotal - attackerUnitsLost;
  const defenderSurvivors = defenderTotal - defenderUnitsLost;

  let winner: 'attacker' | 'defender' | 'draw';
  if (attackerSurvivors <= 0 && defenderSurvivors <= 0) {
    winner = 'draw';
  } else if (attackerSurvivors <= 0) {
    winner = 'defender';
  } else if (defenderSurvivors <= 0) {
    winner = 'attacker';
  } else {
    // Both have survivors - winner is the side that inflicted more proportional damage
    const attackerDamagePct = damageToDefender / defenderTotalHp;
    const defenderDamagePct = damageToAttacker / attackerTotalHp;
    winner = attackerDamagePct >= defenderDamagePct ? 'attacker' : 'defender';
  }

  // Loot: winner gets 5 tokens per enemy unit killed
  const lootTokens = winner === 'attacker'
    ? 5 * defenderUnitsLost
    : winner === 'defender'
      ? 5 * attackerUnitsLost
      : 0;

  return {
    attackerId,
    defenderId,
    attackerStrategy: attacker.strategy,
    defenderStrategy: defender.strategy,
    rounds: [round],
    winner,
    attackerLosses,
    defenderLosses,
    loot: { tokens: lootTokens },
  };
}
