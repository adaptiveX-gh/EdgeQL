#!/usr/bin/env node

/**
 * FilterNode - A custom JavaScript node for filtering dataframe rows based on conditions
 * This demonstrates the basic structure of a custom node in the EdgeQL pipeline system.
 */

const fs = require('fs');
const path = require('path');

// Node execution function
async function execute(input, output) {
  try {
    console.log('FilterNode: Starting execution');
    
    // Read input data
    const inputData = JSON.parse(fs.readFileSync(input, 'utf-8'));
    
    const { nodeType, nodeDefinition, params, inputs, context } = inputData;
    
    console.log(`FilterNode: Processing with params:`, JSON.stringify(params, null, 2));
    
    // Validate required parameters
    if (!params.column) {
      throw new Error('Missing required parameter: column');
    }
    
    if (!params.condition) {
      throw new Error('Missing required parameter: condition');
    }
    
    // Get input dataframe from dependencies
    const inputKeys = Object.keys(inputs);
    if (inputKeys.length !== 1) {
      throw new Error(`FilterNode expects exactly 1 input, got ${inputKeys.length}`);
    }
    
    const inputDataframe = inputs[inputKeys[0]];
    if (!inputDataframe || inputDataframe.type !== 'dataframe') {
      throw new Error('FilterNode requires a dataframe input');
    }
    
    // Simulate filtering operation
    // In a real implementation, this would parse and apply the filter condition
    console.log(`FilterNode: Filtering column '${params.column}' with condition '${params.condition}'`);
    
    // For demonstration, we'll create a filtered result
    const filteredData = {
      type: 'dataframe',
      columns: inputDataframe.columns || ['timestamp', 'open', 'high', 'low', 'close', 'volume'],
      rows: Math.floor((inputDataframe.rows || 1000) * 0.8), // Simulate 80% of rows passing filter
      filter_applied: {
        column: params.column,
        condition: params.condition,
        operator: params.operator || 'greater_than'
      }
    };
    
    // Add any optional processing
    if (params.sort_by) {
      filteredData.sorted_by = params.sort_by;
      console.log(`FilterNode: Sorting by ${params.sort_by}`);
    }
    
    // Write output
    const outputData = {
      success: true,
      result: filteredData,
      metadata: {
        nodeType: 'FilterNode',
        executionTime: Date.now(),
        rowsFiltered: (inputDataframe.rows || 1000) - filteredData.rows
      }
    };
    
    fs.writeFileSync(output, JSON.stringify(outputData, null, 2));
    
    console.log('FilterNode: Execution completed successfully');
    
  } catch (error) {
    console.error('FilterNode: Execution failed:', error.message);
    
    // Write error output
    const errorOutput = {
      success: false,
      error: error.message,
      metadata: {
        nodeType: 'FilterNode',
        executionTime: Date.now()
      }
    };
    
    try {
      fs.writeFileSync(output, JSON.stringify(errorOutput, null, 2));
    } catch (writeError) {
      console.error('FilterNode: Failed to write error output:', writeError.message);
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
    console.error('FilterNode: Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { execute };