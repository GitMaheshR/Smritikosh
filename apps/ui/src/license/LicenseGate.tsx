import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Check, Copy, Share2, ShieldAlert } from 'lucide-react';
import { BrandMark } from '../components/ui';
import { activate, evaluate, type FailReason, type GateState } from './gate';

type OkState = Extract<GateState, { status: 'ok' }>;
interface Ctx {
  state: OkState;
  /** Enter a newer activation code (renewal). */
  renew(code: string): Promise<{ ok: true } | { ok: false; reason: FailReason; expires?: string | null }>;
}
const LicenseCtx = createContext<Ctx | null>(null);
export const useLicense = (): Ctx => {
  const c = useContext(LicenseCtx);
  if (!c) throw new Error('useLicense outside LicenseGate');
  return c;
};

export function reasonText(reason: FailReason | undefined, expires?: string | null): string {
  if (reason === 'format') return 'That does not look like an activation code. Paste the whole code you were sent.';
  if (reason === 'invalid') return 'This code is not valid for this device. Check that you pasted the code made for the Device ID shown above.';
  if (reason === 'expired') return `This code ended on ${expires ?? 'an earlier date'}. Ask for a new one.`;
  return '';
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function ActivationScreen({ state, onActivate }: { state: Extract<GateState, { status: 'locked' }>; onActivate: (code: string) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');
  const [shownReason, setShownReason] = useState<{ reason?: FailReason; expires?: string | null }>({ reason: state.reason, expires: state.expires });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    await onActivate(code);
    setBusy(false);
  }
  // an unsuccessful attempt comes back through the gate state
  useEffect(() => setShownReason({ reason: state.reason, expires: state.expires }), [state]);

  async function share() {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title: 'Smritikosh Device ID', text: `My Smritikosh Device ID: ${state.deviceCode}`, dialogTitle: 'Send Device ID' }).catch(() => undefined);
    } else if (await copyText(state.deviceCode)) setCopied(true);
  }

  async function paste() {
    try {
      setCode(await navigator.clipboard.readText());
      setNote('');
    } catch {
      setNote('Paste is not allowed here. Press and hold in the box and choose Paste.');
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-page-x py-8">
      <div className="panel space-y-4">
        <div className="flex items-center gap-3"><BrandMark /><div><p className="eyebrow">Activation needed</p><h1 className="text-title">Smritikosh</h1></div></div>
        <p className="text-body text-muted">This app only opens on devices its owner has approved. Send the Device ID below to the owner, then enter the activation code you get back.</p>

        <div>
          <span className="field-label">Device ID</span>
          <p className="num rounded-control border border-border bg-surface-2 px-3 py-3 text-center text-heading tracking-wider" data-testid="device-id">{state.deviceCode}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn flex-1" onClick={async () => setCopied(await copyText(state.deviceCode))}>
              {copied ? <><Check size={16} aria-hidden />Copied</> : <><Copy size={16} aria-hidden />Copy</>}
            </button>
            <button type="button" className="btn flex-1" onClick={() => void share()}><Share2 size={16} aria-hidden />Send ID</button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-2">
          <label className="field-label" htmlFor="act-code">Activation code</label>
          <textarea id="act-code" rows={3} className="input num py-2 !text-meta" autoComplete="off" autoCapitalize="off" spellCheck={false}
            value={code} onChange={(e) => { setCode(e.target.value); setNote(''); }} placeholder="SMK1-…" />
          {(shownReason.reason || note) && <p role="alert" className="text-meta text-overdue">{note || reasonText(shownReason.reason, shownReason.expires)}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => void paste()}>Paste</button>
            <button type="submit" disabled={busy || !code.trim()} className="btn btn-primary flex-1 disabled:opacity-50">Activate</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TamperedScreen() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-page-x">
      <div className="panel space-y-3 text-center">
        <ShieldAlert className="mx-auto text-overdue" size={32} aria-hidden />
        <h1 className="text-title">This copy has been modified</h1>
        <p className="text-body text-muted">Smritikosh will not open. Install the original app from its owner.</p>
      </div>
    </div>
  );
}

/** Shows the activation screen until this device is activated; only then does the app (and its data) load. */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: 'checking' });

  useEffect(() => {
    void evaluate().then(setState);
    // Check again when the app comes back to the screen: an expiry may have passed in the meantime.
    const onVisible = () => { if (!document.hidden) void evaluate().then(setState); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const renew = useCallback<Ctx['renew']>(async (code) => {
    const next = await activate(code);
    if (next.status === 'ok') {
      setState(next);
      return { ok: true };
    }
    return { ok: false, reason: next.status === 'locked' ? next.reason ?? 'invalid' : 'invalid', expires: next.status === 'locked' ? next.expires : null };
  }, []);

  const value = useMemo<Ctx | null>(() => (state.status === 'ok' ? { state, renew } : null), [state, renew]);

  if (state.status === 'checking') return <div className="p-8 text-muted">Opening Smritikosh…</div>;
  if (state.status === 'tampered') return <TamperedScreen />;
  if (state.status === 'locked') return <ActivationScreen state={state} onActivate={async (c) => setState(await activate(c))} />;
  return <LicenseCtx.Provider value={value}>{children}</LicenseCtx.Provider>;
}
