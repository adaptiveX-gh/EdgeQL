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
`;

async function debugCrossover() {
  const executor = new PipelineExecutor();

  console.log('=== Debug Crossover Signal Generation ===');
  
  const executionResult = await executor.executePipeline('debug-crossover', dsl);
  
  if (!executionResult.success) {
    console.error('❌ Execution failed:', executionResult.error);
    return;
  }
  
  console.log('✅ Execution successful');

  // Get detailed results
  const signals = executionResult.results.get('ma_signals');
  
  console.log('\n=== CrossoverSignalNode Logs ===');
  if (signals?.logs) {
    signals.logs.forEach(log => console.log('  ', log));
  }
  
  console.log('\n=== Data Analysis ===');
  if (signals?.output?.data) {
    const data = signals.output.data;
    console.log(`Total data points: ${data.length}`);
    
    // Check for crossover data
    let crossoverFound = false;
    for (let i = 1; i < data.length; i++) {
      const curr = data[i];
      const prev = data[i - 1];
      
      if (curr.SMA_10 && curr.SMA_20 && prev.SMA_10 && prev.SMA_20) {
        console.log(`Row ${i}: SMA_10=${curr.SMA_10.toFixed(2)}, SMA_20=${curr.SMA_20.toFixed(2)} | Prev: ${prev.SMA_10.toFixed(2)}, ${prev.SMA_20.toFixed(2)}`);
        
        // Check for golden cross (SMA_10 crosses above SMA_20)
        if (prev.SMA_10 <= prev.SMA_20 && curr.SMA_10 > curr.SMA_20) {
          console.log(`  🟢 GOLDEN CROSS detected at row ${i}!`);
          crossoverFound = true;
        }
        // Check for death cross (SMA_10 crosses below SMA_20)
        else if (prev.SMA_10 >= prev.SMA_20 && curr.SMA_10 < curr.SMA_20) {
          console.log(`  🔴 DEATH CROSS detected at row ${i}!`);
          crossoverFound = true;
        }
        
        if (i < 5 || i >= data.length - 5) {
          console.log(`    Signal: ${curr.signal || 0}`);
        }
      }
    }
    
    if (!crossoverFound) {
      console.log('❌ No crossovers found in the data');
    }
    
    const signalsGenerated = data.filter(row => row.signal && row.signal !== 0);
    console.log(`\nSignals generated: ${signalsGenerated.length}`);
    if (signalsGenerated.length > 0) {
      signalsGenerated.forEach((row, i) => {
        console.log(`  Signal ${i + 1}: ${row.signal} at ${row.timestamp}`);
      });
    }
  }
}

debugCrossover().catch(console.error);