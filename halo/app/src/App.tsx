import { useEffect, useState } from "react";
import type { Api } from "./api.ts";
import { BusinessPortal } from "./Business.tsx";
import { Console } from "./Console.tsx";
import { PhoneApp } from "./Consumer.tsx";
import { PartnerView } from "./Partner.tsx";
import { ApiCtx, useLive } from "./ui.tsx";

const VIEWS = [["demo", "Live demo"], ["business", "Business portal"], ["partner", "Northshore Bank"]] as const;
type View = (typeof VIEWS)[number][0];
const fromHash = (): View => (VIEWS.find(([k]) => "#" + k === location.hash)?.[0] ?? "demo");

export function App({ api }: { api: Api }) {
  const [view, setView] = useState<View>(fromHash());
  const [user, setUser] = useState("maya");
  const [theme, setTheme] = useState<string | null>(() => { try { return localStorage.getItem("halo-theme"); } catch { return null; } });
  useEffect(() => { const f = () => setView(fromHash()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
    try { theme ? localStorage.setItem("halo-theme", theme) : localStorage.removeItem("halo-theme"); } catch { /* storage blocked */ }
  }, [theme]);
  return (
    <ApiCtx.Provider value={api}>
      <div className="gutter mx-auto flex max-w-7xl flex-col gap-6 pb-10 pt-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full border-[3px] border-accent font-display text-lg font-bold text-accent">h</span>
            <div><div className="font-display text-xl font-bold leading-none">Halo</div><div className="text-xs text-muted">Guardian models that answer AI agents for you</div></div>
          </div>
          <nav className="flex flex-wrap gap-1" aria-label="Surfaces">
            {VIEWS.map(([k, l]) => <a key={k} href={"#" + k} className={`rounded-full px-3 py-1.5 text-sm font-bold ${view === k ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`} aria-current={view === k}>{l}</a>)}
          </nav>
          <div className="flex items-center gap-2"><ModeBadge /><button className="chip" onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? null : "dark")} title="Theme">{theme ?? "auto"} theme</button></div>
        </header>
        {view === "demo" && (
          <div className="grid items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-4"><PhoneApp userId={user} onUser={setUser} /></div>
            <Console onUser={setUser} />
          </div>
        )}
        {view === "business" && <BusinessPortal />}
        {view === "partner" && <PartnerView />}
      </div>
    </ApiCtx.Provider>
  );
}

function ModeBadge() {
  const [h] = useLive<any>("/v1/health", () => false);
  const backend = h?.models?.backend;
  const label = backend === "hf" ? "Fine-tuned models" : backend === "stub" ? "Model service: stand-in rules" : backend === "browser-heuristic" ? "Browser demo · stand-in rules" : "Connecting…";
  return <span className={`chip ${backend === "hf" ? "border-safe/40 text-safe" : "border-warn/40 text-warn"}`} title={h?.models?.note ?? ""}>{label}</span>;
}
