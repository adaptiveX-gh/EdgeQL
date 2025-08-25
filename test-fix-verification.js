#!/usr/bin/env node

/**
 * Simple test to verify the CustomNodeRunner fix
 */

const { PipelineExecutor } = require('./services/executor/dist/index.js');

async function testCustomNodeExecution() {
  console.log('🔧 Testing CustomNodeRunner fix...');
  
  const executor = new PipelineExecutor();
  
  // Simple pipeline with a custom aggregation node
  const dslContent = `
pipeline:
  name: test-custom-aggregation
  description: Test custom aggregation node
  
nodes:
  - id: test_data
    type: DataLoaderNode
    params:
      dataset_name: sample_ohlcv.csv
      columns: [open, high, low, close, volume]
    
  - id: custom_agg
    type: custom_aggregation
    params:
      operation: sum
      columns: [close, volume]
    depends_on: [test_data]
`;

  try {
    const result = await executor.executePipeline('test-fix', dslContent);
    
    if (result.success) {
      console.log('✅ SUCCESS: CustomNodeRunner fix works!');
      console.log('📊 Results:', JSON.stringify(result.finalOutputs, null, 2));
      return true;
    } else {
      console.log('❌ FAILED: Test failed');
      console.log('💥 Error:', result.error);
      console.log('📋 Debug logs:', result.debugLogs?.slice(-10)); // Last 10 debug logs
      return false;
    }
  } catch (error) {
    console.error('💥 EXCEPTION during test:', error.message);
    console.error('📋 Stack:', error.stack);
    return false;
  }
}

// Run the test
testCustomNodeExecution()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });