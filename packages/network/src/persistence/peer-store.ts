import type Database from 'better-sqlite3';

export interface KnownPeer {
  multiaddr: string;
  peerId: string;
  playerName: string;
  lastSeen: number;
  successCount: number;
}

/**
 * Persists known peer addresses to SQLite for fast reconnection.
 * Like Bitcoin's peers.dat — remembers peers from previous sessions.
 */
export class PeerStore {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /** Save or update a known peer address. */
  upsert(multiaddr: string, peerId: string, playerName = ''): void {
    this.db
      .prepare(
        `INSERT INTO known_peers (multiaddr, peer_id, player_name, last_seen, success_count)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(multiaddr) DO UPDATE SET
           peer_id = excluded.peer_id,
           player_name = CASE WHEN excluded.player_name != '' THEN excluded.player_name ELSE known_peers.player_name END,
           last_seen = excluded.last_seen,
           success_count = known_peers.success_count + 1`,
      )
      .run(multiaddr, peerId, playerName, Date.now());
  }

  /** Get known peers, ordered by most recently seen and most reliable. */
  getAll(limit = 50): KnownPeer[] {
    return this.db
      .prepare(
        `SELECT multiaddr, peer_id as peerId, player_name as playerName, last_seen as lastSeen, success_count as successCount
         FROM known_peers
         ORDER BY last_seen DESC, success_count DESC
         LIMIT ?`,
      )
      .all(limit) as KnownPeer[];
  }

  /** Get multiaddrs for bootstrapping (most reliable first). */
  getBootstrapAddrs(limit = 20): string[] {
    const peers = this.getAll(limit);
    return peers.map((p) => p.multiaddr);
  }

  /** Remove stale peers older than given age in ms. */
  pruneOlderThan(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    const result = this.db
      .prepare('DELETE FROM known_peers WHERE last_seen < ?')
      .run(cutoff);
    return result.changes;
  }

  /** Total count of known peers. */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM known_peers').get() as { cnt: number };
    return row.cnt;
  }
}
