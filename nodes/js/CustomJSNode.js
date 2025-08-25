#!/usr/bin/env node
/**
 * CustomJSNode - A template for custom JavaScript nodes
 * 
 * This demonstrates how to create custom JavaScript nodes that run
 * in the enhanced sandbox environment with proper resource limits
 * and security restrictions.
 */

const fs = require('fs');

async function executeCustomJSNode(inputFile, outputFile) {
  try {
    // Read input data
    const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const { params = {}, inputs = {}, userCode, sandboxConfig = {} } = inputData;

    // Validate that user code is provided
    if (!userCode) {
      throw new Error('No user code provided for CustomJSNode');
    }

    console.log('Executing custom JavaScript code in sandbox...');
    console.log(`Memory limit: ${sandboxConfig.memoryLimit || 512}MB`);
    console.log(`Time limit: ${sandboxConfig.timeLimit || 30}s`);
    console.log(`Network enabled: ${sandboxConfig.enableNetworking || false}`);
    console.log(`Filesystem enabled: ${sandboxConfig.enableFileSystem || false}`);

    // Create execution context for user code
    const context = {
      inputs: inputs,
      params: params,
      console: {
        log: (...args) => console.log('[USER]', ...args),
        error: (...args) => console.error('[USER ERROR]', ...args),
        warn: (...args) => console.warn('[USER WARN]', ...args)
      },
      // Provide safe utilities
      Math: Math,
      JSON: JSON,
      Date: Date,
      // Restricted setTimeout
      setTimeout: (fn, delay) => {
        if (delay > 5000) {
          throw new Error('setTimeout with delay > 5s not allowed');
        }
        return setTimeout(fn, delay);
      }
    };

    // Execute user code in controlled environment
    const userFunction = new Function(
      'context',
      'inputs', 
      'params',
      'console',
      'Math',
      'JSON',
      'Date',
      'setTimeout',
      `
      "use strict";
      ${userCode}
      `
    );

    // Run the user function
    const result = await Promise.resolve(
      userFunction(
        context,
        context.inputs,
        context.params,
        context.console,
        context.Math,
        context.JSON,
        context.Date,
        context.setTimeout
      )
    );

    // Success response
    const output = {
      success: true,
      result: result,
      nodeType: 'CustomJSNode',
      stats: {
        memoryUsed: process.memoryUsage().heapUsed / (1024 * 1024),
        peakMemory: process.memoryUsage().heapUsed / (1024 * 1024),
        executionTime: 0, // Will be calculated by sandbox wrapper
        rss: process.memoryUsage().rss / (1024 * 1024)
      }
    };

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log('Custom JavaScript node executed successfully');

  } catch (error) {
    // Error response
    const errorOutput = {
      success: false,
      error: error.message,
      violationType: error.name === 'SandboxViolationError' ? error.violationType : 'RUNTIME_ERROR',
      details: error.details || {},
      nodeType: 'CustomJSNode'
    };

    try {
      fs.writeFileSync(outputFile, JSON.stringify(errorOutput, null, 2));
    } catch (writeError) {
      console.error('Failed to write error output:', writeError.message);
    }

    console.error('Custom JavaScript node failed:', error.message);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const [inputFile, outputFile] = process.argv.slice(2);
  
  if (!inputFile || !outputFile) {
    console.error('Usage: node CustomJSNode.js <input.json> <output.json>');
    process.exit(1);
  }

  executeCustomJSNode(inputFile, outputFile).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { executeCustomJSNode };