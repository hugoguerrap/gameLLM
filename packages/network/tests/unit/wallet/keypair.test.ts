import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  publicKeyToAddress,
  serializeKeyPair,
  deserializeKeyPair,
} from '../../../src/wallet/keypair.js';

describe('keypair', () => {
  it('generateKeyPair produces 32-byte private key and 32-byte public key', () => {
    const kp = generateKeyPair();
    expect(kp.privateKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.privateKey.length).toBe(32);
    expect(kp.publicKey.length).toBe(32);
  });

  it('publicKeyToAddress starts with "NC" and is 42 chars long', () => {
    const kp = generateKeyPair();
    const address = publicKeyToAddress(kp.publicKey);
    expect(address).toMatch(/^NC[0-9a-f]{40}$/);
    expect(address.length).toBe(42);
  });

  it('address is deterministic (same pubkey = same address)', () => {
    const kp = generateKeyPair();
    const addr1 = publicKeyToAddress(kp.publicKey);
    const addr2 = publicKeyToAddress(kp.publicKey);
    expect(addr1).toBe(addr2);
  });

  it('serializeKeyPair and deserializeKeyPair roundtrip works', () => {
    const kp = generateKeyPair();
    const serialized = serializeKeyPair(kp);

    expect(typeof serialized.privateKey).toBe('string');
    expect(typeof serialized.publicKey).toBe('string');
    expect(serialized.privateKey.length).toBe(64); // 32 bytes = 64 hex chars
    expect(serialized.publicKey.length).toBe(64);

    const deserialized = deserializeKeyPair(serialized);
    expect(deserialized.privateKey).toEqual(kp.privateKey);
    expect(deserialized.publicKey).toEqual(kp.publicKey);
  });

  it('different keypairs produce different addresses', () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const addr1 = publicKeyToAddress(kp1.publicKey);
    const addr2 = publicKeyToAddress(kp2.publicKey);
    expect(addr1).not.toBe(addr2);
  });
});
