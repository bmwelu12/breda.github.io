// The consumer app: what a person sees on their phone.
import { useEffect, useState } from "react";
import { Card, Pill, RiskMeter, StateBanner, decisionTone, fmtTime, human, useApi, useEvents, useLive } from "./ui.tsx";

const GUIDANCE: Record<string, string> = {
  impersonating: "Please don't share anything or send money. Hang up, then call the official number you already have.",
  unverified: "Halo can't confirm who this is. Don't share codes or personal details until you've checked.",
  verified: "Halo confirmed this agent with its business. It still can't ask for codes, PINs or passwords.",
};

export function PhoneApp({ userId, onUser }: { userId: string; onUser: (u: string) => void }) {
  const api = useApi();
  const [tab, setTab] = useState<"calls" | "agents" | "activity" | "privacy">("calls");
  const [openId, setOpenId] = useState<string | null>(null);
  const [alert, setAlert] = useState<any>(null);
  const [user, reloadUser] = useLive<any>(`/v1/users/${userId}`);
  const [sessions] = useLive<any[]>(`/v1/inbound?user_id=${userId}`, (e) => !e.user_id || e.user_id === userId);

  useEvents((e) => {
    if (e.type === "inbound.started" && e.user_id === userId) { setOpenId(e.session.id); setTab("calls"); }
    if (e.type === "alert.high_risk" && e.user_id === userId) setAlert(e);
  }, [userId]);
  useEffect(() => { setOpenId(null); setAlert(null); }, [userId]);

  const open = sessions?.find((s) => s.id === openId);
  return (
    <div className="phone mx-auto flex h-[760px] max-h-[86vh] flex-col">
      <div className="flex items-center justify-between bg-surface px-5 pb-2 pt-3 text-xs text-muted">
        <span className="tnum">{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        <label className="flex items-center gap-1">
          <span className="sr-only">Signed-in person</span>
          <select id="phone-user" value={userId} onChange={(e) => onUser(e.target.value)} className="rounded bg-transparent text-xs font-bold text-ink">
            {["maya", "leo", "ana", "raj", "li"].map((u) => <option key={u} value={u}>{u[0].toUpperCase() + u.slice(1)}'s phone</option>)}
          </select>
        </label>
      </div>
      <header className="flex items-center justify-between border-b border-line bg-surface px-5 pb-3">
        <div>
          <div className="font-display text-2xl font-bold">Halo</div>
          <div className="flex items-center gap-2 text-sm text-muted"><span className="listening-dot" aria-hidden /> Halo is listening for you</div>
        </div>
        {user && (
          <button className="chip" onClick={() => api.post(`/v1/users/${userId}/protection`, { level: user.protection === "high" ? "standard" : "high" }).then(reloadUser)}
            aria-pressed={user.protection === "high"} title="High protection alerts your trusted contact on high-risk calls">
            {user.protection === "high" ? "High protection" : "Standard"}
          </button>
        )}
      </header>

      {alert && (
        <div className="mx-3 mt-3 rounded-2xl border border-danger/40 bg-danger-bg p-3 text-danger" role="alert">
          <div className="font-bold">Halo stepped in on a risky call</div>
          <div className="text-sm">{alert.label}.{alert.trusted_contact ? ` ${alert.trusted_contact.name} (your ${alert.trusted_contact.relation}) has been told.` : ""}</div>
          <button className="mt-1 text-sm font-bold underline" onClick={() => { setOpenId(alert.inbound_id); setAlert(null); }}>Open the call</button>
        </div>
      )}

      <main className="scroll-y flex-1 px-3 py-3">
        {open ? <CallScreen s={open} onClose={() => setOpenId(null)} /> :
          tab === "calls" ? <CallsList sessions={sessions ?? []} onOpen={setOpenId} /> :
          tab === "agents" ? <AgentsTab userId={userId} /> :
          tab === "activity" ? <ActivityTab userId={userId} /> : <PrivacyTab userId={userId} />}
      </main>

      <nav className="grid grid-cols-4 border-t border-line bg-surface text-sm" aria-label="Halo sections">
        {([["calls", "Calls"], ["agents", "My agents"], ["activity", "Timeline"], ["privacy", "My data"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setOpenId(null); }} className={`py-3 font-bold ${tab === k && !open ? "text-accent" : "text-muted"}`} aria-current={tab === k}>{l}</button>
        ))}
      </nav>
    </div>
  );
}

function CallsList({ sessions, onOpen }: { sessions: any[]; onOpen: (id: string) => void }) {
  if (!sessions.length) return (
    <Card><div className="font-bold">No calls yet</div><p className="text-sm text-muted">When an AI agent calls, texts or chats with you, Halo checks it here. Start a scenario from the console to see it.</p></Card>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="eyebrow px-1">Recent contacts</div>
      {sessions.map((s) => (
        <button key={s.id} onClick={() => onOpen(s.id)} className="text-left">
          <StateBanner state={s.state} label={s.state_label} />
          <div className="flex justify-between px-2 pt-1 text-xs text-muted"><span>{s.claimed?.agent_name ?? s.claimed?.name ?? "Unknown caller"} · {s.channel}</span><span className="tnum">{fmtTime(s.started_at)} · risk {s.risk}</span></div>
        </button>
      ))}
    </div>
  );
}

function CallScreen({ s, onClose }: { s: any; onClose: () => void }) {
  const api = useApi();
  const [busy, setBusy] = useState("");
  const [live, setLive] = useState<any>(null);
  const [reported, setReported] = useState<any>(null);
  const act = async (k: string, fn: () => Promise<any>) => { setBusy(k); try { return await fn(); } finally { setBusy(""); } };
  const callerName = s.claimed?.agent_name ?? s.claimed?.name ?? "Caller";
  return (
    <div className="flex flex-col gap-3">
      <button onClick={onClose} className="self-start text-sm font-bold text-accent">← All calls</button>
      <StateBanner state={s.state} label={s.state_label} big />
      <p className="text-[15px]">{s.judgment?.explanation && s.risk >= 45 ? s.judgment.explanation + " " : ""}{GUIDANCE[s.state]}</p>
      {s.contract_violation && <div className="rounded-xl border border-danger/40 bg-danger-bg p-3 text-sm font-bold text-danger">⚠ Warning: this verified agent asked for something its business promised never to ask for. Don't answer it.</div>}
      <RiskMeter risk={s.risk} />

      {s.verification_code && (
        <Card className="flex items-center justify-between">
          <div><div className="eyebrow">Two-way code</div><div className="text-sm text-muted">The agent's session shows the same code</div></div>
          <div className="font-mono text-3xl font-semibold tracking-widest tnum">{s.verification_code}</div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className="btn justify-center" disabled={!!busy || s.ended} onClick={() => act("verify", () => api.post("/v1/verify/live", { inbound_id: s.id }).then(setLive))}>{busy === "verify" ? "Checking…" : "Verify this caller"}</button>
        <button className="btn btn-primary justify-center" disabled={!!busy || s.ended || s.interrogation?.length > 0} onClick={() => act("ask", () => api.post(`/v1/inbound/${s.id}/interrogate`))}>{busy === "ask" ? "Halo is answering…" : "Let Halo answer"}</button>
      </div>
      {live && <div className={`rounded-xl p-3 text-sm ${live.confirmed ? "bg-safe-bg text-safe" : "bg-warn-bg text-warn"}`}><b>{live.confirmed ? "✓ Confirmed live." : "? Not confirmed."}</b> {live.message}</div>}

      {s.interrogation?.length > 0 && (
        <Card>
          <div className="eyebrow mb-2">Halo is talking to {callerName}</div>
          <div className="flex flex-col gap-2">
            {s.interrogation.map((t: any, i: number) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${t.speaker === "halo" ? "self-end bg-accent text-accent-ink" : "self-start bg-sunk"}`}>{t.text}</div>
            ))}
          </div>
          {s.interrogation_verdict && (
            <div className="mt-3"><Pill tone={s.interrogation_verdict === "verified" ? "safe" : s.interrogation_verdict === "likely_scam" ? "danger" : "warn"}>Verdict: {human(s.interrogation_verdict)}</Pill></div>
          )}
        </Card>
      )}

      <Card>
        <div className="eyebrow mb-2">Live transcript</div>
        <ol className="flex flex-col gap-2">
          {s.transcript.map((t: any, i: number) => (
            <li key={i} className={t.speaker === "user" ? "pl-8" : ""}>
              <div className="text-xs font-bold text-muted">{t.speaker === "user" ? "You" : t.speaker === "caller2" ? "Second caller" : callerName}</div>
              <div className="text-[15px]">{t.text}</div>
              {t.flags && (t.flags.risk !== "low" || t.flags.injection) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  <Pill tone={t.flags.risk === "high" ? "danger" : "warn"}>{t.flags.risk} risk</Pill>
                  {[...new Set<string>([t.flags.tactic, ...t.flags.all_tactics])].filter((x) => x !== "none").map((x) => <Pill key={x} tone="muted">{human(x)}</Pill>)}
                  {[...new Set<string>([t.flags.item, ...t.flags.all_items])].filter((x) => x !== "none").map((x) => <Pill key={x} tone="danger">asks for {human(x)}</Pill>)}
                  {t.flags.injection && <Pill tone="danger">tried to instruct Halo</Pill>}
                </div>
              )}
            </li>
          ))}
          {!s.transcript.length && <li className="text-sm text-muted">Connecting… Halo showed the caller its authorization notice.</li>}
        </ol>
      </Card>

      {s.judgment?.deception_signals?.length > 0 && (
        <Card><div className="eyebrow mb-1">Why Halo thinks so</div><ul className="list-disc pl-5 text-sm">{s.judgment.deception_signals.map((d: string) => <li key={d}>{d}</li>)}</ul></Card>
      )}

      <div className="flex flex-wrap gap-2 pb-2">
        {s.state !== "verified" && <button className="btn" disabled={!!reported || !!busy} onClick={() => act("report", () => api.post("/v1/reports", { inbound_id: s.id }).then(setReported))}>{reported ? "Reported ✓" : "Report scam"}</button>}
        {!s.ended && <button className="btn" onClick={() => api.post(`/v1/inbound/${s.id}/save`)} disabled={s.saved}>{s.saved ? "Transcript saved" : "Save transcript"}</button>}
        {!s.ended && <button className="btn" onClick={() => api.post(`/v1/inbound/${s.id}/end`)}>End</button>}
      </div>
      {reported && <p className="text-sm text-muted">Shared with Halo's network as hashed caller IDs and tactic patterns only. Other Halo users are protected from this campaign now.</p>}
    </div>
  );
}

function AgentsTab({ userId }: { userId: string }) {
  const api = useApi();
  const [agents] = useLive<any[]>(`/v1/personal-agents?user_id=${userId}`);
  const [actions] = useLive<any[]>(`/v1/personal-actions?user_id=${userId}`);
  const [user, reloadUser] = useLive<any>(`/v1/users/${userId}`);
  const pending = (actions ?? []).filter((a) => a.status === "pending");
  const toggle = (k: string) => {
    const cur: string[] = user.controls.always_ask;
    api.post(`/v1/users/${userId}/controls`, { always_ask: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] }).then(reloadUser);
  };
  return (
    <div className="flex flex-col gap-3">
      {pending.length > 0 && <div className="eyebrow px-1">Waiting for you</div>}
      {pending.map((a) => (
        <Card key={a.id} className="border-warn/50">
          <div className="font-bold">{describeAction(a)}</div>
          <p className="text-sm text-muted">{a.final_reason}</p>
          <div className="mt-2 flex gap-2">
            <button className="btn btn-primary" onClick={() => api.post(`/v1/approvals/${a.id}`, { decision: "approve" })}>Approve</button>
            <button className="btn" onClick={() => api.post(`/v1/approvals/${a.id}`, { decision: "deny" })}>Don't do it</button>
          </div>
        </Card>
      ))}

      <div className="flex items-center justify-between px-1">
        <div className="eyebrow">My agents</div>
        <button className="btn !py-1 text-sm" onClick={() => api.post("/v1/personal-agents/pause-all", { user_id: userId })}>Pause all my agents</button>
      </div>
      {(agents ?? []).map((a) => (
        <Card key={a.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><div className="font-bold">{a.name}</div>{a.current_request && <div className="text-sm text-muted">Working on: “{a.current_request}”</div>}</div>
            <Pill tone={a.status === "active" ? "safe" : a.status === "paused" ? "warn" : "danger"}>{a.status}</Pill>
          </div>
          {a.autonomy === "reduced" && <p className="mt-1 text-sm text-warn">Halo lowered this agent's freedom because the goal was “no matter what”. It now asks before every step.</p>}
          <div className="mt-2 flex gap-2">
            {a.status === "paused" && <button className="btn !py-1 text-sm" onClick={() => api.post(`/v1/personal-agents/${a.id}/resume`)}>Resume</button>}
            {a.status !== "revoked" && <button className="btn !py-1 text-sm" onClick={() => api.post(`/v1/personal-agents/${a.id}/revoke`)}>Revoke access</button>}
          </div>
        </Card>
      ))}

      {user && (
        <Card>
          <div className="eyebrow mb-2">Always ask me before…</div>
          {[["send_money", "Sending money"], ["recurring", "Recurring sign-ups"], ["share_personal_data", "Sharing my personal details"], ["delete", "Deleting anything"], ["email_new", "Emailing someone new"]].map(([k, l]) => (
            <label key={k} className="flex items-center justify-between py-1.5 text-[15px]"><span>{l}</span>
              <input id={`ask-${k}`} type="checkbox" className="h-5 w-5 accent-[rgb(var(--accent))]" checked={user.controls.always_ask.includes(k)} onChange={() => toggle(k)} /></label>
          ))}
          <label className="flex items-center justify-between py-1.5 text-[15px]"><span>Quiet hours (10pm–7am)</span>
            <input id="quiet-hours" type="checkbox" className="h-5 w-5" checked={!!user.controls.quiet_hours} onChange={() => api.post(`/v1/users/${userId}/controls`, { quiet_hours: user.controls.quiet_hours ? null : { start: 22, end: 7 } }).then(reloadUser)} /></label>
          <div className="pt-1 text-sm text-muted">Blocked: {user.controls.blocked_categories.join(", ")}</div>
        </Card>
      )}

      <div className="eyebrow px-1">What my agents did</div>
      {(actions ?? []).filter((a) => a.status !== "pending").slice(0, 12).map((a) => (
        <div key={a.id} className="flex items-start justify-between gap-2 border-b border-line px-1 pb-2 text-sm">
          <div className="min-w-0"><div>{describeAction(a)}</div><div className="text-muted">{a.final_reason}</div></div>
          <Pill tone={decisionTone(a.status)}>{a.status}</Pill>
        </div>
      ))}
    </div>
  );
}

export function describeAction(a: any) {
  const x = a.args ?? {};
  switch (a.tool) {
    case "buy": return `Buy ${x.item ?? "an item"} for $${x.price ?? x.amount}`;
    case "subscribe": return `Sign up for ${x.plan} ($${x.price}/${x.period ?? "month"})`;
    case "send_email": return `Email ${x.to}`;
    case "share_info": return `Share ${(x.fields ?? []).map(human).join(", ")} with ${x.site}`;
    case "read_email": return "Read your inbox";
    case "search_products": return `Search for ${x.query}`;
    default: return human(a.tool);
  }
}

function ActivityTab({ userId }: { userId: string }) {
  const [log] = useLive<any[]>(`/v1/activity?user_id=${userId}&limit=60`);
  const [integrity] = useLive<any>("/v1/activity/verify");
  return (
    <div className="flex flex-col gap-2">
      {integrity && <Pill tone={integrity.ok ? "safe" : "danger"}>{integrity.ok ? `✓ Record intact · ${integrity.entries} entries` : `! Record altered at entry ${integrity.broken_at}`}</Pill>}
      <ol className="flex flex-col">
        {(log ?? []).slice().reverse().map((e) => (
          <li key={e.seq} className="border-b border-line py-2 text-sm">
            <div className="flex justify-between gap-2"><span className="font-bold">{plainEvent(e)}</span><span className="tnum text-muted">{fmtTime(e.ts)}</span></div>
            <div className="font-mono text-[11px] text-muted">#{e.seq} · {e.hash.slice(0, 16)}…</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const plainEvent = (e: any) => ({
  "inbound.started": "A caller reached you; Halo showed it the authorization notice",
  "inbound.line": `Halo checked a line (risk ${e.data.risk})`,
  "inbound.ended": "Call ended",
  "escalation.immediate": "High-risk call: Halo alerted right away",
  "interrogation.verdict": `Halo questioned the caller: ${human(e.data.verdict ?? "")}`,
  "report.shared": "You reported a scam",
  "personal_action.decided": `Agent wanted to ${human(e.data.tool)}: ${e.data.decision}`,
  "approval.decided": `You ${e.data.approve ? "approved" : "declined"} an agent action`,
  "evidence.snapshot": "Evidence saved before a change",
  "personal_agent.paused": "An agent was paused",
  "personal_agent.revoked": "An agent's access was revoked",
  "personal_agent.autonomy_lowered": "Halo lowered an agent's freedom",
  "guardrail.model_disagreement": "A safety rule overruled a model",
} as Record<string, string>)[e.type] ?? human(e.type);

function PrivacyTab({ userId }: { userId: string }) {
  const [d] = useLive<any>(`/v1/privacy/my-data?user_id=${userId}`);
  if (!d) return null;
  return (
    <div className="flex flex-col gap-3">
      <Card><div className="eyebrow mb-1">What Halo keeps</div><p className="text-[15px]">{d.statement}</p></Card>
      <Card><div className="eyebrow mb-1">Shared with other Halo users</div><p className="text-sm">{d.shared_with_community}</p></Card>
      <Card>
        <div className="eyebrow mb-1">Stored right now</div>
        <ul className="text-sm tnum">
          <li>{d.contacts.length} contacts ({d.contacts.filter((c: any) => c.transcript === "not kept").length} with transcript deleted)</li>
          <li>{d.personal_agents.length} personal agents · {d.actions.length} agent actions</li>
          <li>{d.evidence_snapshots.length} evidence snapshots · {d.activity.length} timeline entries</li>
        </ul>
        <details className="mt-2 text-xs"><summary className="cursor-pointer font-bold">Show the raw data</summary><pre className="mt-2 max-h-64 overflow-auto rounded bg-sunk p-2 font-mono">{JSON.stringify(d, null, 2)}</pre></details>
      </Card>
    </div>
  );
}
