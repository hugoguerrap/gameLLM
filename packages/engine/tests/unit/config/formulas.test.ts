import { describe, it, expect } from 'vitest';
import {
  calculateProduction,
  calculateBuildingCost,
  calculateFoodForGrowth,
  calculateRequiredAmenities,
  calculateCombatDamage,
  calculateSurvivors,
  calculateTransactionFee,
  calculateLegacyMultiplier,
  calculateMiningReward,
} from '../../../src/config/formulas.js';

describe('calculateProduction', () => {
  it('should return 0 when base is 0', () => {
    expect(calculateProduction(0, 5, 0.1, 1.0, 1.0)).toBe(0);
  });

  it('should return 0 when level is 0', () => {
    expect(calculateProduction(10, 0, 0.1, 1.0, 1.0)).toBe(0);
  });

  it('should scale linearly with level', () => {
    const level1 = calculateProduction(10, 1, 0, 1.0, 1.0);
    const level3 = calculateProduction(10, 3, 0, 1.0, 1.0);
    expect(level3).toBe(level1 * 3);
  });

  it('should apply tech bonus correctly', () => {
    // base * level * (1 + techBonus) * legacy * biome
    // 10 * 1 * (1 + 0.5) * 1.0 * 1.0 = 15
    expect(calculateProduction(10, 1, 0.5, 1.0, 1.0)).toBe(15);
  });

  it('should apply legacy multiplier correctly', () => {
    // 10 * 1 * 1.0 * 1.5 * 1.0 = 15
    expect(calculateProduction(10, 1, 0, 1.5, 1.0)).toBe(15);
  });

  it('should apply biome modifier correctly', () => {
    // 10 * 1 * 1.0 * 1.0 * 1.5 = 15
    expect(calculateProduction(10, 1, 0, 1.0, 1.5)).toBe(15);
  });

  it('should compound all multipliers together', () => {
    // 5 * 3 * (1 + 0.2) * 1.1 * 1.5 = 5 * 3 * 1.2 * 1.1 * 1.5 = 29.7
    const result = calculateProduction(5, 3, 0.2, 1.1, 1.5);
    expect(result).toBeCloseTo(29.7, 5);
  });

  it('should handle large values without overflow', () => {
    const result = calculateProduction(1000, 100, 1.0, 2.0, 2.0);
    expect(result).toBe(1000 * 100 * 2 * 2 * 2);
  });

  it('should handle negative tech bonus (debuff)', () => {
    // 10 * 1 * (1 + (-0.5)) * 1.0 * 1.0 = 5
    expect(calculateProduction(10, 1, -0.5, 1.0, 1.0)).toBe(5);
  });
});

describe('calculateBuildingCost', () => {
  it('should return baseCost at level 0', () => {
    // ceil(100 * 1.15^0) = ceil(100 * 1) = 100
    expect(calculateBuildingCost(100, 0)).toBe(100);
  });

  it('should apply exponential scaling at level 1', () => {
    // ceil(100 * 1.15^1) = ceil(115) = 115
    expect(calculateBuildingCost(100, 1)).toBe(115);
  });

  it('should apply exponential scaling at level 5', () => {
    // ceil(100 * 1.15^5) = ceil(100 * 2.01136...) = ceil(201.136...) = 202
    expect(calculateBuildingCost(100, 5)).toBe(202);
  });

  it('should apply exponential scaling at level 10', () => {
    // ceil(100 * 1.15^10) = ceil(100 * 4.04556...) = ceil(404.556...) = 405
    expect(calculateBuildingCost(100, 10)).toBe(405);
  });

  it('should use custom multiplier', () => {
    // ceil(100 * 1.5^3) = ceil(100 * 3.375) = ceil(337.5) = 338
    expect(calculateBuildingCost(100, 3, 1.5)).toBe(338);
  });

  it('should use default multiplier 1.15 when not specified', () => {
    expect(calculateBuildingCost(100, 2)).toBe(calculateBuildingCost(100, 2, 1.15));
  });

  it('should always ceil the result', () => {
    // ceil(50 * 1.15^1) = ceil(57.5) = 58
    expect(calculateBuildingCost(50, 1)).toBe(58);
  });

  it('should handle multiplier of 1.0 (no scaling)', () => {
    expect(calculateBuildingCost(100, 5, 1.0)).toBe(100);
  });

  it('should handle baseCost of 0', () => {
    expect(calculateBuildingCost(0, 10)).toBe(0);
  });

  it('should handle very high levels', () => {
    const result = calculateBuildingCost(20, 50);
    expect(result).toBeGreaterThan(20);
    expect(Number.isFinite(result)).toBe(true);
  });
});

describe('calculateFoodForGrowth', () => {
  it('should return 15 for population of 0 or below', () => {
    expect(calculateFoodForGrowth(0)).toBe(15);
    expect(calculateFoodForGrowth(-5)).toBe(15);
  });

  it('should return 15 for population of 1', () => {
    // ceil(15 + 8 * 0 + 0^1.5) = ceil(15) = 15
    expect(calculateFoodForGrowth(1)).toBe(15);
  });

  it('should scale with population', () => {
    // pop=2: ceil(15 + 8*1 + 1^1.5) = ceil(15 + 8 + 1) = 24
    expect(calculateFoodForGrowth(2)).toBe(24);
  });

  it('should include superlinear growth at higher populations', () => {
    // pop=10: ceil(15 + 8*9 + 9^1.5) = ceil(15 + 72 + 27) = ceil(114) = 114
    expect(calculateFoodForGrowth(10)).toBe(114);
  });

  it('should increase monotonically', () => {
    let prev = calculateFoodForGrowth(1);
    for (let pop = 2; pop <= 50; pop++) {
      const curr = calculateFoodForGrowth(pop);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });

  it('should be significantly higher for large populations', () => {
    const small = calculateFoodForGrowth(5);
    const large = calculateFoodForGrowth(50);
    expect(large).toBeGreaterThan(small * 5);
  });

  it('should handle population of 100', () => {
    // ceil(15 + 8*99 + 99^1.5) = ceil(15 + 792 + 985.07...) = ceil(1792.07..) = 1793
    const result = calculateFoodForGrowth(100);
    expect(result).toBe(1793);
  });
});

describe('calculateRequiredAmenities', () => {
  it('should return 0 for population of 0', () => {
    expect(calculateRequiredAmenities(0)).toBe(0);
  });

  it('should return 1 for population of 1', () => {
    expect(calculateRequiredAmenities(1)).toBe(1);
  });

  it('should return 1 for population of 2', () => {
    expect(calculateRequiredAmenities(2)).toBe(1);
  });

  it('should return half population rounded up', () => {
    expect(calculateRequiredAmenities(5)).toBe(3);
    expect(calculateRequiredAmenities(10)).toBe(5);
    expect(calculateRequiredAmenities(11)).toBe(6);
  });

  it('should handle large populations', () => {
    expect(calculateRequiredAmenities(1000)).toBe(500);
    expect(calculateRequiredAmenities(999)).toBe(500);
  });
});

describe('calculateCombatDamage', () => {
  it('should return 30 when strength diff is 0 and random factor is 1', () => {
    expect(calculateCombatDamage(0, 1.0)).toBe(30);
  });

  it('should double damage when strength diff is 17', () => {
    // 30 * 2^(17/17) * 1.0 = 30 * 2 = 60
    expect(calculateCombatDamage(17, 1.0)).toBe(60);
  });

  it('should halve damage when strength diff is -17', () => {
    // 30 * 2^(-17/17) * 1.0 = 30 * 0.5 = 15
    expect(calculateCombatDamage(-17, 1.0)).toBe(15);
  });

  it('should scale with random factor', () => {
    // 30 * 2^0 * 0.75 = 30 * 0.75 = 22.5 -> round = 23
    expect(calculateCombatDamage(0, 0.75)).toBe(23);
    // 30 * 2^0 * 1.25 = 30 * 1.25 = 37.5 -> round = 38
    expect(calculateCombatDamage(0, 1.25)).toBe(38);
  });

  it('should handle large positive strength diff', () => {
    // 30 * 2^(34/17) * 1.0 = 30 * 4 = 120
    expect(calculateCombatDamage(34, 1.0)).toBe(120);
  });

  it('should handle large negative strength diff', () => {
    // 30 * 2^(-34/17) * 1.0 = 30 * 0.25 = 7.5 -> round = 8
    expect(calculateCombatDamage(-34, 1.0)).toBe(8);
  });

  it('should return 0 when random factor is 0', () => {
    expect(calculateCombatDamage(10, 0)).toBe(0);
  });

  it('should never return negative values for reasonable inputs', () => {
    for (let diff = -50; diff <= 50; diff += 5) {
      expect(calculateCombatDamage(diff, 0.75)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('calculateSurvivors', () => {
  it('should return 0 when winner strength equals loser strength', () => {
    expect(calculateSurvivors(100, 100)).toBe(0);
  });

  it('should return 0 when winner strength is less than loser strength', () => {
    expect(calculateSurvivors(50, 100)).toBe(0);
  });

  it('should return full strength when loser has 0 strength', () => {
    expect(calculateSurvivors(100, 0)).toBe(100);
  });

  it('should follow Lanchester square law', () => {
    // sqrt(100^2 - 60^2) = sqrt(10000 - 3600) = sqrt(6400) = 80
    expect(calculateSurvivors(100, 60)).toBe(80);
  });

  it('should return correct value for non-perfect squares', () => {
    // sqrt(50^2 - 30^2) = sqrt(2500 - 900) = sqrt(1600) = 40
    expect(calculateSurvivors(50, 30)).toBe(40);
  });

  it('should round the result', () => {
    // sqrt(70^2 - 50^2) = sqrt(4900 - 2500) = sqrt(2400) = 48.989... -> round = 49
    expect(calculateSurvivors(70, 50)).toBe(49);
  });

  it('should handle very large values', () => {
    // sqrt(10000^2 - 6000^2) = sqrt(64000000) = 8000
    expect(calculateSurvivors(10000, 6000)).toBe(8000);
  });

  it('should handle strength difference of 1', () => {
    // sqrt(101^2 - 100^2) = sqrt(10201 - 10000) = sqrt(201) ≈ 14.177 -> round = 14
    expect(calculateSurvivors(101, 100)).toBe(14);
  });
});

describe('calculateTransactionFee', () => {
  it('should return 3% of amount by default', () => {
    // ceil(100 * 0.03 * 100) / 100 = ceil(300) / 100 = 3
    expect(calculateTransactionFee(100)).toBe(3);
  });

  it('should return 0 for amount of 0', () => {
    expect(calculateTransactionFee(0)).toBe(0);
  });

  it('should ceil to 2 decimal places', () => {
    // ceil(10 * 0.03 * 100) / 100 = ceil(30) / 100 = 0.3
    expect(calculateTransactionFee(10)).toBe(0.3);
  });

  it('should round up fractional cents', () => {
    // ceil(7 * 0.03 * 100) / 100 = ceil(21) / 100 = 0.21
    expect(calculateTransactionFee(7)).toBe(0.21);
  });

  it('should use custom tax rate', () => {
    // ceil(100 * 0.05 * 100) / 100 = ceil(500) / 100 = 5
    expect(calculateTransactionFee(100, 0.05)).toBe(5);
  });

  it('should handle small amounts', () => {
    // ceil(1 * 0.03 * 100) / 100 = ceil(3) / 100 = 0.03
    expect(calculateTransactionFee(1)).toBe(0.03);
  });

  it('should handle large amounts', () => {
    // ceil(10000 * 0.03 * 100) / 100 = ceil(30000) / 100 = 300
    expect(calculateTransactionFee(10000)).toBe(300);
  });

  it('should handle tax rate of 0', () => {
    expect(calculateTransactionFee(100, 0)).toBe(0);
  });

  it('should handle non-integer amounts', () => {
    // ceil(33.33 * 0.03 * 100) / 100 = ceil(99.99) / 100 = ceil(99.99) = 100 / 100 = 1
    expect(calculateTransactionFee(33.33)).toBe(1);
  });
});

describe('calculateLegacyMultiplier', () => {
  it('should return 1.0 at prestige level 0', () => {
    expect(calculateLegacyMultiplier(0)).toBe(1.0);
  });

  it('should return 1.1 at prestige level 1', () => {
    expect(calculateLegacyMultiplier(1)).toBeCloseTo(1.1, 10);
  });

  it('should return 2.0 at prestige level 10', () => {
    expect(calculateLegacyMultiplier(10)).toBeCloseTo(2.0, 10);
  });

  it('should scale linearly with prestige level', () => {
    const level5 = calculateLegacyMultiplier(5);
    const level10 = calculateLegacyMultiplier(10);
    // level5 = 1.5, level10 = 2.0
    // (2.0 - 1.0) = 2 * (1.5 - 1.0)
    expect(level10 - 1).toBeCloseTo(2 * (level5 - 1), 10);
  });

  it('should use custom bonus per level', () => {
    // 1 + 5 * 0.20 = 2.0
    expect(calculateLegacyMultiplier(5, 0.20)).toBeCloseTo(2.0, 10);
  });

  it('should handle default bonus of 0.10', () => {
    expect(calculateLegacyMultiplier(3)).toBe(calculateLegacyMultiplier(3, 0.10));
  });

  it('should handle high prestige levels', () => {
    // 1 + 100 * 0.10 = 11.0
    expect(calculateLegacyMultiplier(100)).toBeCloseTo(11.0, 10);
  });
});

describe('calculateMiningReward', () => {
  it('should return base reward when no bonuses', () => {
    // 0.1 * (1 + 0) * 1.0 = 0.1
    expect(calculateMiningReward(0.1, 0, 1.0)).toBeCloseTo(0.1, 10);
  });

  it('should scale with validation bonus', () => {
    // 0.1 * (1 + 0.5) * 1.0 = 0.15
    expect(calculateMiningReward(0.1, 0.5, 1.0)).toBeCloseTo(0.15, 10);
  });

  it('should scale with uptime factor', () => {
    // 0.1 * (1 + 0) * 0.8 = 0.08
    expect(calculateMiningReward(0.1, 0, 0.8)).toBeCloseTo(0.08, 10);
  });

  it('should compound validation bonus and uptime', () => {
    // 0.1 * (1 + 0.5) * 0.8 = 0.12
    expect(calculateMiningReward(0.1, 0.5, 0.8)).toBeCloseTo(0.12, 10);
  });

  it('should return 0 when base reward is 0', () => {
    expect(calculateMiningReward(0, 1.0, 1.0)).toBe(0);
  });

  it('should return 0 when uptime is 0', () => {
    expect(calculateMiningReward(0.1, 0.5, 0)).toBe(0);
  });

  it('should handle large validation bonuses', () => {
    // 0.1 * (1 + 2.0) * 1.0 = 0.3
    expect(calculateMiningReward(0.1, 2.0, 1.0)).toBeCloseTo(0.3, 10);
  });

  it('should handle different base rewards', () => {
    // 0.5 * (1 + 0) * 1.0 = 0.5
    expect(calculateMiningReward(0.5, 0, 1.0)).toBeCloseTo(0.5, 10);
  });
});
