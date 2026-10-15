import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useStream } from '../lib/stream';
import type { InboundSession, PersonalAction, PersonalAgent } from '../lib/types';
import { Button, Card, Chip, RiskMeter, SourceTag, VerdictChip, VerifyBanner, cx, dateTime, money, timeAgo, useToast, ITEM_LABEL, TACTIC_LABEL } from '../lib/appbits';

type Tab = 'home' | 'calls' | 'agents' | 'privacy';

export function ConsumerApp() {
  const [tab, setTab] = useState<Tab>('home');
  return (
    <div className="flex justify-center px-4 py-6">
      <div className="w-full max-w-[420px]">
        {/* phone frame */}
        <div className="relative overflow-hidden rounded-[2.2rem] border-[6px] border-ink-800 bg-sand-50 shadow-2xl dark:border-ink-700 dark:bg-ink-900" style={{ height: 'min(80vh, 820px)' }}>
          <div className="absolute left-1/2 top-0 z-20 h-5 w-32 -translate-x-1/2 rounded-b-2xl bg-ink-800 dark:bg-ink-700" />
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-8">
              {tab === 'home' && <Home onGoCalls={() => setTab('calls')} />}
              {tab === 'calls' && <Calls />}
              {tab === 'agents' && <Agents />}
              {tab === 'privacy' && <Privacy />}
            </div>
            <TabBar tab={tab} setTab={setTab} />
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-ink-400">Trigger live calls and agent actions from the <strong>Demo panel</strong> tab above.</p>
      </div>
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'home', label: 'Home', icon: '◎' }, { id: 'calls', label: 'Calls', icon: '☎' },
    { id: 'agents', label: 'My agents', icon: '⚙' }, { id: 'privacy', label: 'Privacy', icon: '🔒' },
  ];
  return (
    <div className="grid grid-cols-4 border-t border-sand-200 bg-sand-50 dark:border-ink-800 dark:bg-ink-900">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)} className={cx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', tab === t.id ? 'text-halo-600 dark:text-halo-300' : 'text-ink-400')}>
          <span className="text-base leading-none">{t.icon}</span>{t.label}
        </button>
      ))}
    </div>
  );
}

function Home({ onGoCalls }: { onGoCalls: () => void }) {
  const [actions, setActions] = useState<PersonalAction[]>([]);
  const [campaigns, setCampaigns] = useState(0);
  const load = () => { api.actions('user_primary', 6).then(setActions).catch(() => {}); api.campaigns().then((c) => setCampaigns(c.length)).catch(() => {}); };
  useEffect(() => { load(); }, []);
  useStream(['personal.action', 'inbound.new', 'campaign', 'demo.reset'], load);

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center py-4 text-center">
        <div className="relative mb-3 flex h-20 w-20 items-center justify-center">
          <span className="halo-ring absolute inset-0 rounded-full border-2 border-halo-400" />
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-halo-600 text-white">
            <span className="h-5 w-5 rounded-full bg-halo-300" />
          </div>
        </div>
        <h1 className="text-lg font-bold">Halo is listening for you</h1>
        <p className="mt-1 text-sm text-ink-400">Guardian AI watching every call, message and agent action on your behalf.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Protected" value="24/7" />
        <Stat label="Campaigns blocked" value={String(campaigns)} />
        <Stat label="Your agents" value="guarded" small />
      </div>

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold">Recent activity</h2>
          <button onClick={onGoCalls} className="text-xs font-semibold text-halo-600 dark:text-halo-300">See calls →</button>
        </div>
        {actions.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-400">Nothing yet. Start a scenario from the Demo panel.</p>
        ) : (
          <div className="space-y-1.5">
            {actions.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <VerdictChip v={a.status} />
                <span className="truncate text-ink-600 dark:text-ink-200">{a.tool.replace(/_/g, ' ')}{a.amount != null ? ` · ${money(a.amount)}` : ''}</span>
                <span className="ml-auto shrink-0 text-[11px] text-ink-400">{timeAgo(a.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex items-center gap-3 p-4">
        <span className="text-xl">🛡️</span>
        <p className="text-xs text-ink-500 dark:text-ink-300">Halo runs its own guardian models on Halo's servers. Your conversations never go to an outside AI company.</p>
      </Card>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <Card className="p-2.5 text-center">
      <div className={cx('font-bold text-halo-600 dark:text-halo-300', small ? 'text-sm' : 'text-lg')}>{value}</div>
      <div className="text-[10px] text-ink-400">{label}</div>
    </Card>
  );
}

function Calls() {
  const [session, setSession] = useState<InboundSession | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [interro, setInterro] = useState<{ questions: string[]; verdict: string; note: string } | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const toast = useToast();
  const feedRef = useRef<HTMLDivElement>(null);

  // Track the latest inbound session for this person (ignore other users' background traffic).
  useEffect(() => { api.inboundList().then((list) => { const mine = list.find((s) => s.userId === 'user_primary'); if (mine) { setSessionId(mine.id); setSession(mine); } }).catch(() => {}); }, []);
  useStream(['inbound.new'], (e) => { if (e.data.userId && e.data.userId !== 'user_primary') return; setSessionId(e.data.id); setSession(e.data); setInterro(null); setVerifyMsg(null); });
  useStream(['inbound.line', 'inbound.update'], (e) => {
    const sid = e.data.sessionId ?? e.data.id;
    if (sid && sid === sessionId) api.inbound(sid).then(setSession).catch(() => {});
  });
  useStream(['demo.reset'], () => { setSession(null); setSessionId(null); });
  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' }); }, [session?.lines.length]);

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sand-200 text-2xl dark:bg-ink-800">☎</div>
        <p className="text-sm text-ink-400">No active call.<br />Start an inbound scenario from the Demo panel.</p>
      </div>
    );
  }

  const verify = async () => {
    try {
      const r = await api.verify({ claimedBusiness: session.claimedBusiness ?? '' });
      setVerifyMsg(r.reason);
      toast(r.state === 'verified' ? 'Caller verified ✓' : 'Could not verify this caller', r.state === 'verified' ? 'success' : 'error');
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  const letHaloAnswer = async () => {
    try { const r = await api.interrogate(session.id); setInterro(r); toast(`Halo's verdict: ${r.verdict}`, r.verdict === 'verified' ? 'success' : 'error'); api.inbound(session.id).then(setSession); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  const report = async () => {
    try { const r = await api.report(session.id); toast(r.protectedUser ? `Reported. ${r.protectedUser} is now protected too.` : 'Reported to shared intelligence.', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <VerifyBanner state={session.verifyState} business={session.claimedBusiness} big />
      <Card className="p-3"><RiskMeter risk={session.risk} band={session.band} big /></Card>

      {session.verifyState === 'verified' && session.verifyCode && (
        <div className="flex items-center justify-between rounded-xl border border-safe/30 bg-safe-soft px-3 py-2 text-sm">
          <span className="text-ink-500 dark:text-ink-300">Two-way code</span>
          <span className="tabular text-lg font-bold tracking-widest text-safe">{session.verifyCode}</span>
        </div>
      )}

      <div ref={feedRef} className="flex-1 space-y-2 overflow-y-auto rounded-xl bg-sand-100/60 p-2 dark:bg-ink-850/60">
        {session.lines.map((l, i) => {
          const pl = l.speaker === 'agent' ? session.perLine[session.lines.slice(0, i + 1).filter((x) => x.speaker === 'agent').length - 1] : null;
          return <LineView key={i} speaker={l.speaker} text={l.text} pl={pl} />;
        })}
      </div>

      {interro && (
        <Card className="border-halo-500/40 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-halo-600 dark:text-halo-300">Halo answered · verdict: {interro.verdict}</div>
          <p className="text-xs text-ink-500 dark:text-ink-300">{interro.note}</p>
        </Card>
      )}
      {verifyMsg && <p className="rounded-lg bg-sand-100 px-2 py-1 text-[11px] text-ink-500 dark:bg-ink-800 dark:text-ink-300">{verifyMsg}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="default" size="sm" onClick={verify}>Verify this caller</Button>
        <Button variant="primary" size="sm" onClick={letHaloAnswer}>Let Halo answer</Button>
        <Button variant="danger" size="sm" className="col-span-2" onClick={report}>Report this caller</Button>
      </div>
    </div>
  );
}

function LineView({ speaker, text, pl }: { speaker: string; text: string; pl: any }) {
  if (speaker === 'halo') return <div className="rounded-xl border border-halo-500/40 bg-halo-500/10 px-3 py-2 text-sm text-halo-700 dark:text-halo-200"><span className="text-[10px] font-bold uppercase">Halo</span><br />{text}</div>;
  const mine = speaker === 'user';
  const flags = pl ? [...Object.keys(pl.fast.tactics), ...Object.keys(pl.fast.items)] : [];
  const blocked = pl?.guardrails?.some((g: any) => g.severity === 'block');
  return (
    <div className={cx('max-w-[88%]', mine ? 'ml-auto' : '')}>
      <div className={cx('rounded-2xl px-3 py-2 text-sm', mine ? 'bg-halo-600 text-white' : blocked ? 'border border-danger/40 bg-danger-soft' : 'bg-white dark:bg-ink-800')}>{text}</div>
      {!mine && (flags.length > 0 || blocked) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {blocked && <Chip tone="danger">⛔ blocked by Halo</Chip>}
          {Object.keys(pl.fast.items).map((it) => <Chip key={it} tone="danger">{ITEM_LABEL[it] ?? it}</Chip>)}
          {Object.keys(pl.fast.tactics).map((t) => <Chip key={t} tone="caution">{TACTIC_LABEL[t] ?? t}</Chip>)}
          {pl?.fast?.source && <SourceTag source={pl.fast.source} />}
        </div>
      )}
    </div>
  );
}

function Agents() {
  const [agents, setAgents] = useState<PersonalAgent[]>([]);
  const [approvals, setApprovals] = useState<PersonalAction[]>([]);
  const [actions, setActions] = useState<PersonalAction[]>([]);
  const toast = useToast();
  const load = () => {
    api.personalAgents().then(setAgents).catch(() => {});
    api.approvals().then(setApprovals).catch(() => {});
    api.actions('user_primary', 30).then(setActions).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useStream(['personal.action', 'personal.update', 'agent.update', 'demo.reset'], load);

  const resolve = async (a: PersonalAction, d: 'approve' | 'reject') => { try { await api.resolveApproval(a.id, d); toast(d === 'approve' ? 'Approved' : 'Rejected'); load(); } catch (e) { toast((e as Error).message, 'error'); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">My AI agents</h1>
        <Button variant="danger" size="sm" onClick={async () => { await api.pauseAll(); toast('All your agents paused'); load(); }}>Pause all</Button>
      </div>

      {approvals.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-caution">Needs your ok ({approvals.length})</h2>
          {approvals.map((a) => (
            <Card key={a.id} className="border-caution/40 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">{a.tool.replace(/_/g, ' ')}{a.amount != null ? ` · ${money(a.amount)}` : ''}</div>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">{a.reason}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="danger" size="sm" className="flex-1" onClick={() => resolve(a, 'reject')}>Reject</Button>
                <Button variant="safe" size="sm" className="flex-1" onClick={() => resolve(a, 'approve')}>Approve</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {agents.map((a) => (
          <Card key={a.id} className="flex items-center gap-3 p-3">
            <div className={cx('h-2.5 w-2.5 rounded-full', a.status === 'active' ? 'bg-safe' : 'bg-danger')} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{a.name}</div>
              <div className="truncate text-[11px] text-ink-400">{a.model} · autonomy: {a.autonomy}</div>
            </div>
            <Chip tone={a.status === 'active' ? 'safe' : 'danger'}>{a.status}</Chip>
            {a.status === 'active' && <button onClick={async () => { await api.revokeAgent(a.id); toast('Agent revoked'); load(); }} className="text-[11px] font-semibold text-danger">Revoke</button>}
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-400">Timeline</h2>
        <div className="space-y-1">
          {actions.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg px-1 py-1 text-xs">
              <VerdictChip v={a.status} />
              <span className="truncate text-ink-600 dark:text-ink-200">{a.tool.replace(/_/g, ' ')}{a.amount != null ? ` ${money(a.amount)}` : ''}</span>
              {a.evidenceId && <span title="evidence preserved">📎</span>}
              <span className="ml-auto shrink-0 text-ink-400">{timeAgo(a.ts)}</span>
            </div>
          ))}
          {actions.length === 0 && <p className="py-3 text-center text-sm text-ink-400">No agent actions yet.</p>}
        </div>
      </div>
    </div>
  );
}

function Privacy() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.myData().then(setData).catch(() => {}); }, []);
  if (!data) return null;
  return (
    <div className="space-y-3">
      <h1 className="text-base font-bold">Your data</h1>
      <Card className="p-3"><p className="text-xs leading-relaxed text-ink-500 dark:text-ink-300">{data.note}</p></Card>
      <Card className="p-3">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">Retention</h2>
        <p className="text-xs text-ink-500 dark:text-ink-300">{data.retention}</p>
      </Card>
      <Card className="p-3">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">Shared with the network</h2>
        <p className="text-xs text-ink-500 dark:text-ink-300">{data.reportsShared}</p>
      </Card>
      <Card className="p-3">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">Your agents ({data.personalAgents.length})</h2>
        {data.personalAgents.map((a: any) => <div key={a.id} className="flex justify-between text-xs"><span>{a.name}</span><span className="text-ink-400">{a.status}</span></div>)}
      </Card>
      <Card className="p-3">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">Recent actions kept ({data.recentActions.length})</h2>
        <p className="text-[11px] text-ink-400">Transcripts are kept only for the session unless you save them. Halo never sells your data.</p>
      </Card>
    </div>
  );
}
