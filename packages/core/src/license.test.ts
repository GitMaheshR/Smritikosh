import { beforeAll, describe, expect, it } from 'vitest';
import {
  LICENSE_PREFIX, dayNumber, dayToIso, deviceCodeFrom, effectiveToday, formatDeviceCode, generateKeyPair, importPrivateKey,
  importPublicKey, isDeviceCode, isoDay, licenseDaysLeft, normalizeDeviceCode, signLicense, verifyLicense,
} from './license';
import { lockoutSeconds } from './pin';

let priv: CryptoKey;
let pub: CryptoKey;
let otherPub: CryptoKey;
let device: string;
let otherDevice: string;

beforeAll(async () => {
  const k = await generateKeyPair();
  priv = await importPrivateKey(k.privateJwk);
  pub = await importPublicKey(k.publicJwk);
  otherPub = await importPublicKey((await generateKeyPair()).publicJwk);
  device = await deviceCodeFrom('android-id-1234');
  otherDevice = await deviceCodeFrom('android-id-9999');
});

describe('device code', () => {
  it('is 16 characters, grouped, and always the same for the same device', async () => {
    expect(device).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(await deviceCodeFrom('android-id-1234')).toBe(device);
    expect(otherDevice).not.toBe(device);
    expect(isDeviceCode(device)).toBe(true);
  });
  it('accepts typing slips and rejects junk', () => {
    expect(normalizeDeviceCode('abcd-0o1i-lxyz')).toBe('ABCD00111XYZ');
    expect(formatDeviceCode('abcd0123efgh4567')).toBe('ABCD-0123-EFGH-4567');
    expect(isDeviceCode('too short')).toBe(false);
    expect(isDeviceCode('')).toBe(false);
  });
});

describe('activation code', () => {
  it('a code made for a device verifies for that device, with and without expiry', async () => {
    const forever = await signLicense(priv, { deviceCode: device, issued: '2026-10-25' });
    expect(forever.startsWith(LICENSE_PREFIX)).toBe(true);
    expect(await verifyLicense(pub, forever, device, '2030-01-01')).toEqual({ ok: true, expires: null, issued: '2026-10-25' });
    const dated = await signLicense(priv, { deviceCode: device, expires: '2027-01-31', issued: '2026-10-25' });
    expect(await verifyLicense(pub, dated, device, '2027-01-31')).toEqual({ ok: true, expires: '2027-01-31', issued: '2026-10-25' });
  });

  it('works when the device ID is typed with slips, spaces or the prefix in lower case', async () => {
    const code = await signLicense(priv, { deviceCode: device, issued: '2026-10-25' });
    const sloppy = device.toLowerCase().replace('1', 'l');
    // only the prefix is case-insensitive; the body of the code must be exact
    expect((await verifyLicense(pub, ` ${code.replace('SMK1-', 'smk1-')} \n`, sloppy, '2026-10-26')).ok).toBe(true);
    expect((await verifyLicense(pub, code.toLowerCase(), sloppy, '2026-10-26')).ok).toBe(false);
  });

  it('is refused on a different device', async () => {
    const code = await signLicense(priv, { deviceCode: device, issued: '2026-10-25' });
    expect(await verifyLicense(pub, code, otherDevice, '2026-10-26')).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('is refused when signed by a different key', async () => {
    const code = await signLicense(priv, { deviceCode: device, issued: '2026-10-25' });
    expect(await verifyLicense(otherPub, code, device, '2026-10-26')).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('an expired code is refused with the date, and works up to and including the last day', async () => {
    const code = await signLicense(priv, { deviceCode: device, expires: '2026-11-01', issued: '2026-10-25' });
    expect(await verifyLicense(pub, code, device, '2026-11-01')).toMatchObject({ ok: true });
    expect(await verifyLicense(pub, code, device, '2026-11-02')).toMatchObject({ ok: false, reason: 'expired', expires: '2026-11-01' });
  });

  it('editing any part of the code (such as pushing the expiry out) breaks the signature', async () => {
    const code = await signLicense(priv, { deviceCode: device, expires: '2026-11-01', issued: '2026-10-25' });
    const body = Uint8Array.from(atob(code.slice(5).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(((4 - ((code.length - 5) % 4)) % 4))), (c) => c.charCodeAt(0));
    body[2] = body[2]! + 50; // later expiry day
    const forged = LICENSE_PREFIX + btoa(String.fromCharCode(...body)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(await verifyLicense(pub, forged, device, '2026-10-26')).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('garbage and wrong-length input is a format error, never a crash', async () => {
    for (const bad of ['', 'hello', 'SMK1-', 'SMK1-AAAA', '!!!!', 'SMK1-' + 'A'.repeat(200)]) {
      expect(await verifyLicense(pub, bad, device, '2026-10-26')).toMatchObject({ ok: false, reason: 'format' });
    }
  });

  it('only a real device ID can be signed', async () => {
    await expect(signLicense(priv, { deviceCode: 'not-a-device', issued: '2026-10-25' })).rejects.toThrow();
  });
});

describe('dates', () => {
  it('day numbers round-trip', () => {
    expect(dayToIso(dayNumber('2026-10-25'))).toBe('2026-10-25');
    expect(dayNumber('2020-01-02') - dayNumber('2020-01-01')).toBe(1);
  });
  it('days left until expiry, none when it never expires', () => {
    expect(licenseDaysLeft('2026-11-09', '2026-10-25')).toBe(15);
    expect(licenseDaysLeft('2026-10-24', '2026-10-25')).toBe(-1);
    expect(licenseDaysLeft(null, '2026-10-25')).toBeNull();
  });
  it('the clock cannot be set back to extend an expiry', () => {
    expect(effectiveToday('2026-10-01', '2026-10-25')).toBe('2026-10-25');
    expect(effectiveToday('2026-10-30', '2026-10-25')).toBe('2026-10-30');
    expect(effectiveToday('2026-10-30', null)).toBe('2026-10-30');
  });
  it('isoDay formats local dates', () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('PIN lockout', () => {
  it('no wait for the first four mistakes, then 30 s doubling to a 15 minute cap', () => {
    expect([0, 1, 4].map(lockoutSeconds)).toEqual([0, 0, 0]);
    expect([5, 6, 7, 8].map(lockoutSeconds)).toEqual([30, 60, 120, 240]);
    expect(lockoutSeconds(9)).toBe(480);
    expect(lockoutSeconds(10)).toBe(900);
    expect(lockoutSeconds(50)).toBe(900);
  });
});
