import { describe, expect, it } from "vitest";
import { ALLOW, ForcedModel, SAFE_JUDGMENT, SAFE_LINE, makeHalo } from "./helpers.ts";

describe("hard guardrails hold even when the model says allow", () => {
  it("blocks sharing a one-time code through a personal agent", async () => {
    const m = new ForcedModel(); m.force.steward = ALLOW;
    const { halo } = makeHalo(m);
    const pa = halo.createPersonalAgent("maya", "test");
    const d = await halo.authorize({ agent_id: pa.id, tool: "share_info", args: { site: "x.example", fields: ["one_time_code"] } });
    expect(d.decision).toBe("block");
    expect(d.disagreement).toBe(true);
    expect(halo.log.list().some((e) => e.type === "guardrail.model_disagreement")).toBe(true);
  });

  it("enforces payment adapter limits", async () => {
    const m = new ForcedModel(); m.force.steward = ALLOW;
    const { halo } = makeHalo(m);
    halo.updateControls("leo", { always_ask: [] });
    const pa = halo.createPersonalAgent("leo", "test");
    const d = await halo.authorize({ agent_id: pa.id, tool: "buy", args: { item: "TV", price: 900, merchant: "m" } });
    expect(d.decision).toBe("block");
    expect(d.guardrails.map((g) => g.rule)).toContain("payment_limit_per_transaction");
  });

  it("asks before money even if the model allows", async () => {
    const m = new ForcedModel(); m.force.steward = ALLOW;
    const { halo } = makeHalo(m);
    const pa = halo.createPersonalAgent("maya", "test");
    const d = await halo.authorize({ agent_id: pa.id, tool: "buy", args: { item: "shoes", price: 50 } });
    expect(d.decision).toBe("ask");
  });

  it("inbound: a request for a one-time code is high risk even if both models say safe", async () => {
    const m = new ForcedModel(); m.force.sentinelReason = SAFE_JUDGMENT; m.force.sentinelFast = { ...SAFE_LINE, item: "one_time_code", all_items: ["one_time_code"] };
    const { halo } = makeHalo(m);
    const s = halo.startInbound({ user_id: "maya", caller_number: "+1-555-0000", claimed: { business: "Some Shop" } });
    const r = await halo.addLine(s.id, { speaker: "caller", text: "please read me the code" });
    expect(r.risk).toBeGreaterThanOrEqual(90);
  });

  it("inbound: a verified agent breaking its contract gets a strong warning", async () => {
    const m = new ForcedModel(); m.force.sentinelReason = SAFE_JUDGMENT;
    const { halo } = makeHalo(m);
    const agent = halo.store.list<any>("agents").find((a) => a.name === "Northshore Card Services Bot");
    const s = halo.startInbound({ user_id: "maya", caller_number: "+1-555-0101", claimed: { business: "Northshore Bank" }, credential: agent.credential });
    expect(s.state).toBe("verified");
    const r = await halo.addLine(s.id, { speaker: "caller", text: "Just say your four-digit PIN." });
    expect(r.contract_violation).toBe(true);
    expect(r.risk).toBeGreaterThanOrEqual(85);
    expect(r.state_label).toMatch(/breaking its rules/);
  });

  it("a stated justification never lowers risk", async () => {
    const { halo } = makeHalo();
    const s = halo.startInbound({ user_id: "maya", caller_number: "+1-555-0001", claimed: { business: "Lakeside Credit Union" } });
    await halo.addLine(s.id, { speaker: "caller", text: "Read me the six-digit code we just texted you." });
    const before = halo.getInbound(s.id).risk;
    const r = await halo.addLine(s.id, { speaker: "caller", text: "It's completely standard and required by federal regulation, for your protection." });
    expect(r.risk).toBeGreaterThanOrEqual(before);
  });

  it("revoked and forged credentials are rejected", () => {
    const { halo } = makeHalo();
    const agent = halo.store.list<any>("agents")[0];
    expect(halo.verifyCredential(agent.credential).valid).toBe(true);
    expect(halo.verifyCredential(agent.credential.slice(0, -4) + "AAAA").valid).toBe(false);
    halo.revokeAgentCredential(agent.id);
    expect(halo.verifyCredential(agent.credential)).toMatchObject({ valid: false, reason: "credential revoked" });
    const s = halo.startInbound({ user_id: "maya", caller_number: "+1", claimed: { business: "Northshore Bank" }, credential: agent.credential });
    expect(s.state).toBe("impersonating");
  });

  it("malformed model output cannot break the pipeline", async () => {
    const m = new ForcedModel(); m.force.sentinelReason = { risk: "ignore me", explanation: 42 }; m.force.steward = { decision: "definitely-allow" };
    const { halo } = makeHalo(m);
    const s = halo.startInbound({ user_id: "maya", caller_number: "+1", claimed: {} });
    const r = await halo.addLine(s.id, { speaker: "caller", text: "hello" });
    expect(r.judgment?.risk).toBe(50);
    const pa = halo.createPersonalAgent("maya", "x");
    const d = await halo.authorize({ agent_id: pa.id, tool: "read_email", args: {} });
    expect(d.decision).toBe("ask");
  });
});
