import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { BuildingId } from '../../../src/types/buildings.js';
import { ResourceType } from '../../../src/types/resources.js';
import { BuildCommand, UpgradeCommand, DemolishCommand } from '../../../src/commands/build-commands.js';
import { BUILDING_DEFINITIONS } from '../../../src/config/buildings.js';
import { calculateBuildingCost } from '../../../src/config/formulas.js';

describe('BuildCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
  });

  it('should successfully build a Choza with sufficient resources', () => {
    const cmd = new BuildCommand(BuildingId.Choza);
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Started construction of Choza');
    expect(result.data?.buildingId).toBe(BuildingId.Choza);
    expect(result.data?.ticks).toBe(3);

    // Building should exist
    const building = gs.getBuilding(BuildingId.Choza);
    expect(building).toBeDefined();
    expect(building!.level).toBe(1);
    expect(building!.constructionTicksRemaining).toBe(3);

    // Resources should be deducted (Choza costs: Wood=20, Food=10 at level 0)
    const state = gs.getState();
    expect(state.resources[ResourceType.Wood]).toBe(100 - 20);
    expect(state.resources[ResourceType.Food]).toBe(100 - 10);
  });

  it('should fail when insufficient resources', () => {
    // Drain all wood
    const mutable = gs.getMutableState();
    mutable.resources[ResourceType.Wood] = 0;

    const cmd = new BuildCommand(BuildingId.Choza);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient resources');

    // No building should be added
    expect(gs.getBuilding(BuildingId.Choza)).toBeUndefined();
  });

  it('should fail when building already exists', () => {
    // Build first time
    const cmd = new BuildCommand(BuildingId.Choza);
    cmd.execute(gs);

    // Try to build again
    const result = cmd.execute(gs);
    expect(result.success).toBe(false);
    expect(result.message).toContain('already built');
  });

  it('should fail when era requirement is not met', () => {
    // Cuartel requires Era.Pueblo (2), player starts in Era.Aldea (1)
    // Also requires military_tactics tech, but era check comes first
    const cmd = new BuildCommand(BuildingId.Cuartel);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('era');
  });

  it('should fail when required technology is not researched', () => {
    // Muralla is Era.Aldea but has no tech requirement, so use Herreria
    // Herreria is Era.Pueblo and requires 'ironworking' tech
    // Set era to Pueblo to bypass era check and test tech check
    const mutable = gs.getMutableState();
    mutable.era = 2; // Pueblo

    const cmd = new BuildCommand(BuildingId.Herreria);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Requires technology');
  });
});

describe('UpgradeCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
    // Pre-build a Choza at level 1 with construction complete
    gs.addBuilding({
      id: BuildingId.Choza,
      level: 1,
      constructionTicksRemaining: 0,
    });
  });

  it('should successfully upgrade an existing building', () => {
    const cmd = new UpgradeCommand(BuildingId.Choza);
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Upgrading Choza to level 2');
    expect(result.data?.newLevel).toBe(2);

    const building = gs.getBuilding(BuildingId.Choza);
    expect(building!.level).toBe(2);
    expect(building!.constructionTicksRemaining).toBe(3);

    // Cost at level 1: ceil(20 * 1.15^1) = 23 wood, ceil(10 * 1.15^1) = 12 food
    const def = BUILDING_DEFINITIONS[BuildingId.Choza];
    const expectedWoodCost = calculateBuildingCost(20, 1, def.costMultiplier);
    const expectedFoodCost = calculateBuildingCost(10, 1, def.costMultiplier);
    const state = gs.getState();
    expect(state.resources[ResourceType.Wood]).toBe(100 - expectedWoodCost);
    expect(state.resources[ResourceType.Food]).toBe(100 - expectedFoodCost);
  });

  it('should fail when building does not exist', () => {
    const cmd = new UpgradeCommand(BuildingId.Granja);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not yet built');
  });

  it('should fail when building is still under construction', () => {
    // Set Choza as under construction
    const building = gs.getBuilding(BuildingId.Choza)!;
    building.constructionTicksRemaining = 2;

    const cmd = new UpgradeCommand(BuildingId.Choza);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('still under construction');
  });

  it('should fail when building is already at max level', () => {
    // Set Choza to max level (10)
    const building = gs.getBuilding(BuildingId.Choza)!;
    building.level = 10;

    const cmd = new UpgradeCommand(BuildingId.Choza);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('max level');
  });

  it('should fail when insufficient resources for upgrade', () => {
    const mutable = gs.getMutableState();
    mutable.resources[ResourceType.Wood] = 0;
    mutable.resources[ResourceType.Food] = 0;

    const cmd = new UpgradeCommand(BuildingId.Choza);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient resources');
  });
});

describe('DemolishCommand', () => {
  let gs: GameState;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
    // Pre-build a Choza
    gs.addBuilding({
      id: BuildingId.Choza,
      level: 3,
      constructionTicksRemaining: 0,
    });
  });

  it('should remove building and refund 50% of base cost', () => {
    const woodBefore = gs.getState().resources[ResourceType.Wood];
    const foodBefore = gs.getState().resources[ResourceType.Food];

    const cmd = new DemolishCommand(BuildingId.Choza);
    const result = cmd.execute(gs);

    expect(result.success).toBe(true);
    expect(result.message).toContain('demolished');
    expect(result.message).toContain('50% resources refunded');

    // Building should be gone
    expect(gs.getBuilding(BuildingId.Choza)).toBeUndefined();

    // Refund 50% of level 1 base cost: Wood=floor(20*0.5)=10, Food=floor(10*0.5)=5
    const state = gs.getState();
    expect(state.resources[ResourceType.Wood]).toBe(woodBefore + 10);
    expect(state.resources[ResourceType.Food]).toBe(foodBefore + 5);
  });

  it('should fail when building is not built', () => {
    const cmd = new DemolishCommand(BuildingId.Granja);
    const result = cmd.execute(gs);

    expect(result.success).toBe(false);
    expect(result.message).toContain('is not built');
  });
});
