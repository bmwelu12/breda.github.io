import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Api } from "./api.ts";

export const ApiCtx = createContext<Api>(null as any);
export const useApi = () => useContext(ApiCtx);

/** Fetch a path and refetch whenever the engine emits an event (debounced). */
export function useLive<T = any>(path: string | null, filter?: (e: any) => boolean): [T | undefined, () => void] {
  const api = useApi();
  const [data, setData] = useState<T>();
  const timer = useRef<any>();
  const load = () => { if (path) api.get<T>(path).then(setData).catch(() => {}); };
  useEffect(() => {
    load();
    const off = api.subscribe((e) => {
      if (filter && !filter(e)) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 120);
    });
    return () => { off(); clearTimeout(timer.current); };
  }, [path]);
  return [data, load];
}

export function useEvents(fn: (e: any) => void, deps: any[] = []) {
  const api = useApi();
  useEffect(() => api.subscribe(fn), deps);
}

// ---------- state presentation: always icon + words + color ----------
export const STATE = {
  verified: { tone: "safe", icon: "✓", title: "Verified" },
  unverified: { tone: "warn", icon: "?", title: "Not verified" },
  impersonating: { tone: "danger", icon: "!", title: "Impostor" },
} as const;

const toneCls = {
  safe: "bg-safe-bg text-safe border-safe/40",
  warn: "bg-warn-bg text-warn border-warn/40",
  danger: "bg-danger-bg text-danger border-danger/40",
};

export function StateBanner({ state, label, big = false }: { state: keyof typeof STATE; label: string; big?: boolean }) {
  const s = STATE[state];
  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-3 rounded-2xl border ${toneCls[s.tone]} ${big ? "p-4" : "px-3 py-2"}`}>
      <span aria-hidden className={`grid shrink-0 place-items-center rounded-full border-2 border-current font-bold ${big ? "h-10 w-10 text-xl" : "h-6 w-6 text-sm"}`}>{s.icon}</span>
      <div className="min-w-0">
        <div className={`font-bold leading-tight ${big ? "text-lg" : "text-sm"}`}>{label}</div>
        {big && <div className="text-sm opacity-80">{s.title}</div>}
      </div>
    </div>
  );
}

export function RiskMeter({ risk }: { risk: number }) {
  const tone = risk >= 75 ? "danger" : risk >= 45 ? "warn" : "safe";
  const word = risk >= 75 ? "High risk" : risk >= 45 ? "Be careful" : "Low risk";
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="eyebrow">Risk</span>
        <span className={`font-bold text-${tone} tnum`}>{word} · {risk}</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full bg-sunk" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={risk} aria-label="Risk">
        <div className={`h-full rounded-full bg-${tone} transition-all duration-700`} style={{ width: `${Math.max(4, risk)}%` }} />
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</div>;
}

export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function Pill({ tone, children }: { tone: "safe" | "warn" | "danger" | "muted"; children: ReactNode }) {
  const c = tone === "muted" ? "border-line text-muted" : toneCls[tone];
  return <span className={`chip ${c}`}>{children}</span>;
}

export function decisionTone(d: string): "safe" | "warn" | "danger" | "muted" {
  return d === "allow" || d === "executed" || d === "approved" ? "safe" : d === "ask" || d === "pending" ? "warn" : d === "block" || d === "blocked" || d === "denied" ? "danger" : "muted";
}

export const human = (s: string) => s.replace(/_/g, " ");
