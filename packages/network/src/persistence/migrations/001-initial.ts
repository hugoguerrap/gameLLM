export const MIGRATION_001 = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS player_state (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    tick INTEGER NOT NULL,
    state_json TEXT NOT NULL,
    state_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(player_id, tick)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount REAL NOT NULL,
    fee REAL NOT NULL,
    nonce INTEGER NOT NULL,
    tick INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    signature TEXT NOT NULL,
    public_key TEXT NOT NULL,
    data TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions(from_address);
  CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions(to_address);
  CREATE INDEX IF NOT EXISTS idx_tx_tick ON transactions(tick);

  CREATE TABLE IF NOT EXISTS wallet (
    address TEXT PRIMARY KEY,
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS ledger (
    address TEXT PRIMARY KEY,
    balance REAL NOT NULL DEFAULT 0,
    nonce INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS events_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tick INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_events_tick ON events_log(tick);

  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  INSERT OR IGNORE INTO metadata (key, value) VALUES ('schema_version', '1');
`;
