import type { Notifier, ReminderEvent } from '@smritikosh/core';

export interface DesktopBridge {
  requestPermission(): Promise<boolean>;
  rescheduleAll(entries: unknown): Promise<void>;
  getAutoStart(): Promise<boolean>;
  setAutoStart(on: boolean): Promise<void>;
  onEvent(cb: (e: ReminderEvent) => void): () => void;
}

export function desktopNotifier(b: DesktopBridge): Notifier {
  return {
    requestPermission: () => b.requestPermission(),
    rescheduleAll: (entries) => b.rescheduleAll(entries),
    onEvent: (h) => b.onEvent(h),
    getAutoStart: () => b.getAutoStart(),
    setAutoStart: (on) => b.setAutoStart(on),
  };
}

/** Stable positive 31-bit int id for Android notification ids. */
const numId = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
};

export async function androidNotifier(): Promise<Notifier> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const handlers = new Set<(e: ReminderEvent) => void>();
  const idMap = new Map<number, string>();
  const emit = (e: ReminderEvent) => handlers.forEach((h) => h(e));

  await LocalNotifications.registerActionTypes({
    types: [{
      id: 'REMINDER',
      actions: [
        { id: 'done', title: 'Done' },
        { id: 'snooze1h', title: 'Snooze 1h' },
        { id: 'snoozeTomorrow', title: 'Tomorrow 9am' },
      ],
    }],
  });

  await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const itemId = (e.notification.extra?.itemId as string | undefined) ?? idMap.get(e.notification.id);
    if (!itemId) return;
    const a = e.actionId;
    emit({ id: itemId, action: a === 'done' || a === 'snooze1h' || a === 'snoozeTomorrow' ? a : 'open' });
  });
  // Delivered while the app is in the foreground.
  await LocalNotifications.addListener('localNotificationReceived', (n) => {
    const itemId = (n.extra?.itemId as string | undefined) ?? idMap.get(n.id);
    if (itemId) emit({ id: itemId, action: 'fired' });
  });

  return {
    async requestPermission() {
      let p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
      if (p.display !== 'granted') return false;
      // Android 12+: exact alarms need a separate user-granted setting.
      try {
        let ex = await LocalNotifications.checkExactNotificationSetting();
        if (ex.exact_alarm !== 'granted') ex = await LocalNotifications.changeExactNotificationSetting();
        return ex.exact_alarm === 'granted';
      } catch {
        return true; // older Android: no exact-alarm gate
      }
    },
    async rescheduleAll(entries) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications });
      idMap.clear();
      const list = entries.slice(0, 60); // Android caps scheduled alarms; the rest are re-added as time passes
      if (list.length === 0) return;
      for (const e of list) idMap.set(numId(e.id), e.id);
      await LocalNotifications.schedule({
        notifications: list.map((e) => ({
          id: numId(e.id), title: 'Smritikosh', body: e.title, actionTypeId: 'REMINDER',
          schedule: { at: new Date(e.at), allowWhileIdle: true }, extra: { itemId: e.id },
        })),
      });
    },
    onEvent(h) {
      handlers.add(h);
      return () => handlers.delete(h);
    },
  };
}

/** Browser dev: no native notifications, but the in-app reminder prompt still fires from a timer. */
export function webNotifier(): Notifier {
  const handlers = new Set<(e: ReminderEvent) => void>();
  let timers: number[] = [];
  return {
    requestPermission: async () => true,
    async rescheduleAll(entries) {
      timers.forEach(clearTimeout);
      timers = entries
        .map((e) => ({ id: e.id, ms: new Date(e.at).getTime() - Date.now() }))
        .filter((e) => e.ms > 0 && e.ms < 2_000_000_000)
        .map((e) => window.setTimeout(() => handlers.forEach((h) => h({ id: e.id, action: 'fired' })), e.ms));
    },
    onEvent(h) { handlers.add(h); return () => handlers.delete(h); },
  };
}
