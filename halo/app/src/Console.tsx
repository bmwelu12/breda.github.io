// Demo control panel: scenarios, red team scoreboard, data review, eval results, records, why Halo.
import { useState } from "react";
import { Card, Pill, decisionTone, fmtTime, human, useApi, useEvents, useLive } from "./ui.tsx";

type Tab = "scenarios" | "redteam" | "review" | "evals" | "records" | "why";

export function Console({ onUser }: { onUser: (u: string) => void }) {
  const [tab, setTab] = useState<Tab>("scenarios");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav className="flex flex-wrap gap-1" aria-label="Console">
        {([["scenarios", "Scenarios"], ["redteam", "Red Team"], ["review", "Data review"], ["evals", "Eval results"], ["records", "Records"], ["why", "Why Halo"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${tab === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`} aria-current={tab === k}>{l}</button>
        ))}
      </nav>
      {tab === "scenarios" && <Scenarios onUser={onUser} />}
      {tab === "redteam" && <RedTeam />}
      {tab === "review" && <Review />}
      {tab === "evals" && <Evals />}
      {tab === "records" && <Records />}
      {tab === "why" && <Why />}
    </div>
  );
}

function Scenarios({ onUser }: { onUser: (u: string) => void }) {
  const api = useApi();
  const [list] = useLive<any[]>("/v1/scenarios", () => false);
  const [running, setRunning] = useState<string | null>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [campaigns] = useLive<any[]>("/v1/campaigns", (e) => e.type === "swarm.campaign" || e.type === "intel.updated" || e.type === "scenario.finished");
  useEvents((e) => {
    if (e.type === "scenario.finished" || e.type === "scenario.error") setRunning(null);
    if (["alert.high_risk", "swarm.campaign", "personal_action.decided", "interrogation.verdict", "intel.updated", "redteam.round"].includes(e.type)) setFeed((f) => [{ ...e, at: Date.now() }, ...f].slice(0, 8));
  });
  const run = (s: any) => { setRunning(s.id); if (s.user) onUser(s.user); api.post(`/v1/scenarios/${s.id}/run`, { delay_ms: 1300 }); };
  const groups = ["Inbound", "Outbound", "2026 incident cases", "Red Team"];
  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-lg font-bold">{g}</h2>
          {g === "2026 incident cases" && <p className="mb-2 max-w-prose text-sm text-muted">Modeled on agent behaviors reported in the July 2026 OpenAI agents / Hugging Face breach (METR and Redwood Research investigation). Names and details are invented.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {(list ?? []).filter((s) => s.group === g).map((s) => (
              <button key={s.id} onClick={() => run(s)} disabled={!!running} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-left hover:border-accent disabled:opacity-60">
                <span className="min-w-0"><span className="block font-bold leading-snug">{s.title}</span>{s.case && <span className="block text-xs text-muted">{s.case}</span>}{s.user && <span className="text-xs text-muted">on {s.user[0].toUpperCase() + s.user.slice(1)}'s phone</span>}</span>
                <span className="shrink-0 text-sm font-bold text-accent">{running === s.id ? "Running…" : "Run ▸"}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <Card>
        <div className="flex items-center justify-between"><h3 className="font-bold">After a report: protect a second person</h3>
          <button className="btn !py-1 text-sm" disabled={!!running} onClick={() => run({ id: "fake-bank-second-user", user: "leo" })}>Call Leo</button></div>
        <p className="text-sm text-muted">Run “Fake bank agent”, tap Report scam on Maya's phone, then call Leo from the same campaign under a different bank's name.</p>
      </Card>
      <Card>
        <h3 className="font-bold">Campaigns (Swarm Detector)</h3>
        {!campaigns?.length && <p className="text-sm text-muted">No coordinated campaigns yet. Run “Swarm campaign”.</p>}
        {(campaigns ?? []).map((c) => (
          <div key={c.id} className="mt-2 rounded-xl border border-danger/40 bg-danger-bg p-3 text-danger">
            <div className="font-bold">{c.label}</div>
            <div className="text-sm">{c.identities.length} identities · {c.users.length} people targeted · {Math.max(1, Math.round((c.last_seen - c.first_seen) / 60000))} min window {c.reported ? "· reported" : ""}</div>
            <div className="mt-1 flex flex-wrap gap-1">{c.identities.map((i: string) => <span key={i} className="chip border-danger/40 text-danger">{i}</span>)}</div>
          </div>
        ))}
      </Card>
      {feed.length > 0 && (
        <Card><h3 className="mb-1 font-bold">What Halo just did</h3>
          <ul className="text-sm">{feed.map((e, i) => <li key={i} className="border-b border-line py-1 last:border-0"><span className="tnum text-muted">{fmtTime(e.at)}</span> {feedLine(e)}</li>)}</ul></Card>
      )}
    </div>
  );
}

const feedLine = (e: any) =>
  e.type === "alert.high_risk" ? `Alerted ${e.user_id}: ${e.label} (risk ${e.risk})${e.trusted_contact ? `, told ${e.trusted_contact.name}` : ""}` :
  e.type === "swarm.campaign" ? `Grouped a campaign: ${e.campaign.label}` :
  e.type === "personal_action.decided" ? `${e.action.tool}: ${e.action.status} (${e.action.final_reason})` :
  e.type === "interrogation.verdict" ? `Interrogator verdict: ${human(e.verdict)}` :
  e.type === "intel.updated" ? "Report shared with the network (hashed IDs + tactics)" :
  e.type === "redteam.round" ? `Red Team round: caught ${e.round.caught}/${e.round.total}` : e.type;

function RedTeam() {
  const api = useApi();
  const [board, reload] = useLive<any>("/v1/redteam/scoreboard", (e) => e.type === "redteam.round");
  const [busy, setBusy] = useState(false);
  const last = board?.rounds?.[0];
  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">Red Team scoreboard</h2><p className="text-sm text-muted">An open model writes new scam lines and injected instructions aimed at Halo. Misses go to Data review.</p></div>
          <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); await api.post("/v1/redteam/run", { n: 10 }); setBusy(false); reload(); }}>{busy ? "Attacking…" : "Run 10 new attacks"}</button>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[["Attacks", board?.total ?? 0], ["Caught", board?.caught ?? 0], ["Missed", board?.missed ?? 0]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-sunk p-2"><dt className="text-xs text-muted">{l}</dt><dd className="text-3xl font-bold tnum">{v}</dd></div>
          ))}
        </dl>
      </Card>
      {last && (
        <Card>
          <h3 className="mb-2 font-bold">Latest round · {fmtTime(last.ts)} · models: {last.backend}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-muted"><th className="py-1 pr-2">Kind</th><th className="pr-2">Attack</th><th className="pr-2">Result</th></tr></thead>
              <tbody>{last.results.map((r: any) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="py-2 pr-2 whitespace-nowrap">{human(r.kind)}</td>
                  <td className="py-2 pr-2">{r.text}</td>
                  <td className="py-2"><Pill tone={r.caught ? "safe" : "danger"}>{r.caught ? "caught" : "missed"}</Pill><div className="text-xs text-muted">{r.detail}</div></td>
                </tr>))}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Review() {
  const api = useApi();
  const [items, reload] = useLive<any[]>("/v1/review", (e) => e.type?.startsWith("review"));
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const pending = (items ?? []).filter((i) => i.status === "pending");
  return (
    <div className="grid gap-3">
      <Card>
        <h2 className="text-lg font-bold">Data review</h2>
        <p className="text-sm text-muted">Generated examples and Red Team misses wait here. Only approved examples enter training (<code className="font-mono">ml/data/reviewed/approved.jsonl</code>). The test set is frozen and never trained on.</p>
        <div className="mt-2 flex gap-2 text-sm"><Pill tone="warn">{pending.length} waiting</Pill><Pill tone="safe">{(items ?? []).filter((i) => i.status === "approved").length} approved</Pill><Pill tone="muted">{(items ?? []).filter((i) => i.status === "rejected").length} rejected</Pill></div>
      </Card>
      {!items?.length && <p className="text-sm text-muted">Nothing to review yet. Run a Red Team round.</p>}
      {(items ?? []).map((it) => (
        <Card key={it.id}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span><b>{human(it.model)}</b> · from {human(it.source)}</span><Pill tone={decisionTone(it.status === "approved" ? "allow" : it.status === "rejected" ? "block" : "ask")}>{it.status}</Pill></div>
          {editing === it.id ? (
            <textarea id={`edit-${it.id}`} className="mt-2 h-40 w-full rounded-lg border border-line bg-bg p-2 font-mono text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-sunk p-2 font-mono text-xs">{JSON.stringify(it.example, null, 2)}</pre>
          )}
          {it.status === "pending" && (
            <div className="mt-2 flex flex-wrap gap-2">
              {editing === it.id ? (
                <button className="btn btn-primary !py-1 text-sm" onClick={async () => { try { await api.post(`/v1/review/${it.id}`, { action: "edit", example: JSON.parse(draft) }); await api.post(`/v1/review/${it.id}`, { action: "approve" }); setEditing(null); reload(); } catch { /* invalid JSON stays in editor */ } }}>Save & approve</button>
              ) : (
                <>
                  <button className="btn btn-primary !py-1 text-sm" onClick={() => api.post(`/v1/review/${it.id}`, { action: "approve" }).then(reload)}>Approve</button>
                  <button className="btn !py-1 text-sm" onClick={() => { setEditing(it.id); setDraft(JSON.stringify(it.example, null, 2)); }}>Edit</button>
                  <button className="btn !py-1 text-sm" onClick={() => api.post(`/v1/review/${it.id}`, { action: "reject" }).then(reload)}>Reject</button>
                </>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Evals() {
  const [ev] = useLive<any>("/v1/evals/latest", () => false);
  if (!ev) return null;
  const rows = ev.models ?? [];
  return (
    <div className="grid gap-3">
      <Card>
        <h2 className="text-lg font-bold">Eval results</h2>
        <p className="text-sm text-muted">From <code className="font-mono">make eval</code> on the frozen test set · {ev.generated_at ? new Date(ev.generated_at).toLocaleString() : "never run"}</p>
        {ev.status && ev.status !== "complete" && <div className="mt-2 rounded-xl bg-warn-bg p-3 text-sm text-warn"><b>{human(ev.status)}.</b> {ev.message}</div>}
      </Card>
      {rows.map((m: any) => (
        <Card key={m.model}>
          <h3 className="font-bold">{m.model}</h3>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-left text-sm tnum">
              <thead><tr className="text-muted"><th className="py-1 pr-3">System</th><th className="pr-3">Accuracy</th><th className="pr-3">False alarms</th><th className="pr-3">Missed scams</th><th className="pr-3">p50 latency</th>{Object.keys(m.rows[0]?.hard ?? {}).map((h) => <th key={h} className="pr-3">{human(h)}</th>)}</tr></thead>
              <tbody>{m.rows.map((r: any) => (
                <tr key={r.system} className="border-t border-line">
                  <td className="py-1.5 pr-3 font-bold">{r.system}{r.kind === "heuristic" && <span className="ml-1 text-xs font-normal text-muted">(not a model)</span>}</td>
                  <td className="pr-3">{pct(r.accuracy)}</td><td className="pr-3">{pct(r.false_alarm_rate)}</td><td className="pr-3">{pct(r.miss_rate)}</td><td className="pr-3">{r.latency_ms_p50 != null ? `${r.latency_ms_p50.toFixed(1)} ms` : "—"}</td>
                  {Object.values(r.hard ?? {}).map((v: any, i) => <td key={i} className="pr-3">{pct(v)}</td>)}
                </tr>))}</tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
const pct = (v: any) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

function Records() {
  const api = useApi();
  const [integrity, reload] = useLive<any>("/v1/activity/verify");
  const [log] = useLive<any[]>("/v1/activity?limit=40");
  const [notice] = useLive<any>("/v1/authorization-notice", () => false);
  return (
    <div className="grid gap-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-lg font-bold">Tamper-evident activity log</h2><p className="text-sm text-muted">Each entry carries the SHA-256 of the one before it. Halo never trusts logs supplied by agents.</p></div>
          <div className="flex gap-2">
            <button className="btn !py-1 text-sm" onClick={reload}>Check integrity</button>
            {api.tamperDemo && <button className="btn !py-1 text-sm" onClick={() => { api.tamperDemo!(); reload(); }}>Simulate an agent editing the log</button>}
          </div>
        </div>
        {integrity && <div className={`mt-2 rounded-xl p-3 text-sm font-bold ${integrity.ok ? "bg-safe-bg text-safe" : "bg-danger-bg text-danger"}`}>{integrity.ok ? `✓ Intact: ${integrity.entries} entries, head ${integrity.head.slice(0, 16)}…` : `! Tampering detected at entry #${integrity.broken_at}: ${integrity.problem}`}</div>}
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left font-mono text-[11px]"><tbody>
            {(log ?? []).slice().reverse().map((e) => <tr key={e.seq} className="border-t border-line"><td className="py-1 pr-2 tnum">#{e.seq}</td><td className="pr-2">{e.type}</td><td className="pr-2 text-muted">{e.hash.slice(0, 12)}</td></tr>)}
          </tbody></table>
        </div>
      </Card>
      {notice && (
        <Card><h3 className="font-bold">Authorization notice shown to every arriving agent</h3>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-sunk p-2 font-mono text-[11px]">{JSON.stringify({ ...notice, signature: notice.signature.slice(0, 40) + "…" }, null, 2)}</pre></Card>
      )}
    </div>
  );
}

const COMPETITORS = [
  ["Google fake call detection", "Confirms a saved contact's call comes from their phone.", "Verifies businesses' AI agents on every channel, and judges what the caller is trying to do."],
  ["Pindrop BotStopper", "Detects AI callers for enterprises.", "Serves consumers, names which agent it is and who's behind it, and questions suspicious agents."],
  ["Truecaller, Hiya, Norton, Aura", "Warn about known bad callers.", "Also verifies good ones, and catches new scams no blocklist has seen."],
  ["Allowance (YC), agent payment platforms", "Control agent spending.", "Plugs into them and checks whether any action matches the person's intent, not just money."],
  ["Bitdefender AI Guardian", "Controls coding agents for technical users.", "Built for everyday people and families, on mobile."],
];

function Why() {
  return (
    <div className="grid gap-3">
      <Card>
        <h2 className="text-lg font-bold">Why Halo</h2>
        <p className="max-w-prose text-[15px]">Scammers now run AI agents that sound human and adapt in real time, and people's own agents can be talked into overspending or leaking data. Halo gives every person guardian models that verify, question and stop agents for them. Businesses register their agents; people, banks and carriers verify them.</p>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-muted"><th className="py-1 pr-3">Product</th><th className="pr-3">What it does</th><th>What Halo adds</th></tr></thead>
            <tbody>{COMPETITORS.map(([a, b, c]) => <tr key={a} className="border-t border-line align-top"><td className="py-2 pr-3 font-bold">{a}</td><td className="py-2 pr-3 text-muted">{b}</td><td className="py-2">{c}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-sm"><b>Privacy:</b> Halo's models are open-weight models fine-tuned with Hugging Face AutoTrain and run on Halo's own servers. No outside AI company sees anyone's conversations.</p>
        <p className="mt-1 text-xs text-muted">Positioning based on public information as of October 2026.</p>
      </Card>
    </div>
  );
}
