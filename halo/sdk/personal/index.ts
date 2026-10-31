// halo.guard(tool): every personal-agent action goes to Steward + hard guardrails BEFORE it runs.
export type GuardDecision = { id: string; decision: "allow" | "ask" | "block"; final_reason: string; status: string };

export interface HaloAuthorizer {
  authorize(input: { agent_id: string; tool: string; args: Record<string, any>; context?: { source: string; text: string }[]; user_request?: string }): Promise<GuardDecision>;
}

export type GuardedResult<T> =
  | { status: "executed"; decision: GuardDecision; result: T }
  | { status: "pending_approval"; decision: GuardDecision }
  | { status: "blocked"; decision: GuardDecision };

export interface ToolContext { context?: { source: string; text: string }[]; user_request?: string }

export function createHalo(authorizer: HaloAuthorizer, agentId: string) {
  return {
    /** Wrap a tool so it can only run if Halo allows it. */
    guard<A extends Record<string, any>, T>(name: string, tool: (args: A) => Promise<T> | T) {
      return async (args: A, ctx: ToolContext = {}): Promise<GuardedResult<T>> => {
        const decision = await authorizer.authorize({ agent_id: agentId, tool: name, args, context: ctx.context, user_request: ctx.user_request });
        if (decision.decision === "allow") return { status: "executed", decision, result: await tool(args) };
        if (decision.decision === "ask") return { status: "pending_approval", decision };
        return { status: "blocked", decision };
      };
    },
  };
}

/** HTTP authorizer for agents running outside the Halo server. */
export function httpAuthorizer(baseUrl: string, token?: string): HaloAuthorizer {
  return {
    async authorize(input) {
      const res = await fetch(`${baseUrl}/v1/personal-actions/authorize`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Halo authorize failed: ${res.status}`);
      return res.json();
    },
  };
}
