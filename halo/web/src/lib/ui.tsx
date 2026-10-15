import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';

export function cx(...p: Array<string | false | null | undefined>) { return p.filter(Boolean).join(' '); }

export const TACTIC_LABEL: Record<string, string> = {
  urgency: 'Urgency', authority: 'Authority', fear: 'Fear', secrecy: 'Secrecy', isolation: 'Isolation', impersonation: 'Impersonation',
};
export const ITEM_LABEL: Record<string, string> = {
  one_time_code: 'One-time code', pin: 'PIN', password: 'Password', gift_card: 'Gift card', crypto: 'Crypto',
  wire_transfer: 'Wire transfer', remote_access: 'Remote access', personal_data: 'Personal data',
};

export const SOURCE_LABEL: Record<string, string> = { finetuned: 'fine-tuned', base: 'base model', heuristic: 'rules engine' };

export function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 2) return 'now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
export const clockTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const dateTime = (ts: number) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
export const money = (n: number | null | undefined) => (n == null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-sand-200 bg-white shadow-sm dark:border-ink-800 dark:bg-ink-900/70', className)}>{children}</div>;
}

export function Button({ children, variant = 'default', size = 'md', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'safe' | 'ghost'; size?: 'sm' | 'md' | 'lg' }) {
  const variants = {
    default: 'border border-sand-300 bg-white text-ink-700 hover:bg-sand-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
    primary: 'bg-halo-600 text-white hover:bg-halo-700 border border-transparent',
    safe: 'bg-safe text-white hover:brightness-95 border border-transparent',
    danger: 'bg-danger text-white hover:brightness-95 border border-transparent',
    ghost: 'text-ink-500 hover:bg-sand-100 dark:text-ink-400 dark:hover:bg-ink-800 border border-transparent',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm rounded-lg', md: 'px-4 py-2.5 text-sm rounded-xl', lg: 'px-5 py-3 text-base rounded-xl' };
  return <button className={cx('inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', sizes[size], variants[variant], className)} {...props}>{children}</button>;
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'safe' | 'caution' | 'danger' | 'halo' }) {
  const tones = {
    neutral: 'bg-sand-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300',
    safe: 'bg-safe-soft text-safe', caution: 'bg-caution-soft text-caution', danger: 'bg-danger-soft text-danger',
    halo: 'bg-halo-500/15 text-halo-700 dark:text-halo-300',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', tones[tone])}>{children}</span>;
}

const VERDICT: Record<string, { label: string; tone: 'safe' | 'caution' | 'danger' }> = {
  allow: { label: 'Allowed', tone: 'safe' }, allowed: { label: 'Allowed', tone: 'safe' }, approved: { label: 'Approved', tone: 'safe' },
  ask: { label: 'Needs you', tone: 'caution' }, pending: { label: 'Waiting for you', tone: 'caution' },
  block: { label: 'Blocked', tone: 'danger' }, blocked: { label: 'Blocked', tone: 'danger' }, rejected: { label: 'Rejected', tone: 'danger' },
};
export function VerdictChip({ v }: { v: string }) {
  const m = VERDICT[v] ?? { label: v, tone: 'neutral' as const };
  return <Chip tone={m.tone as any}>{m.label}</Chip>;
}

const ThemeCtx = createContext<{ dark: boolean; toggle: () => void }>({ dark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => localStorage.getItem('halo-theme') !== 'light');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('halo-theme', dark ? 'dark' : 'light'); }, [dark]);
  return <ThemeCtx.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>{children}</ThemeCtx.Provider>;
}

type Toast = { id: number; msg: string; tone: 'info' | 'error' | 'success' };
const ToastCtx = createContext<(msg: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (msg: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cx('max-w-sm rounded-xl border px-4 py-2.5 text-sm shadow-lg',
            t.tone === 'error' && 'border-danger/40 bg-danger-soft text-danger',
            t.tone === 'success' && 'border-safe/40 bg-safe-soft text-safe',
            t.tone === 'info' && 'border-sand-300 bg-white text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100')}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
