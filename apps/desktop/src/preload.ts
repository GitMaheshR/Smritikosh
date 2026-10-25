import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('smritikosh', {
  platform: 'desktop',
  invoke: (method: string, ...args: unknown[]) => ipcRenderer.invoke('store', method, args),
  device: { getId: () => ipcRenderer.invoke('device:id') as Promise<string> },
  notifier: {
    requestPermission: () => ipcRenderer.invoke('notifier:permission'),
    rescheduleAll: (entries: unknown) => ipcRenderer.invoke('notifier:reschedule', entries),
    getAutoStart: () => ipcRenderer.invoke('notifier:getAutoStart'),
    setAutoStart: (on: boolean) => ipcRenderer.invoke('notifier:setAutoStart', on),
    onEvent: (cb: (e: unknown) => void) => {
      const h = (_: unknown, e: unknown) => cb(e);
      ipcRenderer.on('reminder', h);
      return () => ipcRenderer.removeListener('reminder', h);
    },
  },
});
