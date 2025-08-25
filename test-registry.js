#!/usr/bin/env node

const { getCustomNodeRegistry } = require('./services/compiler/dist/registry/CustomNodeRegistry.js');

async function testRegistry() {
  try {
    console.log('Testing custom node registry...');
    
    const registry = getCustomNodeRegistry();
    console.log('Registry initialized');
    
    const stats = registry.getStats();
    console.log('Registry stats:', JSON.stringify(stats, null, 2));
    
    console.log('All node types:', registry.getNodeTypes());
    
    console.log('Is AggregationNode custom?', registry.isCustomNode('AggregationNode'));
    console.log('Get AggregationNode:', registry.getNode('AggregationNode'));
    
    // Force discovery
    console.log('Forcing rediscovery...');
    registry.discoverNodes();
    
    const statsAfter = registry.getStats();
    console.log('Registry stats after discovery:', JSON.stringify(statsAfter, null, 2));
    
    console.log('All node types after discovery:', registry.getNodeTypes());
    console.log('Is AggregationNode custom after discovery?', registry.isCustomNode('AggregationNode'));
    
  } catch (error) {
    console.error('Registry test failed:', error.message);
    console.error(error.stack);
  }
}

testRegistry();