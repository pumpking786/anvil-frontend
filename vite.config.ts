import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig(({ mode }) => ({
  // Expose exactly one public setting, even if the host injects other VITE_* keys.
  // Resolve only frontend env files, never the backend's private environment.
  envPrefix: [],
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      loadEnv(mode, fileURLToPath(new URL('.', import.meta.url))).VITE_API_URL || '',
    ),
  },
  // PDF components run in a worker, where React's browser refresh runtime has no window.
  plugins: [react({ exclude: [/\/node_modules\//, /\/src\/pdf\//] })],
  // Prebundle PDF dependencies before the first export so Vite does not reload an active session.
  optimizeDeps: { include: ['@react-pdf/renderer', 'buffer', 'pdf-lib', 'pdfjs-dist'] },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3001' },
    // The combined project installs packages above frontend/. Permit those
    // static worker/font assets without exposing the backend or private data.
    fs: {
      allow: [
        fileURLToPath(new URL('.', import.meta.url)),
        fileURLToPath(new URL('../node_modules', import.meta.url)),
      ],
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (/\/(?:react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (id.includes('/zod/')) return 'validation';
        },
      },
    },
  },
}));
