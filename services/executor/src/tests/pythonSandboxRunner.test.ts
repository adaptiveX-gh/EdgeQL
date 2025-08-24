import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PythonSandboxRunner } from '../runners/PythonSandboxRunner.js';
import { ExecutionContext } from '../types.js';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';

// Mock child_process and fs modules
vi.mock('child_process');
vi.mock('fs');

describe('PythonSandboxRunner', () => {
  let runner: PythonSandboxRunner;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    runner = new PythonSandboxRunner();
    mockContext = {
      runId: 'test-run-123',
      pipelineId: 'test-pipeline',
      workingDir: '/tmp/test-run',
      artifacts: new Map(),
      datasets: new Map([['test.csv', '/datasets/test.csv']])
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('canHandle', () => {
    it('should handle Python node types', () => {
      const pythonNodes = [
        'DataLoaderNode',
        'IndicatorNode',
        'FeatureGeneratorNode',
        'LabelingNode',
        'ModelTrainerNode',
        'BacktestNode'
      ];

      pythonNodes.forEach(nodeType => {
        expect(runner.canHandle(nodeType)).toBe(true);
      });
    });

    it('should not handle non-Python node types', () => {
      const nonPythonNodes = [
        'JavaScriptNode',
        'CustomNode',
        'UnknownNode'
      ];

      nonPythonNodes.forEach(nodeType => {
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
          type: 'dataframe',
          data: [
            { timestamp: '2024-01-01', open: 100, high: 105, low: 98, close: 103, volume: 1000 }
          ]
        }
      }));
    });

    it('should execute Python node successfully', async () => {
      // Mock successful Docker execution
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            // Simulate successful execution
            setTimeout(() => callback(0), 10);
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'test-node',
        'DataLoaderNode',
        { symbol: 'BTC/USD', dataset: 'test.csv' },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.nodeId).toBe('test-node');
      expect(result.output).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle Docker execution failure', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback('Container execution failed');
          }
        }) },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10); // Exit code 1 = failure
          }
        })
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'failing-node',
        'DataLoaderNode',
        { invalid: 'params' },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Container exited with code 1');
      expect(result.logs.length).toBeGreaterThan(0);
    });

    it('should handle timeout', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn() // Never calls callback to simulate hanging
      };

      (spawn as any).mockReturnValue(mockProcess);

      const result = await runner.execute(
        'timeout-node',
        'DataLoaderNode',
        {},
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 70000); // Increase timeout for this test

    it('should pass inputs correctly to Python node', async () => {
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
        ['previous_data', { 
          type: 'dataframe', 
          data: [{ price: 100 }] 
        }]
      ]);

      await runner.execute(
        'input-test-node',
        'FeatureGeneratorNode',
        { features: [{ type: 'sma', period: 20 }] },
        inputs,
        mockContext
      );

      // Verify writeFileSync was called with correct input structure
      expect(writeFileSync).toHaveBeenCalled();
      const writeCall = (writeFileSync as any).mock.calls.find((call: any) => 
        call[0].includes('input.json')
      );
      expect(writeCall).toBeDefined();

      const inputData = JSON.parse(writeCall[1]);
      expect(inputData.nodeType).toBe('FeatureGeneratorNode');
      expect(inputData.params.features).toBeDefined();
      expect(inputData.inputs.previous_data).toBeDefined();
      expect(inputData.context.runId).toBe(mockContext.runId);
    });

    it('should apply resource constraints to Docker container', async () => {
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
        'resource-test',
        'DataLoaderNode',
        {},
        new Map(),
        mockContext
      );

      // Verify Docker was called with resource constraints
      expect(spawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          '--memory=512m',
          '--cpus=1.0',
          '--network=none',
          '--read-only',
          '--user', 'edgeql',
          '--security-opt', 'no-new-privileges'
        ]),
        expect.any(Object)
      );
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
        'no-output-node',
        'DataLoaderNode',
        {},
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('did not produce output file');
    });

    it('should handle Python node errors in output', async () => {
      (readFileSync as any).mockReturnValue(JSON.stringify({
        error: 'Python execution error: Division by zero'
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
        'python-error-node',
        'FeatureGeneratorNode',
        { invalid_params: true },
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Python node error');
      expect(result.error).toContain('Division by zero');
    });
  });

  describe('Windows Path Handling', () => {
    it('should convert Windows paths to Docker format', () => {
      // Access private method for testing
      const convertPath = (runner as any).convertToDockerPath.bind(runner);
      
      // Mock Windows platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      
      try {
        // Test drive letter conversion
        expect(convertPath('C:\\Users\\test\\data')).toBe('/c/Users/test/data');
        expect(convertPath('D:\\Projects\\EdgeQL')).toBe('/d/Projects/EdgeQL');
        
        // Test path with mixed separators (should normalize)
        expect(convertPath('C:\\temp\\edgeql-execution\\123')).toBe('/c/temp/edgeql-execution/123');
        
      } finally {
        // Restore original platform
        Object.defineProperty(process, 'platform', {
          value: originalPlatform
        });
      }
    });

    it('should use OS temp directory instead of hardcoded /tmp', async () => {
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
        'temp-path-test',
        'DataLoaderNode',
        {},
        new Map(),
        mockContext
      );

      // Verify that mkdirSync was called with OS-specific temp directory
      expect(mkdirSync).toHaveBeenCalled();
      const mkdirCall = (mkdirSync as any).mock.calls[0];
      const tempPath = mkdirCall[0];
      
      // Should not start with /tmp on Windows
      if (process.platform === 'win32') {
        expect(tempPath).not.toMatch(/^\/tmp/);
      }
      
      expect(tempPath).toMatch(/edgeql-execution/);
    });

    it('should handle non-Windows paths correctly', () => {
      const convertPath = (runner as any).convertToDockerPath.bind(runner);
      
      // Mock non-Windows platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });
      
      try {
        // Should return paths unchanged on non-Windows
        expect(convertPath('/tmp/test/path')).toBe('/tmp/test/path');
        expect(convertPath('/home/user/data')).toBe('/home/user/data');
        
      } finally {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform
        });
      }
    });
  });

  describe('Dataset Path Resolution', () => {
    it('should find project root directory correctly', () => {
      // Access private method for testing
      const findProjectRoot = (runner as any).findProjectRoot.bind(runner);
      
      // Mock existsSync to simulate project structure
      const originalExistsSync = existsSync;
      (existsSync as any).mockImplementation((path: string) => {
        // Simulate that datasets/ and package.json exist in the root directory
        return path.includes('datasets') || path.includes('package.json');
      });
      
      try {
        const projectRoot = findProjectRoot();
        
        // Should find a path that exists (mocked to return true)
        expect(typeof projectRoot).toBe('string');
        expect(projectRoot.length).toBeGreaterThan(0);
        
      } finally {
        // Restore original existsSync
        (existsSync as any).mockImplementation(originalExistsSync);
      }
    });

    it('should mount datasets from correct directory', async () => {
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
        'dataset-path-test',
        'DataLoaderNode',
        { dataset: 'sample_ohlcv.csv' },
        new Map(),
        mockContext
      );

      // Verify Docker was called with correct datasets mount
      const spawnCall = (spawn as any).mock.calls[0];
      const dockerArgs = spawnCall[1];
      
      // Find the volume mount argument
      const volumeArgIndex = dockerArgs.findIndex((arg: string) => arg.includes('datasets:/datasets:ro'));
      expect(volumeArgIndex).toBeGreaterThan(-1);
      
      // The volume mount should not contain services/api
      const volumeMount = dockerArgs[volumeArgIndex];
      expect(volumeMount).not.toContain('services/api/datasets');
    });
  });

  describe('Security', () => {
    it('should use secure Docker settings', async () => {
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
        'security-test',
        'DataLoaderNode',
        {},
        new Map(),
        mockContext
      );

      const spawnCall = (spawn as any).mock.calls[0];
      const dockerArgs = spawnCall[1];

      expect(dockerArgs).toContain('--network=none');
      expect(dockerArgs).toContain('--read-only');
      expect(dockerArgs).toContain('--user');
      expect(dockerArgs).toContain('edgeql');
      expect(dockerArgs).toContain('--security-opt');
      expect(dockerArgs).toContain('no-new-privileges');
      expect(dockerArgs).toContain('--memory=512m');
      expect(dockerArgs).toContain('--cpus=1.0');
    });
  });
});