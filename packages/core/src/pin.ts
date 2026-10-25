/** PIN hashing: PBKDF2-SHA256 via Web Crypto. Only salt + hash are stored, never the PIN. */
const ITER = 600_000;
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin);

/** Wait after wrong PINs: none for the first 4, then 30 s, doubling each time, up to 15 minutes. */
export function lockoutSeconds(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(900, 30 * 2 ** (failures - 5));
}

export async function hashPin(pin: string, iter = ITER): Promise<string> {
  if (!isValidPin(pin)) throw new Error('PIN must be 4-6 digits');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${iter}$${b64(salt)}$${b64(await derive(pin, salt, iter))}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [iter, salt, hash] = stored.split('$');
  if (!iter || !salt || !hash) return false;
  const got = await derive(pin, unb64(salt), Number(iter));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i]! ^ want[i]!;
  return diff === 0;
}
