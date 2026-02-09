import type { PlayerState } from '../types/player.js';
import type { BuildingId, BuildingState } from '../types/buildings.js';
import type { ResourceType, ResourceMap } from '../types/resources.js';
import { createInitialPlayerState } from '../types/player.js';
import { BiomeType } from '../types/biomes.js';

export class GameState {
  private state: PlayerState;

  constructor(state: PlayerState) {
    this.state = state;
  }

  static createNew(id: string, name: string, biome: BiomeType): GameState {
    return new GameState(createInitialPlayerState(id, name, biome));
  }

  /** Get a readonly snapshot of the state */
  getState(): Readonly<PlayerState> {
    return this.state;
  }

  /** Get mutable state (for systems to modify during tick processing) */
  getMutableState(): PlayerState {
    return this.state;
  }

  /** Serialize state to JSON string */
  serialize(): string {
    return JSON.stringify(this.state);
  }

  /** Deserialize state from JSON string */
  static deserialize(json: string): GameState {
    const state = JSON.parse(json) as PlayerState;
    return new GameState(state);
  }

  // ── Resource helpers ──
  getResource(type: ResourceType): number {
    return this.state.resources[type];
  }

  getStorage(type: ResourceType): number {
    return this.state.resourceStorage[type];
  }

  addResource(type: ResourceType, amount: number): void {
    const max = this.state.resourceStorage[type];
    this.state.resources[type] = Math.min(this.state.resources[type] + amount, max);
  }

  removeResource(type: ResourceType, amount: number): boolean {
    if (this.state.resources[type] < amount) return false;
    this.state.resources[type] -= amount;
    return true;
  }

  hasResources(costs: Partial<ResourceMap>): boolean {
    for (const [resource, cost] of Object.entries(costs)) {
      if ((cost ?? 0) > 0 && this.state.resources[resource as ResourceType] < (cost ?? 0)) {
        return false;
      }
    }
    return true;
  }

  deductResources(costs: Partial<ResourceMap>): boolean {
    if (!this.hasResources(costs)) return false;
    for (const [resource, cost] of Object.entries(costs)) {
      if ((cost ?? 0) > 0) {
        this.state.resources[resource as ResourceType] -= cost ?? 0;
      }
    }
    return true;
  }

  // ── Building helpers ──
  getBuilding(id: BuildingId): BuildingState | undefined {
    return this.state.buildings.find(b => b.id === id);
  }

  getBuildingLevel(id: BuildingId): number {
    return this.getBuilding(id)?.level ?? 0;
  }

  addBuilding(building: BuildingState): void {
    const existing = this.state.buildings.find(b => b.id === building.id);
    if (existing) {
      existing.level = building.level;
      existing.constructionTicksRemaining = building.constructionTicksRemaining;
    } else {
      this.state.buildings.push(building);
    }
  }

  // ── Research helpers ──
  hasResearched(techId: string): boolean {
    return this.state.research.completed.includes(techId);
  }

  // ── Tick management ──
  getTick(): number {
    return this.state.tick;
  }

  setTick(tick: number): void {
    this.state.tick = tick;
    this.state.lastTickProcessed = tick;
  }
}
