import { HaloEmbed } from "../../partner/HaloEmbed.tsx";
import { useApi } from "./ui.tsx";

export function PartnerView() {
  const api = useApi();
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-8 md:grid-cols-[390px_minmax(0,1fr)]">
      <div className="phone mx-auto">
        <div className="bg-bank px-5 pb-6 pt-5 text-bank-ink">
          <div className="text-xs opacity-80">Good afternoon, Maya</div>
          <div className="font-display text-2xl font-bold">Northshore Bank</div>
          <div className="mt-4 text-xs opacity-80">Everyday checking ····4417</div>
          <div className="text-3xl font-bold tnum">$3,284.16</div>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <HaloEmbed client={api} userId="maya" theme={{ brandName: "Northshore Bank", brandColor: "rgb(var(--bank))", brandInk: "rgb(var(--bank-ink))" }} />
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
            <div className="eyebrow mb-2">Recent activity</div>
            {[["Fern Street Grocers", "-$82.00"], ["Paycheck · Harbor Insurance", "+$1,940.00"], ["BrightWave Energy", "-$64.30"]].map(([n, v]) => (
              <div key={n} className="flex justify-between border-b border-line py-2 last:border-0"><span>{n}</span><span className="tnum">{v}</span></div>
            ))}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="eyebrow">Partner view</div>
        <h1 className="text-3xl font-bold">Halo inside Northshore Bank's app</h1>
        <p className="mt-2 max-w-prose text-muted">Northshore embeds Halo's white-label SDK (<code className="font-mono text-sm">partner/HaloEmbed.tsx</code>). When anyone calls Maya claiming to be Northshore, the bank's own app tells her whether it's real. Northshore's AI agents are registered with Halo and carry signed credentials, so impostors can't borrow its name.</p>
        <ul className="mt-4 grid max-w-prose gap-2 text-[15px]">
          <li>✓ Verified Northshore agents show green, with a two-way code.</li>
          <li>! Impostors using the Northshore name show red, inside the bank's app.</li>
          <li>• Halo runs on Halo's servers; Northshore never receives Maya's transcripts.</li>
        </ul>
        <p className="mt-4 text-sm text-muted">Try it: run “Real bank agent, verified” or “Fake bank agent” from the console, then come back here.</p>
      </div>
    </div>
  );
}
