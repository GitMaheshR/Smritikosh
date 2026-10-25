/**
 * electron-builder afterPack hook: stamps the Smritikosh icon onto the app .exe.
 * electron-builder normally does this itself, but that step is switched off here ("signAndEditExecutable": false)
 * because it needs a code-signing tool that can't be unpacked without Windows symlink rights.
 * rcedit (the same tool) is reused from electron-builder's cache when present; otherwise the step is skipped.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function findRcedit() {
  const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'electron-builder', 'Cache', 'winCodeSign');
  if (!fs.existsSync(cache)) return null;
  for (const d of fs.readdirSync(cache)) {
    const exe = path.join(cache, d, 'rcedit-x64.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const rcedit = findRcedit();
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const icon = path.join(context.packager.projectDir, 'build', 'icon.ico');
  if (!rcedit || !fs.existsSync(icon)) {
    console.warn('  • afterPack: rcedit or icon.ico not found, the .exe keeps the default icon');
    return;
  }
  execFileSync(rcedit, [exe, '--set-icon', icon, '--set-version-string', 'FileDescription', 'Smritikosh', '--set-version-string', 'ProductName', 'Smritikosh']);
  console.log('  • afterPack: icon set on', path.basename(exe));
};
