import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build loads from file:// (Electron) and capacitor://localhost (Android).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', target: 'es2022' },
});
