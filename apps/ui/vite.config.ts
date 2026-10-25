import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import obfuscateLicense from './obfuscate-license';

// base './' so the build loads from file:// (Electron) and capacitor://localhost (Android).
export default defineConfig({
  base: './',
  plugins: [react(), obfuscateLicense()],
  build: { outDir: 'dist', target: 'es2022' },
});
