/**
 * Vitest setup file
 * Global test configuration and setup
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mockFactory } from '../helpers/mocks.js';

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.EDGEQL_TEST_MODE = 'true';
  process.env.EDGEQL_LOG_LEVEL = 'error';
  
  // Mock console methods in test environment
  if (!process.env.DEBUG_TESTS) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  }
  
  // Set up global test timeouts
  vi.setConfig({
    testTimeout: 10000, // 10 seconds default
    hookTimeout: 5000   // 5 seconds for setup/teardown
  });
});

afterAll(() => {
  // Restore all mocks
  vi.restoreAllMocks();
  
  // Clean up any global resources
  if (global.gc) {
    global.gc();
  }
});

beforeEach(() => {
  // Reset mocks before each test
  mockFactory.resetAllMocks();
  
  // Clear any cached modules
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up test-specific resources
  vi.clearAllTimers();
});

// Global test utilities
declare global {
  namespace Vi {
    interface JestAssertion {
      toBeWithinRange(floor: number, ceiling: number): void;
      toBeValidUUID(): void;
      toBeValidTimestamp(): void;
    }
  }
}

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
  
  toBeValidTimestamp(received: string) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime()) && date.toISOString() === received;
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ISO timestamp`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ISO timestamp`,
        pass: false,
      };
    }
  }
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in test environment
});

// Global uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process in test environment
});