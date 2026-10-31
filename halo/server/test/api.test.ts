import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";
import { MemoryStore } from "../src/core/store.ts";
import { ForcedModel } from "./helpers.ts";

describe("HTTP API", () => {
  it("registers a business and agent, verifies the credential, serves notice and integrity check", async () => {
    const { app } = await buildApp({ store: new MemoryStore(), models: new ForcedModel() });
    const b = (await app.inject({ method: "POST", url: "/v1/businesses", payload: { name: "Pinecrest Pharmacy", domain: "pinecrest.example", official_callback: "+1-555-0122" } })).json();
    const a = (await app.inject({ method: "POST", url: `/v1/businesses/${b.id}/agents`, payload: { name: "Pinecrest Refill Bot" } })).json();
    expect(a.credential).toMatch(/^halo_cred\./);
    const v = (await app.inject({ method: "POST", url: "/v1/verify", payload: { credential: a.credential } })).json();
    expect(v).toMatchObject({ valid: true, business: { name: "Pinecrest Pharmacy" } });
    const n = (await app.inject({ method: "GET", url: "/v1/authorization-notice" })).json();
    expect(n.type).toBe("halo.authorization_notice/v1");
    const integ = (await app.inject({ method: "GET", url: "/v1/activity/verify" })).json();
    expect(integ.ok).toBe(true);
    const priv = (await app.inject({ method: "GET", url: "/v1/privacy/my-data?user_id=maya" })).json();
    expect(priv.statement).toMatch(/never sells/);
    const bad = await app.inject({ method: "POST", url: "/v1/inbound", payload: {} });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });

  it("drops transcript text when a session ends unless saved", async () => {
    const { app } = await buildApp({ store: new MemoryStore(), models: new ForcedModel() });
    const s = (await app.inject({ method: "POST", url: "/v1/inbound", payload: { user_id: "maya", caller_number: "+1-555-1", claimed: {} } })).json();
    await app.inject({ method: "POST", url: `/v1/inbound/${s.id}/lines`, payload: { text: "hello there" } });
    const ended = (await app.inject({ method: "POST", url: `/v1/inbound/${s.id}/end` })).json();
    expect(ended.transcript[0].text).toMatch(/not kept/);
    await app.close();
  });
});
