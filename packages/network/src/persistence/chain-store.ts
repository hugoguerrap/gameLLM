import type Database from 'better-sqlite3';
import type { ActionBlock } from '../types/blockchain.js';

export class ChainStore {
  private saveStmt: Database.Statement;
  private loadChainStmt: Database.Statement;
  private loadRangeStmt: Database.Statement;
  private latestStmt: Database.Statement;
  private lengthStmt: Database.Statement;
  private hasBlockStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.saveStmt = db.prepare(`
      INSERT OR IGNORE INTO command_chain
        (hash, prev_hash, block_index, player_id, command_type, command_args, command_tick, state_hash, timestamp, signature, public_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.loadChainStmt = db.prepare(
      'SELECT * FROM command_chain WHERE player_id = ? ORDER BY block_index ASC',
    );

    this.loadRangeStmt = db.prepare(
      'SELECT * FROM command_chain WHERE player_id = ? AND block_index >= ? AND block_index <= ? ORDER BY block_index ASC',
    );

    this.latestStmt = db.prepare(
      'SELECT * FROM command_chain WHERE player_id = ? ORDER BY block_index DESC LIMIT 1',
    );

    this.lengthStmt = db.prepare(
      'SELECT COUNT(*) as count FROM command_chain WHERE player_id = ?',
    );

    this.hasBlockStmt = db.prepare(
      'SELECT 1 FROM command_chain WHERE hash = ? LIMIT 1',
    );
  }

  saveBlock(block: ActionBlock): void {
    this.saveStmt.run(
      block.hash,
      block.prevHash,
      block.index,
      block.playerId,
      block.command.type,
      JSON.stringify(block.command.args),
      block.command.tick,
      block.stateHash,
      block.timestamp,
      block.signature,
      block.publicKey,
    );
  }

  loadChain(playerId: string): ActionBlock[] {
    const rows = this.loadChainStmt.all(playerId) as ChainRow[];
    return rows.map(rowToBlock);
  }

  loadBlockRange(playerId: string, fromIndex: number, toIndex: number): ActionBlock[] {
    const rows = this.loadRangeStmt.all(playerId, fromIndex, toIndex) as ChainRow[];
    return rows.map(rowToBlock);
  }

  getLatestBlock(playerId: string): ActionBlock | null {
    const row = this.latestStmt.get(playerId) as ChainRow | undefined;
    return row ? rowToBlock(row) : null;
  }

  getChainLength(playerId: string): number {
    const row = this.lengthStmt.get(playerId) as { count: number };
    return row.count;
  }

  hasBlock(hash: string): boolean {
    return this.hasBlockStmt.get(hash) !== undefined;
  }
}

interface ChainRow {
  hash: string;
  prev_hash: string;
  block_index: number;
  player_id: string;
  command_type: string;
  command_args: string;
  command_tick: number;
  state_hash: string;
  timestamp: number;
  signature: string;
  public_key: string;
}

function rowToBlock(row: ChainRow): ActionBlock {
  return {
    hash: row.hash,
    prevHash: row.prev_hash,
    index: row.block_index,
    playerId: row.player_id,
    command: {
      type: row.command_type as ActionBlock['command']['type'],
      args: JSON.parse(row.command_args) as Record<string, unknown>,
      tick: row.command_tick,
    },
    stateHash: row.state_hash,
    timestamp: row.timestamp,
    signature: row.signature,
    publicKey: row.public_key,
  };
}
