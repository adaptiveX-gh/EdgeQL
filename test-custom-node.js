#!/usr/bin/env node

const fs = require('fs');
const fetch = require('node-fetch');

async function testCustomNodePipeline() {
  try {
    console.log('Testing custom node pipeline execution...');
    
    // Read the pipeline DSL
    const pipelineDsl = fs.readFileSync('./test-custom-node-pipeline.yaml', 'utf-8');
    console.log('Pipeline DSL loaded');
    
    // First, create a pipeline
    console.log('Creating pipeline...');
    const createResponse = await fetch('http://localhost:3001/api/pipelines', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Test Custom Node Pipeline',
        description: 'Testing AggregationNode custom JavaScript node',
        dslContent: pipelineDsl
      })
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create pipeline: ${createResponse.status} ${errorText}`);
    }
    
    const pipeline = await createResponse.json();
    console.log(`Pipeline created with ID: ${pipeline.id}`);
    
    // Run the pipeline
    console.log('Executing pipeline...');
    const runResponse = await fetch(`http://localhost:3001/api/pipelines/${pipeline.id}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      throw new Error(`Failed to run pipeline: ${runResponse.status} ${errorText}`);
    }
    
    const runResult = await runResponse.json();
    console.log('\n=== PIPELINE EXECUTION RESULT ===');
    console.log('Success:', runResult.success);
    console.log('Run ID:', runResult.runId);
    console.log('Total Execution Time:', runResult.totalExecutionTime, 'ms');
    
    if (runResult.error) {
      console.log('Error:', runResult.error);
    }
    
    if (runResult.results) {
      console.log('\n=== NODE RESULTS ===');
      for (const [nodeId, result] of Object.entries(runResult.results)) {
        console.log(`\n--- ${nodeId} ---`);
        console.log('Success:', result.success);
        console.log('Execution Time:', result.executionTime, 'ms');
        
        if (result.error) {
          console.log('Error:', result.error);
        }
        
        if (result.logs && result.logs.length > 0) {
          console.log('Logs:');
          result.logs.forEach(log => console.log('  ', log));
        }
        
        if (result.output) {
          console.log('Output Type:', typeof result.output, result.output.type || 'unknown');
          if (nodeId === 'custom_aggregation') {
            console.log('Custom Node Output:', JSON.stringify(result.output, null, 2));
          }
        }
      }
    }
    
    console.log('\n=== TEST COMPLETED ===');
    
    // Test for specific custom node success
    if (runResult.success && runResult.results && runResult.results.custom_aggregation) {
      const customNodeResult = runResult.results.custom_aggregation;
      if (customNodeResult.success) {
        console.log('✅ Custom JavaScript node (AggregationNode) executed successfully!');
        return true;
      } else {
        console.log('❌ Custom JavaScript node failed:', customNodeResult.error);
        return false;
      }
    } else {
      console.log('❌ Pipeline execution failed or custom node not found');
      return false;
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    return false;
  }
}

// Run the test
testCustomNodePipeline()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });