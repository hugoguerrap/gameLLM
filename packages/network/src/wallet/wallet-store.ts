import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import os from 'node:os';
import { Wallet } from './wallet.js';

/**
 * Derives a deterministic encryption key from machine-specific identifiers.
 * This prevents wallet files from being useful if copied to another machine.
 */
function deriveKey(salt: Uint8Array): Buffer {
  const machineId = `${os.hostname()}:${os.userInfo().username}:nodecoin`;
  return scryptSync(machineId, salt, 32);
}

export interface EncryptedWalletData {
  version: 2;
  salt: string; // hex
  iv: string; // hex
  tag: string; // hex (GCM auth tag)
  ciphertext: string; // hex
}

function isEncryptedWallet(data: unknown): data is EncryptedWalletData {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).version === 2 &&
    typeof (data as Record<string, unknown>).ciphertext === 'string'
  );
}

function isLegacyWallet(data: unknown): data is { privateKey: string; publicKey: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as Record<string, unknown>).privateKey === 'string' &&
    typeof (data as Record<string, unknown>).publicKey === 'string' &&
    !('version' in (data as Record<string, unknown>))
  );
}

/**
 * Securely store and load wallets with AES-256-GCM encryption.
 *
 * - Encryption key derived from machine identity (hostname + username)
 * - File permissions set to 0600 (owner-only read/write)
 * - Automatically migrates legacy plain-text wallet files
 */
export class WalletStore {
  /**
   * Save a wallet to disk with encryption.
   */
  static save(wallet: Wallet, filePath: string): void {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = deriveKey(salt);

    const plaintext = JSON.stringify(wallet.export());
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const data: EncryptedWalletData = {
      version: 2,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      ciphertext: encrypted.toString('hex'),
    };

    writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    try {
      chmodSync(filePath, 0o600);
    } catch {
      // chmod may fail on Windows — non-critical
    }
  }

  /**
   * Load a wallet from disk. Handles both encrypted (v2) and legacy plain-text formats.
   * If a legacy file is found, it is automatically re-encrypted in place.
   */
  static load(filePath: string): Wallet {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));

    if (isEncryptedWallet(raw)) {
      const salt = Buffer.from(raw.salt, 'hex');
      const iv = Buffer.from(raw.iv, 'hex');
      const tag = Buffer.from(raw.tag, 'hex');
      const ciphertext = Buffer.from(raw.ciphertext, 'hex');
      const key = deriveKey(salt);

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plaintext = decipher.update(ciphertext) + decipher.final('utf8');
      const walletData = JSON.parse(plaintext);
      return Wallet.import(walletData);
    }

    if (isLegacyWallet(raw)) {
      // Migrate: load legacy, re-save encrypted
      const wallet = Wallet.import(raw);
      WalletStore.save(wallet, filePath);
      return wallet;
    }

    throw new Error('Unrecognized wallet file format');
  }
}
