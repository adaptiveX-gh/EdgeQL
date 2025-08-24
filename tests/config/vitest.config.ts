/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    
    // Test file patterns
    include: [
      'services/**/*.test.ts',
      'tests/**/*.test.ts',
      'apps/**/*.test.ts'
    ],
    
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.svelte-kit/**',
      'coverage/**',
      'reports/**'
    ],
    
    // Reporter configuration
    reporter: ['default', 'json', 'html', 'junit'],
    outputFile: {
      json: './reports/vitest-results.json',
      html: './reports/vitest-report.html',
      junit: './reports/vitest-junit.xml'
    },
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './reports/coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.test.ts',
        '**/*.config.ts',
        '**/*.d.ts',
        'tests/helpers/**',
        'tests/fixtures/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Performance
    testTimeout: 30000, // 30 seconds for individual tests
    hookTimeout: 10000, // 10 seconds for hooks
    
    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    },
    
    // Setup files
    setupFiles: [
      './tests/config/vitest.setup.ts'
    ],
    
    // Mock configuration  
    deps: {
      external: ['dockerode']
    },
    
    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      EDGEQL_TEST_MODE: 'true',
      EDGEQL_LOG_LEVEL: 'error'
    }
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@tests': path.resolve(__dirname, '../'),
      '@helpers': path.resolve(__dirname, '../helpers'),
      '@fixtures': path.resolve(__dirname, '../helpers/fixtures')
    }
  }
});