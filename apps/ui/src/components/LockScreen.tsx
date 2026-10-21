import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../store/app';

export function LockScreen() {
  const unlock = useApp((s) => s.unlock);
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await unlock(pin);
    if (!ok) { setBad(true); setPin(''); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4 text-center">
        <Lock className="mx-auto text-accent" size={32} aria-hidden />
        <h1 className="text-title">Smritikosh</h1>
        <label className="block text-meta text-muted" htmlFor="pin">Enter your PIN</label>
        <input id="pin" autoFocus type="password" inputMode="numeric" autoComplete="off" maxLength={6}
          value={pin} onChange={(e) => { setBad(false); setPin(e.target.value.replace(/\D/g, '')); }}
          className="num min-h-touch w-full rounded-control border border-border bg-surface px-3 text-center text-heading tracking-[0.5em] outline-none" />
        {bad && <p role="alert" className="text-meta text-overdue">That PIN is not right. Try again.</p>}
        <button type="submit" disabled={pin.length < 4} className="min-h-touch w-full rounded-control bg-accent text-body font-semibold text-on-accent disabled:opacity-50">Unlock</button>
      </form>
    </div>
  );
}
