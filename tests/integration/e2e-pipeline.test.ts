import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PipelineCompiler } from '../../services/compiler/src/index.js';
import { PipelineExecutor } from '../../services/executor/src/index.js';
import { dslFixtures, testUtils, performanceUtils } from '../helpers/fixtures.js';

describe('End-to-End Pipeline Integration Tests', () => {
  let compiler: PipelineCompiler;
  let executor: PipelineExecutor;
  
  beforeAll(async () => {
    compiler = new PipelineCompiler();
    executor = new PipelineExecutor();
  });
  
  beforeEach(() => {
    // Clear any previous state
  });
  
  afterAll(async () => {
    // Cleanup any resources
  });

  describe('Complete Pipeline Execution Flow', () => {
    it('should execute simple moving average strategy end-to-end', async () => {
      const dsl = dslFixtures.simpleMovingAverage;
      
      // Step 1: Compile DSL
      const { result: compilationResult, timeMs: compileTime } = 
        await performanceUtils.measureTime(() => compiler.compile(dsl));
      
      expect(compilationResult.success).toBe(true);
      expect(compilationResult.pipeline).toBeDefined();
      expect(compileTime).toBeLessThan(1000); // Should compile quickly
      
      const pipeline = compilationResult.pipeline!;
      expect(pipeline.nodes).toHaveLength(2);
      expect(pipeline.executionOrder).toEqual(['price_data', 'sma_20']);
      
      // Step 2: Execute pipeline
      const { result: executionResult, timeMs: execTime } = 
        await performanceUtils.measureTime(() => 
          executor.executePipeline('e2e-sma-test', dsl)
        );
      
      expect(executionResult.success).toBe(true);
      expect(executionResult.runId).toBeDefined();
      expect(executionResult.results.size).toBe(2);
      expect(executionResult.totalExecutionTime).toBeGreaterThan(0);
      expect(execTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Step 3: Verify node results
      const dataLoaderResult = executionResult.results.get('price_data');
      expect(dataLoaderResult).toBeDefined();
      expect(dataLoaderResult!.success).toBe(true);
      expect(dataLoaderResult!.output.type).toBe('dataframe');
      
      const smaResult = executionResult.results.get('sma_20');
      expect(smaResult).toBeDefined();
      expect(smaResult!.success).toBe(true);
      expect(smaResult!.output.type).toBe('dataframe');
      
      // Step 4: Verify final outputs
      expect(executionResult.finalOutputs.size).toBeGreaterThan(0);
      const finalOutput = Array.from(executionResult.finalOutputs.values())[0];
      expect(finalOutput).toBeDefined();
    }, { timeout: 15000 });

    it('should execute moving average crossover strategy with proper data flow', async () => {
      const dsl = dslFixtures.movingAverageCrossover;
      
      // Compile and execute
      const compilationResult = compiler.compile(dsl);
      expect(compilationResult.success).toBe(true);
      
      const pipeline = compilationResult.pipeline!;
      expect(pipeline.nodes).toHaveLength(5);
      expect(pipeline.executionOrder).toEqual([
        'price_data',
        'fast_ma',
        'slow_ma',
        'ma_signals',
        'backtest_results'
      ]);
      
      const executionResult = await executor.executePipeline('e2e-crossover-test', dsl);
      
      expect(executionResult.success).toBe(true);
      expect(executionResult.results.size).toBe(5);
      
      // Verify data flow between nodes
      const priceData = executionResult.results.get('price_data');
      const fastMa = executionResult.results.get('fast_ma');
      const slowMa = executionResult.results.get('slow_ma');
      const signals = executionResult.results.get('ma_signals');
      const backtest = executionResult.results.get('backtest_results');
      
      // All nodes should have executed successfully
      [priceData, fastMa, slowMa, signals, backtest].forEach(result => {
        expect(result).toBeDefined();
        expect(result!.success).toBe(true);
        expect(result!.executionTime).toBeGreaterThan(0);
      });
      
      // Verify output types
      expect(priceData!.output.type).toBe('dataframe');
      expect(fastMa!.output.type).toBe('dataframe');
      expect(slowMa!.output.type).toBe('dataframe');
      expect(signals!.output.type).toBe('dataframe');
      expect(backtest!.output.type).toBe('backtest_results');
    }, { timeout: 20000 });

    it('should execute RSI strategy with proper parameter validation', async () => {
      const dsl = dslFixtures.rsiStrategy;
      
      const compilationResult = compiler.compile(dsl);
      expect(compilationResult.success).toBe(true);
      
      const pipeline = compilationResult.pipeline!;
      
      // Verify RSI node parameters
      const rsiNode = pipeline.nodes.find(n => n.id === 'rsi_indicator');
      expect(rsiNode).toBeDefined();
      expect(rsiNode!.parameters.indicator).toBe('RSI');
      expect(rsiNode!.parameters.period).toBe(14);
      expect(rsiNode!.parameters.column).toBe('close');
      
      // Verify signal node parameters
      const signalNode = pipeline.nodes.find(n => n.id === 'rsi_signals');
      expect(signalNode).toBeDefined();
      expect(signalNode!.parameters.buy_condition).toBe('rsi < 30');
      expect(signalNode!.parameters.sell_condition).toBe('rsi > 70');
      
      const executionResult = await executor.executePipeline('e2e-rsi-test', dsl);
      
      expect(executionResult.success).toBe(true);
      expect(executionResult.results.size).toBe(4);
    }, { timeout: 15000 });

    it('should handle complex multi-indicator strategy', async () => {
      const dsl = dslFixtures.complexMultiIndicator;
      
      const compilationResult = compiler.compile(dsl);
      expect(compilationResult.success).toBe(true);
      
      const pipeline = compilationResult.pipeline!;
      expect(pipeline.nodes).toHaveLength(7);
      
      // Verify complex dependency graph
      expect(pipeline.executionOrder).toEqual([
        'price_data',
        'sma_20',
        'ema_12',
        'rsi_14',
        'macd_signals',
        'combined_signals',
        'backtest_results'
      ]);
      
      const executionResult = await executor.executePipeline('e2e-complex-test', dsl);
      
      expect(executionResult.success).toBe(true);
      expect(executionResult.results.size).toBe(7);
      
      // Verify all indicators computed correctly
      const sma = executionResult.results.get('sma_20');
      const ema = executionResult.results.get('ema_12');
      const rsi = executionResult.results.get('rsi_14');
      
      expect(sma!.success).toBe(true);
      expect(ema!.success).toBe(true);
      expect(rsi!.success).toBe(true);
      
      // Verify signal generation with multiple inputs
      const macdSignals = executionResult.results.get('macd_signals');
      const combinedSignals = executionResult.results.get('combined_signals');
      
      expect(macdSignals!.success).toBe(true);
      expect(combinedSignals!.success).toBe(true);
      
      // Verify backtest includes advanced parameters
      const backtest = executionResult.results.get('backtest_results');
      expect(backtest!.success).toBe(true);
    }, { timeout: 25000 });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle compilation errors gracefully', async () => {
      const invalidDsl = dslFixtures.invalidSyntax;
      
      const compilationResult = compiler.compile(invalidDsl);
      expect(compilationResult.success).toBe(false);
      expect(compilationResult.errors).toBeDefined();
      expect(compilationResult.errors!.length).toBeGreaterThan(0);
      expect(compilationResult.errors![0].type).toBe('syntax');
    });

    it('should detect missing required parameters', async () => {
      const invalidDsl = dslFixtures.missingRequiredParams;
      
      const compilationResult = compiler.compile(invalidDsl);
      expect(compilationResult.success).toBe(false);
      expect(compilationResult.errors).toBeDefined();
      
      const paramErrors = compilationResult.errors!.filter(e =>
        e.message.includes('timeframe') || e.message.includes('dataset')
      );
      expect(paramErrors.length).toBeGreaterThan(0);
    });

    it('should detect and report circular dependencies', async () => {
      const circularDsl = dslFixtures.circularDependency;
      
      const compilationResult = compiler.compile(circularDsl);
      expect(compilationResult.success).toBe(false);
      expect(compilationResult.errors).toBeDefined();
      
      const circularError = compilationResult.errors!.find(e =>
        e.message.includes('Circular dependency')
      );
      expect(circularError).toBeDefined();
    });

    it('should handle duplicate node IDs', async () => {
      const duplicateDsl = dslFixtures.duplicateNodeIds;
      
      const compilationResult = compiler.compile(duplicateDsl);
      expect(compilationResult.success).toBe(false);
      expect(compilationResult.errors).toBeDefined();
      
      const duplicateError = compilationResult.errors!.find(e =>
        e.message.includes('Duplicate node ID')
      );
      expect(duplicateError).toBeDefined();
    });

    it('should handle execution failures with proper error reporting', async () => {
      // Create a DSL with a node that will fail
      const failingDsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "non_existent_file.csv"
`;
      
      const executionResult = await executor.executePipeline('e2e-fail-test', failingDsl);
      
      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBeDefined();
      expect(executionResult.error).toContain('DataLoader failed');
      expect(executionResult.runId).toBeDefined(); // Should still generate run ID
      expect(executionResult.totalExecutionTime).toBeGreaterThan(0);
    }, { timeout: 10000 });

    it('should handle unknown node types', async () => {
      const unknownTypeDsl = dslFixtures.unknownNodeType;
      
      const compilationResult = compiler.compile(unknownTypeDsl);
      expect(compilationResult.success).toBe(false);
      expect(compilationResult.errors).toBeDefined();
      
      const typeError = compilationResult.errors!.find(e =>
        e.message.includes('Unknown node type')
      );
      expect(typeError).toBeDefined();
    });

    it('should handle missing dependencies', async () => {
      const missingDepDsl = dslFixtures.missingDependency;
      
      const compilationResult = compiler.compile(missingDepDsl);
      expect(compilationResult.success).toBe(false);
      expect(compilationResult.errors).toBeDefined();
      
      const depError = compilationResult.errors!.find(e =>
        e.message.includes('Dependency not found')
      );
      expect(depError).toBeDefined();
    });

    it('should validate parameter values', async () => {
      const invalidParamsDsl = dslFixtures.invalidParameters;
      
      const compilationResult = compiler.compile(invalidParamsDsl);
      expect(compilationResult.success).toBe(false);
      expect(compilationResult.errors).toBeDefined();
      
      // Should have errors for invalid indicator and negative period
      const indicatorError = compilationResult.errors!.find(e =>
        e.message.includes('indicator')
      );
      expect(indicatorError).toBeDefined();
      
      const periodError = compilationResult.errors!.find(e =>
        e.message.includes('period') || e.message.includes('positive')
      );
      expect(periodError).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete simple pipelines within performance thresholds', async () => {
      const dsl = dslFixtures.simpleMovingAverage;
      
      const { result, timeMs } = await performanceUtils.measureTime(() =>
        executor.executePipeline('perf-simple', dsl)
      );
      
      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.totalExecutionTime).toBeLessThan(timeMs);
    });

    it('should handle concurrent pipeline executions', async () => {
      const dsl = dslFixtures.simpleMovingAverage;
      
      const concurrentRuns = await performanceUtils.createConcurrentRequests(
        () => executor.executePipeline(`concurrent-${testUtils.randomString(8)}`, dsl),
        3 // Test with 3 concurrent pipelines
      );
      
      expect(concurrentRuns).toHaveLength(3);
      concurrentRuns.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.runId).toBeDefined();
        expect(result.results.size).toBeGreaterThan(0);
        
        // Each run should have unique ID
        const otherRuns = concurrentRuns.slice(0, index);
        const isDuplicate = otherRuns.some(other => other.runId === result.runId);
        expect(isDuplicate).toBe(false);
      });
    }, { timeout: 30000 });

    it('should scale with increasing pipeline complexity', async () => {
      const testCases = [
        { name: 'simple', dsl: dslFixtures.simpleMovingAverage, expectedNodes: 2 },
        { name: 'crossover', dsl: dslFixtures.movingAverageCrossover, expectedNodes: 5 },
        { name: 'complex', dsl: dslFixtures.complexMultiIndicator, expectedNodes: 7 }
      ];
      
      const results = [];
      
      for (const testCase of testCases) {
        const { result, timeMs } = await performanceUtils.measureTime(() =>
          executor.executePipeline(`scale-${testCase.name}`, testCase.dsl)
        );
        
        expect(result.success).toBe(true);
        expect(result.results.size).toBe(testCase.expectedNodes);
        
        results.push({
          name: testCase.name,
          nodes: testCase.expectedNodes,
          timeMs,
          executionTime: result.totalExecutionTime
        });
      }
      
      // Verify reasonable scaling characteristics
      results.forEach((result, index) => {
        if (index > 0) {
          const previous = results[index - 1];
          // Execution time should scale reasonably with complexity
          const scalingFactor = result.timeMs / previous.timeMs;
          expect(scalingFactor).toBeLessThan(5); // Shouldn't be more than 5x slower
        }
      });
    }, { timeout: 45000 });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain data consistency through pipeline execution', async () => {
      const dsl = dslFixtures.movingAverageCrossover;
      
      const executionResult = await executor.executePipeline('integrity-test', dsl);
      
      expect(executionResult.success).toBe(true);
      
      // Verify data consistency
      const priceData = executionResult.results.get('price_data');
      const fastMa = executionResult.results.get('fast_ma');
      const slowMa = executionResult.results.get('slow_ma');
      
      // All should have processed the same dataset
      expect(priceData!.output.metadata.symbol).toBe('BTC/USD');
      expect(fastMa!.output.metadata.symbol).toBe('BTC/USD');
      expect(slowMa!.output.metadata.symbol).toBe('BTC/USD');
      
      // Data structure validation
      expect(priceData!.output.type).toBe('dataframe');
      expect(Array.isArray(priceData!.output.data)).toBe(true);
      
      if (priceData!.output.data.length > 0) {
        const firstRow = priceData!.output.data[0];
        expect(firstRow).toHaveProperty('timestamp');
        expect(firstRow).toHaveProperty('open');
        expect(firstRow).toHaveProperty('high');
        expect(firstRow).toHaveProperty('low');
        expect(firstRow).toHaveProperty('close');
        expect(firstRow).toHaveProperty('volume');
      }
    });

    it('should validate node input/output schemas', async () => {
      const dsl = dslFixtures.rsiStrategy;
      
      const compilationResult = compiler.compile(dsl);
      expect(compilationResult.success).toBe(true);
      
      const pipeline = compilationResult.pipeline!;
      
      // Verify schema compatibility
      pipeline.nodes.forEach(node => {
        expect(node.id).toBeDefined();
        expect(node.type).toBeDefined();
        expect(node.parameters).toBeDefined();
        
        // Parameters should be objects
        expect(typeof node.parameters).toBe('object');
        
        // Dependencies should be valid
        node.dependencies.forEach(dep => {
          const depNode = pipeline.nodes.find(n => n.id === dep);
          expect(depNode).toBeDefined();
        });
      });
    });

    it('should preserve metadata through pipeline execution', async () => {
      const dsl = dslFixtures.complexMultiIndicator;
      
      const executionResult = await executor.executePipeline('metadata-test', dsl);
      
      expect(executionResult.success).toBe(true);
      
      // Check metadata preservation
      executionResult.results.forEach((result, nodeId) => {
        expect(result.nodeId).toBe(nodeId);
        expect(result.executionTime).toBeGreaterThan(0);
        expect(result.success).toBe(true);
        
        if (result.output.metadata) {
          expect(typeof result.output.metadata).toBe('object');
        }
      });
      
      // Verify execution order was respected
      const nodeResults = Array.from(executionResult.results.entries());
      expect(nodeResults.length).toBe(7);
      
      // First node should be the data loader
      expect(nodeResults[0][0]).toBe('price_data');
    });
  });
});