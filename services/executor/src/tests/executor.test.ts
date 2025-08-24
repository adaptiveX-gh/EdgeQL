import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PipelineExecutor } from '../index.js';
import { BuiltinNodeRunner } from '../runners/builtinRunner.js';
import { PythonSandboxRunner } from '../runners/pythonSandboxRunner.js';
import { NodejsSandboxRunner } from '../runners/nodejsSandboxRunner.js';
import { ExecutionContext, PipelineExecutionResult } from '../types.js';

describe('PipelineExecutor', () => {
  let executor: PipelineExecutor;
  
  beforeEach(() => {
    executor = new PipelineExecutor();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with all three runners', () => {
      expect(executor).toBeDefined();
      expect(executor['runners']).toHaveLength(3);
      expect(executor['runners'][0]).toBeInstanceOf(PythonSandboxRunner);
      expect(executor['runners'][1]).toBeInstanceOf(NodejsSandboxRunner);
      expect(executor['runners'][2]).toBeInstanceOf(BuiltinNodeRunner);
    });
  });

  describe('executePipeline', () => {
    it('should execute a simple DSL pipeline successfully', async () => {
      const simpleDSL = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "sample_ohlcv.csv"
      
  - id: indicator
    type: IndicatorNode
    depends_on: [data_loader]
    params:
      indicator: "SMA"
      period: 20
      column: "close"
`;

      const result = await executor.executePipeline('test-pipeline', simpleDSL);
      
      expect(result.success).toBe(true);
      expect(result.runId).toBeDefined();
      expect(result.results.size).toBeGreaterThan(0);
      expect(result.totalExecutionTime).toBeGreaterThan(0);
    });

    it('should handle compilation errors gracefully', async () => {
      const invalidDSL = `
invalid:
  syntax: error
`;

      const result = await executor.executePipeline('invalid-pipeline', invalidDSL);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Compilation failed');
    });

    it('should handle node execution failures', async () => {
      const dslWithInvalidNode = `
pipeline:
  - id: invalid_node
    type: NonExistentNode
    params:
      invalid: true
`;

      const result = await executor.executePipeline('failing-pipeline', dslWithInvalidNode);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No runner found for node type');
    });

    it('should pass data between dependent nodes', async () => {
      const dependencyDSL = `
pipeline:
  - id: data_source
    type: DataLoaderNode
    params:
      symbol: "ETH/USD"
      timeframe: "4h"
      dataset: "sample_ohlcv.csv"
      
  - id: features
    type: IndicatorNode
    depends_on: [data_source]
    params:
      indicator: "EMA"
      period: 12
      column: "close"
      
  - id: more_features
    type: IndicatorNode
    depends_on: [features]
    params:
      indicator: "SMA"
      period: 26
      column: "close"
`;

      const result = await executor.executePipeline('dependency-test', dependencyDSL);
      
      expect(result.success).toBe(true);
      expect(result.results.size).toBe(3);
      
      // Check that each node executed successfully
      for (const [nodeId, nodeResult] of result.results) {
        expect(nodeResult.success).toBe(true);
        expect(nodeResult.nodeId).toBe(nodeId);
        expect(nodeResult.executionTime).toBeGreaterThan(0);
      }
    });

    it('should provide execution context to nodes', async () => {
      const contextTestDSL = `
pipeline:
  - id: context_test
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1d"
      dataset: "sample_ohlcv.csv"
`;

      const result = await executor.executePipeline('context-test', contextTestDSL);
      
      expect(result.success).toBe(true);
      expect(result.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle runtime exceptions gracefully', async () => {
      // Mock a runner that throws an exception
      const mockRunner = {
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockRejectedValue(new Error('Runtime exception'))
      };
      
      executor['runners'] = [mockRunner as any];
      
      const testDSL = `
pipeline:
  - id: error_node
    type: ErrorNode
    params: {}
`;

      const result = await executor.executePipeline('error-test', testDSL);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Runtime exception');
    });

    it('should clean up properly after failures', async () => {
      const failingDSL = `
pipeline:
  - id: node1
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      dataset: "nonexistent.csv"
`;

      const result = await executor.executePipeline('cleanup-test', failingDSL);
      
      expect(result.success).toBe(false);
      expect(result.runId).toBeDefined();
      expect(result.totalExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should execute pipelines within reasonable time limits', async () => {
      const performanceDSL = `
pipeline:
  - id: perf_data
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "sample_ohlcv.csv"
      
  - id: perf_indicator
    type: IndicatorNode
    depends_on: [perf_data]
    params:
      indicator: "SMA"
      period: 10
      column: "close"
`;

      const startTime = Date.now();
      const result = await executor.executePipeline('performance-test', performanceDSL);
      const executionTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.totalExecutionTime).toBeLessThan(executionTime);
    });
  });
});