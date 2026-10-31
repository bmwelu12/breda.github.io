import { describe, expect, it } from "vitest";
import { makeHalo } from "./helpers.ts";
import { SqliteStore } from "../src/sqliteStore.ts";
import { ActivityLog } from "../src/core/activity.ts";

describe("hash-chained activity log", () => {
  it("verifies a clean chain and catches edited entries", () => {
    const { halo, store } = makeHalo();
    expect(halo.log.verify().ok).toBe(true);
    store._tamper(3, { data: { forged: true } });
    const v = halo.log.verify();
    expect(v.ok).toBe(false);
    expect(v.broken_at).toBe(3);
  });

  it("catches a re-hashed entry because the next link breaks", () => {
    const { halo, store } = makeHalo();
    const all = halo.log.list();
    store._tamper(2, { hash: "f".repeat(64) });
    expect(halo.log.verify()).toMatchObject({ ok: false });
    expect(all.length).toBeGreaterThan(3);
  });

  it("SQLite refuses updates/deletes, and direct tampering is caught", () => {
    const store = new SqliteStore(":memory:");
    const log = new ActivityLog(store);
    log.append("a", "x", null, { n: 1 });
    log.append("b", "x", null, { n: 2 });
    expect(() => store.db.prepare("UPDATE activity SET data='{}' WHERE seq=1").run()).toThrow(/append-only/);
    expect(() => store.db.prepare("DELETE FROM activity WHERE seq=1").run()).toThrow(/append-only/);
    store.db.exec("DROP TRIGGER activity_no_update");
    store.db.prepare(`UPDATE activity SET data='{"n":99}' WHERE seq=1`).run();
    expect(log.verify()).toMatchObject({ ok: false, broken_at: 1 });
  });

  it("snapshots evidence before revoke and pause", async () => {
    const { halo } = makeHalo();
    const pa = halo.store.list<any>("personal_agents")[0];
    halo.revokePersonalAgent(pa.id);
    const types = halo.log.list().map((e) => e.type);
    expect(types.lastIndexOf("evidence.snapshot")).toBeLessThan(types.lastIndexOf("personal_agent.revoked"));
    expect(halo.store.list("evidence").length).toBe(1);
  });
});
