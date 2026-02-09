import type { KeyPair } from '../types/wallet.js';
import { generateKeyPair, publicKeyToAddress, serializeKeyPair, deserializeKeyPair } from './keypair.js';
import { Signer } from './signer.js';
import { bytesToHex } from '@noble/hashes/utils';

export class Wallet {
  private keyPair: KeyPair;
  readonly address: string;
  readonly publicKeyHex: string;

  constructor(existingKeyPair?: KeyPair) {
    this.keyPair = existingKeyPair ?? generateKeyPair();
    this.address = publicKeyToAddress(this.keyPair.publicKey);
    this.publicKeyHex = bytesToHex(this.keyPair.publicKey);
  }

  sign(message: Uint8Array): string {
    return Signer.sign(message, this.keyPair.privateKey);
  }

  verify(message: Uint8Array, signature: string): boolean {
    return Signer.verify(message, signature, this.publicKeyHex);
  }

  export(): { privateKey: string; publicKey: string } {
    return serializeKeyPair(this.keyPair);
  }

  static import(data: { privateKey: string; publicKey: string }): Wallet {
    return new Wallet(deserializeKeyPair(data));
  }
}
