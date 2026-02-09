import { describe, it, expect } from 'vitest';
import { computeDataHash, verifySignedData, type RankingData } from '../../../src/sync/state-sync.js';
import { Wallet } from '../../../src/wallet/wallet.js';
import { Signer } from '../../../src/wallet/signer.js';

const encoder = new TextEncoder();

function signData(wallet: Wallet, data: Record<string, unknown>): Record<string, unknown> {
  const hash = computeDataHash(data);
  const signature = wallet.sign(encoder.encode(hash));
  return { ...data, signature, signedBy: wallet.publicKeyHex };
}

describe('Signed SharedWorldState', () => {
  describe('computeDataHash', () => {
    it('produces consistent hash for same data', () => {
      const data = { name: 'Test', era: 1, tokens: 100 };
      const h1 = computeDataHash(data);
      const h2 = computeDataHash(data);
      expect(h1).toBe(h2);
    });

    it('excludes signature and signedBy from hash', () => {
      const data = { name: 'Test', era: 1 };
      const withSig = { ...data, signature: 'abc', signedBy: 'def' };
      expect(computeDataHash(data)).toBe(computeDataHash(withSig));
    });

    it('produces different hash for different data', () => {
      const d1 = { name: 'A', era: 1 };
      const d2 = { name: 'B', era: 1 };
      expect(computeDataHash(d1)).not.toBe(computeDataHash(d2));
    });

    it('is order-independent (keys sorted)', () => {
      const d1 = { name: 'A', era: 1 };
      const d2 = { era: 1, name: 'A' };
      expect(computeDataHash(d1)).toBe(computeDataHash(d2));
    });
  });

  describe('verifySignedData', () => {
    it('returns true for valid signature', () => {
      const wallet = new Wallet();
      const data: RankingData = { name: 'Ironforge', era: 1, prestige: 0, tokens: 100 };
      const signed = signData(wallet, data as unknown as Record<string, unknown>);
      expect(verifySignedData(signed, Signer.verify)).toBe(true);
    });

    it('returns false for tampered data', () => {
      const wallet = new Wallet();
      const data = { name: 'Ironforge', era: 1, prestige: 0, tokens: 100 };
      const signed = signData(wallet, data);
      // Tamper
      signed.tokens = 999999;
      expect(verifySignedData(signed, Signer.verify)).toBe(false);
    });

    it('returns false for missing signature', () => {
      const data = { name: 'Ironforge', era: 1, prestige: 0, tokens: 100 };
      expect(verifySignedData(data, Signer.verify)).toBe(false);
    });

    it('returns false for wrong public key', () => {
      const wallet1 = new Wallet();
      const wallet2 = new Wallet();
      const data = { name: 'Ironforge', era: 1, prestige: 0, tokens: 100 };
      const signed = signData(wallet1, data);
      // Replace signedBy with different key
      signed.signedBy = wallet2.publicKeyHex;
      expect(verifySignedData(signed, Signer.verify)).toBe(false);
    });

    it('returns false when no verify function provided', () => {
      const wallet = new Wallet();
      const data = { name: 'Ironforge', era: 1 };
      const signed = signData(wallet, data);
      expect(verifySignedData(signed)).toBe(false);
    });
  });
});
