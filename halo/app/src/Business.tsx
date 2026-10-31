import { useState } from "react";
import { Card, Pill, human, useApi, useLive } from "./ui.tsx";

const ITEMS = ["personal_data", "one_time_code", "pin", "password", "gift_card", "crypto", "wire_transfer", "remote_access"];
const ALWAYS_FORBIDDEN = ["one_time_code", "pin", "password"];

export function BusinessPortal() {
  const api = useApi();
  const [bizList, reload] = useLive<any[]>("/v1/businesses");
  const [form, setForm] = useState({ name: "Pinecrest Pharmacy", domain: "pinecrest-pharmacy.example", official_callback: "+1-555-0122" });
  const [agentForm, setAgentForm] = useState({ business_id: "", name: "Pinecrest Refill Assistant", phone: "+1-555-0123", purpose: "prescription refill reminders", allowed: [] as string[], forbidden: ["gift_card", "crypto", "wire_transfer", "remote_access"] });
  const [issued, setIssued] = useState<any>(null);
  const [err, setErr] = useState("");

  const register = async () => {
    setErr("");
    try { const b = await api.post("/v1/businesses", form); setAgentForm((f) => ({ ...f, business_id: b.id })); reload(); } catch (e: any) { setErr(e.message); }
  };
  const addAgent = async () => {
    setErr("");
    const bid = agentForm.business_id || bizList?.[0]?.id;
    try {
      const r = await api.post(`/v1/businesses/${bid}/agents`, { name: agentForm.name, phone_numbers: [agentForm.phone], contract: { allowed_requests: ["none", ...agentForm.allowed], forbidden_requests: agentForm.forbidden, purpose: agentForm.purpose, channels: ["call", "sms", "chat"] } });
      setIssued(r); reload();
    } catch (e: any) { setErr(e.message); }
  };
  const toggle = (key: "allowed" | "forbidden", item: string) => setAgentForm((f) => ({ ...f, [key]: f[key].includes(item) ? f[key].filter((x) => x !== item) : [...f[key], item] }));

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <div className="eyebrow">Halo for Business</div>
          <h1 className="text-3xl font-bold">Register your AI agents</h1>
          <p className="max-w-prose text-muted">Verified agents show up green on your customers' phones, with your name. Impostors using your name show up red.</p>
        </div>
        <Card>
          <h2 className="mb-3 text-lg font-bold">1. Your business</h2>
          <div className="grid gap-3">
            {(["name", "domain", "official_callback"] as const).map((k) => (
              <label key={k} className="grid gap-1 text-sm"><span className="font-bold">{k === "official_callback" ? "Official callback number" : human(k)}</span>
                <input id={`biz-${k}`} className="rounded-lg border border-line bg-bg px-3 py-2" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
            ))}
            <button className="btn btn-primary justify-self-start" onClick={register}>Register business</button>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">2. Add an agent and its behavior contract</h2>
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1"><span className="font-bold">Business</span>
              <select id="agent-biz" className="rounded-lg border border-line bg-bg px-3 py-2" value={agentForm.business_id || bizList?.[0]?.id || ""} onChange={(e) => setAgentForm({ ...agentForm, business_id: e.target.value })}>
                {(bizList ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></label>
            <label className="grid gap-1"><span className="font-bold">Agent name</span><input id="agent-name" className="rounded-lg border border-line bg-bg px-3 py-2" value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} /></label>
            <label className="grid gap-1"><span className="font-bold">Calls from</span><input id="agent-phone" className="rounded-lg border border-line bg-bg px-3 py-2 font-mono" value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} /></label>
            <label className="grid gap-1"><span className="font-bold">Purpose</span><input id="agent-purpose" className="rounded-lg border border-line bg-bg px-3 py-2" value={agentForm.purpose} onChange={(e) => setAgentForm({ ...agentForm, purpose: e.target.value })} /></label>
            <fieldset><legend className="font-bold">This agent may ask customers for</legend>
              <div className="mt-1 flex flex-wrap gap-2">{ITEMS.filter((i) => !ALWAYS_FORBIDDEN.includes(i)).map((i) => (
                <label key={i} className="chip cursor-pointer"><input id={`allow-${i}`} type="checkbox" checked={agentForm.allowed.includes(i)} onChange={() => toggle("allowed", i)} /> {human(i)}</label>))}</div></fieldset>
            <fieldset><legend className="font-bold">It must never ask for</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {ALWAYS_FORBIDDEN.map((i) => <span key={i} className="chip border-danger/40 text-danger" title="Always forbidden by Halo">🔒 {human(i)}</span>)}
                {ITEMS.filter((i) => !ALWAYS_FORBIDDEN.includes(i)).map((i) => (
                  <label key={i} className="chip cursor-pointer"><input id={`forbid-${i}`} type="checkbox" checked={agentForm.forbidden.includes(i)} onChange={() => toggle("forbidden", i)} /> {human(i)}</label>))}</div></fieldset>
            <button className="btn btn-primary justify-self-start" onClick={addAgent} disabled={!bizList?.length}>Issue Halo credential</button>
            {err && <p className="text-danger">{err}</p>}
            {issued && (
              <div className="rounded-xl bg-safe-bg p-3 text-safe">
                <div className="font-bold">Credential issued for {issued.agent.name}</div>
                <p className="text-xs">Your agent presents this signed credential on every contact. Keep it secret; you can revoke it any time.</p>
                <code className="mt-1 block break-all rounded bg-surface p-2 font-mono text-[11px] text-ink">{issued.credential}</code>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <h2 className="text-xl font-bold">Registered businesses</h2>
        {(bizList ?? []).map((b) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div><div className="text-lg font-bold">{b.name}</div><div className="text-sm text-muted">{b.domain} · callback {b.official_callback}</div></div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {[["Verified contacts", b.stats.verified_contacts], ["Live checks passed", b.stats.live_verifications], ["Contract breaks", b.stats.contract_violations], ["Impostors flagged", b.stats.impersonation_attempts_blocked]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-sunk p-2"><dt className="text-xs text-muted">{l}</dt><dd className="text-2xl font-bold tnum">{v}</dd></div>
              ))}
            </dl>
            <ul className="mt-3 flex flex-col gap-2">
              {b.agents.map((a: any) => (
                <li key={a.id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{a.name}</span>
                    <span className="flex items-center gap-2"><Pill tone={a.status === "active" ? "safe" : "danger"}>{a.status}</Pill>
                      {a.status === "active" && <button className="text-xs font-bold text-danger underline" onClick={() => api.post(`/v1/businesses/${b.id}/agents/${a.id}/revoke`).then(reload)}>Revoke</button>}</span>
                  </div>
                  <div className="text-muted">{a.contract.purpose} · {a.phone_numbers.join(", ")}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{a.contract.forbidden_requests.map((f: string) => <Pill key={f} tone="muted">never {human(f)}</Pill>)}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted">credential fingerprint {a.credential_fingerprint}</div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
