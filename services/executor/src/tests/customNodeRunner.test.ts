import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CustomNodeRunner } from '../runners/CustomNodeRunner.js';
import { ExecutionContext } from '../types.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Mock the CustomNodeRegistry
vi.mock('@edgeql/compiler/registry/CustomNodeRegistry.js', () => {
  const mockRegistry = {
    isCustomNode: vi.fn(),
    getNode: vi.fn()
  };
  
  return {
    getCustomNodeRegistry: () => mockRegistry
  };
});

describe('CustomNodeRunner', () => {
  let runner: CustomNodeRunner;
  let testDir: string;
  let mockRegistry: any;

  beforeEach(async () => {
    // Import and get the mocked registry
    const { getCustomNodeRegistry } = await import('@edgeql/compiler/registry/CustomNodeRegistry.js');
    mockRegistry = getCustomNodeRegistry();
    
    runner = new CustomNodeRunner();
    
    // Create temporary directory for test files
    testDir = path.join(tmpdir(), `edgeql-custom-runner-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    // Reset mocks
    vi.resetAllMocks();
  });

  describe('canHandle', () => {
    it('should return true for custom nodes', () => {
      mockRegistry.isCustomNode.mockReturnValue(true);
      
      expect(runner.canHandle('CustomTestNode')).toBe(true);
      expect(mockRegistry.isCustomNode).toHaveBeenCalledWith('CustomTestNode');
    });

    it('should return false for non-custom nodes', () => {
      mockRegistry.isCustomNode.mockReturnValue(false);
      
      expect(runner.canHandle('BuiltinNode')).toBe(false);
      expect(mockRegistry.isCustomNode).toHaveBeenCalledWith('BuiltinNode');
    });
  });

  describe('execute', () => {
    let mockContext: ExecutionContext;
    
    beforeEach(() => {
      mockContext = {
        runId: 'test-run-123',
        pipelineId: 'test-pipeline',
        workingDir: '/tmp/test',
        artifacts: new Map(),
        datasets: new Map([['test.csv', '/datasets/test.csv']]),
        cancelled: false
      };
    });

    it('should fail if custom node definition is not found', async () => {
      mockRegistry.getNode.mockReturnValue(undefined);
      
      const result = await runner.execute(
        'test-node',
        'MissingNode',
        {},
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Custom node definition not found');
    });

    it('should fail if entry point does not exist', async () => {
      const mockNodeDef = {
        id: 'TestNode',
        name: 'Test Node',
        entryPoint: path.join(testDir, 'nonexistent.js'),
        inputSchema: {},
        outputSchema: {},
        requiredParams: [],
        optionalParams: []
      };

      mockRegistry.getNode.mockReturnValue(mockNodeDef);
      
      const result = await runner.execute(
        'test-node',
        'TestNode',
        {},
        new Map(),
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Custom node entry point not found');
    });

    it('should return cancelled result if context is cancelled', async () => {
      const cancelledContext = { ...mockContext, cancelled: true };
      
      const result = await runner.execute(
        'test-node',
        'TestNode',
        {},
        new Map(),
        cancelledContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution was cancelled');
      expect(result.logs).toContain('Execution cancelled before starting');
    });

    it('should execute custom node successfully with valid setup', async () => {
      // Create a simple test node script
      const testNodeScript = path.join(testDir, 'test-node.js');
      const nodeCode = `
        const fs = require('fs');
        
        const [inputFile, outputFile] = process.argv.slice(2);
        const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
        
        const outputData = {
          success: true,
          result: {
            type: 'dataframe',
            processed: true,
            input_params: inputData.params
          }
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
      `;
      
      writeFileSync(testNodeScript, nodeCode);

      const mockNodeDef = {
        id: 'TestNode',
        name: 'Test Node',
        entryPoint: testNodeScript,
        inputSchema: { type: 'dataframe' },
        outputSchema: { type: 'dataframe' },
        requiredParams: ['param1'],
        optionalParams: ['param2']
      };

      mockRegistry.getNode.mockReturnValue(mockNodeDef);

      // Mock Docker execution to avoid actual container runs in tests
      const originalSpawn = require('child_process').spawn;
      vi.spyOn(require('child_process'), 'spawn').mockImplementation((command, args, options) => {
        // Create a mock process that simulates successful execution
        const mockProcess = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              // Simulate successful execution with exit code 0
              setTimeout(() => callback(0), 10);
            }
          })
        };
        return mockProcess;
      });

      const inputs = new Map([
        ['input-data', { type: 'dataframe', columns: ['a', 'b'] }]
      ]);

      const result = await runner.execute(
        'test-node',
        'TestNode', 
        { param1: 'value1', param2: 'value2' },
        inputs,
        mockContext
      );

      // Note: This test would need actual Docker integration to fully validate
      // For unit testing, we're primarily testing the setup and validation logic
      expect(mockRegistry.getNode).toHaveBeenCalledWith('TestNode');
      expect(result.nodeId).toBe('test-node');
      
      // Restore original spawn
      require('child_process').spawn = originalSpawn;
    }, 10000); // Increased timeout for Docker operations
  });

  describe('error handling', () => {
    it('should handle exceptions gracefully', async () => {
      // Mock getNode to throw an exception
      mockRegistry.getNode.mockImplementation(() => {
        throw new Error('Registry error');
      });

      const result = await runner.execute(
        'test-node',
        'ErrorNode',
        {},
        new Map(),
        {
          runId: 'test-run',
          pipelineId: 'test-pipeline', 
          workingDir: '/tmp/test',
          artifacts: new Map(),
          datasets: new Map(),
          cancelled: false
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Registry error');
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });
});