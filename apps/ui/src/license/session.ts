// Ties the app's data to a successful activation: the database is opened through requireUnlocked(),
// which only succeeds after the activation check has passed. Cutting the activation screen out of the
// code leaves an app that cannot open its data.
let unlockedFor: string | null = null;

export function markUnlocked(deviceCode: string): void {
  unlockedFor = deviceCode;
}

export function markLocked(): void {
  unlockedFor = null;
}

export function requireUnlocked(): string {
  if (!unlockedFor) throw new Error('E1042');
  return unlockedFor;
}
