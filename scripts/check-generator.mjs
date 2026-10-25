// Smoke test for the licence generator page: loads it in a simulated browser, picks the secret key, makes a code for a
// device and checks that the app's own verifier accepts it. Run: node scripts/check-generator.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { deviceCodeFrom, importPublicKey, isoDay, verifyLicense } from '../packages/core/src/license.ts';

const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const { JSDOM } = createRequire(path.join(root, 'apps', 'ui', 'package.json'))('jsdom');
const folder = process.env.SMRITIKOSH_LICENSE_DIR || path.join(os.homedir(), 'Documents', 'Smritikosh-license');
const html = fs.readFileSync(path.join(folder, 'Smritikosh-License-Generator.html'), 'utf8');
const keyJson = fs.readFileSync(path.join(folder, 'smritikosh-private-key.json'), 'utf8');
const publicKey = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'ui', 'src', 'license', 'publicKey.ts'), 'utf8')
  .replace(/^[\s\S]*?=\s*/, '').replace(/;\s*$/, '').replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));

const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'http://localhost/',
  beforeParse(w) {
    Object.defineProperty(w, 'crypto', { value: webcrypto });
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => {} } });
  },
});
const { document } = dom.window;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);

const fileInput = $('keyfile');
const file = new dom.window.File([keyJson], 'smritikosh-private-key.json');
file.text = async () => keyJson;
Object.defineProperty(fileInput, 'files', { value: [file] });
fileInput.dispatchEvent(new dom.window.Event('change'));
await wait(200);
console.log('key step    :', $('keymsg').textContent);

const device = await deviceCodeFrom('generator-smoke-test-device');
$('device').value = device.toLowerCase().replace(/-/g, ' ');
$('label').value = 'smoke test';
$('make').click();
await wait(300);
console.log('make step   :', $('makemsg').textContent);
const code = $('code').value;
const result = await verifyLicense(await importPublicKey(publicKey), code, device, isoDay());
console.log('app accepts :', JSON.stringify(result));
console.log('history rows:', document.querySelectorAll('#rows tr').length);
if (!result.ok) process.exit(1);
