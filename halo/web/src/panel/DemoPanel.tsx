import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useStream } from '../lib/stream';
import type { ActivityEvent, RedTeamResult, VerifyResult } from '../lib/types';
import { Button, Card, Chip, cx, clockTime, dateTime, useToast } from '../lib/appbits';

type Panel = 'scenarios' | 'redteam' | 'activity' | 'evals' | 'why';

export function DemoPanel({ onOpenConsumer }: { onOpenConsumer: () => void }) {
  const [panel, setPanel] = useState<Panel>('scenarios');
  const toast = useToast();
  const tabs: Array<{ id: Panel; label: string }> = [
    { id: 'scenarios', label: 'Scenarios' }, { id: 'redteam', label: 'Red Team' },
    { id: 'activity', label: 'Activity & integrity' }, { id: 'evals', label: 'Model evals' }, { id: 'why', label: 'Why Halo' },
  ];
  return (
    <div className="mx-auto max-w-5xl px-5 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Demo control panel</h1>
          <p className="text-sm text-ink-400">Trigger live scenarios, run the Red Team, and inspect Halo's tamper-evident record.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={async () => { await api.resetDemo(); toast('Demo reset', 'success'); }}>↻ Reset demo</Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-sand-200 p-1 dark:border-ink-800">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setPanel(t.id)} className={cx('rounded-lg px-3 py-1.5 text-sm font-semibold', panel === t.id ? 'bg-halo-600 text-white' : 'text-ink-500 hover:bg-sand-100 dark:text-ink-300 dark:hover:bg-ink-800')}>{t.label}</button>
        ))}
      </div>

      {panel === 'scenarios' && <Scenarios onOpenConsumer={onOpenConsumer} />}
      {panel === 'redteam' && <RedTeam />}
      {panel === 'activity' && <Activity />}
      {panel === 'evals' && <Evals />}
      {panel === 'why' && <WhyHalo />}
    </div>
  );
}

function Scenarios({ onOpenConsumer }: { onOpenConsumer: () => void }) {
  const [cat, setCat] = useState<{ inbound: any[]; outbound: any[] }>({ inbound: [], outbound: [] });
  const [running, setRunning] = useState<string | null>(null);
  const [outResult, setOutResult] = useState<Record<string, any[]>>({});
  const toast = useToast();
  useEffect(() => { api.scenarios().then(setCat).catch(() => {}); }, []);

  const runInbound = async (id: string) => {
    setRunning(id); onOpenConsumer();
    try { await api.runInbound(id); toast('Scenario ran — see the Consumer app', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setRunning(null); }
  };
  const runOutbound = async (id: string) => {
    setRunning(id);
    try { const r = await api.runOutbound(id); setOutResult((s) => ({ ...s, [id]: r.steps })); toast('Agent actions reviewed by Steward', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setRunning(null); }
  };
  const runSwarm = async () => {
    setRunning('swarm');
    try { const r = await api.runSwarm(); toast(`Swarm grouped into ${r.campaigns.length} campaign(s)`, 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setRunning(null); }
  };

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-400">Inbound — agents contacting you</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cat.inbound.map((s) => (
            <Card key={s.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{s.title}</h3>
                <Button variant="primary" size="sm" disabled={running === s.id} onClick={() => runInbound(s.id)}>{running === s.id ? 'Running…' : 'Run'}</Button>
              </div>
              <p className="mt-1 text-xs text-ink-400">{s.summary}</p>
              <ul className="mt-2 space-y-0.5">{s.expected.map((e: string, i: number) => <li key={i} className="flex gap-1.5 text-[11px] text-ink-500 dark:text-ink-300"><span className="text-safe">✓</span>{e}</li>)}</ul>
            </Card>
          ))}
          <Card className="flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">Swarm campaign</h3>
              <Button variant="primary" size="sm" disabled={running === 'swarm'} onClick={runSwarm}>{running === 'swarm' ? 'Running…' : 'Run'}</Button>
            </div>
            <p className="mt-1 text-xs text-ink-400">Five different "bank" callers hit several users within minutes using the same tactics. The Swarm Detector groups them into one campaign.</p>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-400">Outbound — your own agent acting for you</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cat.outbound.map((s) => (
            <Card key={s.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{s.title}</h3>
                <Button variant="primary" size="sm" disabled={running === s.id} onClick={() => runOutbound(s.id)}>{running === s.id ? 'Running…' : 'Run'}</Button>
              </div>
              <p className="mt-1 text-xs text-ink-400">{s.summary}</p>
              <p className="mt-1 text-[11px] italic text-ink-400">You asked: “{s.userRequest}”</p>
              {outResult[s.id] && (
                <div className="mt-2 space-y-1 border-t border-sand-200 pt-2 dark:border-ink-800">
                  {outResult[s.id].map((st: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{st.label}</span>
                      <Chip tone={st.action?.verdict === 'block' || st.action?.status === 'blocked' ? 'danger' : st.action?.status === 'pending' ? 'caution' : 'safe'}>
                        {st.action?.status ?? st.action?.verdict ?? '—'}
                      </Chip>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function RedTeam() {
  const [result, setResult] = useState<RedTeamResult | null>(null);
  const [running, setRunning] = useState(false);
  const toast = useToast();
  useEffect(() => { api.redteamLatest().then((r) => r && setResult(r)).catch(() => {}); }, []);
  useStream(['redteam'], (e) => setResult(e.data));

  const run = async () => { setRunning(true); try { setResult(await api.redteamRun(10)); } catch (e) { toast((e as Error).message, 'error'); } finally { setRunning(false); } };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-bold">Red Team — adversarial testing</h2>
          <p className="text-sm text-ink-400">Generates fresh scam & injection attempts (open model, defensive only) and scores whether Halo catches each. Misses go to the data-review queue to become training examples after human review.</p>
        </div>
        <Button variant="primary" onClick={run} disabled={running}>{running ? 'Running round…' : 'Run attack round'}</Button>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <ScoreCard label="Attacks" value={result.total} />
            <ScoreCard label="Caught" value={result.caught} tone="safe" />
            <ScoreCard label="Missed" value={result.missed.length} tone={result.missed.length ? 'danger' : 'safe'} />
          </div>
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-bold">By attack type</h3>
            <div className="space-y-1.5">
              {Object.entries(result.byKind).map(([kind, v]) => (
                <div key={kind} className="flex items-center gap-2 text-sm">
                  <span className="w-32 shrink-0 font-mono text-xs">{kind}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-200 dark:bg-ink-800">
                    <div className="h-full rounded-full bg-safe" style={{ width: `${(v.caught / v.total) * 100}%` }} />
                  </div>
                  <span className="tabular w-10 text-right text-xs">{v.caught}/{v.total}</span>
                </div>
              ))}
            </div>
          </Card>
          {result.missed.length > 0 && (
            <Card className="border-danger/40 p-4">
              <h3 className="mb-2 text-sm font-bold text-danger">Data review queue — attacks that slipped through ({result.missed.length})</h3>
              <p className="mb-2 text-[11px] text-ink-400">These become new training examples after the founder approves them.</p>
              <div className="space-y-2">
                {result.missed.map((m, i) => (
                  <div key={i} className="rounded-lg border border-sand-200 p-2 text-xs dark:border-ink-800">
                    <div className="flex items-center gap-2"><Chip tone="danger">{m.kind}</Chip><span className="text-ink-400">final risk {m.finalRisk}</span></div>
                    <div className="mt-1 text-ink-500 dark:text-ink-300">{m.lines.join(' / ')}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ScoreCard({ label, value, tone }: { label: string; value: number; tone?: 'safe' | 'danger' }) {
  return (
    <Card className="p-4 text-center">
      <div className={cx('text-3xl font-bold tabular', tone === 'safe' ? 'text-safe' : tone === 'danger' ? 'text-danger' : 'text-halo-600 dark:text-halo-300')}>{value}</div>
      <div className="text-xs text-ink-400">{label}</div>
    </Card>
  );
}

function Activity() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [q, setQ] = useState('');
  const toast = useToast();
  const load = () => api.activity({ q, limit: 120 }).then((r) => setEvents(r.events)).catch(() => {});
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);
  useStream(['activity', 'personal.action', 'inbound.line', 'demo.reset'], () => { if (!q) load(); });

  const runVerify = async () => { const r = await api.verifyActivity(); setVerify(r); toast(r.ok ? `Chain intact — ${r.count} events` : `Tampering at event #${r.brokenAt}`, r.ok ? 'success' : 'error'); };
  const tamper = async () => { try { const r = await api.tamper(); toast(`Edited row #${r.tamperedSeq} in SQLite`); setVerify(null); load(); } catch (e) { toast((e as Error).message, 'error'); } };

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex-1">
          <h2 className="font-bold">Tamper-evident activity log</h2>
          <p className="text-sm text-ink-400">Halo keeps its own hash-chained record (SHA-256) — it never trusts agent-supplied logs. Editing any row breaks the chain.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={tamper}>Simulate tampering</Button>
        <Button variant="primary" size="sm" onClick={runVerify}>Verify integrity</Button>
      </Card>

      {verify && (
        <Card className={cx('border-2 p-4', verify.ok ? 'border-safe/50 bg-safe-soft' : 'border-danger/60 bg-danger-soft')}>
          <div className={cx('font-bold', verify.ok ? 'text-safe' : 'text-danger')}>
            {verify.ok ? `✓ Chain intact — ${verify.count} events verified` : `✗ Tampering detected at event #${verify.brokenAt}`}
          </div>
          {!verify.ok && <div className="text-xs text-ink-500 dark:text-ink-300">{verify.reason}</div>}
        </Card>
      )}

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the activity log…" className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm outline-none focus:border-halo-500 dark:border-ink-800 dark:bg-ink-900" />

      <Card className="max-h-[32rem] overflow-y-auto">
        {events.map((e) => {
          const broken = verify && !verify.ok && verify.brokenAt === e.seq;
          return (
            <div key={e.seq} className={cx('flex items-start gap-3 border-b border-sand-100 px-3 py-2 text-xs last:border-0 dark:border-ink-850', broken && 'bg-danger-soft')}>
              <span className="tabular w-10 shrink-0 text-ink-400">#{e.seq}</span>
              <span className="tabular w-14 shrink-0 text-ink-400">{clockTime(e.ts)}</span>
              <code className="shrink-0 rounded bg-sand-100 px-1 text-[10px] text-ink-500 dark:bg-ink-800 dark:text-ink-300">{e.type}</code>
              <span className="min-w-0 flex-1">{e.summary}</span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function Evals() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.evals().then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h2 className="font-bold">Guardian model evals</h2>
        <p className="text-sm text-ink-400">Each fine-tuned model vs. its untuned base model on the held-out test set.</p>
      </Card>
      {!data.available ? (
        <Card className="p-4">
          <p className="text-sm text-ink-500 dark:text-ink-300">{data.note}</p>
          <p className="mt-2 text-xs text-ink-400">The app currently runs on the built-in <strong>rules engine</strong> (and base open models when the ML service is up), so every scenario works now. Fine-tuned numbers appear here after <code className="font-mono">make models</code> + <code className="font-mono">make eval</code>.</p>
        </Card>
      ) : (
        <Card className="p-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase text-ink-400"><th className="py-1">Model</th><th>Base acc</th><th>Fine-tuned acc</th><th>Δ</th><th>Latency</th></tr></thead>
            <tbody>
              {(data.models ?? []).map((m: any) => (
                <tr key={m.name} className="border-t border-sand-100 dark:border-ink-850">
                  <td className="py-1.5 font-medium">{m.name}</td>
                  <td className="tabular">{m.baseAccuracy}</td>
                  <td className="tabular font-semibold text-safe">{m.finetunedAccuracy}</td>
                  <td className="tabular text-halo-600 dark:text-halo-300">+{m.delta}</td>
                  <td className="tabular text-ink-400">{m.latencyMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const COMPETITORS = [
  { name: 'Google fake-call detection', them: 'Confirms a saved contact’s call comes from their phone.', us: 'Verifies businesses’ AI agents on every channel and judges what the caller is trying to do.' },
  { name: 'Pindrop BotStopper', them: 'Detects AI callers for enterprises.', us: 'Serves consumers, says which agent it is and who’s behind it, and actively questions it.' },
  { name: 'Truecaller / Hiya / Norton / Aura', them: 'Warn about bad callers.', us: 'Also positively verifies good ones and catches new scams no blocklist has seen.' },
  { name: 'Allowance / agent-payment platforms', them: 'Control agent spending.', us: 'Plugs into them and checks whether any action matches your intent — not just money.' },
  { name: 'Bitdefender AI Guardian', them: 'Controls coding agents for technical users.', us: 'For everyday people and families, on mobile.' },
];

function WhyHalo() {
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h2 className="font-bold">Why Halo</h2>
        <p className="text-sm text-ink-500 dark:text-ink-300">Scammers now use AI that sounds human and adapts in real time, and your own agents can be tricked into overspending or leaking data. Halo fights AI with AI: guardian models that verify, question and stop agents on your behalf — running entirely on Halo’s own servers, with no closed AI provider ever seeing your conversations.</p>
      </Card>
      <div className="space-y-2">
        {COMPETITORS.map((c) => (
          <Card key={c.name} className="p-3">
            <div className="text-sm font-semibold">{c.name}</div>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-sand-100 p-2 text-xs text-ink-500 dark:bg-ink-850 dark:text-ink-300"><span className="font-semibold">Them:</span> {c.them}</div>
              <div className="rounded-lg bg-halo-500/10 p-2 text-xs text-halo-700 dark:text-halo-200"><span className="font-semibold">Halo:</span> {c.us}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
