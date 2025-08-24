#!/usr/bin/env node

import { PipelineCompiler } from './services/compiler/dist/index.js';
import { PipelineExecutor } from './services/executor/dist/index.js';

const dsl = `
pipeline:
  - id: price_data
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "crossover_test.csv"
      
  - id: fast_ma
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "SMA"
      period: 10
      column: "close"
      
  - id: slow_ma
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "SMA"
      period: 20
      column: "close"
      
  - id: ma_signals
    type: CrossoverSignalNode
    depends_on: [fast_ma, slow_ma]
    params:
      buy_condition: "fast > slow"
      sell_condition: "fast < slow"
      
  - id: backtest_results
    type: BacktestNode
    depends_on: [ma_signals]
    params:
      initial_capital: 10000
      commission: 0.001
`;

async function testPipeline() {
  const compiler = new PipelineCompiler();
  const executor = new PipelineExecutor();

  console.log('=== Testing Pipeline Fix ===');
  
  // Step 1: Compile
  console.log('\n1. Compiling DSL...');
  const compilationResult = compiler.compile(dsl);
  
  if (!compilationResult.success) {
    console.error('❌ Compilation failed:', compilationResult.errors);
    return;
  }
  
  console.log('✅ Compilation successful');
  console.log('  Nodes:', compilationResult.pipeline.nodes.length);
  console.log('  Execution order:', compilationResult.pipeline.executionOrder);

  // Step 2: Execute
  console.log('\n2. Executing pipeline...');
  const executionResult = await executor.executePipeline('test-fix', dsl);
  
  if (!executionResult.success) {
    console.error('❌ Execution failed:', executionResult.error);
    
    // Print detailed logs
    if (executionResult.results) {
      console.log('\n=== Node Results ===');
      for (const [nodeId, result] of executionResult.results) {
        console.log(`\n--- ${nodeId} ---`);
        console.log('Success:', result.success);
        if (result.logs) {
          result.logs.forEach(log => console.log('  Log:', log));
        }
        if (result.error) {
          console.log('  Error:', result.error);
        }
      }
    }
    return;
  }
  
  console.log('✅ Execution successful');
  console.log('  Total execution time:', executionResult.totalExecutionTime, 'ms');
  console.log('  Results count:', executionResult.results.size);

  // Step 3: Check specific results
  console.log('\n3. Checking results...');
  
  const priceData = executionResult.results.get('price_data');
  console.log('Price data:', priceData?.success, '- points:', priceData?.output?.data?.length);
  
  const fastMa = executionResult.results.get('fast_ma');
  console.log('Fast MA:', fastMa?.success, '- SMA values calculated');
  
  const slowMa = executionResult.results.get('slow_ma');
  console.log('Slow MA:', slowMa?.success, '- SMA values calculated');
  
  const signals = executionResult.results.get('ma_signals');
  console.log('Signals:', signals?.success);
  if (signals?.output?.data) {
    const signalData = signals.output.data;
    const totalSignals = signalData.filter(row => row.signal !== 0).length;
    const buySignals = signalData.filter(row => row.signal > 0).length;
    const sellSignals = signalData.filter(row => row.signal < 0).length;
    console.log(`  Total signals: ${totalSignals} (${buySignals} buy, ${sellSignals} sell)`);
  }
  
  const backtest = executionResult.results.get('backtest_results');
  console.log('Backtest:', backtest?.success);
  if (backtest?.output?.data) {
    const results = backtest.output.data;
    console.log(`  Return: ${results.totalReturn}%`);
    console.log(`  Trades: ${results.numTrades}`);
    console.log(`  Win Rate: ${(results.winRate * 100).toFixed(1)}%`);
    console.log(`  Sharpe: ${results.sharpeRatio}`);
  }
  
  console.log('\n=== Test Complete ===');
}

testPipeline().catch(console.error);