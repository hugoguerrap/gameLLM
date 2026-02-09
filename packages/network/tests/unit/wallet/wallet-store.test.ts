import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Wallet } from '../../../src/wallet/wallet.js';
import { WalletStore } from '../../../src/wallet/wallet-store.js';

describe('WalletStore', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'wallet-store-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves and loads a wallet with encryption', () => {
    const wallet = new Wallet();
    const filePath = path.join(tmpDir, 'wallet.json');

    WalletStore.save(wallet, filePath);
    const loaded = WalletStore.load(filePath);

    expect(loaded.publicKeyHex).toBe(wallet.publicKeyHex);
    expect(loaded.address).toBe(wallet.address);
  });

  it('encrypted file does not contain raw private key', () => {
    const wallet = new Wallet();
    const filePath = path.join(tmpDir, 'wallet.json');

    WalletStore.save(wallet, filePath);
    const fileContent = readFileSync(filePath, 'utf-8');
    const exported = wallet.export();

    // The raw private key should NOT appear in the file
    expect(fileContent).not.toContain(exported.privateKey);
    // But it should have the encrypted format
    const parsed = JSON.parse(fileContent);
    expect(parsed.version).toBe(2);
    expect(parsed.ciphertext).toBeDefined();
    expect(parsed.salt).toBeDefined();
    expect(parsed.iv).toBeDefined();
    expect(parsed.tag).toBeDefined();
  });

  it('migrates legacy plain-text wallet to encrypted', () => {
    const wallet = new Wallet();
    const filePath = path.join(tmpDir, 'wallet.json');

    // Save in legacy format
    writeFileSync(filePath, JSON.stringify(wallet.export()), 'utf-8');

    // Load should migrate it
    const loaded = WalletStore.load(filePath);
    expect(loaded.publicKeyHex).toBe(wallet.publicKeyHex);

    // File should now be encrypted
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(parsed.version).toBe(2);
  });

  it('signing works with loaded wallet', () => {
    const wallet = new Wallet();
    const filePath = path.join(tmpDir, 'wallet.json');

    WalletStore.save(wallet, filePath);
    const loaded = WalletStore.load(filePath);

    const message = new TextEncoder().encode('test message');
    const sig = loaded.sign(message);
    expect(loaded.verify(message, sig)).toBe(true);
  });

  it('throws on unrecognized file format', () => {
    const filePath = path.join(tmpDir, 'wallet.json');
    writeFileSync(filePath, JSON.stringify({ foo: 'bar' }), 'utf-8');

    expect(() => WalletStore.load(filePath)).toThrow('Unrecognized wallet file format');
  });
});
