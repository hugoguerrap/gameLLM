import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import type { Tx, TxType } from '../types/transaction.js';

export function createTransaction(params: {
  type: TxType;
  from: string;
  to: string;
  amount: number;
  fee: number;
  nonce: number;
  tick: number;
  data?: string;
}): Tx {
  const tx: Tx = {
    ...params,
    id: '',
    timestamp: Date.now(),
  };
  tx.id = computeTxId(tx);
  return tx;
}

export function computeTxId(tx: Omit<Tx, 'id'>): string {
  const payload = JSON.stringify({
    type: tx.type,
    from: tx.from,
    to: tx.to,
    amount: tx.amount,
    fee: tx.fee,
    nonce: tx.nonce,
    tick: tx.tick,
    timestamp: tx.timestamp,
    data: tx.data,
  });
  const hash = sha256(new TextEncoder().encode(payload));
  return bytesToHex(hash);
}

export function serializeTx(tx: Tx): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(tx));
}
