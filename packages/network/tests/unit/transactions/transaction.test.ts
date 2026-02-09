import { describe, it, expect } from 'vitest';
import { createTransaction, computeTxId, serializeTx } from '../../../src/transactions/transaction.js';
import { TxType } from '../../../src/types/transaction.js';

describe('transaction', () => {
  const baseParams = {
    type: TxType.Transfer,
    from: 'NC' + 'a'.repeat(40),
    to: 'NC' + 'b'.repeat(40),
    amount: 10,
    fee: 0.01,
    nonce: 0,
    tick: 1,
  };

  it('createTransaction generates unique ID', () => {
    const tx = createTransaction(baseParams);

    expect(tx.id).toBeTruthy();
    expect(typeof tx.id).toBe('string');
    expect(tx.id.length).toBe(64); // SHA-256 hex = 64 chars
    expect(tx.type).toBe(TxType.Transfer);
    expect(tx.from).toBe(baseParams.from);
    expect(tx.to).toBe(baseParams.to);
    expect(tx.amount).toBe(10);
    expect(tx.fee).toBe(0.01);
    expect(tx.timestamp).toBeGreaterThan(0);
  });

  it('computeTxId is deterministic', () => {
    const tx = {
      type: TxType.Transfer,
      from: 'NC' + 'a'.repeat(40),
      to: 'NC' + 'b'.repeat(40),
      amount: 10,
      fee: 0.01,
      nonce: 0,
      tick: 1,
      timestamp: 1000000,
      data: undefined,
    };

    const id1 = computeTxId(tx);
    const id2 = computeTxId(tx);
    expect(id1).toBe(id2);
  });

  it('computeTxId changes when fields change', () => {
    const tx1 = {
      type: TxType.Transfer,
      from: 'NC' + 'a'.repeat(40),
      to: 'NC' + 'b'.repeat(40),
      amount: 10,
      fee: 0.01,
      nonce: 0,
      tick: 1,
      timestamp: 1000000,
    };

    const tx2 = { ...tx1, amount: 20 };
    expect(computeTxId(tx1)).not.toBe(computeTxId(tx2));
  });

  it('serializeTx produces valid bytes', () => {
    const tx = createTransaction(baseParams);
    const bytes = serializeTx(tx);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    // Should be valid JSON when decoded
    const decoded = JSON.parse(new TextDecoder().decode(bytes));
    expect(decoded.id).toBe(tx.id);
    expect(decoded.type).toBe(tx.type);
    expect(decoded.amount).toBe(tx.amount);
  });
});
