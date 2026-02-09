import { Signer } from '../wallet/signer.js';
import { serializeTx } from './transaction.js';
import type { SignedTx } from '../types/transaction.js';
import type { Ledger } from './ledger.js';

export class TxValidator {
  static validate(stx: SignedTx, ledger: Ledger): { valid: boolean; error?: string } {
    // 1. Verify signature
    const txBytes = serializeTx(stx.tx);
    if (!Signer.verify(txBytes, stx.signature, stx.publicKey)) {
      return { valid: false, error: 'Invalid signature' };
    }

    // 2. Check balance
    const balance = ledger.getBalance(stx.tx.from);
    if (balance < stx.tx.amount + stx.tx.fee) {
      return { valid: false, error: 'Insufficient balance' };
    }

    // 3. Check nonce
    const expectedNonce = ledger.getNonce(stx.tx.from);
    if (stx.tx.nonce !== expectedNonce) {
      return { valid: false, error: `Invalid nonce: expected ${expectedNonce}, got ${stx.tx.nonce}` };
    }

    // 4. Check amount is positive
    if (stx.tx.amount <= 0) {
      return { valid: false, error: 'Amount must be positive' };
    }

    return { valid: true };
  }
}
