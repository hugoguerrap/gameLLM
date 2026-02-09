export enum TxType {
  Transfer = 'transfer',
  TradeExecution = 'trade_execution',
  MiningReward = 'mining_reward',
  TaxBurn = 'tax_burn',
}

export interface Tx {
  id: string;
  type: TxType;
  from: string;
  to: string;
  amount: number;
  fee: number;
  nonce: number;
  tick: number;
  timestamp: number;
  data?: string;
}

export interface SignedTx {
  tx: Tx;
  signature: string;
  publicKey: string;
}
