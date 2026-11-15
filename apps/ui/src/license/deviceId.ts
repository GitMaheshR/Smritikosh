import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

/**
 * The platform's own identifier for this device. It is only ever hashed (see deviceCodeFrom) to make the
 * 16-character Device ID that is shown on screen.
 *  - Android: the app's Android ID (it also depends on the key the app is signed with)
 *  - iPhone: the identifier for this app's maker on this phone (it changes only if every app from that maker is removed)
 *  - Windows: the machine's MachineGuid, read by the desktop app
 *  - Browser (development only): a random ID kept in that browser's storage
 */
export async function rawDeviceId(): Promise<string> {
  const desktop = window.smritikosh?.device;
  if (desktop) return desktop.getId();
  if (Capacitor.isNativePlatform()) {
    // A plain import on purpose: the scrambler hides the text of a dynamic import(), and the build then cannot find the package.
    return (await Device.getId()).identifier;
  }
  let id = localStorage.getItem('smk.dev');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('smk.dev', id);
  }
  return id;
}
