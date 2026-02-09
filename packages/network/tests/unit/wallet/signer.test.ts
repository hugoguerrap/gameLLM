import { describe, it, expect } from 'vitest';
import { Signer } from '../../../src/wallet/signer.js';
import { generateKeyPair } from '../../../src/wallet/keypair.js';
import { bytesToHex } from '@noble/hashes/utils';

describe('Signer', () => {
  it('sign + verify roundtrip succeeds', () => {
    const kp = generateKeyPair();
    const message = new TextEncoder().encode('hello world');
    const signature = Signer.sign(message, kp.privateKey);
    const publicKeyHex = bytesToHex(kp.publicKey);

    expect(typeof signature).toBe('string');
    expect(signature.length).toBe(128); // 64 bytes = 128 hex chars

    const valid = Signer.verify(message, signature, publicKeyHex);
    expect(valid).toBe(true);
  });

  it('verify fails with wrong key', () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const message = new TextEncoder().encode('hello world');
    const signature = Signer.sign(message, kp1.privateKey);
    const wrongPublicKeyHex = bytesToHex(kp2.publicKey);

    const valid = Signer.verify(message, signature, wrongPublicKeyHex);
    expect(valid).toBe(false);
  });

  it('verify fails with tampered message', () => {
    const kp = generateKeyPair();
    const message = new TextEncoder().encode('hello world');
    const signature = Signer.sign(message, kp.privateKey);
    const publicKeyHex = bytesToHex(kp.publicKey);

    const tamperedMessage = new TextEncoder().encode('hello world!');
    const valid = Signer.verify(tamperedMessage, signature, publicKeyHex);
    expect(valid).toBe(false);
  });

  it('verify returns false for invalid signature format', () => {
    const kp = generateKeyPair();
    const message = new TextEncoder().encode('hello world');
    const publicKeyHex = bytesToHex(kp.publicKey);

    const valid = Signer.verify(message, 'not-a-valid-hex-signature', publicKeyHex);
    expect(valid).toBe(false);
  });
});
