import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// Ensure sha512Sync is set for ed25519 sync operations
if (!ed.etc.sha512Sync) {
  ed.etc.sha512Sync = (...msgs) => {
    const h = sha512.create();
    for (const msg of msgs) h.update(msg);
    return h.digest();
  };
}

export class Signer {
  static sign(message: Uint8Array, privateKey: Uint8Array): string {
    const signature = ed.sign(message, privateKey);
    return bytesToHex(signature);
  }

  static verify(message: Uint8Array, signature: string, publicKey: string): boolean {
    try {
      return ed.verify(hexToBytes(signature), message, hexToBytes(publicKey));
    } catch {
      return false;
    }
  }
}
