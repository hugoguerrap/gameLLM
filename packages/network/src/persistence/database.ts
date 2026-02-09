import Database from 'better-sqlite3';
import { MIGRATION_001, MIGRATION_002, MIGRATION_003 } from './migrations/index.js';

export class GameDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  migrate(): void {
    this.db.exec(MIGRATION_001);
    const version = this.getSchemaVersion();
    if (version < 2) {
      this.db.exec(MIGRATION_002);
    }
    if (this.getSchemaVersion() < 3) {
      this.db.exec(MIGRATION_003);
    }
  }

  private getSchemaVersion(): number {
    try {
      const row = this.db
        .prepare("SELECT value FROM metadata WHERE key = 'schema_version'")
        .get() as { value: string } | undefined;
      return row ? parseInt(row.value, 10) : 0;
    } catch {
      return 0;
    }
  }

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}
