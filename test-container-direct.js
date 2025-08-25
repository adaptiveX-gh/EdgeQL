#!/usr/bin/env node

const { CustomNodeRunner } = require('./services/executor/dist/runners/CustomNodeRunner.js');
const { mkdirSync, writeFileSync } = require('fs');
const { tmpdir } = require('os');
const path = require('path');

async function testContainerFix() {
  console.log('🔧 Testing CustomNodeRunner container execution...');
  
  const runner = new CustomNodeRunner();
  
  // Mock execution context
  const context = {
    runId: 'test-container-fix',
    pipelineId: 'test-pipeline',
    workingDir: '/tmp/test',
    artifacts: new Map(),
    datasets: new Map([['sample_ohlcv.csv', '/datasets/BTC_1m_hyperliquid_perpetualx.csv']]),
    cancelled: false
  };
  
  // Test parameters for a custom aggregation node
  const params = {
    operation: 'sum',
    columns: ['close', 'volume']
  };
  
  const inputs = new Map([
    ['test_input', { 
      type: 'dataframe', 
      rows: 1000,
      columns: ['open', 'high', 'low', 'close', 'volume']
    }]
  ]);
  
  try {
    console.log('🔧 Checking if runner can handle AggregationNode...');
    const canHandle = runner.canHandle('AggregationNode');
    console.log(`🔧 Can handle: ${canHandle}`);
    
    if (!canHandle) {
      console.log('❌ Runner cannot handle AggregationNode node type');
      return false;
    }
    
    console.log('🔧 Executing custom node...');
    const result = await runner.execute(
      'test_agg_node',
      'AggregationNode',
      params,
      inputs,
      context
    );
    
    if (result.success) {
      console.log('✅ SUCCESS: Container execution works!');
      console.log('📊 Result:', JSON.stringify(result.output, null, 2));
      console.log('📋 Logs:', result.logs);
      return true;
    } else {
      console.log('❌ FAILED: Container execution failed');
      console.log('💥 Error:', result.error);
      console.log('📋 Logs:', result.logs);
      
      // Check if it's the old ENOENT 'node' error
      if (result.error && result.error.includes('ENOENT') && result.error.includes('node')) {
        console.log('⚠️  This appears to be the original ENOENT error - fix may not be complete');
      } else {
        console.log('ℹ️  This is a different error - the ENOENT fix likely worked');
      }
      
      return false;
    }
  } catch (error) {
    console.error('💥 EXCEPTION during test:', error.message);
    console.error('📋 Stack:', error.stack);
    return false;
  }
}

// Run the test
testContainerFix()
  .then(success => {
    console.log(success ? '🎉 Test completed successfully!' : '😞 Test failed');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });