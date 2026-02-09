import { describe, it, expect } from 'vitest';
import { DeterministicRng } from '../../../src/core/rng.js';

describe('DeterministicRng', () => {
  describe('determinism', () => {
    it('should produce identical sequences for the same string seed', () => {
      const rng1 = new DeterministicRng('test-seed');
      const rng2 = new DeterministicRng('test-seed');

      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('should produce identical sequences for the same numeric seed', () => {
      const rng1 = new DeterministicRng(42);
      const rng2 = new DeterministicRng(42);

      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('should produce different sequences for different seeds', () => {
      const rng1 = new DeterministicRng('seed-a');
      const rng2 = new DeterministicRng('seed-b');

      const values1 = Array.from({ length: 10 }, () => rng1.next());
      const values2 = Array.from({ length: 10 }, () => rng2.next());

      // At least some values should differ
      const allEqual = values1.every((v, i) => v === values2[i]);
      expect(allEqual).toBe(false);
    });

    it('should reproduce the same sequence after reset', () => {
      const rng = new DeterministicRng('reset-test');
      const firstRun = Array.from({ length: 20 }, () => rng.next());

      rng.reset();
      const secondRun = Array.from({ length: 20 }, () => rng.next());

      expect(firstRun).toEqual(secondRun);
    });
  });

  describe('next()', () => {
    it('should return values in [0, 1) by default', () => {
      const rng = new DeterministicRng('range-test');
      for (let i = 0; i < 1000; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should return values in [min, max) when specified', () => {
      const rng = new DeterministicRng('range-minmax');
      for (let i = 0; i < 1000; i++) {
        const value = rng.next(5, 10);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThan(10);
      }
    });

    it('should return values in negative range', () => {
      const rng = new DeterministicRng('negative-range');
      for (let i = 0; i < 1000; i++) {
        const value = rng.next(-10, -5);
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThan(-5);
      }
    });
  });

  describe('nextInt()', () => {
    it('should return integers in [min, max] inclusive', () => {
      const rng = new DeterministicRng('int-test');
      const seen = new Set<number>();

      for (let i = 0; i < 1000; i++) {
        const value = rng.nextInt(1, 6);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
        seen.add(value);
      }

      // With 1000 rolls, all values 1-6 should appear
      expect(seen.size).toBe(6);
    });

    it('should return exact value when min equals max', () => {
      const rng = new DeterministicRng('exact');
      for (let i = 0; i < 10; i++) {
        expect(rng.nextInt(5, 5)).toBe(5);
      }
    });
  });

  describe('chance()', () => {
    it('should always return true with probability 1', () => {
      const rng = new DeterministicRng('chance-1');
      for (let i = 0; i < 100; i++) {
        expect(rng.chance(1)).toBe(true);
      }
    });

    it('should always return false with probability 0', () => {
      const rng = new DeterministicRng('chance-0');
      for (let i = 0; i < 100; i++) {
        expect(rng.chance(0)).toBe(false);
      }
    });

    it('should return approximately correct ratio for probability 0.5', () => {
      const rng = new DeterministicRng('chance-half');
      let trueCount = 0;
      const trials = 10000;

      for (let i = 0; i < trials; i++) {
        if (rng.chance(0.5)) trueCount++;
      }

      const ratio = trueCount / trials;
      expect(ratio).toBeGreaterThan(0.45);
      expect(ratio).toBeLessThan(0.55);
    });
  });

  describe('pick()', () => {
    it('should return an element from the array', () => {
      const rng = new DeterministicRng('pick-test');
      const items = ['a', 'b', 'c', 'd', 'e'];

      for (let i = 0; i < 100; i++) {
        const picked = rng.pick(items);
        expect(items).toContain(picked);
      }
    });

    it('should eventually pick all elements given enough iterations', () => {
      const rng = new DeterministicRng('pick-all');
      const items = [1, 2, 3];
      const seen = new Set<number>();

      for (let i = 0; i < 100; i++) {
        seen.add(rng.pick(items));
      }

      expect(seen.size).toBe(3);
    });

    it('should return the only element from a single-element array', () => {
      const rng = new DeterministicRng('pick-single');
      expect(rng.pick([42])).toBe(42);
    });

    it('should be deterministic', () => {
      const rng1 = new DeterministicRng('pick-det');
      const rng2 = new DeterministicRng('pick-det');
      const items = ['x', 'y', 'z'];

      for (let i = 0; i < 50; i++) {
        expect(rng1.pick(items)).toBe(rng2.pick(items));
      }
    });
  });

  describe('skip()', () => {
    it('should advance the RNG state by n iterations', () => {
      const rng1 = new DeterministicRng('skip-test');
      const rng2 = new DeterministicRng('skip-test');

      // Advance rng1 manually by 5 calls
      for (let i = 0; i < 5; i++) {
        rng1.next();
      }

      // Skip rng2 by 5
      rng2.skip(5);

      // Both should now produce the same next value
      expect(rng1.next()).toBe(rng2.next());
    });
  });
});
