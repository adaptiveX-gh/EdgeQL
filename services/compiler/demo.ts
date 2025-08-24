#!/usr/bin/env node

import { PipelineCompiler } from './src/index.js';

// Demo DSL content - Moving Average Crossover Strategy
const sampleDSL = `
# Moving Average Crossover Strategy Demo
pipeline:
  - id: price_data
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "BTC_1m_hyperliquid_perpetualx.csv"
      start_date: "2023-01-01"
      end_date: "2023-12-31"

  - id: fast_ma
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "SMA"
      period: 20
      column: "close"

  - id: slow_ma
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "SMA"
      period: 50
      column: "close"

  - id: ma_signals
    type: CrossoverSignalNode
    depends_on: [fast_ma, slow_ma]
    params:
      buy_condition: "fast_ma > slow_ma"
      sell_condition: "fast_ma < slow_ma"

  - id: backtest_results
    type: BacktestNode
    depends_on: [ma_signals, price_data]
    params:
      initial_capital: 10000
      commission: 0.001
      slippage: 0.0005
`;

// Demo invalid DSL for error handling
const invalidDSL = `
pipeline:
  - id: invalid_node
    type: UnknownNodeType
    depends_on: [missing_dependency]
    params:
      invalid_param: -999
`;

function runDemo() {
  console.log('🚀 EdgeQL DSL Compiler Demo');
  console.log('=' .repeat(50));
  
  const compiler = new PipelineCompiler();
  
  console.log('\n📝 Sample DSL Strategy:');
  console.log(sampleDSL.trim());
  
  console.log('\n🔄 Compiling...');
  const result = compiler.compile(sampleDSL);
  
  if (result.success) {
    console.log('\n✅ Compilation Successful!');
    
    const pipeline = result.pipeline!;
    console.log(`\n📊 Generated ${pipeline.nodes.length} nodes`);
    console.log('Execution order:', pipeline.executionOrder.join(' → '));
    
    console.log('\n🏗️  Compiled Nodes:');
    pipeline.nodes.forEach(node => {
      console.log(`  • ${node.id} (${node.type}) - Runtime: ${node.runtime}`);
      if (node.dependencies.length > 0) {
        console.log(`    Dependencies: ${node.dependencies.join(', ')}`);
      }
    });
    
  } else {
    console.log('\n❌ Compilation Failed');
    result.errors!.forEach(error => {
      console.log(`  ${error.type}: ${error.message}`);
    });
  }
  
  // Demo error handling
  console.log('\n\n🚨 Error Handling Demo');
  console.log('=' .repeat(30));
  console.log('Compiling invalid DSL...');
  
  const invalidResult = compiler.compile(invalidDSL);
  console.log(`\n❌ Found ${invalidResult.errors!.length} validation errors:`);
  
  invalidResult.errors!.forEach((error, index) => {
    console.log(`  ${index + 1}. [${error.type.toUpperCase()}] ${error.message}`);
    if (error.node) console.log(`     Node: ${error.node}`);
  });
  
  console.log('\n🎉 Demo Complete!');
  console.log('\nTo test your own DSL files, use:');
  console.log('npm run compile path/to/your/strategy.yaml');
}

if (require.main === module) {
  runDemo();
}

export { runDemo };