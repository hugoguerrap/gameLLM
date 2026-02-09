export const MIGRATION_002 = `
CREATE TABLE IF NOT EXISTS command_chain (
  hash TEXT PRIMARY KEY,
  prev_hash TEXT NOT NULL,
  block_index INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  command_args TEXT NOT NULL,
  command_tick INTEGER NOT NULL,
  state_hash TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  signature TEXT NOT NULL,
  public_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chain_player_index ON command_chain(player_id, block_index);
CREATE INDEX IF NOT EXISTS idx_chain_player ON command_chain(player_id);

INSERT OR IGNORE INTO metadata (key, value) VALUES ('schema_version', '2');
UPDATE metadata SET value = '2' WHERE key = 'schema_version';
`;
