import { formatDeviceCode, importPrivateKey, isDeviceCode, isoDay, signLicense } from '../../packages/core/src/license';

interface Issued { when: string; label: string; device: string; expires: string | null; code: string }
const HISTORY = 'smk.issued';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let key: CryptoKey | null = null;
const load = (): Issued[] => {
  try { return JSON.parse(localStorage.getItem(HISTORY) ?? '[]'); } catch { return []; }
};
const save = (rows: Issued[]) => localStorage.setItem(HISTORY, JSON.stringify(rows));

function say(el: HTMLElement, text: string, ok = true) {
  el.textContent = text;
  el.className = ok ? 'msg ok' : 'msg bad';
}

async function copy(text: string, btn: HTMLButtonElement) {
  await navigator.clipboard.writeText(text);
  const old = btn.textContent;
  btn.textContent = 'Copied';
  setTimeout(() => (btn.textContent = old), 1200);
}

function renderHistory() {
  const rows = load();
  const body = $('rows');
  body.innerHTML = '';
  $('empty').style.display = rows.length ? 'none' : 'block';
  for (const r of [...rows].reverse()) {
    const tr = document.createElement('tr');
    for (const v of [r.when, r.label || '(no name)', r.device, r.expires ?? 'No expiry']) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
}

$<HTMLInputElement>('keyfile').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    key = await importPrivateKey(JSON.parse(await file.text()));
    say($('keymsg'), `Key loaded: ${file.name}`);
  } catch {
    key = null;
    say($('keymsg'), 'That file is not a Smritikosh secret key.', false);
  }
});

$<HTMLInputElement>('noexp').addEventListener('change', () => {
  $<HTMLInputElement>('expiry').disabled = $<HTMLInputElement>('noexp').checked;
});

$<HTMLButtonElement>('make').addEventListener('click', async () => {
  const out = $('result');
  out.style.display = 'none';
  if (!key) return say($('makemsg'), 'Step 1 first: choose your secret key file.', false);
  const raw = $<HTMLInputElement>('device').value;
  if (!isDeviceCode(raw)) return say($('makemsg'), 'That is not a Smritikosh Device ID. It has 16 letters and numbers, like AB12-CD34-EF56-GH78.', false);
  const noExpiry = $<HTMLInputElement>('noexp').checked;
  const expires = noExpiry ? null : $<HTMLInputElement>('expiry').value || null;
  if (!noExpiry && !expires) return say($('makemsg'), 'Pick an expiry date, or tick "No expiry".', false);
  if (expires && expires < isoDay()) return say($('makemsg'), 'The expiry date is in the past.', false);
  const device = formatDeviceCode(raw);
  const code = await signLicense(key, { deviceCode: device, expires, issued: isoDay() });
  $<HTMLTextAreaElement>('code').value = code;
  out.style.display = 'block';
  say($('makemsg'), `Code created for ${device}${expires ? `, valid until ${expires}` : ', no expiry'}.`);
  const rows = load();
  rows.push({ when: new Date().toLocaleString(), label: $<HTMLInputElement>('label').value.trim(), device, expires, code });
  save(rows);
  renderHistory();
});

$<HTMLButtonElement>('copycode').addEventListener('click', (e) => copy($<HTMLTextAreaElement>('code').value, e.currentTarget as HTMLButtonElement));
$<HTMLButtonElement>('copywa').addEventListener('click', (e) => {
  const device = formatDeviceCode($<HTMLInputElement>('device').value);
  const msg = `Your Smritikosh activation code (for device ${device}):\n\n${$<HTMLTextAreaElement>('code').value}\n\nOpen Smritikosh, paste this code and tap Activate.`;
  void copy(msg, e.currentTarget as HTMLButtonElement);
});

$<HTMLButtonElement>('csv').addEventListener('click', () => {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ['When,Name,Device ID,Expires,Code', ...load().map((r) => [r.when, r.label, r.device, r.expires ?? 'none', r.code].map(q).join(','))];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = 'smritikosh-codes-issued.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

renderHistory();
