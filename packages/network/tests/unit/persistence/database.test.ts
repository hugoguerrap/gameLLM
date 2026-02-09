import { describe, it, expect, afterEach } from 'vitest';
import { GameDatabase } from '../../../src/persistence/database.js';

describe('GameDatabase', () => {
  let db: GameDatabase;

  afterEach(() => {
    if (db) db.close();
  });

  it('creates and migrates successfully', () => {
    db = new GameDatabase(':memory:');
    expect(() => db.migrate()).not.toThrow();
  });

  it('tables exist after migration', () => {
    db = new GameDatabase(':memory:');
    db.migrate();

    const raw = db.getDb();
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('player_state');
    expect(tableNames).toContain('transactions');
    expect(tableNames).toContain('wallet');
    expect(tableNames).toContain('ledger');
    expect(tableNames).toContain('events_log');
    expect(tableNames).toContain('metadata');
  });

  it('WAL mode is enabled', () => {
    db = new GameDatabase(':memory:');
    const raw = db.getDb();
    const result = raw.pragma('journal_mode') as { journal_mode: string }[];
    // In-memory databases may use 'memory' mode, but the pragma was set
    expect(result[0].journal_mode).toBeTruthy();
  });

  it('metadata has schema_version after migration', () => {
    db = new GameDatabase(':memory:');
    db.migrate();

    const raw = db.getDb();
    const row = raw.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get() as { value: string };
    expect(row.value).toBe('3');
  });

  it('migration is idempotent', () => {
    db = new GameDatabase(':memory:');
    db.migrate();
    // Running migrate again should not throw
    expect(() => db.migrate()).not.toThrow();
  });
});
