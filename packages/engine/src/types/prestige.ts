export interface AscensionBonus {
  type: 'production' | 'combat' | 'research' | 'storage';
  value: number;
}

export interface PrestigeState {
  level: number;
  totalTokensEarned: number;
  legacyMultiplier: number;
  bonuses: AscensionBonus[];
}
