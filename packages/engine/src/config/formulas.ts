// All game formulas in one place - deterministic, pure functions

/** Production per tick for a building */
export function calculateProduction(
  base: number,
  level: number,
  techBonus: number,
  legacyMultiplier: number,
  biomeModifier: number,
): number {
  return base * level * (1 + techBonus) * legacyMultiplier * biomeModifier;
}

/** Cost to build/upgrade at a given level */
export function calculateBuildingCost(baseCost: number, currentLevel: number, multiplier: number = 1.15): number {
  return Math.ceil(baseCost * Math.pow(multiplier, currentLevel));
}

/** Food needed for population to grow by 1 */
export function calculateFoodForGrowth(currentPopulation: number): number {
  if (currentPopulation <= 0) return 15;
  return Math.ceil(15 + 8 * (currentPopulation - 1) + Math.pow(currentPopulation - 1, 1.5));
}

/** Required amenities for given population */
export function calculateRequiredAmenities(population: number): number {
  return Math.ceil(population / 2);
}

/** Combat damage formula (Civ6-inspired) */
export function calculateCombatDamage(strengthDiff: number, randomFactor: number): number {
  return Math.round(30 * Math.pow(2, strengthDiff / 17) * randomFactor);
}

/** Lanchester square law survivors */
export function calculateSurvivors(winnerStrength: number, loserStrength: number): number {
  if (winnerStrength <= loserStrength) return 0;
  return Math.round(Math.sqrt(winnerStrength * winnerStrength - loserStrength * loserStrength));
}

/** Transaction fee */
export function calculateTransactionFee(amount: number, taxRate: number = 0.03): number {
  return Math.ceil(amount * taxRate * 100) / 100;
}

/** Legacy multiplier from prestige */
export function calculateLegacyMultiplier(prestigeLevel: number, bonusPerLevel: number = 0.10): number {
  return 1 + prestigeLevel * bonusPerLevel;
}

/** Mining reward per tick */
export function calculateMiningReward(baseReward: number, validationBonus: number, uptimeFactor: number): number {
  return baseReward * (1 + validationBonus) * uptimeFactor;
}
