export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface WalletState {
  address: string;
  publicKey: string; // hex
  balance: number;
  nonce: number;
}
