import { MemoryStore, SqlStore, type DataStore, type Notifier, type SqlDriver } from '@smritikosh/core';
import { androidNotifier, desktopNotifier, webNotifier, type DesktopBridge } from './notifier';

declare global {
  interface Window {
    /** Exposed by apps/desktop preload (contextBridge). */
    smritikosh?: { invoke(method: string, ...args: unknown[]): Promise<unknown>; platform: 'desktop'; notifier: DesktopBridge };
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
  const driver: SqlDriver = {
    exec: async (sql) => { await conn.execute(sql); },
    run: async (sql, params = []) => { await conn.run(sql, params as never[], true); },
    all: async <T,>(sql: string, params: unknown[] = []) => ((await conn.query(sql, params as never[])).values ?? []) as T[],
  };
  return new SqlStore(driver);
}

export async function createNotifier(): Promise<Notifier> {
  const p = platformName();
  return p === 'desktop' ? desktopNotifier(window.smritikosh!.notifier) : p === 'android' ? androidNotifier() : webNotifier();
}

export async function createStore(): Promise<DataStore> {
  const p = platformName();
  const store = p === 'desktop' ? electronStore() : p === 'android' ? await capacitorStore() : new MemoryStore();
  await store.init();
  return store;
}
