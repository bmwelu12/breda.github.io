import { useEffect, useRef, useState } from 'react';

export interface StreamEvent { type: string; data: any; ts: number }
type Handler = (e: StreamEvent) => void;

class StreamBus {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private statusHandlers = new Set<(c: boolean) => void>();
  private retry = 0;
  connected = false;

  private connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/v1/stream`);
    this.ws = ws;
    ws.onopen = () => { this.retry = 0; this.setConnected(true); };
    ws.onmessage = (ev) => { try { this.handlers.forEach((h) => h(JSON.parse(ev.data))); } catch { /* ignore */ } };
    ws.onclose = () => {
      this.setConnected(false);
      this.ws = null;
      if (this.handlers.size) { this.retry = Math.min(this.retry + 1, 6); setTimeout(() => this.ensure(), 300 * this.retry); }
    };
    ws.onerror = () => ws.close();
  }
  private setConnected(c: boolean) { this.connected = c; this.statusHandlers.forEach((h) => h(c)); }
  private ensure() { if (!this.ws && this.handlers.size) this.connect(); }
  subscribe(h: Handler) {
    this.handlers.add(h); this.ensure();
    return () => { this.handlers.delete(h); if (!this.handlers.size) { this.ws?.close(); this.ws = null; } };
  }
  onStatus(h: (c: boolean) => void) { this.statusHandlers.add(h); h(this.connected); return () => { this.statusHandlers.delete(h); }; }
}
export const streamBus = new StreamBus();

export function useStream(types: string[], handler: Handler, deps: unknown[] = []) {
  const ref = useRef(handler);
  ref.current = handler;
  const key = types.join(',');
  useEffect(() => {
    const set = new Set(types);
    return streamBus.subscribe((e) => { if (set.has(e.type)) ref.current(e); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);
}
export function useStreamStatus() {
  const [c, setC] = useState(streamBus.connected);
  useEffect(() => streamBus.onStatus(setC), []);
  return c;
}
