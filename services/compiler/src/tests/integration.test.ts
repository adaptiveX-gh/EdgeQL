import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PipelineCompiler } from '../index.js';

describe('PipelineCompiler Integration Tests', () => {
  let compiler: PipelineCompiler;
  
  beforeEach(() => {
    compiler = new PipelineCompiler();
  });
  
  function loadFixture(filename: string): string {
    const fixturePath = join(__dirname, 'fixtures', filename);
    return readFileSync(fixturePath, 'utf-8');
  }
  
  describe('Valid Pipeline Compilation', () => {
    it('should successfully compile Moving Average Crossover strategy', () => {
      const dslContent = loadFixture('moving-average-crossover.yaml');
      const result = compiler.compile(dslContent);
      
      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.pipeline).toBeDefined();
      
      const pipeline = result.pipeline!;
      expect(pipeline.nodes).toHaveLength(5);
      expect(pipeline.executionOrder).toEqual([
        'price_data',
        'fast_ma', 
        'slow_ma',
        'ma_signals',
        'backtest_results'
      ]);
      
      // Verify node compilation
      const priceDataNode = pipeline.nodes.find(n => n.id === 'price_data')!;
      expect(priceDataNode.type).toBe('DataLoaderNode');
      expect(priceDataNode.runtime).toBe('builtin');
      expect(priceDataNode.dependencies).toEqual([]);
      expect(priceDataNode.parameters.symbol).toBe('BTC/USD');
      
      const fastMaNode = pipeline.nodes.find(n => n.id === 'fast_ma')!;
      expect(fastMaNode.dependencies).toEqual(['price_data']);
      expect(fastMaNode.parameters.period).toBe(20);
      
      const signalsNode = pipeline.nodes.find(n => n.id === 'ma_signals')!;
      expect(signalsNode.dependencies).toEqual(['fast_ma', 'slow_ma']);
      
      // Verify metadata
      expect(pipeline.metadata.totalNodes).toBe(5);
      expect(pipeline.metadata.version).toBe('0.1.0');
      expect(pipeline.metadata.compiledAt).toBeDefined();
    });
    
    it('should successfully compile RSI strategy', () => {
      const dslContent = loadFixture('rsi-strategy.yaml');
      const result = compiler.compile(dslContent);
      
      expect(result.success).toBe(true);
      expect(result.pipeline).toBeDefined();
      
      const pipeline = result.pipeline!;
      expect(pipeline.nodes).toHaveLength(4);
      expect(pipeline.executionOrder).toEqual([
        'price_data',
        'rsi_indicator',
        'rsi_signals',
        'backtest_results'
      ]);
      
      // Check RSI-specific parameters
      const rsiNode = pipeline.nodes.find(n => n.id === 'rsi_indicator')!;
      expect(rsiNode.parameters.indicator).toBe('RSI');
      expect(rsiNode.parameters.period).toBe(14);
    });
  });
  
  describe('Invalid Pipeline Handling', () => {
    it('should detect missing required parameters', () => {
      const invalidDsl = `
pipeline:
  - id: incomplete_node
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      # Missing timeframe and dataset
`;
      
      const result = compiler.compile(invalidDsl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      
      const paramErrors = result.errors!.filter(e => 
        e.message.includes('timeframe') || e.message.includes('dataset')
      );
      expect(paramErrors.length).toBeGreaterThan(0);
    });
    
    it('should detect circular dependencies', () => {
      const circularDsl = `
pipeline:
  - id: node_a
    type: IndicatorNode
    depends_on: [node_b]
    params:
      indicator: "SMA"
      period: 10
  
  - id: node_b
    type: IndicatorNode
    depends_on: [node_c]
    params:
      indicator: "EMA"
      period: 20
  
  - id: node_c
    type: IndicatorNode
    depends_on: [node_a]
    params:
      indicator: "RSI"
      period: 14
`;
      
      const result = compiler.compile(circularDsl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      
      const circularError = result.errors!.find(e => 
        e.message.includes('Circular dependency')
      );
      expect(circularError).toBeDefined();
    });
    
    it('should detect duplicate node IDs', () => {
      const duplicateDsl = `
pipeline:
  - id: duplicate_id
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"
  
  - id: duplicate_id
    type: IndicatorNode
    params:
      indicator: "SMA"
      period: 10
`;
      
      const result = compiler.compile(duplicateDsl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      
      const duplicateError = result.errors!.find(e => 
        e.message.includes('Duplicate node ID')
      );
      expect(duplicateError).toBeDefined();
    });
    
    it('should detect invalid parameter values', () => {
      const invalidParamsDsl = `
pipeline:
  - id: invalid_indicator
    type: IndicatorNode
    params:
      indicator: "INVALID_INDICATOR"
      period: -5
`;
      
      const result = compiler.compile(invalidParamsDsl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      
      // Should have errors for invalid indicator and negative period
      const indicatorError = result.errors!.find(e => 
        e.message.includes('indicator')
      );
      expect(indicatorError).toBeDefined();
      
      const periodError = result.errors!.find(e => 
        e.message.includes('period') || e.message.includes('positive')
      );
      expect(periodError).toBeDefined();
    });
    
    it('should detect missing dependencies', () => {
      const missingDepDsl = `
pipeline:
  - id: dependent_node
    type: IndicatorNode
    depends_on: [non_existent_node]
    params:
      indicator: "SMA"
      period: 10
`;
      
      const result = compiler.compile(missingDepDsl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      
      const depError = result.errors!.find(e => 
        e.message.includes('Dependency not found')
      );
      expect(depError).toBeDefined();
    });
    
    it('should detect unknown node types', () => {
      const unknownTypeDsl = `
pipeline:
  - id: unknown_node
    type: UnknownNodeType
    params:
      some_param: "value"
`;
      
      const result = compiler.compile(unknownTypeDsl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      
      const typeError = result.errors!.find(e => 
        e.message.includes('Unknown node type')
      );
      expect(typeError).toBeDefined();
    });
    
    it('should handle invalid YAML syntax', () => {
      const invalidYaml = `
pipeline:
  - id: test
    invalid yaml: [unclosed array
`;
      
      const result = compiler.compile(invalidYaml);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].type).toBe('syntax');
    });
  });
  
  describe('Execution Order Validation', () => {
    it('should correctly order nodes with complex dependencies', () => {
      const complexDsl = `
pipeline:
  # Node with no dependencies should be first
  - id: data_source
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"
  
  # Multiple nodes depending on data_source
  - id: indicator_1
    type: IndicatorNode
    depends_on: [data_source]
    params:
      indicator: "SMA"
      period: 20
  
  - id: indicator_2
    type: IndicatorNode
    depends_on: [data_source]
    params:
      indicator: "EMA"
      period: 50
  
  # Node depending on both indicators
  - id: combined_signals
    type: CrossoverSignalNode
    depends_on: [indicator_1, indicator_2]
    params:
      buy_condition: "sma > ema"
      sell_condition: "sma < ema"
  
  # Final node depending on signals and original data
  - id: final_backtest
    type: BacktestNode
    depends_on: [combined_signals, data_source]
    params:
      initial_capital: 10000
`;
      
      const result = compiler.compile(complexDsl);
      
      expect(result.success).toBe(true);
      expect(result.pipeline!.executionOrder).toEqual([
        'data_source',
        'indicator_1',
        'indicator_2', 
        'combined_signals',
        'final_backtest'
      ]);
    });
  });
  
  describe('Schema Validation', () => {
    it('should validate node ID format', () => {
      const invalidIdDsl = `
pipeline:
  - id: "123invalid"
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"
`;
      
      const result = compiler.compile(invalidIdDsl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      
      const idError = result.errors!.find(e => 
        e.message.includes('Node ID must start with letter')
      );
      expect(idError).toBeDefined();
    });
    
    it('should require at least one node in pipeline', () => {
      const emptyPipelineDsl = `
pipeline: []
`;
      
      const result = compiler.compile(emptyPipelineDsl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      
      const emptyError = result.errors!.find(e => 
        e.message.includes('at least one node')
      );
      expect(emptyError).toBeDefined();
    });
  });
});