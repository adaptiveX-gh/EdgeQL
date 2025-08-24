#!/usr/bin/env node

import { readFileSync } from 'fs';
import { PipelineCompiler } from './index.js';

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node cli.js <dsl-file.yaml>');
    console.log('Example: node cli.js examples/moving-average-crossover.yaml');
    process.exit(1);
  }
  
  const dslFile = args[0];
  
  try {
    console.log(`Compiling DSL file: ${dslFile}`);
    console.log('=' .repeat(50));
    
    const dslContent = readFileSync(dslFile!, 'utf-8');
    const compiler = new PipelineCompiler();
    const result = compiler.compile(dslContent);
    
    if (result.success) {
      console.log('✅ Compilation successful!');
      console.log();
      
      const pipeline = result.pipeline!;
      
      console.log('📊 Pipeline Summary:');
      console.log(`  Total nodes: ${pipeline.metadata.totalNodes}`);
      console.log(`  Compiled at: ${pipeline.metadata.compiledAt}`);
      console.log(`  Version: ${pipeline.metadata.version}`);
      console.log();
      
      console.log('🔄 Execution Order:');
      pipeline.executionOrder.forEach((nodeId, index) => {
        console.log(`  ${index + 1}. ${nodeId}`);
      });
      console.log();
      
      console.log('🏗️  Node Details:');
      pipeline.nodes.forEach(node => {
        console.log(`  📦 ${node.id}:`);
        console.log(`    Type: ${node.type}`);
        console.log(`    Runtime: ${node.runtime}`);
        console.log(`    Dependencies: [${node.dependencies.join(', ')}]`);
        console.log(`    Parameters: ${JSON.stringify(node.parameters, null, 6)}`);
        
        if (node.outputSchema) {
          console.log(`    Output: ${JSON.stringify(node.outputSchema, null, 6)}`);
        }
        console.log();
      });
      
      if (result.warnings && result.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        result.warnings.forEach(warning => {
          console.log(`  - ${warning}`);
        });
      }
      
    } else {
      console.log('❌ Compilation failed!');
      console.log();
      
      console.log('🚨 Errors:');
      result.errors!.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.type.toUpperCase()}] ${error.message}`);
        if (error.node) {
          console.log(`     Node: ${error.node}`);
        }
        if (error.field) {
          console.log(`     Field: ${error.field}`);
        }
        if (error.line !== undefined || error.column !== undefined) {
          console.log(`     Location: Line ${error.line || '?'}, Column ${error.column || '?'}`);
        }
        console.log();
      });
      
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Note: ESM modules don't have require.main, so we check if this is the main module differently
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };