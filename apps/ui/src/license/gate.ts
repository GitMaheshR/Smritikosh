import { Capacitor, registerPlugin } from '@capacitor/core';
import { deviceCodeFrom, effectiveToday, importPublicKey, isoDay, licenseDaysLeft, verifyLicense } from '@smritikosh/core';
import { LICENSE_OFF } from '../buildConfig';
import { rawDeviceId } from './deviceId';
import { PUBLIC_KEY_JWK } from './publicKey';
import { markLocked, markUnlocked } from './session';

const ACTIVATION_KEY = 'smk.act';
const LAST_SEEN_KEY = 'smk.seen';

export type FailReason = 'format' | 'invalid' | 'expired';

export type GateState =
  | { status: 'checking' }
  | { status: 'tampered' }
  | { status: 'locked'; deviceCode: string; reason?: FailReason; expires?: string | null }
  | { status: 'ok'; deviceCode: string; issued: string | null; expires: string | null; daysLeft: number | null };

interface Saved { code: string; issued: string; expires: string | null }

const Integrity = registerPlugin<{ check(): Promise<{ genuine: boolean }> }>('Integrity');

/** Second, independent copy check (the native code also checks at start). Android only. */
async function copyIsGenuine(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    return (await Integrity.check()).genuine === true;
  } catch {
    return false;
  }
}

function saved(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(ACTIVATION_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/** Today's date, but never earlier than the latest date seen: setting the phone's clock back does not extend an expiry. */
function today(): string {
  const t = effectiveToday(isoDay(), localStorage.getItem(LAST_SEEN_KEY));
  localStorage.setItem(LAST_SEEN_KEY, t);
  return t;
}

export const currentCode = () => saved()?.code ?? null;

async function verify(code: string, deviceCode: string) {
  return verifyLicense(await importPublicKey(PUBLIC_KEY_JWK), code, deviceCode, today());
}

export async function evaluate(): Promise<GateState> {
  if (LICENSE_OFF) {
    markUnlocked('DEV');
    return { status: 'ok', deviceCode: 'DEV-MODE', issued: null, expires: null, daysLeft: null };
  }
  if (!(await copyIsGenuine())) {
    markLocked();
    return { status: 'tampered' };
  }
  const deviceCode = await deviceCodeFrom(await rawDeviceId());
  const s = saved();
  if (!s) {
    markLocked();
    return { status: 'locked', deviceCode };
  }
  const r = await verify(s.code, deviceCode);
  if (r.ok) {
    markUnlocked(deviceCode);
    return { status: 'ok', deviceCode, issued: r.issued, expires: r.expires, daysLeft: licenseDaysLeft(r.expires, today()) };
  }
  markLocked();
  return { status: 'locked', deviceCode, reason: r.reason, expires: r.expires };
}

/** Checks an entered code for this device and, if it is good, keeps it. */
export async function activate(code: string): Promise<GateState> {
  if (!(await copyIsGenuine())) return { status: 'tampered' };
  const deviceCode = await deviceCodeFrom(await rawDeviceId());
  const r = await verify(code, deviceCode);
  if (!r.ok) return { status: 'locked', deviceCode, reason: r.reason, expires: r.expires };
  localStorage.setItem(ACTIVATION_KEY, JSON.stringify({ code: code.replace(/\s+/g, ''), issued: r.issued, expires: r.expires } satisfies Saved));
  markUnlocked(deviceCode);
  return { status: 'ok', deviceCode, issued: r.issued, expires: r.expires, daysLeft: licenseDaysLeft(r.expires, today()) };
}

/** "Forgot PIN": proof that the owner issued a *different*, valid code for this device. */
export async function proveOwner(code: string): Promise<'ok' | 'same' | FailReason> {
  if (LICENSE_OFF) return 'ok';
  const deviceCode = await deviceCodeFrom(await rawDeviceId());
  const r = await verify(code, deviceCode);
  if (!r.ok) return r.reason;
  return code.replace(/\s+/g, '') === currentCode() ? 'same' : 'ok';
}
