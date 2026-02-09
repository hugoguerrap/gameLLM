import { sha512 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

/**
 * Derive a NODECOIN address from a public key.
 * Format: "NC" + first 20 bytes of SHA-512 hash, hex encoded (40 hex chars).
 * Total address length: 42 characters.
 */
export function publicKeyToAddress(publicKey: Uint8Array): string {
  const hash = sha512(publicKey);
  return 'NC' + bytesToHex(hash.slice(0, 20));
}

/**
 * Validate that a string is a well-formed NODECOIN address.
 * Must start with "NC" and be followed by exactly 40 hex characters.
 */
export function isValidAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  if (address.length !== 42) return false;
  if (!address.startsWith('NC')) return false;
  const hexPart = address.slice(2);
  return /^[0-9a-f]{40}$/.test(hexPart);
}

/**
 * Verify that an address was derived from the given public key (hex encoded).
 */
export function verifyAddress(address: string, publicKeyHex: string): boolean {
  try {
    const publicKey = hexToBytes(publicKeyHex);
    const derived = publicKeyToAddress(publicKey);
    return derived === address;
  } catch {
    return false;
  }
}
