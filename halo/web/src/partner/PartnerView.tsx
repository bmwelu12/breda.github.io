import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useStream } from '../lib/stream';
import type { InboundSession } from '../lib/types';
import { Button, RiskMeter, VerifyBanner, cx, useToast } from '../lib/appbits';

/**
 * Northshore Bank partner view — Halo embedded via white-label SDK inside a fictional bank app.
 * The bank keeps its chrome; Halo provides the "is this caller really us?" protection panel.
 */
export function PartnerView() {
  const [session, setSession] = useState<InboundSession | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => { api.inboundList().then((l) => { const s = l.find((x) => x.claimedBusiness === 'Northshore Bank') ?? l[0]; if (s) { setSessionId(s.id); setSession(s); } }).catch(() => {}); }, []);
  useStream(['inbound.new'], (e) => { setSessionId(e.data.id); setSession(e.data); });
  useStream(['inbound.line', 'inbound.update'], (e) => { const sid = e.data.sessionId ?? e.data.id; if (sid === sessionId) api.inbound(sid).then(setSession).catch(() => {}); });
  useStream(['demo.reset'], () => { setSession(null); setSessionId(null); });

  return (
    <div className="min-h-full bg-[#0b2a4a] px-4 py-8 dark:bg-[#07192e]">
      <div className="mx-auto max-w-md">
        {/* Bank chrome */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-ink-900">
          <div className="flex items-center justify-between bg-[#0b2a4a] px-5 py-4 text-white dark:bg-[#0a2033]">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 font-bold">N</div>
              <div>
                <div className="text-sm font-bold leading-none">Northshore Bank</div>
                <div className="text-[10px] text-white/60">Mobile banking</div>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-halo-300" /> Protected by Halo
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-2xl bg-sand-100 p-4 dark:bg-ink-850">
              <div className="text-xs text-ink-400">Available balance</div>
              <div className="text-2xl font-bold">$4,820.55</div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-bold">Caller check</span>
                <span className="rounded-full bg-halo-500/15 px-2 py-0.5 text-[10px] font-semibold text-halo-700 dark:text-halo-300">Halo SDK</span>
              </div>
              {!session ? (
                <div className="rounded-2xl border border-dashed border-sand-300 p-5 text-center text-sm text-ink-400 dark:border-ink-700">
                  No active caller. Start the “Fake bank agent” or “Real bank agent” scenario from the Demo panel to see Halo verify a caller inside the bank app.
                </div>
              ) : (
                <div className="space-y-3">
                  <VerifyBanner state={session.verifyState} business={session.claimedBusiness} />
                  <RiskMeter risk={session.risk} band={session.band} />
                  {session.verifyState === 'impersonation' && (
                    <div className="rounded-xl border border-danger/40 bg-danger-soft p-3 text-xs text-danger">
                      <strong>Northshore will never call to ask for a one-time code, PIN or password.</strong> Hang up and call the number on the back of your card.
                    </div>
                  )}
                  {session.verifyState === 'verified' && session.verifyCode && (
                    <div className="flex items-center justify-between rounded-xl border border-safe/30 bg-safe-soft px-3 py-2 text-sm">
                      <span className="text-ink-500 dark:text-ink-300">Confirm this code with the agent</span>
                      <span className="tabular text-lg font-bold tracking-widest text-safe">{session.verifyCode}</span>
                    </div>
                  )}
                  <div className="max-h-40 space-y-1.5 overflow-y-auto">
                    {session.lines.filter((l) => l.speaker === 'agent').slice(-4).map((l, i) => (
                      <div key={i} className="rounded-lg bg-sand-100 px-2.5 py-1.5 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-200">{l.text}</div>
                    ))}
                  </div>
                  <Button variant="primary" size="sm" className="w-full" onClick={async () => { const r = await api.report(session.id); toast(r.protectedUser ? 'Reported — other customers protected' : 'Reported', 'success'); }}>Report to Northshore fraud team</Button>
                </div>
              )}
            </div>

            <p className="text-center text-[10px] text-ink-400">Halo runs on the bank's infrastructure. Customer calls never leave Northshore.</p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-white/60">White-label partner embed · fictional bank for demo</p>
      </div>
    </div>
  );
}
