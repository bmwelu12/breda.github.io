// Browser-safe crypto helpers (pure JS: @noble). Used by server and standalone demo alike.
import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
import { bytesToHex, utf8ToBytes, randomBytes } from "@noble/hashes/utils";
import { ed25519 } from "@noble/curves/ed25519";

export const sha256hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
export const hmacHex = (key: string, msg: string) => bytesToHex(hmac(sha256, utf8ToBytes(key), utf8ToBytes(msg)));
export const randomHex = (n = 16) => bytesToHex(randomBytes(n));
export const newId = (prefix: string) => `${prefix}_${randomHex(6)}`;

/** Deterministic JSON with sorted keys, used for hashing. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
}

const b64u = (b: Uint8Array) => {
  let s = "";
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export interface KeyPair { privateKey: string; publicKey: string }
export function generateKeyPair(): KeyPair {
  const priv = ed25519.utils.randomPrivateKey();
  return { privateKey: bytesToHex(priv), publicKey: bytesToHex(ed25519.getPublicKey(priv)) };
}

const hexToBytes = (h: string) => Uint8Array.from(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));

/** Halo-signed credential token: base64url(payload).base64url(ed25519 signature). */
export function signToken(payload: Record<string, unknown>, privateKeyHex: string): string {
  const body = b64u(utf8ToBytes(canonical(payload)));
  const sig = ed25519.sign(utf8ToBytes(body), hexToBytes(privateKeyHex));
  return `halo_cred.${body}.${b64u(sig)}`;
}

export function verifyToken(token: string, publicKeyHex: string): { ok: boolean; payload?: any } {
  try {
    const [prefix, body, sig] = token.split(".");
    if (prefix !== "halo_cred" || !body || !sig) return { ok: false };
    const ok = ed25519.verify(unb64u(sig), utf8ToBytes(body), hexToBytes(publicKeyHex));
    if (!ok) return { ok: false };
    return { ok: true, payload: JSON.parse(new TextDecoder().decode(unb64u(body))) };
  } catch {
    return { ok: false };
  }
}
