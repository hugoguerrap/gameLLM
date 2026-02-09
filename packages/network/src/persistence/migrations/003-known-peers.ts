export const MIGRATION_003 = `
  CREATE TABLE IF NOT EXISTS known_peers (
    multiaddr TEXT PRIMARY KEY,
    peer_id TEXT NOT NULL,
    player_name TEXT DEFAULT '',
    last_seen INTEGER NOT NULL,
    success_count INTEGER DEFAULT 0
  );

  INSERT OR REPLACE INTO metadata (key, value) VALUES ('schema_version', '3');
`;
