// White-label Halo embed for partner apps (banks, carriers). The partner supplies its brand;
// Halo supplies verification, risk and guidance. Data stays on Halo's servers.
import { useEffect, useState } from "react";

export interface EmbedClient {
  get(path: string): Promise<any>;
  post(path: string, body?: any): Promise<any>;
  subscribe(fn: (e: any) => void): () => void;
}

export interface EmbedTheme { brandName: string; brandColor: string; brandInk: string }

export function HaloEmbed({ client, userId, theme }: { client: EmbedClient; userId: string; theme: EmbedTheme }) {
  const [latest, setLatest] = useState<any>(null);
  const [check, setCheck] = useState<any>(null);
  useEffect(() => {
    const load = () => client.get(`/v1/inbound?user_id=${userId}`).then((l: any[]) => setLatest(l[0] ?? null));
    load();
    return client.subscribe((e) => { if (!e.user_id || e.user_id === userId) load(); });
  }, [userId]);
  const tone = !latest ? "neutral" : latest.state === "verified" ? "safe" : latest.state === "impersonating" ? "danger" : "warn";
  const toneStyle: Record<string, string> = { safe: "bg-safe-bg text-safe", danger: "bg-danger-bg text-danger", warn: "bg-warn-bg text-warn", neutral: "bg-sunk text-muted" };
  const icon: Record<string, string> = { safe: "✓", danger: "!", warn: "?", neutral: "•" };
  return (
    <section aria-label={`${theme.brandName} call protection`} className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold" style={{ color: theme.brandColor }}>{theme.brandName} Call Shield</h3>
        <span className="text-[11px] text-muted">powered by Halo</span>
      </div>
      <div className={`mt-3 flex items-center gap-3 rounded-xl p-3 ${toneStyle[tone]}`}>
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-current font-bold">{icon[tone]}</span>
        <div className="min-w-0 text-sm">
          <div className="font-bold">{latest ? latest.state_label : "No recent calls"}</div>
          <div>{latest ? (latest.state === "verified" ? `It's really ${theme.brandName}. We'll never ask for your PIN or codes.` : latest.state === "impersonating" ? `This is not ${theme.brandName}. Hang up and call the number on your card.` : "We can't confirm this caller.") : "We check every call that says it's us."}</div>
        </div>
      </div>
      {latest && !latest.ended && (
        <button className="mt-3 w-full rounded-full px-4 py-2 font-bold" style={{ background: theme.brandColor, color: theme.brandInk }}
          onClick={() => client.post("/v1/verify/live", { inbound_id: latest.id }).then(setCheck)}>Is this really {theme.brandName}?</button>
      )}
      {check && <p className="mt-2 text-sm">{check.message}</p>}
    </section>
  );
}
