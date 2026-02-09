import PrandoDefault from 'prando';

// Node16 CJS interop: prando uses UMD module.exports = Prando
const Prando = PrandoDefault as unknown as new (seed?: string | number) => PrandoInstance;

interface PrandoInstance {
  next(min?: number, pseudoMax?: number): number;
  nextInt(min?: number, max?: number): number;
  skip(iterations?: number): void;
  reset(): void;
}

export class DeterministicRng {
  private rng: PrandoInstance;

  constructor(seed: string | number) {
    this.rng = new Prando(seed);
  }

  /** Returns float in [min, max) */
  next(min: number = 0, max: number = 1): number {
    return this.rng.next(min, max);
  }

  /** Returns integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return this.rng.nextInt(min, max);
  }

  /** Returns true with given probability (0-1) */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick random element from array */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  /** Reset to initial state */
  reset(): void {
    this.rng.reset();
  }

  /** Skip n iterations */
  skip(n: number): void {
    this.rng.skip(n);
  }
}
