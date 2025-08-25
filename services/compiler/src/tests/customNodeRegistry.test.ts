import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CustomNodeRegistry, resetCustomNodeRegistry } from '../registry/CustomNodeRegistry.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('CustomNodeRegistry', () => {
  let testDir: string;
  let registry: CustomNodeRegistry;

  beforeEach(() => {
    // Create a temporary directory for test nodes
    testDir = path.join(tmpdir(), `edgeql-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    
    // Reset global registry
    resetCustomNodeRegistry();
    
    // Create registry with test directory
    registry = new CustomNodeRegistry({
      customNodesPath: testDir,
      enableAutoDiscovery: false // We'll manually control discovery
    });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    resetCustomNodeRegistry();
  });

  describe('Node Registration', () => {
    it('should register a custom node definition', () => {
      const nodeDefinition = {
        id: 'TestNode',
        name: 'Test Node',
        runtime: 'javascript' as const,
        entryPoint: path.join(testDir, 'test.js'),
        inputSchema: { type: 'dataframe' },
        outputSchema: { type: 'dataframe' },
        requiredParams: ['param1'],
        optionalParams: ['param2']
      };

      // Create dummy entry point file
      writeFileSync(nodeDefinition.entryPoint, 'console.log("test");');

      registry.registerNode(nodeDefinition);

      expect(registry.isCustomNode('TestNode')).toBe(true);
      expect(registry.getNode('TestNode')).toEqual(nodeDefinition);
    });

    it('should throw error if entry point does not exist', () => {
      const nodeDefinition = {
        id: 'TestNode',
        name: 'Test Node',
        runtime: 'javascript' as const,
        entryPoint: path.join(testDir, 'nonexistent.js'),
        inputSchema: { type: 'dataframe' },
        outputSchema: { type: 'dataframe' },
        requiredParams: ['param1'],
        optionalParams: []
      };

      expect(() => registry.registerNode(nodeDefinition)).toThrow(
        'Custom node entry point not found'
      );
    });
  });

  describe('Node Discovery', () => {
    it('should discover nodes from node.json manifest files', () => {
      // Create a test node directory with manifest
      const nodeDir = path.join(testDir, 'TestDiscoveryNode');
      mkdirSync(nodeDir);
      
      const manifest = {
        id: 'TestDiscoveryNode',
        name: 'Test Discovery Node',
        runtime: 'javascript',
        entryPoint: './index.js',
        inputSchema: { type: 'dataframe' },
        outputSchema: { type: 'dataframe' },
        requiredParams: [],
        optionalParams: []
      };

      writeFileSync(path.join(nodeDir, 'node.json'), JSON.stringify(manifest, null, 2));
      writeFileSync(path.join(nodeDir, 'index.js'), 'console.log("test");');

      registry.discoverNodes();

      expect(registry.isCustomNode('TestDiscoveryNode')).toBe(true);
      
      const discoveredNode = registry.getNode('TestDiscoveryNode');
      expect(discoveredNode).toBeDefined();
      expect(discoveredNode?.name).toBe('Test Discovery Node');
    });

    it('should discover nodes from package.json with edgeql configuration', () => {
      // Create a test node directory with package.json
      const nodeDir = path.join(testDir, 'TestPackageNode');
      mkdirSync(nodeDir);
      
      const packageJson = {
        name: 'test-package-node',
        version: '1.0.0',
        edgeql: {
          nodeDefinition: {
            id: 'TestPackageNode',
            name: 'Test Package Node',
            runtime: 'javascript',
            entryPoint: './main.js',
            inputSchema: { type: 'dataframe' },
            outputSchema: { type: 'dataframe' },
            requiredParams: ['config'],
            optionalParams: []
          }
        }
      };

      writeFileSync(path.join(nodeDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      writeFileSync(path.join(nodeDir, 'main.js'), 'console.log("package test");');

      registry.discoverNodes();

      expect(registry.isCustomNode('TestPackageNode')).toBe(true);
      
      const discoveredNode = registry.getNode('TestPackageNode');
      expect(discoveredNode).toBeDefined();
      expect(discoveredNode?.requiredParams).toContain('config');
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      // Register a test node for validation tests
      const nodeDefinition = {
        id: 'ValidTestNode',
        name: 'Valid Test Node',
        runtime: 'javascript' as const,
        entryPoint: path.join(testDir, 'valid.js'),
        inputSchema: { type: 'dataframe' },
        outputSchema: { type: 'dataframe' },
        requiredParams: [],
        optionalParams: []
      };

      writeFileSync(nodeDefinition.entryPoint, 'console.log("valid");');
      registry.registerNode(nodeDefinition);
    });

    it('should validate node references correctly', () => {
      const nodeTypes = ['DataLoaderNode', 'ValidTestNode', 'InvalidNode'];
      
      const validation = registry.validateNodeReferences(nodeTypes);
      
      expect(validation.valid).toBe(false);
      expect(validation.missingNodes).toEqual(['InvalidNode']);
    });

    it('should return valid for all built-in nodes', () => {
      const nodeTypes = ['DataLoaderNode', 'IndicatorNode', 'CrossoverSignalNode', 'BacktestNode'];
      
      const validation = registry.validateNodeReferences(nodeTypes);
      
      expect(validation.valid).toBe(true);
      expect(validation.missingNodes).toHaveLength(0);
    });

    it('should return valid for mix of built-in and custom nodes', () => {
      const nodeTypes = ['DataLoaderNode', 'ValidTestNode'];
      
      const validation = registry.validateNodeReferences(nodeTypes);
      
      expect(validation.valid).toBe(true);
      expect(validation.missingNodes).toHaveLength(0);
    });
  });

  describe('Node Schemas', () => {
    it('should return input/output schemas for registered nodes', () => {
      const nodeDefinition = {
        id: 'SchemaTestNode',
        name: 'Schema Test Node',
        runtime: 'javascript' as const,
        entryPoint: path.join(testDir, 'schema.js'),
        inputSchema: { type: 'dataframe', columns: ['timestamp', 'value'] },
        outputSchema: { type: 'signals', signal_columns: ['signal'] },
        requiredParams: [],
        optionalParams: []
      };

      writeFileSync(nodeDefinition.entryPoint, 'console.log("schema test");');
      registry.registerNode(nodeDefinition);

      const schemas = registry.getNodeSchemas('SchemaTestNode');
      
      expect(schemas).toBeDefined();
      expect(schemas?.inputSchema).toEqual({ type: 'dataframe', columns: ['timestamp', 'value'] });
      expect(schemas?.outputSchema).toEqual({ type: 'signals', signal_columns: ['signal'] });
    });

    it('should return undefined for non-existent nodes', () => {
      const schemas = registry.getNodeSchemas('NonExistentNode');
      expect(schemas).toBeUndefined();
    });
  });

  describe('Registry Statistics', () => {
    it('should return correct statistics', () => {
      // Register nodes with different categories
      const nodes = [
        {
          id: 'FilterNode',
          name: 'Filter Node',
          runtime: 'javascript' as const,
          entryPoint: path.join(testDir, 'filter.js'),
          inputSchema: {},
          outputSchema: {},
          requiredParams: [],
          optionalParams: [],
          metadata: { category: 'data-transformation' }
        },
        {
          id: 'AggregationNode', 
          name: 'Aggregation Node',
          runtime: 'javascript' as const,
          entryPoint: path.join(testDir, 'agg.js'),
          inputSchema: {},
          outputSchema: {},
          requiredParams: [],
          optionalParams: [],
          metadata: { category: 'data-analysis' }
        },
        {
          id: 'UncategorizedNode',
          name: 'Uncategorized Node',
          runtime: 'javascript' as const,
          entryPoint: path.join(testDir, 'uncat.js'),
          inputSchema: {},
          outputSchema: {},
          requiredParams: [],
          optionalParams: [],
          metadata: {}
        }
      ];

      nodes.forEach(node => {
        writeFileSync(node.entryPoint, 'console.log("test");');
        registry.registerNode(node);
      });

      const stats = registry.getStats();

      expect(stats.totalNodes).toBe(3);
      expect(stats.nodesByCategory['data-transformation']).toBe(1);
      expect(stats.nodesByCategory['data-analysis']).toBe(1);
      expect(stats.nodesByCategory['uncategorized']).toBe(1);
      expect(stats.path).toBe(testDir);
    });
  });
});