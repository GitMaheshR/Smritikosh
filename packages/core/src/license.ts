// Device activation codes. Pure Web Crypto, so the same code runs in the app, in the licence
// generator page and in tests.
//
// The owner keeps an ECDSA P-256 private key on their PC and signs
//   "smritikosh-license-v1|<device code>|<expiry day>|<issued day>"
// The app holds only the public key: it can check a code but never make one.
//
// Activation code = "SMK1-" + base64url(version, expiry day, issued day, signature).

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const LICENSE_PREFIX = 'SMK1-';
const VERSION = 1;
const EPOCH = Date.UTC(2020, 0, 1);
const ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const;
const MESSAGE_PREFIX = 'smritikosh-license-v1';

const utf8 = (s: string) => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>;

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** Device codes are typed and read aloud, so accept common slips (O for 0, I/L for 1). */
export function normalizeDeviceCode(text: string): string {
  return String(text || '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-Z]/g, '');
}

export function formatDeviceCode(text: string): string {
  return normalizeDeviceCode(text).replace(/(.{4})(?=.)/g, '$1-');
}

export const isDeviceCode = (text: string) => /^[0-9A-HJKMNP-TV-Z]{16}$/.test(normalizeDeviceCode(text));

/** 16-character code (80 bits) derived from the platform's device identifier. */
export async function deviceCodeFrom(rawId: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(`smritikosh-device|${rawId}`)));
  return formatDeviceCode(base32(hash.slice(0, 10)));
}

export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000);
}

export function dayToIso(n: number): string {
  return new Date(EPOCH + n * 86_400_000).toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD in local time. */
export function isoDay(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The date never goes backwards: setting the clock back does not extend an expiry. */
export function effectiveToday(today: string, lastSeen: string | null): string {
  return lastSeen && lastSeen > today ? lastSeen : today;
}

/** Whole days until an expiry date (negative once passed). Null when the licence does not expire. */
export function licenseDaysLeft(expires: string | null, today: string): number | null {
  return expires ? dayNumber(expires) - dayNumber(today) : null;
}

const message = (deviceCode: string, expiryDay: number, issuedDay: number) =>
  utf8(`${MESSAGE_PREFIX}|${normalizeDeviceCode(deviceCode)}|${expiryDay}|${issuedDay}`);

export async function generateKeyPair(): Promise<{ privateJwk: JsonWebKey; publicJwk: JsonWebKey }> {
  const pair = await crypto.subtle.generateKey(ALGO, true, ['sign', 'verify']);
  return {
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
  };
}

export const importPrivateKey = (jwk: JsonWebKey) => crypto.subtle.importKey('jwk', jwk, ALGO, false, ['sign']);
export const importPublicKey = (jwk: JsonWebKey) =>
  crypto.subtle.importKey('jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, ALGO, false, ['verify']);

/** expires: 'YYYY-MM-DD' or null for no expiry. issued: 'YYYY-MM-DD'. */
export async function signLicense(
  privateKey: CryptoKey,
  { deviceCode, expires = null, issued }: { deviceCode: string; expires?: string | null; issued: string },
): Promise<string> {
  if (!isDeviceCode(deviceCode)) throw new Error('Not a Smritikosh device ID');
  const expiryDay = expires ? dayNumber(expires) : 0;
  const issuedDay = dayNumber(issued);
  const sig = new Uint8Array(await crypto.subtle.sign(SIGN, privateKey, message(deviceCode, expiryDay, issuedDay)));
  const bytes = new Uint8Array(5 + sig.length);
  bytes[0] = VERSION;
  bytes[1] = expiryDay >> 8;
  bytes[2] = expiryDay & 255;
  bytes[3] = issuedDay >> 8;
  bytes[4] = issuedDay & 255;
  bytes.set(sig, 5);
  return LICENSE_PREFIX + toBase64Url(bytes);
}

export type LicenseResult =
  | { ok: true; expires: string | null; issued: string }
  | { ok: false; reason: 'format' | 'invalid' | 'expired'; expires?: string | null; issued?: string };

/** 'invalid' covers both a mistyped code and a code made for a different device. */
export async function verifyLicense(publicKey: CryptoKey, code: string, deviceCode: string, today: string): Promise<LicenseResult> {
  const text = String(code || '').replace(/\s+/g, '');
  const body = text.toUpperCase().startsWith(LICENSE_PREFIX) ? text.slice(LICENSE_PREFIX.length) : text;
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = fromBase64Url(body);
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (bytes.length !== 69 || bytes[0] !== VERSION) return { ok: false, reason: 'format' };
  const expiryDay = (bytes[1]! << 8) | bytes[2]!;
  const issuedDay = (bytes[3]! << 8) | bytes[4]!;
  const sig = bytes.slice(5);
  const valid = await crypto.subtle.verify(SIGN, publicKey, sig, message(deviceCode, expiryDay, issuedDay));
  if (!valid) return { ok: false, reason: 'invalid' };
  const expires = expiryDay ? dayToIso(expiryDay) : null;
  const issued = dayToIso(issuedDay);
  if (expires && today > expires) return { ok: false, reason: 'expired', expires, issued };
  return { ok: true, expires, issued };
}
