import { describe, it, expect } from 'vitest';
import { formatStatus, formatInventory, formatNarrative } from '../../src/formatter.js';
import {
  createInitialPlayerState,
  BiomeType,
  CombatStrategy,
  UnitType,
  BuildingId,
  type PlayerState,
} from '@nodecoin/engine';

function createTestState(overrides: Partial<PlayerState> = {}): PlayerState {
  const base = createInitialPlayerState('test-id', 'TestSettlement', BiomeType.Forest);
  return { ...base, ...overrides };
}

describe('formatStatus', () => {
  it('should include settlement name, era, tick, resources, population, and tokens', () => {
    const state = createTestState();
    const output = formatStatus(state);

    expect(output).toContain('=== TestSettlement ===');
    expect(output).toContain('Era: Aldea');
    expect(output).toContain('Tick: 0');
    expect(output).toContain('Population: 10/20');
    expect(output).toContain('Happiness: 50');
    expect(output).toContain('100.00 NODECOIN');
    expect(output).toContain('--- Resources ---');
    expect(output).toContain('Wood:');
    expect(output).toContain('Food:');
    expect(output).toContain('Stone:');
    expect(output).toContain('Iron:');
    expect(output).toContain('Gems:');
    expect(output).toContain('Mana:');
  });

  it('should handle empty buildings gracefully', () => {
    const state = createTestState({ buildings: [] });
    const output = formatStatus(state);

    // Should NOT contain the buildings section header when there are no buildings
    expect(output).not.toContain('--- Buildings ---');
  });

  it('should show buildings when present', () => {
    const state = createTestState({
      buildings: [
        { id: BuildingId.Granja, level: 2, constructionTicksRemaining: 0 },
        { id: BuildingId.Choza, level: 1, constructionTicksRemaining: 3 },
      ],
    });
    const output = formatStatus(state);

    expect(output).toContain('--- Buildings ---');
    expect(output).toContain('granja (Lv2)');
    expect(output).toContain('choza (Lv1) [Building... 3 ticks left]');
  });

  it('should handle empty army gracefully', () => {
    const state = createTestState();
    // Default state has all unit counts at 0
    const output = formatStatus(state);

    // Army section should NOT appear when all units are 0
    expect(output).not.toContain('--- Army ---');
  });

  it('should show army when units are present', () => {
    const state = createTestState({
      army: {
        units: {
          [UnitType.Soldier]: 5,
          [UnitType.Archer]: 3,
          [UnitType.Cavalry]: 0,
          [UnitType.Lancer]: 0,
          [UnitType.Catapult]: 0,
          [UnitType.Spy]: 0,
          [UnitType.Mage]: 0,
        },
        strategy: CombatStrategy.Aggressive,
      },
    });
    const output = formatStatus(state);

    expect(output).toContain('--- Army ---');
    expect(output).toContain('Strategy: aggressive');
    expect(output).toContain('soldier: 5');
    expect(output).toContain('archer: 3');
    // Units with 0 count should not appear
    expect(output).not.toContain('cavalry: 0');
  });

  it('should show build queue when present', () => {
    const state = createTestState({
      buildQueue: [
        { id: BuildingId.Mina, level: 1, constructionTicksRemaining: 5 },
      ],
    });
    const output = formatStatus(state);

    expect(output).toContain('--- Build Queue ---');
    expect(output).toContain('mina - 5 ticks remaining');
  });

  it('should show active effects when present', () => {
    const state = createTestState({
      activeEffects: [
        { id: 'boost-1', type: 'production_boost', modifier: 0.25, ticksRemaining: 10 },
        { id: 'debuff-1', type: 'disaster', modifier: -0.15, ticksRemaining: 5 },
      ],
    });
    const output = formatStatus(state);

    expect(output).toContain('--- Active Effects ---');
    expect(output).toContain('production_boost: +25%');
    expect(output).toContain('10 ticks left');
    expect(output).toContain('disaster: -15%');
    expect(output).toContain('5 ticks left');
  });

  it('should show prestige info when level > 0', () => {
    const state = createTestState({
      prestige: { level: 2, totalTokensEarned: 500, legacyMultiplier: 1.2, bonuses: [] },
    });
    const output = formatStatus(state);

    expect(output).toContain('--- Prestige ---');
    expect(output).toContain('Level: 2');
    expect(output).toContain('Legacy Multiplier: x1.20');
  });

  it('should not show prestige when level is 0', () => {
    const state = createTestState({
      prestige: { level: 0, totalTokensEarned: 0, legacyMultiplier: 1.0, bonuses: [] },
    });
    const output = formatStatus(state);

    expect(output).not.toContain('--- Prestige ---');
  });

  it('should show research when active', () => {
    const state = createTestState({
      research: { completed: ['agriculture'], current: 'woodworking', progress: 3 },
    });
    const output = formatStatus(state);

    expect(output).toContain('--- Research ---');
    expect(output).toContain('Researching: woodworking');
    expect(output).toContain('progress: 3');
    expect(output).toContain('Completed: 1 technologies');
  });

  it('should not show research section when nothing is being researched', () => {
    const state = createTestState({
      research: { completed: [], current: null, progress: 0 },
    });
    const output = formatStatus(state);

    expect(output).not.toContain('--- Research ---');
  });

  it('should format resource bars correctly', () => {
    const state = createTestState();
    const output = formatStatus(state);

    // Wood: 100/500 = 20% -> 2 filled, 8 empty
    expect(output).toContain('[##--------] 20%');
  });

  it('should display era names correctly for all eras', () => {
    expect(formatStatus(createTestState({ era: 1 }))).toContain('Era: Aldea');
    expect(formatStatus(createTestState({ era: 2 }))).toContain('Era: Pueblo');
    expect(formatStatus(createTestState({ era: 3 }))).toContain('Era: Ciudad');
    expect(formatStatus(createTestState({ era: 4 }))).toContain('Era: Metropolis');
  });
});

describe('formatInventory', () => {
  it('should show all resources with storage caps', () => {
    const state = createTestState();
    const output = formatInventory(state);

    expect(output).toContain('=== Inventory ===');
    expect(output).toContain('Resources:');
    expect(output).toContain('Wood: 100 / 500');
    expect(output).toContain('Food: 100 / 500');
    expect(output).toContain('Stone: 50 / 300');
    expect(output).toContain('Iron: 20 / 200');
    expect(output).toContain('Gems: 5 / 100');
    expect(output).toContain('Mana: 0 / 50');
  });

  it('should show NODECOIN balance', () => {
    const state = createTestState({ tokens: 42.5 });
    const output = formatInventory(state);

    expect(output).toContain('NODECOIN: 42.50');
  });

  it('should show army units', () => {
    const state = createTestState({
      army: {
        units: {
          [UnitType.Soldier]: 10,
          [UnitType.Archer]: 5,
          [UnitType.Cavalry]: 0,
          [UnitType.Lancer]: 0,
          [UnitType.Catapult]: 0,
          [UnitType.Spy]: 0,
          [UnitType.Mage]: 0,
        },
        strategy: CombatStrategy.Balanced,
      },
    });
    const output = formatInventory(state);

    expect(output).toContain('Army:');
    expect(output).toContain('soldier: 10');
    expect(output).toContain('archer: 5');
    // formatInventory shows all units including 0 counts
    expect(output).toContain('cavalry: 0');
  });

  it('should show zero for all army units on fresh state', () => {
    const state = createTestState();
    const output = formatInventory(state);

    expect(output).toContain('soldier: 0');
    expect(output).toContain('archer: 0');
    expect(output).toContain('cavalry: 0');
  });
});

describe('formatNarrative', () => {
  it('should return quiet message for empty events', () => {
    const output = formatNarrative([]);

    expect(output).toBe('All is quiet in your settlement.');
  });

  it('should return bullet list for events', () => {
    const events = [
      { description: 'A travelling merchant arrived.' },
      { description: 'Harvest season brought extra food.' },
      { description: 'Scouts report movement near the border.' },
    ];
    const output = formatNarrative(events);

    expect(output).toContain('- A travelling merchant arrived.');
    expect(output).toContain('- Harvest season brought extra food.');
    expect(output).toContain('- Scouts report movement near the border.');
  });

  it('should format a single event correctly', () => {
    const events = [{ description: 'A storm approaches.' }];
    const output = formatNarrative(events);

    expect(output).toBe('- A storm approaches.');
  });
});
