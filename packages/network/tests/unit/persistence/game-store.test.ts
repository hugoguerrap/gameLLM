import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameDatabase } from '../../../src/persistence/database.js';
import { GameStore } from '../../../src/persistence/game-store.js';

describe('GameStore', () => {
  let gameDb: GameDatabase;
  let store: GameStore;

  beforeEach(() => {
    gameDb = new GameDatabase(':memory:');
    gameDb.migrate();
    store = new GameStore(gameDb.getDb());
  });

  afterEach(() => {
    gameDb.close();
  });

  it('save and loadLatest roundtrip works', () => {
    const state = { hp: 100, x: 10, y: 20, inventory: ['sword'] };
    store.save('player1', 1, state);

    const loaded = store.loadLatest('player1');
    expect(loaded).toEqual(state);
  });

  it('loadLatest returns null for unknown player', () => {
    const loaded = store.loadLatest('nonexistent');
    expect(loaded).toBeNull();
  });

  it('multiple saves return latest', () => {
    store.save('player1', 1, { hp: 100 });
    store.save('player1', 2, { hp: 90 });
    store.save('player1', 3, { hp: 75 });

    const loaded = store.loadLatest('player1');
    expect(loaded).toEqual({ hp: 75 });
  });

  it('saves for different players are independent', () => {
    store.save('player1', 1, { hp: 100 });
    store.save('player2', 1, { hp: 50 });

    expect(store.loadLatest('player1')).toEqual({ hp: 100 });
    expect(store.loadLatest('player2')).toEqual({ hp: 50 });
  });

  it('overwriting same tick replaces state', () => {
    store.save('player1', 1, { hp: 100 });
    store.save('player1', 1, { hp: 80 });

    const loaded = store.loadLatest('player1');
    expect(loaded).toEqual({ hp: 80 });
  });
});
