import { describe, it, expect } from 'vitest';
import { Ledger } from '../../../src/transactions/ledger.js';

describe('Ledger', () => {
  it('initial balance is 0', () => {
    const ledger = new Ledger();
    expect(ledger.getBalance('unknown_address')).toBe(0);
  });

  it('initial nonce is 0', () => {
    const ledger = new Ledger();
    expect(ledger.getNonce('unknown_address')).toBe(0);
  });

  it('credit increases balance', () => {
    const ledger = new Ledger();
    ledger.credit('alice', 50);
    expect(ledger.getBalance('alice')).toBe(50);

    ledger.credit('alice', 30);
    expect(ledger.getBalance('alice')).toBe(80);
  });

  it('debit decreases balance', () => {
    const ledger = new Ledger();
    ledger.credit('alice', 100);
    ledger.debit('alice', 30);
    expect(ledger.getBalance('alice')).toBe(70);
  });

  it('debit fails if insufficient balance', () => {
    const ledger = new Ledger();
    ledger.credit('alice', 10);
    expect(() => ledger.debit('alice', 20)).toThrow('Insufficient balance');
  });

  it('debit fails on zero balance', () => {
    const ledger = new Ledger();
    expect(() => ledger.debit('alice', 1)).toThrow('Insufficient balance');
  });

  it('applyTransfer moves funds and increments nonce', () => {
    const ledger = new Ledger();
    ledger.credit('alice', 100);

    ledger.applyTransfer('alice', 'bob', 30, 1);

    expect(ledger.getBalance('alice')).toBe(69); // 100 - 30 - 1
    expect(ledger.getBalance('bob')).toBe(30);
    expect(ledger.getNonce('alice')).toBe(1);
  });

  it('fee is burned (not credited to anyone)', () => {
    const ledger = new Ledger();
    ledger.credit('alice', 100);

    ledger.applyTransfer('alice', 'bob', 30, 5);

    // Total deducted: 30 + 5 = 35
    // Alice has 65, Bob has 30. 5 is burned.
    expect(ledger.getBalance('alice')).toBe(65);
    expect(ledger.getBalance('bob')).toBe(30);

    // Sum of all balances should be 95 (100 - 5 burned)
    const allBalances = ledger.getAllBalances();
    let total = 0;
    for (const balance of allBalances.values()) {
      total += balance;
    }
    expect(total).toBe(95);
  });

  it('mint creates tokens from nothing', () => {
    const ledger = new Ledger();
    ledger.mint('miner', 10);
    expect(ledger.getBalance('miner')).toBe(10);

    ledger.mint('miner', 5);
    expect(ledger.getBalance('miner')).toBe(15);
  });

  it('incrementNonce increments nonce by 1', () => {
    const ledger = new Ledger();
    expect(ledger.getNonce('alice')).toBe(0);
    ledger.incrementNonce('alice');
    expect(ledger.getNonce('alice')).toBe(1);
    ledger.incrementNonce('alice');
    expect(ledger.getNonce('alice')).toBe(2);
  });

  it('getAllBalances returns a copy of balances', () => {
    const ledger = new Ledger();
    ledger.credit('alice', 50);
    ledger.credit('bob', 30);

    const balances = ledger.getAllBalances();
    expect(balances.get('alice')).toBe(50);
    expect(balances.get('bob')).toBe(30);

    // Modifying the returned map should not affect the ledger
    balances.set('alice', 999);
    expect(ledger.getBalance('alice')).toBe(50);
  });
});
