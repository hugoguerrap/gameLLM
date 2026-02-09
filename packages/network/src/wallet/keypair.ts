import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { KeyPair } from '../types/wallet.js';

// Set sha512Sync so that ed25519 sync methods work
ed.etc.sha512Sync = (...msgs) => {
  const h = sha512.create();
  for (const msg of msgs) h.update(msg);
  return h.digest();
};

export function generateKeyPair(): KeyPair {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

export function publicKeyToAddress(publicKey: Uint8Array): string {
  const hash = sha512(publicKey);
  return 'NC' + bytesToHex(hash.slice(0, 20));
}

export function serializeKeyPair(kp: KeyPair): { privateKey: string; publicKey: string } {
  return {
    privateKey: bytesToHex(kp.privateKey),
    publicKey: bytesToHex(kp.publicKey),
  };
}

export function deserializeKeyPair(data: { privateKey: string; publicKey: string }): KeyPair {
  return {
    privateKey: hexToBytes(data.privateKey),
    publicKey: hexToBytes(data.publicKey),
  };
}
