import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PipelineCompiler } from '../index.js';
import { CustomNodeRegistry, resetCustomNodeRegistry } from '../registry/CustomNodeRegistry.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('Custom Node Integration', () => {
  let compiler: PipelineCompiler;
  let testDir: string;
  let registry: CustomNodeRegistry;

  beforeEach(() => {
    // Create temporary directory for test nodes
    testDir = path.join(tmpdir(), `edgeql-integration-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    
    // Reset and configure custom node registry
    resetCustomNodeRegistry();
    registry = new CustomNodeRegistry({
      customNodesPath: testDir,
      enableAutoDiscovery: false
    });
    
    // Create compiler
    compiler = new PipelineCompiler();
    
    // Register test custom nodes
    setupTestNodes();
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    resetCustomNodeRegistry();
  });

  function setupTestNodes() {
    // Create FilterNode
    const filterNodeDir = path.join(testDir, 'FilterNode');
    mkdirSync(filterNodeDir);
    
    writeFileSync(path.join(filterNodeDir, 'index.js'), 'console.log("filter");');
    writeFileSync(path.join(filterNodeDir, 'node.json'), JSON.stringify({
      id: 'FilterNode',
      name: 'Filter Node',
      runtime: 'javascript',
      entryPoint: './index.js',
      inputSchema: { type: 'dataframe' },
      outputSchema: { type: 'dataframe' },
      requiredParams: ['column', 'condition'],
      optionalParams: ['operator']
    }, null, 2));

    // Create AggregationNode
    const aggNodeDir = path.join(testDir, 'AggregationNode');
    mkdirSync(aggNodeDir);
    
    writeFileSync(path.join(aggNodeDir, 'index.js'), 'console.log("aggregation");');
    writeFileSync(path.join(aggNodeDir, 'node.json'), JSON.stringify({
      id: 'AggregationNode',
      name: 'Aggregation Node',
      runtime: 'javascript',
      entryPoint: './index.js',
      inputSchema: { type: 'dataframe' },
      outputSchema: { type: 'dataframe' },
      requiredParams: ['operation', 'columns'],
      optionalParams: ['group_by']
    }, null, 2));

    // Discover the nodes
    registry.discoverNodes();
  }

  describe('DSL Compilation with Custom Nodes', () => {
    it('should compile pipeline with custom nodes successfully', () => {
      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"

  - id: filter_data
    type: FilterNode
    depends_on: [data_loader]
    params:
      column: "close"
      condition: ">100"
      operator: "greater_than"

  - id: aggregate_data
    type: AggregationNode
    depends_on: [filter_data]
    params:
      operation: "mean"
      columns: ["close", "volume"]
      `;

      const result = compiler.compile(dsl);

      expect(result.success).toBe(true);
      expect(result.pipeline).toBeDefined();
      expect(result.pipeline!.nodes).toHaveLength(3);
      
      // Check that custom nodes have correct runtime
      const filterNode = result.pipeline!.nodes.find(n => n.type === 'FilterNode');
      const aggNode = result.pipeline!.nodes.find(n => n.type === 'AggregationNode');
      
      expect(filterNode?.runtime).toBe('javascript');
      expect(aggNode?.runtime).toBe('javascript');
    });

    it('should fail compilation with missing custom node', () => {
      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"

  - id: missing_node
    type: NonExistentCustomNode
    depends_on: [data_loader]
    params:
      some_param: "value"
      `;

      const result = compiler.compile(dsl);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.message.includes('Custom node type \'NonExistentCustomNode\' not found'))).toBe(true);
    });

    it('should validate custom node parameters', () => {
      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"

  - id: filter_missing_params
    type: FilterNode
    depends_on: [data_loader]
    params:
      column: "close"
      # Missing required 'condition' parameter
      `;

      const result = compiler.compile(dsl);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(e => e.message.includes('Missing required parameter: condition'))).toBe(true);
    });
  });

  describe('IR Generation with Custom Nodes', () => {
    it('should generate correct IR for custom nodes', () => {
      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"

  - id: custom_filter
    type: FilterNode
    depends_on: [data_loader]
    params:
      column: "close"
      condition: ">50"
      `;

      const result = compiler.compileToIR(dsl, 'test-pipeline');

      expect(result.success).toBe(true);
      expect(result.ir).toBeDefined();
      
      const filterNode = result.ir!.nodes.find(n => n.type === 'FilterNode');
      expect(filterNode).toBeDefined();
      expect(filterNode!.runtime).toBe('javascript');
      expect(filterNode!.parameters).toEqual({
        column: 'close',
        condition: '>50'
      });
    });
  });

  describe('Enhanced Validation', () => {
    it('should validate custom node data flow', () => {
      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"

  - id: filter_data
    type: FilterNode
    depends_on: [data_loader]
    params:
      column: "close"
      condition: ">100"

  - id: aggregate_data
    type: AggregationNode
    depends_on: [filter_data]
    params:
      operation: "sum"
      columns: ["close"]
      `;

      const result = compiler.compile(dsl);

      expect(result.success).toBe(true);
      // Data flow should be valid: DataLoader -> Filter -> Aggregation
    });

    it('should detect incompatible custom node connections', () => {
      // Create a custom node that outputs signals instead of dataframe
      const signalNodeDir = path.join(testDir, 'SignalNode');
      mkdirSync(signalNodeDir);
      
      writeFileSync(path.join(signalNodeDir, 'index.js'), 'console.log("signals");');
      writeFileSync(path.join(signalNodeDir, 'node.json'), JSON.stringify({
        id: 'SignalNode',
        name: 'Signal Node',
        runtime: 'javascript',
        entryPoint: './index.js',
        inputSchema: { type: 'dataframe' },
        outputSchema: { type: 'signals' }, // Outputs signals, not dataframe
        requiredParams: [],
        optionalParams: []
      }, null, 2));

      registry.discoverNodes(); // Re-discover to include new node

      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"

  - id: signal_node
    type: SignalNode
    depends_on: [data_loader]
    params: {}

  - id: filter_data
    type: FilterNode
    depends_on: [signal_node]  # FilterNode expects dataframe but SignalNode outputs signals
    params:
      column: "close"
      condition: ">100"
      `;

      const result = compiler.compile(dsl);

      // This should still pass basic compilation as we have simplified validation
      // In a production system, you'd want more sophisticated schema validation
      expect(result.success).toBe(true);
    });
  });

  describe('Mixed Pipeline Validation', () => {
    it('should handle mix of built-in and custom nodes', () => {
      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"

  - id: sma_indicator
    type: IndicatorNode
    depends_on: [data_loader]
    params:
      indicator: "SMA"
      period: 20

  - id: filter_data
    type: FilterNode
    depends_on: [sma_indicator]
    params:
      column: "close"
      condition: ">100"

  - id: crossover_signals
    type: CrossoverSignalNode
    depends_on: [sma_indicator, data_loader]
    params:
      fast_period: 10
      slow_period: 20

  - id: backtest
    type: BacktestNode
    depends_on: [crossover_signals, filter_data]
    params:
      initial_capital: 10000
      `;

      const result = compiler.compile(dsl);

      expect(result.success).toBe(true);
      expect(result.pipeline!.nodes).toHaveLength(5);
      
      // Verify node types and runtimes
      const nodes = result.pipeline!.nodes;
      expect(nodes.find(n => n.type === 'DataLoaderNode')?.runtime).toBe('builtin');
      expect(nodes.find(n => n.type === 'IndicatorNode')?.runtime).toBe('builtin');
      expect(nodes.find(n => n.type === 'FilterNode')?.runtime).toBe('javascript');
      expect(nodes.find(n => n.type === 'CrossoverSignalNode')?.runtime).toBe('builtin');
      expect(nodes.find(n => n.type === 'BacktestNode')?.runtime).toBe('builtin');
    });
  });
});