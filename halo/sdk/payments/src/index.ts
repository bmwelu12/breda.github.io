/**
 * @halo/payments — a tiny payment-adapter interface so Halo can enforce real spending limits
 * against whatever payment/agent-wallet provider a user has connected. One mock provider ships
 * here; real providers (agent-payment platforms, bank rails) implement the same interface.
 *
 * Halo never moves money itself — it asks the adapter for the current limit and records intent.
 */

export interface PaymentContext {
  userId: string;
  agentId: string;
  amount: number;
  currency: string;
  payee?: string;
  category?: string;
}

export interface PaymentDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  reason: string;
}

export interface PaymentAdapter {
  readonly name: string;
  /** The hard per-transaction limit this provider enforces for the user/agent. */
  limitFor(ctx: Omit<PaymentContext, 'amount'>): Promise<number> | number;
  /** Would this payment be allowed by the provider right now? (no money actually moves) */
  authorize(ctx: PaymentContext): Promise<PaymentDecision> | PaymentDecision;
}

export interface MockProviderConfig {
  perTxnLimit?: number;
  dailyLimit?: number;
  blockedPayees?: string[];
}

/** A deterministic mock provider for the demo. */
export class MockPaymentProvider implements PaymentAdapter {
  readonly name = 'MockPay';
  private spentToday = new Map<string, number>();
  private cfg: Required<MockProviderConfig>;

  constructor(cfg: MockProviderConfig = {}) {
    this.cfg = { perTxnLimit: cfg.perTxnLimit ?? 100, dailyLimit: cfg.dailyLimit ?? 500, blockedPayees: cfg.blockedPayees ?? [] };
  }

  limitFor() {
    return this.cfg.perTxnLimit;
  }

  authorize(ctx: PaymentContext): PaymentDecision {
    const spent = this.spentToday.get(ctx.userId) ?? 0;
    const remaining = this.cfg.dailyLimit - spent;
    if (ctx.payee && this.cfg.blockedPayees.includes(ctx.payee.toLowerCase())) {
      return { allowed: false, limit: this.cfg.perTxnLimit, remaining, reason: `Payee "${ctx.payee}" is blocked.` };
    }
    if (ctx.amount > this.cfg.perTxnLimit) {
      return { allowed: false, limit: this.cfg.perTxnLimit, remaining, reason: `Over the $${this.cfg.perTxnLimit} per-transaction limit.` };
    }
    if (ctx.amount > remaining) {
      return { allowed: false, limit: this.cfg.perTxnLimit, remaining, reason: `Over today's remaining budget ($${remaining}).` };
    }
    return { allowed: true, limit: this.cfg.perTxnLimit, remaining, reason: 'Within limits.' };
  }

  /** Demo helper: record a settled payment so daily limits move. */
  record(userId: string, amount: number) {
    this.spentToday.set(userId, (this.spentToday.get(userId) ?? 0) + amount);
  }
}
