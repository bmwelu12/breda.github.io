import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import type { DB } from '../db.js';
import { id } from '../util.js';

/**
 * Signed identity tokens for registered agents (and personal agents). Ed25519 via Node crypto.
 * Format: base64url(JSON claims) + "." + base64url(signature). Revoked or forged ⇒ invalid.
 */
export interface Claims {
  iss: 'halo';
  sub: string; // agent id
  cid: string; // credential id (revocable)
  kind: 'business_agent' | 'personal_agent';
  iat: number;
}

export type CredentialCheck =
  | { ok: true; claims: Claims }
  | { ok: false; code: 'missing' | 'malformed' | 'forged' | 'revoked' | 'unknown'; message: string; subject?: string };

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export class CredentialAuthority {
  private priv: KeyObject;
  readonly pub: KeyObject;

  constructor(private db: DB) {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'issuer_key'").get() as { value: string } | undefined;
    if (row) {
      this.priv = createPrivateKey(row.value);
    } else {
      this.priv = generateKeyPairSync('ed25519').privateKey;
      db.prepare("INSERT INTO meta (key, value) VALUES ('issuer_key', ?)").run(this.priv.export({ type: 'pkcs8', format: 'pem' }) as string);
    }
    this.pub = createPublicKey(this.priv);
  }

  publicKeyPem() {
    return this.pub.export({ type: 'spki', format: 'pem' }) as string;
  }

  issue(subject: string, kind: Claims['kind']): { token: string; credentialId: string } {
    const cid = id('cred');
    const t = Date.now();
    this.db.prepare('UPDATE credentials SET revoked_at = ?, revoked_reason = ? WHERE subject = ? AND revoked_at IS NULL').run(t, 'superseded', subject);
    this.db.prepare('INSERT INTO credentials (id, subject, kind, issued_at) VALUES (?, ?, ?, ?)').run(cid, subject, kind, t);
    const claims: Claims = { iss: 'halo', sub: subject, cid, kind, iat: Math.floor(t / 1000) };
    const body = b64u(JSON.stringify(claims));
    const sig = sign(null, Buffer.from(body), this.priv);
    return { token: `${body}.${b64u(sig)}`, credentialId: cid };
  }

  revoke(subject: string, reason: string) {
    this.db.prepare('UPDATE credentials SET revoked_at = ?, revoked_reason = ? WHERE subject = ? AND revoked_at IS NULL').run(Date.now(), reason, subject);
  }

  check(token: string | null | undefined): CredentialCheck {
    if (!token) return { ok: false, code: 'missing', message: 'No credential presented' };
    const parts = token.split('.');
    if (parts.length !== 2) return { ok: false, code: 'malformed', message: 'Credential is malformed' };
    let claims: Claims;
    try { claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { return { ok: false, code: 'malformed', message: 'Credential is malformed' }; }
    if (!verify(null, Buffer.from(parts[0]), this.pub, Buffer.from(parts[1], 'base64url'))) {
      return { ok: false, code: 'forged', message: 'Credential signature is invalid (forged or tampered)', subject: claims.sub };
    }
    const row = this.db.prepare('SELECT revoked_at, revoked_reason FROM credentials WHERE id = ? AND subject = ?').get(claims.cid, claims.sub) as { revoked_at: number | null; revoked_reason: string | null } | undefined;
    if (!row) return { ok: false, code: 'unknown', message: 'Credential was not issued by Halo', subject: claims.sub };
    if (row.revoked_at) return { ok: false, code: 'revoked', message: `Credential revoked (${row.revoked_reason ?? 'revoked'})`, subject: claims.sub };
    return { ok: true, claims };
  }
}
