import { PipelineExecutor } from './services/executor/dist/index.js';

const dsl = `pipeline:
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
      column: "close"`;

async function test() {
  console.log('Testing executor pipeline execution...');

  try {
    const executor = new PipelineExecutor();
    const result = await executor.executePipeline('test-pipeline', dsl);
    
    if (result.success) {
      console.log('✅ Execution successful');
    } else {
      console.log('❌ Execution failed:', result.error);
    }
  } catch (error) {
    console.error('💥 Execution error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

test();