// Payment adapter interface + one mock provider. No real payments, ever.
export interface PaymentLimits { per_transaction: number; daily: number; spent_today: number }
export interface Receipt { id: string; amount: number; merchant: string; ts: number; provider: string; simulated: true }

export interface PaymentAdapter {
  readonly name: string;
  limits(userId: string): PaymentLimits;
  charge(userId: string, amount: number, merchant: string): Receipt;
  refund(receiptId: string): boolean;
}

export class MockPay implements PaymentAdapter {
  readonly name = "MockPay (simulated)";
  private spent = new Map<string, { day: string; total: number }>();
  private receipts = new Map<string, Receipt>();
  constructor(private cfg: { per_transaction: number; daily: number } = { per_transaction: 300, daily: 500 }) {}
  private today() { return new Date().toISOString().slice(0, 10); }
  limits(userId: string): PaymentLimits {
    const s = this.spent.get(userId);
    return { ...this.cfg, spent_today: s && s.day === this.today() ? s.total : 0 };
  }
  charge(userId: string, amount: number, merchant: string): Receipt {
    const l = this.limits(userId);
    if (amount > l.per_transaction || l.spent_today + amount > l.daily) throw new Error("MockPay: limit exceeded");
    this.spent.set(userId, { day: this.today(), total: l.spent_today + amount });
    const r: Receipt = { id: `rcpt_${Math.random().toString(36).slice(2, 10)}`, amount, merchant, ts: Date.now(), provider: this.name, simulated: true };
    this.receipts.set(r.id, r);
    return r;
  }
  refund(id: string) { return this.receipts.delete(id); }
}
