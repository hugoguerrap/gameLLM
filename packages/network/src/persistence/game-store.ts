import type Database from 'better-sqlite3';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

export class GameStore {
  private db: Database.Database;
  private saveStmt: Database.Statement;
  private loadLatestStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.saveStmt = db.prepare(
      'INSERT OR REPLACE INTO player_state (id, player_id, tick, state_json, state_hash) VALUES (?, ?, ?, ?, ?)'
    );
    this.loadLatestStmt = db.prepare(
      'SELECT state_json FROM player_state WHERE player_id = ? ORDER BY tick DESC LIMIT 1'
    );
  }

  save(playerId: string, tick: number, state: unknown): void {
    const json = JSON.stringify(state);
    const hash = bytesToHex(sha256(new TextEncoder().encode(json)));
    const id = `${playerId}:${tick}`;
    this.saveStmt.run(id, playerId, tick, json, hash);
  }

  loadLatest(playerId: string): unknown | null {
    const row = this.loadLatestStmt.get(playerId) as { state_json: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.state_json);
  }
}
