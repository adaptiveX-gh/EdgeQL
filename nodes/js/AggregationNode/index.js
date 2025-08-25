#!/usr/bin/env node

/**
 * AggregationNode - A custom JavaScript node for aggregating dataframe data
 * This demonstrates a more complex custom node with multiple aggregation operations.
 */

const fs = require('fs');
const path = require('path');

// Node execution function
async function execute(input, output) {
  try {
    console.log('AggregationNode: Starting execution');
    
    // Read input data
    const inputData = JSON.parse(fs.readFileSync(input, 'utf-8'));
    
    const { nodeType, nodeDefinition, params, inputs, context } = inputData;
    
    console.log(`AggregationNode: Processing with params:`, JSON.stringify(params, null, 2));
    
    // Validate required parameters
    if (!params.operation) {
      throw new Error('Missing required parameter: operation');
    }
    
    if (!params.columns || !Array.isArray(params.columns) || params.columns.length === 0) {
      throw new Error('Missing or invalid required parameter: columns (must be non-empty array)');
    }
    
    // Get input dataframe from dependencies
    const inputKeys = Object.keys(inputs);
    if (inputKeys.length !== 1) {
      throw new Error(`AggregationNode expects exactly 1 input, got ${inputKeys.length}`);
    }
    
    const inputDataframe = inputs[inputKeys[0]];
    if (!inputDataframe || inputDataframe.type !== 'dataframe') {
      throw new Error('AggregationNode requires a dataframe input');
    }
    
    // Validate operation
    const validOperations = ['sum', 'mean', 'median', 'std', 'min', 'max', 'count'];
    if (!validOperations.includes(params.operation)) {
      throw new Error(`Invalid operation: ${params.operation}. Valid operations: ${validOperations.join(', ')}`);
    }
    
    console.log(`AggregationNode: Performing ${params.operation} on columns:`, params.columns);
    
    // Simulate aggregation operation
    const aggregationResults = {};
    
    for (const column of params.columns) {
      // Simulate different aggregation operations with mock results
      switch (params.operation) {
        case 'sum':
          aggregationResults[`${column}_sum`] = Math.random() * 10000;
          break;
        case 'mean':
          aggregationResults[`${column}_mean`] = Math.random() * 100;
          break;
        case 'median':
          aggregationResults[`${column}_median`] = Math.random() * 100;
          break;
        case 'std':
          aggregationResults[`${column}_std`] = Math.random() * 20;
          break;
        case 'min':
          aggregationResults[`${column}_min`] = Math.random() * 10;
          break;
        case 'max':
          aggregationResults[`${column}_max`] = Math.random() * 1000;
          break;
        case 'count':
          aggregationResults[`${column}_count`] = Math.floor(Math.random() * 1000) + 100;
          break;
      }
    }
    
    // Handle optional grouping
    let resultData;
    if (params.group_by) {
      console.log(`AggregationNode: Grouping by ${params.group_by}`);
      resultData = {
        type: 'dataframe',
        columns: [params.group_by, ...Object.keys(aggregationResults)],
        grouped_by: params.group_by,
        groups: ['Group A', 'Group B', 'Group C'], // Mock groups
        aggregations: aggregationResults,
        operation: params.operation
      };
    } else {
      resultData = {
        type: 'dataframe',
        columns: Object.keys(aggregationResults),
        aggregations: aggregationResults,
        operation: params.operation,
        original_rows: inputDataframe.rows || 1000
      };
    }
    
    // Handle optional window size
    if (params.window_size) {
      resultData.window_size = params.window_size;
      resultData.windowed_aggregation = true;
      console.log(`AggregationNode: Applied windowed aggregation with window size ${params.window_size}`);
    }
    
    // Write output
    const outputData = {
      success: true,
      result: resultData,
      metadata: {
        nodeType: 'AggregationNode',
        executionTime: Date.now(),
        operation: params.operation,
        columns_processed: params.columns.length,
        grouped: !!params.group_by
      }
    };
    
    fs.writeFileSync(output, JSON.stringify(outputData, null, 2));
    
    console.log('AggregationNode: Execution completed successfully');
    
  } catch (error) {
    console.error('AggregationNode: Execution failed:', error.message);
    
    // Write error output
    const errorOutput = {
      success: false,
      error: error.message,
      metadata: {
        nodeType: 'AggregationNode',
        executionTime: Date.now()
      }
    };
    
    try {
      fs.writeFileSync(output, JSON.stringify(errorOutput, null, 2));
    } catch (writeError) {
      console.error('AggregationNode: Failed to write error output:', writeError.message);
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const [inputFile, outputFile] = process.argv.slice(2);
  
  if (!inputFile || !outputFile) {
    console.error('Usage: node index.js <input.json> <output.json>');
    process.exit(1);
  }
  
  execute(inputFile, outputFile).catch(error => {
    console.error('AggregationNode: Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { execute };