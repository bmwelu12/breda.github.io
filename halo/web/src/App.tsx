import { useState } from 'react';
import { Button, cx, useStreamStatusBadge, useTheme } from './lib/appbits';
import { ConsumerApp } from './app/ConsumerApp';
import { BusinessPortal } from './business/BusinessPortal';
import { PartnerView } from './partner/PartnerView';
import { DemoPanel } from './panel/DemoPanel';

type Surface = 'consumer' | 'business' | 'partner' | 'panel';

const SURFACES: Array<{ id: Surface; label: string; sub: string }> = [
  { id: 'consumer', label: 'Consumer app', sub: 'the person Halo protects' },
  { id: 'panel', label: 'Demo panel', sub: 'scenarios · red team · evals' },
  { id: 'business', label: 'Business portal', sub: 'register & verify agents' },
  { id: 'partner', label: 'Northshore Bank', sub: 'white-label partner' },
];

export function App() {
  const [surface, setSurface] = useState<Surface>('consumer');
  const { dark, toggle } = useTheme();
  const status = useStreamStatusBadge();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-sand-200 bg-sand-50/85 px-4 py-2.5 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-halo-600">
            <span className="h-3 w-3 rounded-full bg-halo-300" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight">Halo</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400">AI that defends you from AI</div>
          </div>
        </div>
        <nav className="ml-2 flex flex-wrap gap-1">
          {SURFACES.map((s) => (
            <button key={s.id} onClick={() => setSurface(s.id)}
              className={cx('rounded-lg px-3 py-1.5 text-left transition', surface === s.id ? 'bg-halo-600 text-white' : 'text-ink-500 hover:bg-sand-100 dark:text-ink-300 dark:hover:bg-ink-800')}>
              <div className="text-[13px] font-semibold leading-none">{s.label}</div>
              <div className={cx('text-[10px]', surface === s.id ? 'text-white/70' : 'text-ink-400')}>{s.sub}</div>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {status}
          <button onClick={toggle} className="rounded-lg border border-sand-300 p-2 text-ink-500 hover:bg-sand-100 dark:border-ink-700 dark:hover:bg-ink-800" title="Toggle theme">
            {dark ? '☀' : '☾'}
          </button>
        </div>
      </header>
      <main className="flex-1">
        {surface === 'consumer' && <ConsumerApp />}
        {surface === 'business' && <BusinessPortal />}
        {surface === 'partner' && <PartnerView />}
        {surface === 'panel' && <DemoPanel onOpenConsumer={() => setSurface('consumer')} />}
      </main>
    </div>
  );
}
