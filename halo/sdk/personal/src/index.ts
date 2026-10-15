/**
 * @halo/personal — wrap every action a person's own AI agent takes so it goes through Halo's
 * Steward and hard guardrails before it runs.
 *
 *   const halo = new HaloGuard({ baseUrl, agentId, credential, userRequest });
 *   const buy = halo.guard({
 *     name: 'buy',
 *     describe: (i) => ({ amount: i.price, params: i }),
 *     execute: (i) => store.buy(i),
 *   });
 *   await buy({ sku: 'x', price: 240 }); // → Steward: ask/block, or runs if allowed
 */

export type Verdict = 'allow' | 'ask' | 'block';

export interface ActionDescriptor {
  amount?: number;
  params?: Record<string, unknown>;
  /** Where the instruction came from (agent reasoning / fetched content) — helps detect injection. */
  sourceText?: string;
}

export interface AuthorizeResponse {
  actionId: string | null;
  verdict: Verdict;
  status: 'allowed' | 'blocked' | 'pending' | 'approved' | 'rejected';
  reason: string;
  overrodeModel: boolean;
  guardrails: Array<{ rule: string; severity: string; reason: string }>;
}

export class HaloBlockedError extends Error {
  constructor(readonly tool: string, readonly result: AuthorizeResponse) {
    super(`Halo ${result.status} ${tool}: ${result.reason}`);
    this.name = 'HaloBlockedError';
  }
}

export interface HaloGuardOptions {
  baseUrl: string;
  agentId: string;
  credential: string;
  /** The user's actual request, so Steward can judge off-intent actions. */
  userRequest: string;
  approvalTimeoutMs?: number;
  pollIntervalMs?: number;
  onEvent?: (e: { type: 'authorizing' | 'decision' | 'resolved'; tool: string; result?: AuthorizeResponse }) => void;
  fetch?: typeof fetch;
}

export interface GuardSpec<I, O> {
  name: string;
  describe?: (input: I) => ActionDescriptor;
  execute: (input: I) => Promise<O> | O;
}

export class HaloGuard {
  private f: typeof fetch;
  constructor(private opts: HaloGuardOptions) {
    this.f = opts.fetch ?? fetch;
  }

  async authorize(tool: string, d: ActionDescriptor = {}): Promise<AuthorizeResponse> {
    const res = await this.f(`${this.opts.baseUrl}/v1/personal-actions/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.opts.credential}` },
      body: JSON.stringify({ agentId: this.opts.agentId, tool, userRequest: this.opts.userRequest, ...d }),
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new Error(json?.message ?? `Halo authorize failed (${res.status})`);
    return json as AuthorizeResponse;
  }

  private async poll(actionId: string): Promise<AuthorizeResponse> {
    const deadline = Date.now() + (this.opts.approvalTimeoutMs ?? 120_000);
    while (Date.now() < deadline) {
      const res = await this.f(`${this.opts.baseUrl}/v1/personal-actions/${actionId}`);
      if (res.ok) {
        const a = (await res.json()) as any;
        if (a.status !== 'pending') return a as AuthorizeResponse;
      }
      await new Promise((r) => setTimeout(r, this.opts.pollIntervalMs ?? 700));
    }
    return { actionId, verdict: 'block', status: 'rejected', reason: 'No approval before timeout', overrodeModel: false, guardrails: [] };
  }

  guard<I, O>(spec: GuardSpec<I, O>): (input: I) => Promise<O> {
    return async (input: I) => {
      const d = spec.describe?.(input) ?? { params: input as Record<string, unknown> };
      this.opts.onEvent?.({ type: 'authorizing', tool: spec.name });
      let result = await this.authorize(spec.name, d);
      this.opts.onEvent?.({ type: 'decision', tool: spec.name, result });
      if (result.status === 'pending' && result.actionId) {
        result = await this.poll(result.actionId);
        this.opts.onEvent?.({ type: 'resolved', tool: spec.name, result });
      }
      if (result.verdict !== 'allow' && result.status !== 'approved') throw new HaloBlockedError(spec.name, result);
      return spec.execute(input);
    };
  }
}
