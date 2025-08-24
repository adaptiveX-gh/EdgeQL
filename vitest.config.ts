/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'services/**/*.test.ts',
      'tests/**/*.test.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'apps/web/**' // Web app has its own test config
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.config.ts'
      ]
    }
  }
});