/**
 * Mock implementations for testing
 * Provides mock services, runners, and external dependencies
 */

import { vi } from 'vitest';
import { mockNodeResults, mockDockerResponses, testUtils } from './fixtures.js';

// Mock Docker container implementation
export class MockDockerContainer {
  private mockBehavior: 'success' | 'error' | 'timeout' = 'success';
  
  constructor(behavior: 'success' | 'error' | 'timeout' = 'success') {
    this.mockBehavior = behavior;
  }

  async start() {
    await testUtils.sleep(50); // Simulate container startup
    return Promise.resolve();
  }

  async wait() {
    await testUtils.sleep(100); // Simulate execution time
    
    switch (this.mockBehavior) {
      case 'success':
        return { StatusCode: 0 };
      case 'error':
        return { StatusCode: 1 };
      case 'timeout':
        return { StatusCode: 124 };
    }
  }

  async logs() {
    switch (this.mockBehavior) {
      case 'success':
        return [mockDockerResponses.pythonSuccess.stdout];
      case 'error':
        return [mockDockerResponses.pythonError.stderr];
      case 'timeout':
        return [mockDockerResponses.timeout.stderr];
    }
  }

  async remove() {
    await testUtils.sleep(25); // Simulate cleanup
    return Promise.resolve();
  }
}

// Mock Docker service
export class MockDockerService {
  private containers = new Map<string, MockDockerContainer>();

  createContainer = vi.fn().mockImplementation((options: any) => {
    const containerId = testUtils.generateRunId();
    const behavior = options.Env?.includes('MOCK_ERROR=1') ? 'error' : 
                    options.Env?.includes('MOCK_TIMEOUT=1') ? 'timeout' : 'success';
    
    const container = new MockDockerContainer(behavior);
    this.containers.set(containerId, container);
    
    return Promise.resolve({
      id: containerId,
      ...container
    });
  });

  getContainer = vi.fn().mockImplementation((id: string) => {
    return this.containers.get(id) || new MockDockerContainer('error');
  });

  listContainers = vi.fn().mockResolvedValue([]);
  
  pruneContainers = vi.fn().mockResolvedValue({ ContainersDeleted: [], SpaceReclaimed: 0 });
}

// Mock file system operations
export const mockFs = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  rmdir: vi.fn(),
  stat: vi.fn(),
  
  // Setup common behaviors
  setupSuccess: () => {
    mockFs.readFile.mockResolvedValue('test,data\n1,2\n3,4');
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.exists.mockResolvedValue(true);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.rmdir.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ size: 1024, mtime: new Date() });
  },
  
  setupFileNotFound: () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));
    mockFs.exists.mockResolvedValue(false);
    mockFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));
  },
  
  setupPermissionError: () => {
    mockFs.readFile.mockRejectedValue(new Error('EACCES: permission denied'));
    mockFs.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));
  }
};

// Mock compiler service
export const mockCompilerService = {
  compile: vi.fn(),
  validate: vi.fn(),
  
  setupSuccess: () => {
    mockCompilerService.compile.mockResolvedValue({
      success: true,
      pipeline: {
        nodes: [
          {
            id: 'test_node',
            type: 'DataLoaderNode',
            runtime: 'python',
            dependencies: [],
            parameters: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
          }
        ],
        executionOrder: ['test_node'],
        metadata: {
          version: '0.1.0',
          compiledAt: new Date().toISOString(),
          totalNodes: 1
        }
      }
    });
    mockCompilerService.validate.mockResolvedValue({ valid: true, errors: [] });
  },
  
  setupCompilationError: () => {
    mockCompilerService.compile.mockResolvedValue({
      success: false,
      errors: [
        {
          type: 'validation',
          message: 'Missing required parameter: timeframe',
          nodeId: 'test_node',
          line: 5
        }
      ]
    });
    mockCompilerService.validate.mockResolvedValue({
      valid: false,
      errors: ['Missing required parameter: timeframe']
    });
  }
};

// Mock executor service
export const mockExecutorService = {
  execute: vi.fn(),
  cancel: vi.fn(),
  getStatus: vi.fn(),
  
  setupSuccess: () => {
    mockExecutorService.execute.mockResolvedValue({
      success: true,
      runId: testUtils.generateRunId(),
      results: new Map([
        ['test_node', mockNodeResults.dataLoader]
      ]),
      finalOutputs: new Map([
        ['test_node', mockNodeResults.dataLoader.output]
      ]),
      totalExecutionTime: 235
    });
    
    mockExecutorService.getStatus.mockResolvedValue({
      status: 'completed',
      progress: 100,
      currentNode: null,
      errors: []
    });
    
    mockExecutorService.cancel.mockResolvedValue({
      success: true,
      message: 'Pipeline execution cancelled'
    });
  },
  
  setupExecutionError: () => {
    mockExecutorService.execute.mockResolvedValue({
      success: false,
      error: 'Node execution failed: Invalid input data',
      runId: testUtils.generateRunId(),
      results: new Map(),
      finalOutputs: new Map(),
      totalExecutionTime: 125
    });
    
    mockExecutorService.getStatus.mockResolvedValue({
      status: 'failed',
      progress: 45,
      currentNode: 'failed_node',
      errors: ['Invalid input data']
    });
  }
};

// Mock node runners
export const mockNodeRunners = {
  python: {
    canHandle: vi.fn().mockReturnValue(true),
    execute: vi.fn().mockResolvedValue(mockNodeResults.dataLoader)
  },
  
  javascript: {
    canHandle: vi.fn().mockReturnValue(true),
    execute: vi.fn().mockResolvedValue({
      success: true,
      nodeId: 'js_node',
      executionTime: 50,
      output: { type: 'json', data: { processed: true } },
      error: null
    })
  },
  
  builtin: {
    canHandle: vi.fn().mockReturnValue(true),
    execute: vi.fn().mockResolvedValue(mockNodeResults.smaIndicator)
  }
};

// Mock HTTP client for external API calls
export const mockHttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  
  setupSuccess: () => {
    mockHttpClient.get.mockResolvedValue({
      status: 200,
      data: { success: true, data: 'mock response' }
    });
    mockHttpClient.post.mockResolvedValue({
      status: 201,
      data: { success: true, id: testUtils.generateRunId() }
    });
  },
  
  setupNetworkError: () => {
    const networkError = new Error('Network Error');
    mockHttpClient.get.mockRejectedValue(networkError);
    mockHttpClient.post.mockRejectedValue(networkError);
  },
  
  setupServerError: () => {
    mockHttpClient.get.mockResolvedValue({
      status: 500,
      data: { success: false, error: 'Internal Server Error' }
    });
  }
};

// Mock database/storage operations
export const mockStorage = {
  runs: new Map(),
  pipelines: new Map(),
  datasets: new Map(),
  
  // Run operations
  saveRun: vi.fn().mockImplementation((run: any) => {
    mockStorage.runs.set(run.id, run);
    return Promise.resolve(run);
  }),
  
  getRun: vi.fn().mockImplementation((id: string) => {
    return Promise.resolve(mockStorage.runs.get(id));
  }),
  
  listRuns: vi.fn().mockImplementation(() => {
    return Promise.resolve(Array.from(mockStorage.runs.values()));
  }),
  
  deleteRun: vi.fn().mockImplementation((id: string) => {
    const existed = mockStorage.runs.has(id);
    mockStorage.runs.delete(id);
    return Promise.resolve(existed);
  }),
  
  // Pipeline operations
  savePipeline: vi.fn().mockImplementation((pipeline: any) => {
    mockStorage.pipelines.set(pipeline.id, pipeline);
    return Promise.resolve(pipeline);
  }),
  
  getPipeline: vi.fn().mockImplementation((id: string) => {
    return Promise.resolve(mockStorage.pipelines.get(id));
  }),
  
  // Clear all data
  clear: () => {
    mockStorage.runs.clear();
    mockStorage.pipelines.clear();
    mockStorage.datasets.clear();
  }
};

// Mock metrics collection
export const mockMetrics = {
  counter: vi.fn(),
  histogram: vi.fn(),
  gauge: vi.fn(),
  
  recordNodeExecution: vi.fn(),
  recordPipelineExecution: vi.fn(),
  recordApiRequest: vi.fn(),
  
  getMetrics: vi.fn().mockResolvedValue({
    totalPipelines: 10,
    totalRuns: 50,
    avgExecutionTime: 1250,
    successRate: 0.92
  })
};

// Mock logging service
export const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  
  // Create child logger
  child: vi.fn().mockReturnThis(),
  
  // Get logged messages for testing
  getMessages: () => ({
    info: mockLogger.info.mock.calls,
    warn: mockLogger.warn.mock.calls,
    error: mockLogger.error.mock.calls,
    debug: mockLogger.debug.mock.calls
  })
};

// Mock configuration service
export const mockConfig = {
  get: vi.fn(),
  set: vi.fn(),
  
  setupDefaults: () => {
    mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        'executor.timeout': 300000,
        'executor.maxConcurrent': 5,
        'docker.python.image': 'python:3.9-slim',
        'docker.node.image': 'node:18-alpine',
        'storage.path': '/tmp/edgeql',
        'api.port': 3000,
        'metrics.enabled': true
      };
      return config[key as keyof typeof config] ?? defaultValue;
    });
  }
};

// Mock event emitter for system events
export const mockEventEmitter = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  
  // Helper to trigger events in tests
  trigger: (event: string, ...args: any[]) => {
    const handlers = mockEventEmitter.on.mock.calls
      .filter(call => call[0] === event)
      .map(call => call[1]);
    
    handlers.forEach(handler => handler(...args));
  }
};

// Factory functions for creating mock instances
export const mockFactory = {
  /**
   * Create a complete mock environment for integration tests
   */
  createIntegrationMocks: () => {
    mockFs.setupSuccess();
    mockCompilerService.setupSuccess();
    mockExecutorService.setupSuccess();
    mockHttpClient.setupSuccess();
    mockConfig.setupDefaults();
    mockStorage.clear();
    
    return {
      fs: mockFs,
      compiler: mockCompilerService,
      executor: mockExecutorService,
      http: mockHttpClient,
      storage: mockStorage,
      config: mockConfig,
      logger: mockLogger,
      metrics: mockMetrics,
      events: mockEventEmitter
    };
  },

  /**
   * Create mocks that simulate error conditions
   */
  createErrorMocks: () => {
    mockFs.setupFileNotFound();
    mockCompilerService.setupCompilationError();
    mockExecutorService.setupExecutionError();
    mockHttpClient.setupNetworkError();
    
    return {
      fs: mockFs,
      compiler: mockCompilerService,
      executor: mockExecutorService,
      http: mockHttpClient
    };
  },

  /**
   * Reset all mocks to clean state
   */
  resetAllMocks: () => {
    vi.clearAllMocks();
    mockStorage.clear();
    
    // Reset mock implementations to defaults
    Object.values(mockNodeRunners).forEach(runner => {
      runner.canHandle.mockClear();
      runner.execute.mockClear();
    });
  }
};

export default {
  MockDockerContainer,
  MockDockerService,
  mockFs,
  mockCompilerService,
  mockExecutorService,
  mockNodeRunners,
  mockHttpClient,
  mockStorage,
  mockMetrics,
  mockLogger,
  mockConfig,
  mockEventEmitter,
  mockFactory
};