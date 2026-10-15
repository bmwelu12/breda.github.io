// Swarm Detector (not fine-tuned). Clusters related contacts into campaigns using shared
// tactics, targets, timing and hashed identifiers, with sentence embeddings from the ML service
// (MiniLM) — falling back to a local hashed embedding when the service is offline.

import type { DB } from '../db.js';
import type { Campaign, Report, Tactic } from '../domain.js';
import type { MlClient } from '../ml/client.js';
import type { ActivityLog } from './activity.js';
import type { Bus } from '../bus.js';
import { id } from '../util.js';

const cosine = (a: number[], b: number[]) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

const SIM_THRESHOLD = 0.72;
const WINDOW_MS = 30 * 60_000; // contacts within 30 minutes can belong to one campaign

export class SwarmDetector {
  constructor(private db: DB, private ml: MlClient, private activity: ActivityLog, private bus: Bus) {}

  private rows(): Array<Campaign & { embedding: number[] }> {
    return (this.db.prepare('SELECT data FROM campaigns ORDER BY updated_at DESC').all() as any[]).map((r) => JSON.parse(r.data));
  }
  private save(c: Campaign & { embedding: number[] }) {
    this.db.prepare('INSERT OR REPLACE INTO campaigns (id, data, updated_at) VALUES (?, ?, ?)').run(c.id, JSON.stringify(c), c.lastSeen);
  }

  list(): Campaign[] {
    return this.rows()
      .map(({ embedding, ...c }) => c)
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }

  /** Fold a new report into an existing campaign or start one. Returns the campaign id. */
  async ingest(report: Report): Promise<string> {
    const text = `${report.claimedBusiness ?? ''} ${report.tactics.join(' ')} ${report.items.join(' ')} ${report.summary}`;
    const [embedding] = await this.ml.embed([text]);
    const campaigns = this.rows();

    let best: (Campaign & { embedding: number[] }) | null = null;
    let bestScore = 0;
    for (const c of campaigns) {
      const recent = report.createdAt - c.lastSeen < WINDOW_MS * 6; // allow a wider join window for grouping
      const sim = cosine(embedding, c.embedding);
      const sharesId = report.fingerprints.some((f) => c.fingerprints.includes(f));
      const sameBiz = !!report.claimedBusiness && c.label.toLowerCase().includes((report.claimedBusiness ?? '').toLowerCase().split(' ')[0]);
      const isCandidate = sim >= SIM_THRESHOLD || sharesId || (sameBiz && recent);
      // A shared hashed identifier is a strong link on its own, regardless of text similarity.
      const score = (sharesId ? 1 : 0) + (sameBiz && recent ? 0.3 : 0) + Math.max(0, sim);
      if (isCandidate && score > bestScore) { best = c; bestScore = score; }
    }

    if (best) {
      best.reportIds.push(report.id);
      best.sharedTactics = union(best.sharedTactics, report.tactics);
      best.fingerprints = union(best.fingerprints, report.fingerprints);
      best.targets = new Set([...best.reportIds]).size; // reports ≈ distinct hits
      best.lastSeen = report.createdAt;
      // blend embedding toward the running centroid
      best.embedding = best.embedding.map((x, i) => (x * (best!.reportIds.length - 1) + (embedding[i] ?? 0)) / best!.reportIds.length);
      this.save(best);
      this.flag(best);
      return best.id;
    }

    const campaign: Campaign & { embedding: number[] } = {
      id: id('camp'),
      label: report.claimedBusiness ? `"${report.claimedBusiness}" impersonation` : `${report.tactics[0] ?? 'scam'} campaign`,
      reportIds: [report.id],
      sessionIds: report.sessionId ? [report.sessionId] : [],
      sharedTactics: report.tactics,
      targets: 1,
      fingerprints: report.fingerprints,
      firstSeen: report.createdAt,
      lastSeen: report.createdAt,
      embedding,
    };
    this.save(campaign);
    return campaign.id;
  }

  /** Once a campaign crosses a few related reports, raise a swarm alert. */
  private flag(c: Campaign) {
    if (c.reportIds.length === 3) {
      this.activity.append({
        type: 'swarm.detected',
        actor: 'halo',
        subject: c.id,
        summary: `Swarm campaign detected: ${c.label} — ${c.reportIds.length} related contacts sharing tactics ${c.sharedTactics.join(', ')}`,
        payload: { campaignId: c.id, reports: c.reportIds.length, tactics: c.sharedTactics },
      });
      this.bus.publish('alert', { kind: 'swarm', campaignId: c.id, label: c.label, severity: 'high' });
    }
    this.bus.publish('campaign', { id: c.id });
  }

  attachSession(campaignId: string, sessionId: string) {
    const c = this.rows().find((x) => x.id === campaignId);
    if (c && !c.sessionIds.includes(sessionId)) { c.sessionIds.push(sessionId); this.save(c); }
  }
}

const union = <T>(a: T[], b: T[]): T[] => [...new Set([...a, ...b])];
