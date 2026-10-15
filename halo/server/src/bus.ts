import { EventEmitter } from 'node:events';

export interface StreamEvent {
  type:
    | 'inbound.line' | 'inbound.update' | 'inbound.new'
    | 'activity' | 'alert' | 'report' | 'campaign'
    | 'personal.action' | 'personal.update' | 'agent.update'
    | 'redteam' | 'demo.reset';
  data: unknown;
  ts: number;
}

export class Bus extends EventEmitter {
  constructor() { super(); this.setMaxListeners(200); }
  publish(type: StreamEvent['type'], data: unknown) {
    this.emit('stream', { type, data, ts: Date.now() } satisfies StreamEvent);
  }
  onStream(fn: (e: StreamEvent) => void) {
    this.on('stream', fn);
    return () => this.off('stream', fn);
  }
}
