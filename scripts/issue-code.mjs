// Command-line way to make an activation code (the same as the Licence Generator page).
//   node scripts/issue-code.mjs AB12-CD34-EF56-GH78            no expiry
//   node scripts/issue-code.mjs AB12-CD34-EF56-GH78 2027-03-31  valid until that date
// Reads the secret key from %USERPROFILE%\Documents\Smritikosh-license\smritikosh-private-key.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatDeviceCode, importPrivateKey, isDeviceCode, isoDay, signLicense } from '../packages/core/src/license.ts';

const [device, expires = null] = process.argv.slice(2);
if (!device || !isDeviceCode(device)) {
  console.error('Usage: node scripts/issue-code.mjs <Device ID> [expiry YYYY-MM-DD]');
  process.exit(1);
}
if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
  console.error('The expiry must look like 2027-03-31.');
  process.exit(1);
}
const folder = process.env.SMRITIKOSH_LICENSE_DIR || path.join(os.homedir(), 'Documents', 'Smritikosh-license');
const key = await importPrivateKey(JSON.parse(fs.readFileSync(path.join(folder, 'smritikosh-private-key.json'), 'utf8')));
const code = await signLicense(key, { deviceCode: device, expires, issued: isoDay() });
console.error(`Activation code for ${formatDeviceCode(device)}, ${expires ? `valid until ${expires}` : 'no expiry'}:`);
console.log(code);
