// Shared app widgets, re-exporting the primitives so surfaces import from one place.
export * from './ui';
import { useStreamStatus } from './stream';
import { cx } from './ui';
import type { RiskBand, VerifyState } from './types';

export function useStreamStatusBadge() {
  const c = useStreamStatus();
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium', c ? 'text-safe' : 'text-ink-400')}>
      <span className={cx('h-1.5 w-1.5 rounded-full', c ? 'bg-safe pulse-dot' : 'bg-ink-400')} />
      {c ? 'Halo live' : 'offline'}
    </span>
  );
}

export const BAND_META: Record<RiskBand, { label: string; tone: string; color: string }> = {
  low: { label: 'Looks fine', tone: 'text-safe', color: 'var(--color-safe)' },
  guarded: { label: 'Stay alert', tone: 'text-caution', color: 'var(--color-caution)' },
  elevated: { label: 'Likely a scam', tone: 'text-danger', color: 'var(--color-danger)' },
  high: { label: 'Stop — scam', tone: 'text-danger', color: 'var(--color-danger)' },
};

export function RiskMeter({ risk, band, big }: { risk: number; band: RiskBand; big?: boolean }) {
  const meta = BAND_META[band];
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className={cx('font-semibold', meta.tone, big ? 'text-base' : 'text-sm')}>{meta.label}</span>
        <span className={cx('tabular font-bold', meta.tone, big ? 'text-xl' : 'text-sm')}>{risk}</span>
      </div>
      <div className={cx('w-full overflow-hidden rounded-full bg-sand-200 dark:bg-ink-800', big ? 'h-3' : 'h-2')}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${risk}%`, background: meta.color }} />
      </div>
    </div>
  );
}

export const VERIFY_META: Record<VerifyState, { label: (b: string | null) => string; tone: string; icon: string; bg: string }> = {
  verified: { label: (b) => `Verified agent${b ? ` from ${b}` : ''}`, tone: 'text-safe', icon: '✓', bg: 'border-safe/40 bg-safe-soft' },
  unverified: { label: () => 'AI caller — not verified', tone: 'text-caution', icon: '?', bg: 'border-caution/40 bg-caution-soft' },
  impersonation: { label: (b) => `Pretending to be ${b ?? 'a business'}`, tone: 'text-danger', icon: '!', bg: 'border-danger/50 bg-danger-soft' },
};

export function VerifyBanner({ state, business, big }: { state: VerifyState; business: string | null; big?: boolean }) {
  const m = VERIFY_META[state];
  return (
    <div className={cx('flex items-center gap-3 rounded-2xl border px-4 py-3', m.bg)}>
      <span className={cx('flex items-center justify-center rounded-full font-bold', m.tone, big ? 'h-10 w-10 text-xl' : 'h-8 w-8 text-base',
        state === 'verified' ? 'bg-safe/15' : state === 'unverified' ? 'bg-caution/15' : 'bg-danger/15')}>{m.icon}</span>
      <div>
        <div className={cx('font-bold', m.tone, big ? 'text-lg' : 'text-sm')}>{m.label(business)}</div>
        <div className="text-[11px] text-ink-400">
          {state === 'verified' ? 'Identity confirmed on Halo' : state === 'unverified' ? 'No verified identity on file' : 'No matching verified agent — treat as a scam'}
        </div>
      </div>
    </div>
  );
}

export function SourceTag({ source }: { source: string }) {
  const label = { finetuned: 'fine-tuned', base: 'base model', heuristic: 'rules engine' }[source] ?? source;
  return <span className="rounded bg-sand-100 px-1 py-0.5 font-mono text-[9px] text-ink-400 dark:bg-ink-800">{label}</span>;
}
