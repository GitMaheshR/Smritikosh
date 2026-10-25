import { useState } from 'react';
import { useApp } from '../store/app';
import { BrandMark } from './ui';

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
      <form onSubmit={submit} className="panel w-full max-w-xs space-y-4 text-center">
        <div className="flex justify-center"><BrandMark /></div>
        <h1 className="text-title">Smritikosh</h1>
        <label className="block text-meta font-bold text-muted" htmlFor="pin">Enter your PIN</label>
        <input id="pin" autoFocus type="password" inputMode="numeric" autoComplete="off" maxLength={6}
          value={pin} onChange={(e) => { setBad(false); setPin(e.target.value.replace(/\D/g, '')); }}
          className="input num text-center text-heading tracking-[0.5em]" />
        {bad && <p role="alert" className="text-meta text-overdue">That PIN is not right. Try again.</p>}
        <button type="submit" disabled={pin.length < 4} className="btn btn-primary w-full disabled:opacity-50">Unlock</button>
      </form>
    </div>
  );
}
