import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['../../tests/unit/**/*.test.{js,ts}'],
    globals: true
  },
  resolve: {
    alias: {
      '$lib': './src/lib',
      '$app': '@sveltejs/kit/src/runtime/app'
    }
  }
});