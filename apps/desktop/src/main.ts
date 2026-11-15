import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, shell, Tray } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { SqlStore, isGoogleMapsUrl, type SqlDriver } from '@smritikosh/core';
import { APP_ICON_DATA_URL, TRAY_ICON_DATA_URL } from './trayIcon';

let store: SqlStore;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

/** node:sqlite (built into Electron's Node 22) instead of better-sqlite3: no native compile / VS Build Tools needed. */
function openStore() {
  const db = new DatabaseSync(path.join(app.getPath('userData'), 'smritikosh.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const driver: SqlDriver = {
    exec: async (sql) => { db.exec(sql); },
    run: async (sql, params = []) => { db.prepare(sql).run(...(params as never[])); },
    all: async <T,>(sql: string, params: unknown[] = []) => db.prepare(sql).all(...(params as never[])) as T[],
  };
  store = new SqlStore(driver);
}

const ALLOWED = new Set([
  'init', 'listItems', 'getItem', 'createItem', 'updateItem', 'deleteItem', 'restoreItem', 'purgeTrash',
  'listTags', 'upsertTag', 'renameTag', 'deleteTag', 'listCategories', 'addCategory', 'renameCategory',
  'deleteCategory', 'listChecklist', 'listAllChecklist', 'addChecklist', 'updateChecklist', 'deleteChecklist',
  'copyChecklist', 'getSetting', 'setSetting',
]);

// ---- Device ID --------------------------------------------------------------------------------
// The raw machine identifier behind the Device ID shown on the activation screen (the app only ever hashes it).
// Windows: the MachineGuid; if that cannot be read, a random ID kept in the app's data folder.
async function machineId(): Promise<string> {
  try {
    const { stdout } = await promisify(execFile)('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { windowsHide: true });
    const m = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(stdout);
    if (m?.[1]) return m[1];
  } catch { /* fall through */ }
  const file = path.join(app.getPath('userData'), 'device-id.txt');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) return existing;
  } catch { /* first run */ }
  const id = randomUUID();
  fs.writeFileSync(file, id);
  return id;
}

// ---- Reminder scheduler -------------------------------------------------------------------------
// One ticker instead of long setTimeouts (which overflow after ~24 days and drift across sleep).
interface Reminder { id: string; title: string; at: number }
let reminders = new Map<string, Reminder>();
const FIRED = new Set<string>();

function fire(r: Reminder) {
  FIRED.add(`${r.id}@${r.at}`);
  reminders.delete(r.id);
  const n = new Notification({ title: 'Smritikosh', body: r.title, silent: false });
  // Electron only supports notification action buttons on macOS, so on Windows a click opens the app,
  // where the in-app reminder prompt offers Done / Snooze 1h / Tomorrow 9am.
  n.on('click', () => { showWindow(); win?.webContents.send('reminder', { id: r.id, action: 'open' }); });
  n.show();
  win?.webContents.send('reminder', { id: r.id, action: 'fired' });
}

setInterval(() => {
  const now = Date.now();
  for (const r of [...reminders.values()]) if (r.at <= now) fire(r);
}, 10_000);

// ---- Window, tray, auto-start --------------------------------------------------------------------
function showWindow() {
  if (!win) return createWindow(false);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow(hidden: boolean) {
  win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 360, minHeight: 600, title: 'Smritikosh', show: !hidden, icon: nativeImage.createFromDataURL(APP_ICON_DATA_URL),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false,
    },
  });
  Menu.setApplicationMenu(null);
  // Offline only: block any navigation or window outside the bundled UI.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  // Close hides to the tray so reminders keep firing; Quit lives in the tray menu.
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win?.hide(); }
  });
  win.on('closed', () => { win = null; });
  const uiIndex = app.isPackaged
    ? path.join(process.resourcesPath, 'ui', 'index.html')
    : path.join(__dirname, '..', '..', 'ui', 'dist', 'index.html');
  void win.loadFile(uiIndex);
}

function createTray() {
  tray = new Tray(nativeImage.createFromDataURL(TRAY_ICON_DATA_URL));
  tray.setToolTip('Smritikosh');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Smritikosh', click: showWindow },
    { type: 'separator' },
    { label: 'Quit (stops reminders)', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    openStore();
    await store.init();

    ipcMain.handle('store', (_e, method: string, args: unknown[]) => {
      if (!ALLOWED.has(method)) throw new Error(`Unknown store method: ${method}`);
      return (store as unknown as Record<string, (...a: unknown[]) => unknown>)[method]!(...(args ?? []));
    });
    ipcMain.handle('device:id', () => machineId());
    // The one way out of the app: a Google Maps web link, opened in the person's browser. Nothing else is allowed.
    ipcMain.handle('open:external', async (_e, url: unknown) => {
      if (typeof url !== 'string' || !isGoogleMapsUrl(url)) throw new Error('Only Google Maps links can be opened.');
      await shell.openExternal(new URL(url).toString());
    });
    ipcMain.handle('notifier:permission', () => Notification.isSupported());
    ipcMain.handle('notifier:reschedule', (_e, entries: { id: string; title: string; at: string }[]) => {
      const next = new Map<string, Reminder>();
      for (const e of entries) {
        const at = new Date(e.at).getTime();
        if (!Number.isNaN(at) && !FIRED.has(`${e.id}@${at}`)) next.set(e.id, { id: e.id, title: e.title, at });
      }
      reminders = next;
    });
    ipcMain.handle('notifier:getAutoStart', () => app.getLoginItemSettings().openAtLogin);
    ipcMain.handle('notifier:setAutoStart', (_e, on: boolean) => {
      app.setLoginItemSettings({ openAtLogin: !!on, args: on ? ['--hidden'] : [] });
    });

    createTray();
    createWindow(process.argv.includes('--hidden'));
  });
  app.on('before-quit', () => { quitting = true; });
  // Stay alive in the tray when every window is closed.
  app.on('window-all-closed', () => { /* keep running */ });
}
