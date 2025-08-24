import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NodejsSandboxRunner } from '../runners/nodejsSandboxRunner.js';
import { ExecutionContext } from '../types.js';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';

// Mock child_process and fs modules
vi.mock('child_process');
vi.mock('fs');

describe('NodejsSandboxRunner', () => {
  let runner: NodejsSandboxRunner;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    runner = new NodejsSandboxRunner();
    mockContext = {
      runId: 'test-run-456',
      pipelineId: 'test-pipeline-js',
      workingDir: '/tmp/test-run-js',
      artifacts: new Map(),
      datasets: new Map([['test.csv', '/datasets/test.csv']])
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('canHandle', () => {
    it('should handle Node.js node types', () => {
      const nodejsNodes = [
        'DataTransformNode',
        'FilterNode',
        'AggregationNode',
        'JoinNode',
        'ValidationNode'
      ];

      nodejsNodes.forEach(nodeType => {
        expect(runner.canHandle(nodeType)).toBe(true);
      });
    });

    it('should not handle non-Node.js node types', () => {
      const nonNodejsNodes = [
        'DataLoaderNode',
        'FeatureGeneratorNode',
        'PythonNode',
        'UnknownNode'
      ];

      nonNodejsNodes.forEach(nodeType => {
        expect(runner.canHandle(nodeType)).toBe(false);
      });
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Mock file system operations
      (mkdirSync as any).mockImplementation(() => {});
      (writeFileSync as any).mockImplementation(() => {});
      (existsSync as any).mockReturnValue(true);
      (readFileSync as any).mockReturnValue(JSON.stringify({
        result: {
          type: 'transformed_data',
          data: [
            { id: 1, value: 'transformed', processed: true }
          ]
        }
      }));
    });

    it('should execute Node.js node successfully', async () => {
      // Mock successful Docker execution
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
        'transform-node',
        'DataTransformNode',
        { transformation: 'normalize' },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.nodeId).toBe('transform-node');
      expect(result.output).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle Docker execution failure', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback('Node.js execution failed');
          }
        }) },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'failing-js-node',
        'FilterNode',
        { invalid: 'config' },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container exited with code 1');
      expect(result.logs.length).toBeGreaterThan(0);
    });

    it('should handle timeout with shorter duration than Python', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn() // Never calls callback to simulate hanging
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'timeout-js-node',
        'ValidationNode',
        {},
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 40000); // Should timeout faster than Python (30s vs 60s)

    it('should apply correct resource constraints', async () => {
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
        'resource-test-js',
        'AggregationNode',
        {},
        new Map(),
        mockContext
      );

      // Verify Docker was called with Node.js-specific resource constraints
      expect(spawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          '--memory=256m',  // Less memory than Python
          '--cpus=0.5',     // Less CPU than Python
          '--network=none',
          '--read-only',
          '--user', 'edgeql',
          '--security-opt', 'no-new-privileges',
          'edgeql-nodejs-sandbox'
        ]),
        expect.any(Object)
      );
    });

    it('should pass inputs correctly to Node.js node', async () => {
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

      const inputs = new Map([
        ['input_data', { 
          type: 'dataframe', 
          data: [{ field1: 'value1', field2: 42 }] 
        }]
      ]);

      await runner.execute(
        'input-test-js-node',
        'FilterNode',
        { filter_criteria: { field2: { $gt: 40 } } },
        inputs,
        mockContext
      );

      // Verify input structure
      expect(writeFileSync).toHaveBeenCalled();
      const writeCall = (writeFileSync as any).mock.calls.find((call: any) => 
        call[0].includes('input.json')
      );
      expect(writeCall).toBeDefined();

      const inputData = JSON.parse(writeCall[1]);
      expect(inputData.nodeType).toBe('FilterNode');
      expect(inputData.params.filter_criteria).toBeDefined();
      expect(inputData.inputs.input_data).toBeDefined();
      expect(inputData.context.runId).toBe(mockContext.runId);
    });

    it('should handle missing output file', async () => {
      (existsSync as any).mockReturnValue(false);

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
        'no-output-js-node',
        'JoinNode',
        {},
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('did not produce output file');
    });

    it('should handle Node.js runtime errors in output', async () => {
      (readFileSync as any).mockReturnValue(JSON.stringify({
        error: 'TypeError: Cannot read property of undefined'
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
        'js-error-node',
        'DataTransformNode',
        { invalid_transformation: true },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Node.js node error');
      expect(result.error).toContain('TypeError');
    });
  });

  describe('Security', () => {
    it('should use secure Docker settings with Node.js optimizations', async () => {
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
        'security-test-js',
        'ValidationNode',
        {},
        new Map(),
        mockContext
      );

      const spawnCall = (spawn as any).mock.calls[0];
      const dockerArgs = spawnCall[1];

      // Verify all security constraints
      expect(dockerArgs).toContain('--network=none');
      expect(dockerArgs).toContain('--read-only');
      expect(dockerArgs).toContain('--user');
      expect(dockerArgs).toContain('edgeql');
      expect(dockerArgs).toContain('--security-opt');
      expect(dockerArgs).toContain('no-new-privileges');
      
      // Verify Node.js-specific resource limits
      expect(dockerArgs).toContain('--memory=256m');
      expect(dockerArgs).toContain('--cpus=0.5');
      
      // Verify correct image is used
      expect(dockerArgs).toContain('edgeql-nodejs-sandbox');
    });

    it('should mount datasets as read-only', async () => {
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
        'dataset-mount-test',
        'DataTransformNode',
        {},
        new Map(),
        mockContext
      );

      const spawnCall = (spawn as any).mock.calls[0];
      const dockerArgs = spawnCall[1];

      // Find the datasets volume mount
      const datasetMountIndex = dockerArgs.findIndex((arg: string) => 
        arg.includes('/datasets:/datasets:ro')
      );
      expect(datasetMountIndex).toBeGreaterThan(-1);
    });
  });

  describe('Performance', () => {
    it('should have faster timeout than Python sandbox', async () => {
      const startTime = Date.now();
      
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn() // Simulates hanging process
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'timeout-comparison',
        'FilterNode',
        {},
        new Map(),
        mockContext
      );

      const executionTime = Date.now() - startTime;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(executionTime).toBeLessThan(35000); // Should timeout in ~30s, not 60s
    }, 40000);
  });
});