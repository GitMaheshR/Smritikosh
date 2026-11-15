import { MemoryStore, SqlStore, isAllowedExternalUrl, type DataStore, type Notifier, type SqlDriver } from '@smritikosh/core';
import { requireUnlocked } from '../license/session';
import { androidNotifier, desktopNotifier, webNotifier, type DesktopBridge } from './notifier';

declare global {
  interface Window {
    /** Exposed by apps/desktop preload (contextBridge). */
    smritikosh?: { invoke(method: string, ...args: unknown[]): Promise<unknown>; platform: 'desktop'; notifier: DesktopBridge; device: { getId(): Promise<string> }; openExternal(url: string): Promise<void> };
    Capacitor?: { isNativePlatform(): boolean };
  }
}

export type PlatformName = 'desktop' | 'android' | 'web';

export function platformName(): PlatformName {
  if (window.smritikosh) return 'desktop';
  if (window.Capacitor?.isNativePlatform()) return 'android';
  return 'web';
}

/** Electron: every DataStore call is forwarded over typed IPC to the main process (better-sqlite3). */
function electronStore(): DataStore {
  return new Proxy({} as DataStore, {
    // `then` must be undefined or awaiting the store would try to IPC a thenable call.
    get: (_t, method: string) => (method === 'then' ? undefined : (...args: unknown[]) => window.smritikosh!.invoke(method, ...args)),
  });
}

async function capacitorStore(): Promise<DataStore> {
  const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const name = 'smritikosh';
  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const isConn = (await sqlite.isConnection(name, false)).result;
  const conn = consistent && isConn
    ? await sqlite.retrieveConnection(name, false)
    : await sqlite.createConnection(name, false, 'no-encryption', 1, false);
  await conn.open();
  let inTransaction = false; // while true, the writes below belong to one transaction (see store.bulk)
  const driver: SqlDriver = {
    exec: async (sql) => { await conn.execute(sql); },
    run: async (sql, params = []) => { await conn.run(sql, params as never[], !inTransaction); },
    all: async <T,>(sql: string, params: unknown[] = []) => ((await conn.query(sql, params as never[])).values ?? []) as T[],
  };
  const store = new SqlStore(driver);
  // Many writes at once (such as the sample data) would otherwise each be a slow round trip with its own commit.
  store.bulk = async (fn) => {
    await conn.beginTransaction();
    inTransaction = true;
    try {
      const result = await fn();
      await conn.commitTransaction();
      return result;
    } catch (e) {
      await conn.rollbackTransaction().catch(() => undefined);
      throw e;
    } finally {
      inTransaction = false;
    }
  };
  return store;
}

/**
 * Android hardware/gesture Back. `handler` returns true when it dealt with the press (closed a sheet, went back a
 * screen); returning false at the start of the app lets Android leave the app. No-op on desktop and in the browser.
 */
export async function onHardwareBack(handler: () => boolean): Promise<() => void> {
  if (platformName() !== 'android') return () => {};
  const { App } = await import('@capacitor/app');
  const sub = await App.addListener('backButton', () => {
    if (!handler()) void App.exitApp();
  });
  return () => void sub.remove();
}

/** Runs many writes as one transaction where the platform supports it (Android); elsewhere just runs them. */
export function inBulk<T>(store: DataStore, fn: () => Promise<T>): Promise<T> {
  return store instanceof SqlStore && store.bulk ? store.bulk(fn) : fn();
}

// ---- Places: map links, calls, GPS -------------------------------------------------------------
// The app never talks to a map service. It only hands a Google Maps link (or a phone number) to the system, which opens
// Google Maps, the browser or the dialer. GPS works without internet on the phone; on Windows the browser's location
// would ask Google over the network, so it is not offered there.

export const canUseLocation = () => platformName() === 'android';
export const canCall = () => platformName() === 'android';

/** Opens a Google Maps link or `tel:` number outside the app. Anything else is refused. */
export async function openExternal(url: string): Promise<void> {
  if (!isAllowedExternalUrl(url)) throw new Error('That link cannot be opened.');
  const p = platformName();
  if (p === 'desktop') return window.smritikosh!.openExternal(url);
  if (p === 'android') {
    const { AppLauncher } = await import('@capacitor/app-launcher');
    const r = await AppLauncher.openUrl({ url });
    if (!r.completed) throw new Error('No app could open that link.');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export interface Fix { lat: number; lng: number; accuracy: number }

/** The phone's current position from GPS. Throws an Error with a message fit to show the person. */
export async function currentLocation(): Promise<Fix> {
  if (!canUseLocation()) throw new Error('Current location is available in the Android app.');
  const { Geolocation } = await import('@capacitor/geolocation');
  let perm;
  try {
    perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
  } catch {
    throw new Error('Location is switched off. Turn on Location in the phone settings and try again.');
  }
  if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') throw new Error('Smritikosh is not allowed to use your location. You can allow it in the phone settings.');
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 30_000, maximumAge: 30_000 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch {
    throw new Error('Could not find your location. Step outside or near a window and try again.');
  }
}

/** Shares text through Android's share sheet; elsewhere copies it. Returns what happened. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied'> {
  if (platformName() === 'android') {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, dialogTitle: `Share ${title}` });
    return 'shared';
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}

export async function createNotifier(): Promise<Notifier> {
  const p = platformName();
  return p === 'desktop' ? desktopNotifier(window.smritikosh!.notifier) : p === 'android' ? androidNotifier() : webNotifier();
}

export async function createStore(): Promise<DataStore> {
  requireUnlocked(); // the database only opens after this device has been activated
  const p = platformName();
  const store = p === 'desktop' ? electronStore() : p === 'android' ? await capacitorStore() : new MemoryStore();
  await store.init();
  return store;
}
