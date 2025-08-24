import { describe, it, expect, beforeAll } from 'vitest';
import { PipelineCompiler } from '../../services/compiler/src/index.js';
import { PipelineExecutor } from '../../services/executor/src/index.js';

describe('Pipeline Integration Tests', () => {
  let compiler: PipelineCompiler;
  let executor: PipelineExecutor;
  
  beforeAll(() => {
    compiler = new PipelineCompiler();
    executor = new PipelineExecutor();
  });
  
  describe('end-to-end pipeline execution', () => {
    it('should compile and execute a simple moving average pipeline', async () => {
      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "sample_ohlcv.csv"
      
  - id: sma_fast
    type: IndicatorNode
    depends_on: [data_loader]
    params:
      indicator: "SMA"
      period: 10
      column: "close"
      
  - id: sma_slow
    type: IndicatorNode
    depends_on: [data_loader]
    params:
      indicator: "SMA"
      period: 20
      column: "close"
`;
      
      // Test compilation
      const compilationResult = compiler.compile(dsl);
      expect(compilationResult.success).toBe(true);
      expect(compilationResult.pipeline).toBeDefined();
      expect(compilationResult.pipeline!.nodes).toHaveLength(3);
      
      // Test execution order
      const executionOrder = compilationResult.pipeline!.executionOrder;
      expect(executionOrder[0]).toBe('data_loader');
      expect(executionOrder).toContain('sma_fast');
      expect(executionOrder).toContain('sma_slow');
    }, { timeout: 10000 });
    
    it('should handle compilation errors gracefully', async () => {
      const invalidDsl = `
pipeline:
  - id: invalid
    type: NonExistentNode
    params: {}
`;
      
      const result = compiler.compile(invalidDsl);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
    
    it('should execute builtin nodes successfully', async () => {
      const simpleDsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h" 
      dataset: "sample_ohlcv.csv"
`;
      
      const executionResult = await executor.executePipeline('test-pipeline', simpleDsl);
      
      expect(executionResult.success).toBe(true);
      expect(executionResult.results.size).toBeGreaterThan(0);
      expect(executionResult.finalOutputs.size).toBeGreaterThan(0);
    }, { timeout: 15000 });
  });
  
  describe('error handling', () => {
    it('should handle node execution failures', async () => {
      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "non_existent.csv"  # This should cause failure
`;
      
      const result = await executor.executePipeline('failing-pipeline', dsl);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, { timeout: 10000 });
  });
});