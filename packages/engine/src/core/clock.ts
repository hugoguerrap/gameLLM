import { TICK_DURATION_MS } from '../config/constants.js';

export class GameClock {
  private startTime: number;
  private tickDuration: number;

  constructor(startTime: number, tickDuration: number = TICK_DURATION_MS) {
    this.startTime = startTime;
    this.tickDuration = tickDuration;
  }

  /** Calculate current tick based on wall-clock time */
  getCurrentTick(now: number = Date.now()): number {
    const elapsed = Math.max(0, now - this.startTime);
    return Math.floor(elapsed / this.tickDuration);
  }

  /** Get the number of ticks between last processed and now */
  getTicksToProcess(lastProcessedTick: number, now: number = Date.now()): number {
    const currentTick = this.getCurrentTick(now);
    return Math.max(0, currentTick - lastProcessedTick);
  }

  /** Get the timestamp when a specific tick occurs/occurred */
  getTickTimestamp(tick: number): number {
    return this.startTime + tick * this.tickDuration;
  }

  getStartTime(): number {
    return this.startTime;
  }

  getTickDuration(): number {
    return this.tickDuration;
  }
}
