import { describe, it, expect } from 'vitest';
import { GameClock } from '../../../src/core/clock.js';

describe('GameClock', () => {
  const TICK_MS = 60_000; // 1 minute per tick (default)

  describe('getCurrentTick()', () => {
    it('should return 0 at the start time', () => {
      const clock = new GameClock(1000);
      expect(clock.getCurrentTick(1000)).toBe(0);
    });

    it('should return 0 before the first full tick elapses', () => {
      const clock = new GameClock(1000);
      expect(clock.getCurrentTick(1000 + TICK_MS - 1)).toBe(0);
    });

    it('should return 1 after exactly one tick duration', () => {
      const clock = new GameClock(1000);
      expect(clock.getCurrentTick(1000 + TICK_MS)).toBe(1);
    });

    it('should return correct tick after multiple tick durations', () => {
      const clock = new GameClock(0);
      expect(clock.getCurrentTick(TICK_MS * 10)).toBe(10);
    });

    it('should floor partial ticks', () => {
      const clock = new GameClock(0);
      expect(clock.getCurrentTick(TICK_MS * 2.5)).toBe(2);
    });

    it('should return 0 if now is before start time', () => {
      const clock = new GameClock(5000);
      expect(clock.getCurrentTick(3000)).toBe(0);
    });

    it('should work with a custom tick duration', () => {
      const clock = new GameClock(0, 1000); // 1 second per tick
      expect(clock.getCurrentTick(5000)).toBe(5);
      expect(clock.getCurrentTick(5500)).toBe(5);
      expect(clock.getCurrentTick(6000)).toBe(6);
    });
  });

  describe('getTicksToProcess()', () => {
    it('should return 0 when current tick equals last processed tick', () => {
      const clock = new GameClock(0);
      const now = TICK_MS * 5;
      expect(clock.getTicksToProcess(5, now)).toBe(0);
    });

    it('should return the difference between current tick and last processed tick', () => {
      const clock = new GameClock(0);
      const now = TICK_MS * 10;
      expect(clock.getTicksToProcess(5, now)).toBe(5);
    });

    it('should return 0 when last processed tick is ahead of current time', () => {
      const clock = new GameClock(0);
      const now = TICK_MS * 3;
      expect(clock.getTicksToProcess(5, now)).toBe(0);
    });

    it('should return 1 after exactly one tick has elapsed', () => {
      const start = 1000;
      const clock = new GameClock(start);
      expect(clock.getTicksToProcess(0, start + TICK_MS)).toBe(1);
    });

    it('should handle large catch-up scenarios', () => {
      const clock = new GameClock(0);
      const now = TICK_MS * 1440; // 24 hours worth of ticks
      expect(clock.getTicksToProcess(0, now)).toBe(1440);
    });
  });

  describe('getTickTimestamp()', () => {
    it('should return start time for tick 0', () => {
      const clock = new GameClock(5000);
      expect(clock.getTickTimestamp(0)).toBe(5000);
    });

    it('should return correct timestamp for tick 1', () => {
      const clock = new GameClock(5000);
      expect(clock.getTickTimestamp(1)).toBe(5000 + TICK_MS);
    });

    it('should return correct timestamp for arbitrary ticks', () => {
      const clock = new GameClock(1000);
      expect(clock.getTickTimestamp(10)).toBe(1000 + TICK_MS * 10);
    });

    it('should be the inverse of getCurrentTick for exact tick boundaries', () => {
      const clock = new GameClock(0);
      for (let tick = 0; tick < 20; tick++) {
        const timestamp = clock.getTickTimestamp(tick);
        expect(clock.getCurrentTick(timestamp)).toBe(tick);
      }
    });
  });

  describe('getStartTime()', () => {
    it('should return the start time passed to the constructor', () => {
      const clock = new GameClock(12345);
      expect(clock.getStartTime()).toBe(12345);
    });
  });

  describe('getTickDuration()', () => {
    it('should return the default tick duration', () => {
      const clock = new GameClock(0);
      expect(clock.getTickDuration()).toBe(TICK_MS);
    });

    it('should return a custom tick duration', () => {
      const clock = new GameClock(0, 5000);
      expect(clock.getTickDuration()).toBe(5000);
    });
  });
});
