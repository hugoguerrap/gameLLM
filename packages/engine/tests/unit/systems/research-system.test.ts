import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../../src/core/game-state.js';
import { DeterministicRng } from '../../../src/core/rng.js';
import { BiomeType } from '../../../src/types/biomes.js';
import { Era } from '../../../src/types/buildings.js';
import { ResearchSystem } from '../../../src/systems/research-system.js';
import { TECH_DEFINITIONS } from '../../../src/config/tech-tree.js';

describe('ResearchSystem', () => {
  let gs: GameState;
  let rng: DeterministicRng;
  let system: ResearchSystem;

  beforeEach(() => {
    gs = GameState.createNew('test', 'TestPlayer', BiomeType.Forest);
    rng = new DeterministicRng('test-seed');
    system = new ResearchSystem();
  });

  describe('research progress', () => {
    it('should increment progress when research is active', () => {
      const mutableState = gs.getMutableState();
      mutableState.research.current = 'agriculture';
      mutableState.research.progress = 0;

      system.process(gs, rng, 1);

      expect(gs.getState().research.progress).toBe(1);
    });

    it('should not change progress when no research is active', () => {
      const mutableState = gs.getMutableState();
      mutableState.research.current = null;
      mutableState.research.progress = 0;

      system.process(gs, rng, 1);

      expect(gs.getState().research.progress).toBe(0);
    });

    it('should accumulate progress over multiple ticks', () => {
      const mutableState = gs.getMutableState();
      mutableState.research.current = 'agriculture';
      mutableState.research.progress = 0;

      system.process(gs, rng, 1);
      system.process(gs, rng, 2);
      system.process(gs, rng, 3);

      expect(gs.getState().research.progress).toBe(3);
    });
  });

  describe('research completion', () => {
    it('should complete research when progress reaches researchTicks', () => {
      const mutableState = gs.getMutableState();
      mutableState.research.current = 'agriculture';
      // agriculture has researchTicks: 10
      mutableState.research.progress = 9; // one more tick to complete

      system.process(gs, rng, 1);

      expect(gs.getState().research.completed).toContain('agriculture');
      expect(gs.getState().research.current).toBeNull();
      expect(gs.getState().research.progress).toBe(0);
    });

    it('should add to completed list on completion', () => {
      const mutableState = gs.getMutableState();
      mutableState.research.completed = ['woodworking'];
      mutableState.research.current = 'agriculture';
      mutableState.research.progress = 9;

      system.process(gs, rng, 1);

      expect(gs.getState().research.completed).toEqual(['woodworking', 'agriculture']);
    });

    it('should reset current and progress on completion', () => {
      const mutableState = gs.getMutableState();
      mutableState.research.current = 'agriculture';
      mutableState.research.progress = 9;

      system.process(gs, rng, 1);

      expect(gs.getState().research.current).toBeNull();
      expect(gs.getState().research.progress).toBe(0);
    });

    it('should not complete research before reaching required ticks', () => {
      const mutableState = gs.getMutableState();
      mutableState.research.current = 'agriculture';
      mutableState.research.progress = 5; // 6 after tick, need 10

      system.process(gs, rng, 1);

      expect(gs.getState().research.completed).not.toContain('agriculture');
      expect(gs.getState().research.current).toBe('agriculture');
      expect(gs.getState().research.progress).toBe(6);
    });
  });

  describe('era upgrade', () => {
    it('should upgrade era when all techs of current era are completed', () => {
      const mutableState = gs.getMutableState();

      // Complete all Era.Aldea techs except one
      const aldeaTechs = TECH_DEFINITIONS.filter(t => t.era === Era.Aldea);
      const lastTech = aldeaTechs[aldeaTechs.length - 1];
      const otherTechs = aldeaTechs.slice(0, -1);

      mutableState.research.completed = otherTechs.map(t => t.id);
      mutableState.research.current = lastTech.id;
      mutableState.research.progress = lastTech.researchTicks - 1;

      system.process(gs, rng, 1);

      expect(gs.getState().era).toBe(Era.Pueblo);
    });

    it('should not upgrade era if not all techs are completed', () => {
      const mutableState = gs.getMutableState();
      mutableState.research.current = 'agriculture';
      mutableState.research.progress = 9;

      system.process(gs, rng, 1);

      // Only agriculture completed, not all Aldea techs
      expect(gs.getState().era).toBe(Era.Aldea);
    });

    it('should not upgrade beyond Metropolis', () => {
      const mutableState = gs.getMutableState();
      mutableState.era = Era.Metropolis;

      // Complete all Metropolis techs
      const metropolisTechs = TECH_DEFINITIONS.filter(t => t.era === Era.Metropolis);
      const lastTech = metropolisTechs[metropolisTechs.length - 1];
      const otherTechs = metropolisTechs.slice(0, -1);

      mutableState.research.completed = otherTechs.map(t => t.id);
      mutableState.research.current = lastTech.id;
      mutableState.research.progress = lastTech.researchTicks - 1;

      system.process(gs, rng, 1);

      expect(gs.getState().era).toBe(Era.Metropolis);
    });
  });
});
