async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/v1${path}`, {
    ...init,
    headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).message ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
const post = <T>(p: string, body?: unknown) => req<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const api = {
  status: () => req<import('./types').Status>('/status'),
  authorizationNotice: () => req<any>('/authorization-notice'),
  myData: (userId = 'user_primary') => req<any>(`/privacy/my-data?userId=${userId}`),

  businesses: () => req<import('./types').Business[]>('/businesses'),
  registerBusiness: (b: { name: string; domain: string; category: string }) => post<import('./types').Business>('/businesses', b),
  registerAgent: (bizId: string, body: any) => post<any>(`/businesses/${bizId}/agents`, body),
  agents: () => req<import('./types').RegisteredAgent[]>('/agents'),

  verify: (b: { claimedBusiness: string; credential?: string }) => post<any>('/verify', b),
  liveVerify: (sessionId: string, code: string) => post<any>('/verify/live', { sessionId, code }),

  inboundList: () => req<import('./types').InboundSession[]>('/inbound'),
  inbound: (id: string) => req<import('./types').InboundSession>(`/inbound/${id}`),
  interrogate: (id: string) => post<any>(`/inbound/${id}/interrogate`),

  report: (sessionId: string) => post<any>('/reports', { sessionId }),
  campaigns: () => req<import('./types').Campaign[]>('/campaigns'),

  personalAgents: (userId = 'user_primary') => req<import('./types').PersonalAgent[]>(`/personal-agents?userId=${userId}`),
  revokeAgent: (id: string) => post<any>(`/personal-agents/${id}/revoke`, { actor: 'user_primary' }),
  pauseAll: () => post<any>('/personal-agents/pause-all', { userId: 'user_primary', actor: 'user_primary' }),
  actions: (userId = 'user_primary', limit = 60) => req<import('./types').PersonalAction[]>(`/personal-actions?userId=${userId}&limit=${limit}`),
  approvals: (userId = 'user_primary') => req<import('./types').PersonalAction[]>(`/approvals?userId=${userId}`),
  resolveApproval: (id: string, decision: 'approve' | 'reject') => post<any>(`/approvals/${id}`, { decision, actor: 'user_primary' }),

  preferences: (userId = 'user_primary') => req<import('./types').Preferences>(`/preferences?userId=${userId}`),
  setPreferences: (p: Partial<import('./types').Preferences> & { userId?: string }) => post<import('./types').Preferences>('/preferences', p),

  activity: (q: Record<string, string | number> = {}) => req<{ total: number; events: import('./types').ActivityEvent[] }>('/activity?' + new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)]))),
  verifyActivity: () => req<import('./types').VerifyResult>('/activity/verify'),
  evidence: () => req<any[]>('/evidence'),

  scenarios: () => req<{ inbound: any[]; outbound: any[] }>('/scenarios'),
  runInbound: (id: string) => post<any>(`/scenarios/inbound/${id}/run`),
  runOutbound: (id: string) => post<any>(`/scenarios/outbound/${id}/run`),
  runSwarm: () => post<any>('/scenarios/swarm/run'),

  redteamRun: (count = 10) => post<import('./types').RedTeamResult>('/redteam/run', { count }),
  redteamLatest: () => req<import('./types').RedTeamResult | null>('/redteam/latest'),

  evals: () => req<any>('/evals'),
  resetDemo: () => post<any>('/demo/reset'),
  tamper: () => post<any>('/demo/tamper'),
};
