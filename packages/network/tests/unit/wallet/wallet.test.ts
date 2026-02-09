import { describe, it, expect } from 'vitest';
import { Wallet } from '../../../src/wallet/wallet.js';

describe('Wallet', () => {
  it('generates address on creation', () => {
    const wallet = new Wallet();
    expect(wallet.address).toMatch(/^NC[0-9a-f]{40}$/);
    expect(wallet.address.length).toBe(42);
    expect(typeof wallet.publicKeyHex).toBe('string');
    expect(wallet.publicKeyHex.length).toBe(64); // 32 bytes hex
  });

  it('signs and verifies correctly', () => {
    const wallet = new Wallet();
    const message = new TextEncoder().encode('test message');
    const signature = wallet.sign(message);

    expect(typeof signature).toBe('string');
    expect(wallet.verify(message, signature)).toBe(true);
  });

  it('verify rejects tampered messages', () => {
    const wallet = new Wallet();
    const message = new TextEncoder().encode('test message');
    const signature = wallet.sign(message);

    const tampered = new TextEncoder().encode('tampered message');
    expect(wallet.verify(tampered, signature)).toBe(false);
  });

  it('export/import roundtrip works', () => {
    const wallet = new Wallet();
    const exported = wallet.export();

    expect(typeof exported.privateKey).toBe('string');
    expect(typeof exported.publicKey).toBe('string');

    const imported = Wallet.import(exported);
    expect(imported.address).toBe(wallet.address);
    expect(imported.publicKeyHex).toBe(wallet.publicKeyHex);

    // Verify signing works with imported wallet
    const message = new TextEncoder().encode('roundtrip test');
    const signature = imported.sign(message);
    expect(wallet.verify(message, signature)).toBe(true);
  });

  it('two wallets have different addresses', () => {
    const w1 = new Wallet();
    const w2 = new Wallet();
    expect(w1.address).not.toBe(w2.address);
  });
});
