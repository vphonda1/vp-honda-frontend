// ════════════════════════════════════════════════════════════════════════════
// vite.config.js — VP Honda PWA Configuration
// ════════════════════════════════════════════════════════════════════════════

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Important: ensure service worker and manifest are at root
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          excel: ['xlsx', 'html2pdf.js'],
        },
      },
    },
  },
  // Public files (manifest.json, service-worker.js, icons/) are auto-copied from /public
  publicDir: 'public',
});