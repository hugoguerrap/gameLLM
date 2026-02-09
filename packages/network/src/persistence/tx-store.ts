import type Database from 'better-sqlite3';
import type { SignedTx } from '../types/transaction.js';

export class TxStore {
  private db: Database.Database;
  private insertStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.insertStmt = db.prepare(
      `INSERT OR IGNORE INTO transactions (id, type, from_address, to_address, amount, fee, nonce, tick, timestamp, signature, public_key, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
  }

  save(stx: SignedTx): void {
    const { tx } = stx;
    this.insertStmt.run(tx.id, tx.type, tx.from, tx.to, tx.amount, tx.fee, tx.nonce, tx.tick, tx.timestamp, stx.signature, stx.publicKey, tx.data ?? null);
  }

  getByAddress(address: string, limit: number = 50): SignedTx[] {
    const rows = this.db.prepare(
      'SELECT * FROM transactions WHERE from_address = ? OR to_address = ? ORDER BY tick DESC LIMIT ?'
    ).all(address, address, limit) as any[];
    return rows.map(rowToSignedTx);
  }
}

function rowToSignedTx(row: any): SignedTx {
  return {
    tx: {
      id: row.id,
      type: row.type,
      from: row.from_address,
      to: row.to_address,
      amount: row.amount,
      fee: row.fee,
      nonce: row.nonce,
      tick: row.tick,
      timestamp: row.timestamp,
      data: row.data,
    },
    signature: row.signature,
    publicKey: row.public_key,
  };
}
