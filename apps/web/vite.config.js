import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import svelteConfig from './svelte.config.vite.js';

export default defineConfig({
  plugins: [
    svelte(svelteConfig)
  ],
  root: '.',
  publicDir: 'static',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
        },
      },
    },
    // Ensure Monaco worker files are copied to dist
    copyPublicDir: true,
  },
  optimizeDeps: {
    // Exclude monaco-editor from dependency optimization to avoid issues
    exclude: ['monaco-editor'],
    include: []
  },
  define: {
    global: 'globalThis',
  },
  // Worker configuration removed as Monaco runs in main thread
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: {
      allow: ['..', '../../node_modules'],
      // Allow serving monaco-editor files
      strict: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  assetsInclude: ['**/*.wasm']
});