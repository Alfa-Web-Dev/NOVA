import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devProxy } from './scripts/dev-proxy.mjs';

// Relative base => works at a domain root, a GitHub Pages sub-path, and inside Capacitor (Android).
export default defineConfig({
  plugins: [react(), devProxy()], // devProxy only runs under `npm run dev`
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
