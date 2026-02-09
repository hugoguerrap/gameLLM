import { describe, it, expect, beforeEach } from 'vitest';
import { TxValidator } from '../../../src/transactions/tx-validator.js';
import { Ledger } from '../../../src/transactions/ledger.js';
import { createTransaction, serializeTx } from '../../../src/transactions/transaction.js';
import { Wallet } from '../../../src/wallet/wallet.js';
import { TxType } from '../../../src/types/transaction.js';
import type { SignedTx } from '../../../src/types/transaction.js';

describe('TxValidator', () => {
  let ledger: Ledger;
  let senderWallet: Wallet;
  let receiverWallet: Wallet;

  beforeEach(() => {
    ledger = new Ledger();
    senderWallet = new Wallet();
    receiverWallet = new Wallet();
    // Give the sender some balance
    ledger.credit(senderWallet.address, 100);
  });

  function createSignedTx(overrides?: Partial<{ amount: number; fee: number; nonce: number }>): SignedTx {
    const tx = createTransaction({
      type: TxType.Transfer,
      from: senderWallet.address,
      to: receiverWallet.address,
      amount: overrides?.amount ?? 10,
      fee: overrides?.fee ?? 0.01,
      nonce: overrides?.nonce ?? 0,
      tick: 1,
    });

    const txBytes = serializeTx(tx);
    const signature = senderWallet.sign(txBytes);

    return {
      tx,
      signature,
      publicKey: senderWallet.publicKeyHex,
    };
  }

  it('valid tx passes validation', () => {
    const stx = createSignedTx();
    const result = TxValidator.validate(stx, ledger);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('invalid signature fails', () => {
    const stx = createSignedTx();
    // Tamper with signature
    stx.signature = 'a'.repeat(128);
    const result = TxValidator.validate(stx, ledger);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('wrong public key fails signature check', () => {
    const stx = createSignedTx();
    // Use a different wallet's public key
    stx.publicKey = receiverWallet.publicKeyHex;
    const result = TxValidator.validate(stx, ledger);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('insufficient balance fails', () => {
    const stx = createSignedTx({ amount: 200 });
    const result = TxValidator.validate(stx, ledger);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Insufficient balance');
  });

  it('wrong nonce fails', () => {
    const stx = createSignedTx({ nonce: 5 });
    const result = TxValidator.validate(stx, ledger);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid nonce');
  });

  it('negative amount fails', () => {
    const stx = createSignedTx({ amount: -5 });
    const result = TxValidator.validate(stx, ledger);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Amount must be positive');
  });

  it('zero amount fails', () => {
    const stx = createSignedTx({ amount: 0 });
    const result = TxValidator.validate(stx, ledger);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Amount must be positive');
  });
});
