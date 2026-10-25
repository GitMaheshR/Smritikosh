// Vite plugin: scrambles the activation logic (src/license/*.ts and packages/core/src/license.ts) in production
// builds, so it cannot be found by searching for its text or followed by reading it. Only these files are scrambled;
// the rest of the app stays normally minified (smaller and faster). Development builds are left readable.
import type { Plugin } from 'vite';
import JavaScriptObfuscator from 'javascript-obfuscator';

const LICENSE_FILE = /(?:[\\/]apps[\\/]ui[\\/]src[\\/]license[\\/][^\\/]+|[\\/]packages[\\/]core[\\/]src[\\/]license)\.ts$/;

export const OBFUSCATION_OPTIONS = {
  compact: true,
  target: 'browser',
  sourceType: 'module',
  sourceMap: false,
  // Hide all text (messages, storage names, plugin names) behind an encoded lookup table.
  stringArray: true,
  stringArrayThreshold: 1,
  stringArrayEncoding: ['rc4'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersType: 'function',
  splitStrings: true,
  splitStringsChunkLength: 4,
  // Shuffle the order of the logic and mix in decoy code.
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  numbersToExpressions: true,
  transformObjectKeys: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  // Self-defending code breaks when the build's own minifier reformats it, so it stays off.
  selfDefending: false,
  unicodeEscapeSequence: false,
} as const;

export default function obfuscateLicense(): Plugin {
  return {
    name: 'smritikosh-obfuscate-license',
    apply: 'build',
    enforce: 'post', // after TypeScript has been compiled to plain JavaScript
    transform(code, id) {
      if (!LICENSE_FILE.test(id.split('?')[0]!)) return null;
      return { code: JavaScriptObfuscator.obfuscate(code, OPTIONS_MUTABLE).getObfuscatedCode(), map: null };
    },
  };
}

// javascript-obfuscator wants a mutable options object
const OPTIONS_MUTABLE = JSON.parse(JSON.stringify(OBFUSCATION_OPTIONS));
