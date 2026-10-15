import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useStream } from '../lib/stream';
import type { Business } from '../lib/types';
import { Button, Card, Chip, cx, dateTime, useToast } from '../lib/appbits';

export function BusinessPortal() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const toast = useToast();
  const load = () => api.businesses().then((b) => { setBusinesses(b); if (!selected && b[0]) setSelected(b[0].id); }).catch(() => {});
  useEffect(() => { load(); }, []);
  useStream(['agent.update', 'demo.reset'], load);

  const biz = businesses.find((b) => b.id === selected);

  return (
    <div className="mx-auto max-w-5xl px-5 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold">Business portal</h1>
        <p className="text-sm text-ink-400">Register your AI agents on the Halo network. Set a behavior contract so consumers can verify what your agents may and may not do.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-[260px_1fr]">
        <div className="space-y-3">
          <Card className="p-3">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Businesses</h2>
            <div className="space-y-1">
              {businesses.map((b) => (
                <button key={b.id} onClick={() => setSelected(b.id)} className={cx('flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm', selected === b.id ? 'bg-halo-600 text-white' : 'hover:bg-sand-100 dark:hover:bg-ink-800')}>
                  <span className="truncate font-medium">{b.name}</span>
                  <span className={cx('text-[10px]', selected === b.id ? 'text-white/70' : 'text-ink-400')}>{b.agents?.length ?? 0}</span>
                </button>
              ))}
            </div>
          </Card>
          <NewBusiness onDone={load} />
        </div>

        <div className="space-y-4">
          {biz && (
            <>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">{biz.name}</h2>
                  <Chip tone="safe">✓ verified business</Chip>
                </div>
                <p className="text-xs text-ink-400">{biz.domain} · {biz.category}</p>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                {(biz.agents ?? []).map((a) => (
                  <Card key={a.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{a.displayName}</h3>
                      <Chip tone={a.status === 'active' ? 'safe' : 'danger'}>{a.status}</Chip>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-400">{a.purpose}</p>
                    <div className="mt-2 text-[11px]">
                      <div className="font-semibold text-ink-500 dark:text-ink-300">Behavior contract</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Chip tone="danger">never: {a.contract.neverRequest.map((x) => x.replace(/_/g, ' ')).join(', ') || 'none'}</Chip>
                      </div>
                      <div className="mt-1 text-ink-400">Callback: {a.contract.callbackNumber} · channels: {a.channels.join(', ')}</div>
                    </div>
                  </Card>
                ))}
                {(biz.agents ?? []).length === 0 && <p className="text-sm text-ink-400">No agents registered yet.</p>}
              </div>

              <NewAgent businessId={biz.id} onDone={load} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NewBusiness({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [category, setCategory] = useState('retailer');
  const toast = useToast();
  const submit = async () => {
    if (!name || !domain) return;
    try { await api.registerBusiness({ name, domain, category }); toast(`${name} registered`, 'success'); setName(''); setDomain(''); onDone(); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <Card className="p-3">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Register a business</h2>
      <div className="space-y-2">
        <Input value={name} onChange={setName} placeholder="Business name" />
        <Input value={domain} onChange={setDomain} placeholder="domain.example" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-800">
          {['bank', 'carrier', 'retailer', 'delivery', 'utility', 'insurance'].map((c) => <option key={c}>{c}</option>)}
        </select>
        <Button variant="primary" size="sm" className="w-full" onClick={submit}>Register</Button>
      </div>
    </Card>
  );
}

function NewAgent({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [credential, setCredential] = useState<string | null>(null);
  const toast = useToast();
  const submit = async () => {
    if (!displayName || !purpose) return;
    try {
      const r = await api.registerAgent(businessId, { displayName, purpose, channels: ['call', 'sms', 'chat'] });
      setCredential(r.credential);
      toast('Agent registered · credential issued', 'success');
      setDisplayName(''); setPurpose('');
      onDone();
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-bold">Register a new agent</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={displayName} onChange={setDisplayName} placeholder="Agent display name" />
        <Input value={purpose} onChange={setPurpose} placeholder="Purpose (what it does)" />
      </div>
      <p className="mt-1.5 text-[11px] text-ink-400">Default contract forbids one-time codes, PINs, passwords and wire transfers — enforced even when the agent is verified.</p>
      <Button variant="primary" size="sm" className="mt-2" onClick={submit}>Register agent</Button>
      {credential && (
        <div className="mt-2 rounded-lg border border-safe/30 bg-safe-soft p-2">
          <div className="text-[11px] font-semibold text-safe">Ed25519 credential issued (store securely):</div>
          <code className="mt-1 block break-all font-mono text-[10px] text-ink-500 dark:text-ink-300">{credential.slice(0, 64)}…</code>
        </div>
      )}
    </Card>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-halo-500 dark:border-ink-700 dark:bg-ink-800" />;
}
