import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NodejsSandboxRunner } from '../runners/nodejsSandboxRunner.js';
import { ExecutionContext } from '../types.js';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';

// Mock child_process and fs modules
vi.mock('child_process');
vi.mock('fs');

describe('Enhanced Sandbox Security Tests', () => {
  let runner: NodejsSandboxRunner;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    runner = new NodejsSandboxRunner();
    mockContext = {
      runId: 'security-test-run',
      pipelineId: 'security-test-pipeline',
      workingDir: '/tmp/security-test',
      artifacts: new Map(),
      datasets: new Map([['test.csv', '/datasets/test.csv']])
    };

    // Reset mocks
    vi.clearAllMocks();

    // Mock file system operations
    (mkdirSync as any).mockImplementation(() => {});
    (writeFileSync as any).mockImplementation(() => {});
    (existsSync as any).mockReturnValue(true);
  });

  describe('Memory Limit Enforcement', () => {
    it('should enforce configurable memory limits', async () => {
      // Mock successful execution with memory stats
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: true,
        result: { data: 'processed' },
        stats: {
          memoryUsed: 256,
          peakMemory: 300,
          executionTime: 2.5
        }
      }));

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      await runner.execute(
        'memory-test-node',
        'CustomJSNode',
        { 
          code: 'return { result: "test" };',
          memoryLimit: 256, // Custom memory limit
          timeLimit: 20
        },
        new Map(),
        mockContext
      );

      // Verify Docker was called with correct memory limit
      expect(spawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          '--memory', '256m',
          '--memory-swap', '256m',
          '--env', 'SANDBOX_MEMORY_MB=256'
        ]),
        expect.any(Object)
      );
    });

    it('should handle memory limit violations', async () => {
      // Mock memory violation response
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: false,
        error: 'Memory usage (600.00MB) exceeded limit of 512MB',
        violationType: 'MEMORY_LIMIT',
        details: {
          currentMemory: 600,
          limit: 512,
          peakMemory: 650
        }
      }));

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'memory-bomb-node',
        'CustomJSNode',
        { 
          code: 'const bigArray = new Array(1000000).fill("x".repeat(1000)); return bigArray;',
          memoryLimit: 512
        },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('MEMORY_LIMIT');
      expect(result.error).toContain('exceeded limit');
    });
  });

  describe('Time Limit Enforcement', () => {
    it('should enforce configurable time limits', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn() // Simulate hanging process
      };

      (spawn as any).mockReturnValue(mockProcess);

      const customTimeLimit = 10; // 10 seconds
      const startTime = Date.now();

      const result = await runner.execute(
        'timeout-test-node',
        'CustomJSNode',
        { 
          code: 'while(true) {}', // Infinite loop
          timeLimit: customTimeLimit
        },
        new Map(),
        mockContext
      );

      const executionTime = (Date.now() - startTime) / 1000;

      expect(result.success).toBe(false);
      expect(result.error).toContain(`timeout (${customTimeLimit} seconds)`);
      expect(executionTime).toBeLessThan(customTimeLimit + 10); // Should timeout within buffer
    });

    it('should handle timeout violations from sandbox', async () => {
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: false,
        error: 'Execution time (35.50s) exceeded limit of 30s',
        violationType: 'TIMEOUT',
        details: {
          currentTime: 35.5,
          limit: 30
        }
      }));

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'slow-node',
        'CustomJSNode',
        { 
          code: 'setTimeout(() => {}, 35000);', // Long timeout
          timeLimit: 30
        },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('TIMEOUT');
      expect(result.error).toContain('exceeded limit of 30s');
    });
  });

  describe('API Access Restrictions', () => {
    it('should block dangerous module access', async () => {
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: false,
        error: "Access to module 'fs' is not allowed in sandbox",
        violationType: 'RESTRICTED_MODULE',
        details: {
          module: 'fs'
        }
      }));

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'dangerous-fs-node',
        'CustomJSNode',
        { 
          code: 'const fs = require("fs"); fs.unlinkSync("/important/file");',
          enableFileSystem: false
        },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('RESTRICTED_MODULE');
      expect(result.error).toContain("'fs' is not allowed");
    });

    it('should block network access when disabled', async () => {
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: false,
        error: "Access to module 'http' is not allowed in sandbox",
        violationType: 'RESTRICTED_MODULE',
        details: {
          module: 'http'
        }
      }));

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'network-node',
        'CustomJSNode',
        { 
          code: 'const http = require("http"); http.get("http://evil.com");',
          enableNetworking: false
        },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('RESTRICTED_MODULE');
    });

    it('should block eval and dynamic code execution', async () => {
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: false,
        error: 'Dynamic code execution via eval() is not allowed in sandbox',
        violationType: 'DYNAMIC_CODE'
      }));

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'eval-node',
        'CustomJSNode',
        { 
          code: 'eval("process.exit(1)");'
        },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('DYNAMIC_CODE');
      expect(result.error).toContain('eval() is not allowed');
    });

    it('should enforce allowed modules whitelist', async () => {
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: false,
        error: "Module 'crypto' is not in the allowed modules list",
        violationType: 'UNAUTHORIZED_MODULE',
        details: {
          module: 'crypto',
          allowedModules: ['lodash', 'moment']
        }
      }));

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'unauthorized-module-node',
        'CustomJSNode',
        { 
          code: 'const crypto = require("crypto"); return crypto.randomBytes(10);',
          allowedModules: ['lodash', 'moment']
        },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('UNAUTHORIZED_MODULE');
      expect(result.error).toContain('not in the allowed modules list');
    });
  });

  describe('Docker Security Configuration', () => {
    it('should apply strict security constraints', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: true,
        result: { data: 'secure' }
      }));

      await runner.execute(
        'security-config-test',
        'CustomJSNode',
        { code: 'return { result: "test" };' },
        new Map(),
        mockContext
      );

      const spawnCall = (spawn as any).mock.calls[0];
      const dockerArgs = spawnCall[1];

      // Verify comprehensive security settings
      expect(dockerArgs).toContain('--network=none');
      expect(dockerArgs).toContain('--read-only');
      expect(dockerArgs).toContain('--user');
      expect(dockerArgs).toContain('edgeql');
      expect(dockerArgs).toContain('--security-opt');
      expect(dockerArgs).toContain('no-new-privileges');
      expect(dockerArgs).toContain('--security-opt');
      expect(dockerArgs).toContain('seccomp=default');
      expect(dockerArgs).toContain('--cap-drop');
      expect(dockerArgs).toContain('ALL');
      expect(dockerArgs).toContain('--pids-limit');
      expect(dockerArgs).toContain('50');
    });

    it('should use isolated workspace with tmpfs', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: true,
        result: { data: 'isolated' }
      }));

      await runner.execute(
        'isolation-test',
        'CustomJSNode',
        { code: 'return { result: "test" };' },
        new Map(),
        mockContext
      );

      const spawnCall = (spawn as any).mock.calls[0];
      const dockerArgs = spawnCall[1];

      // Verify tmpfs usage for isolation
      expect(dockerArgs).toContain('--tmpfs');
      expect(dockerArgs.find(arg => arg.includes('/workspace:rw,noexec,nosuid'))).toBeDefined();
      expect(dockerArgs.find(arg => arg.includes('/tmp:rw,noexec,nosuid'))).toBeDefined();
    });

    it('should configure networking based on permissions', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: true,
        result: { data: 'network test' }
      }));

      // Test with networking enabled
      await runner.execute(
        'network-enabled-test',
        'CustomJSNode',
        { 
          code: 'return { result: "test" };',
          enableNetworking: true
        },
        new Map(),
        mockContext
      );

      const spawnCall = (spawn as any).mock.calls[0];
      const dockerArgs = spawnCall[1];

      expect(dockerArgs).toContain('--net=bridge');
      expect(dockerArgs).not.toContain('--network=none');
    });
  });

  describe('Resource Monitoring', () => {
    it('should report execution statistics', async () => {
      const mockStats = {
        memoryUsed: 128.5,
        peakMemory: 150.2,
        executionTime: 5.75,
        rss: 200.1
      };

      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: true,
        result: { data: 'processed' },
        stats: mockStats
      }));

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'stats-test-node',
        'CustomJSNode',
        { code: 'return { result: "test" };' },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.memoryUsage).toBe(mockStats.memoryUsed);
      expect(result.peakMemory).toBe(mockStats.peakMemory);
      expect(result.sandboxStats).toEqual(mockStats);
    });
  });

  describe('Error Handling and Cleanup', () => {
    it('should properly handle and report sandbox violations', async () => {
      (readFileSync as any).mockReturnValue(JSON.stringify({
        success: false,
        error: 'Custom violation message',
        violationType: 'CUSTOM_VIOLATION',
        details: {
          customField: 'customValue',
          severity: 'high'
        }
      }));

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'violation-test-node',
        'CustomJSNode',
        { code: 'throw new Error("test");' },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('CUSTOM_VIOLATION');
      expect(result.error).toContain('Custom violation message');
      expect(result.logs.some(log => log.includes('Violation details'))).toBe(true);
    });

    it('should handle container cancellation', async () => {
      // Test cancellation functionality
      const cancelledContext = { ...mockContext, cancelled: true };

      const result = await runner.execute(
        'cancelled-node',
        'CustomJSNode',
        { code: 'return { result: "test" };' },
        new Map(),
        cancelledContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });
});