import { useEffect, useState } from 'react';
import { lockoutSeconds } from '@smritikosh/core';
import { useApp } from '../store/app';
import { proveOwner } from '../license/gate';
import { reasonText } from '../license/LicenseGate';
import { BrandMark } from './ui';

const FAIL_KEY = 'smk.pinfail'; // wrong-PIN count and the time the wait ends, kept across restarts

interface Fails { n: number; until: number }
const loadFails = (): Fails => {
  try {
    return { n: 0, until: 0, ...JSON.parse(localStorage.getItem(FAIL_KEY) ?? '{}') };
  } catch {
    return { n: 0, until: 0 };
  }
};

export function LockScreen() {
  const unlock = useApp((s) => s.unlock);
  const [pin, setPin] = useState('');
  const [fails, setFails] = useState<Fails>(loadFails);
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  const wait = Math.max(0, Math.ceil((fails.until - now) / 1000));
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [wait]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (wait > 0) return;
    if (await unlock(pin)) {
      localStorage.removeItem(FAIL_KEY);
      return;
    }
    const n = fails.n + 1;
    const next = { n, until: Date.now() + lockoutSeconds(n) * 1000 };
    localStorage.setItem(FAIL_KEY, JSON.stringify(next));
    setFails(next);
    setNow(Date.now());
    setPin('');
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    const r = await proveOwner(code);
    if (r === 'ok') {
      localStorage.removeItem(FAIL_KEY);
      await useApp.getState().setPin(null); // removes the PIN and opens the app; the data is kept
      return;
    }
    setMsg(r === 'same' ? 'Use a different, newer activation code than the one already on this device.' : reasonText(r));
  }

  const mmss = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="panel w-full max-w-xs space-y-4 text-center">
        <div className="flex justify-center"><BrandMark /></div>
        <h1 className="text-title">Smritikosh</h1>
        {!forgot ? (
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-meta font-bold text-muted" htmlFor="pin">Enter your PIN</label>
            <input id="pin" autoFocus type="password" inputMode="numeric" autoComplete="off" maxLength={6} disabled={wait > 0}
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="input num text-center text-heading tracking-[0.5em] disabled:opacity-50" />
            {wait > 0 ? (
              <p role="alert" className="text-meta text-overdue">Too many wrong tries. Try again in <span className="num">{mmss}</span>.</p>
            ) : fails.n > 0 ? (
              <p role="alert" className="text-meta text-overdue">That PIN is not right. Try again.</p>
            ) : null}
            <button type="submit" disabled={pin.length < 4 || wait > 0} className="btn btn-primary w-full disabled:opacity-50">Unlock</button>
            <button type="button" className="text-link !text-meta" onClick={() => { setForgot(true); setMsg(''); }}>Forgot PIN?</button>
          </form>
        ) : (
          <form onSubmit={reset} className="space-y-3 text-left">
            <p className="text-body text-muted">Enter a new activation code for this device from the owner. It removes the PIN. Your data is kept.</p>
            <textarea aria-label="Activation code" rows={3} className="input num py-2 !text-meta" placeholder="SMK1-…" value={code} onChange={(e) => { setCode(e.target.value); setMsg(''); }} />
            {msg && <p role="alert" className="text-meta text-overdue">{msg}</p>}
            <button type="submit" disabled={!code.trim()} className="btn btn-primary w-full disabled:opacity-50">Remove PIN</button>
            <button type="button" className="text-link !text-meta" onClick={() => setForgot(false)}>Back to PIN</button>
          </form>
        )}
      </div>
    </div>
  );
}
