export class Ledger {
  private balances: Map<string, number> = new Map();
  private nonces: Map<string, number> = new Map();

  getBalance(address: string): number {
    return this.balances.get(address) ?? 0;
  }

  getNonce(address: string): number {
    return this.nonces.get(address) ?? 0;
  }

  credit(address: string, amount: number): void {
    this.balances.set(address, this.getBalance(address) + amount);
  }

  debit(address: string, amount: number): void {
    const balance = this.getBalance(address);
    if (balance < amount) throw new Error(`Insufficient balance: ${balance} < ${amount}`);
    this.balances.set(address, balance - amount);
  }

  incrementNonce(address: string): void {
    this.nonces.set(address, this.getNonce(address) + 1);
  }

  applyTransfer(from: string, to: string, amount: number, fee: number): void {
    this.debit(from, amount + fee);
    this.credit(to, amount);
    // fee is burned (not credited to anyone)
    this.incrementNonce(from);
  }

  /** For mining rewards - creates tokens from nothing */
  mint(address: string, amount: number): void {
    this.credit(address, amount);
  }

  getAllBalances(): Map<string, number> {
    return new Map(this.balances);
  }
}
