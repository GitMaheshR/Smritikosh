// Bundles tools/license-generator into ONE offline HTML file and puts it next to the secret key:
//   %USERPROFILE%\Documents\Smritikosh-license\Smritikosh-License-Generator.html
// It uses the same licence code as the app (packages/core/src/license.ts), so the two cannot drift apart.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// esbuild is installed for the desktop app; resolve it from there.
const { build } = createRequire(path.join(root, 'apps', 'desktop', 'package.json'))('esbuild');

const out = await build({
  entryPoints: [path.join(root, 'tools', 'license-generator', 'main.ts')],
  bundle: true, minify: true, format: 'iife', target: 'es2022', write: false,
});
const script = out.outputFiles[0].text.replace(/<\/script>/gi, '<\\/script>');
const html = fs.readFileSync(path.join(root, 'tools', 'license-generator', 'index.html'), 'utf8').replace('/*SCRIPT*/', () => script);

const folder = process.env.SMRITIKOSH_LICENSE_DIR || path.join(os.homedir(), 'Documents', 'Smritikosh-license');
fs.mkdirSync(folder, { recursive: true });
const file = path.join(folder, 'Smritikosh-License-Generator.html');
fs.writeFileSync(file, html);
console.log('Licence generator written to', file, `(${Math.round(html.length / 1024)} KB)`);
