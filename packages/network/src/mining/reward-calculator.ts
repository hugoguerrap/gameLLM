export class RewardCalculator {
  /** Halving schedule: reward halves every halvingInterval ticks */
  static calculateBlockReward(tick: number, baseReward: number = 0.1, halvingInterval: number = 525600): number {
    const halvings = Math.floor(tick / halvingInterval);
    return baseReward / Math.pow(2, halvings);
  }

  /** Total supply cap check */
  static isSupplyCapReached(totalMinted: number, maxSupply: number = 21_000_000): boolean {
    return totalMinted >= maxSupply;
  }
}
