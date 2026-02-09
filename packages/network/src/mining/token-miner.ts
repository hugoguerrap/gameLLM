export class TokenMiner {
  private baseReward: number;

  constructor(baseReward: number = 0.1) {
    this.baseReward = baseReward;
  }

  calculateReward(uptimeHours: number, validatedTxCount: number): number {
    const uptimeFactor = Math.min(uptimeHours / 24, 1.0); // max 1.0 at 24h
    const validationBonus = Math.min(validatedTxCount * 0.01, 0.5); // max 0.5
    return this.baseReward * (1 + validationBonus) * (0.5 + uptimeFactor * 0.5);
  }
}
