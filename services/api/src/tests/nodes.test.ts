import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { nodesRouter } from '../routes/nodes.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Nodes API', () => {
  let app: express.Application;
  const TEST_DATA_DIR = path.resolve(process.cwd(), 'data-test');
  
  beforeEach(async () => {
    // Set up test app
    app = express();
    app.use(express.json());
    app.use('/api/nodes', nodesRouter);
    
    // Clean up any existing test data
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
    
    // Set environment to use test data directory
    process.env.NODE_ENV = 'test';
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });
  
  describe('GET /api/nodes', () => {
    it('should return list of all nodes including built-ins', async () => {
      const response = await request(app)
        .get('/api/nodes')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Should include built-in nodes
      const nodeIds = response.body.data.map((node: any) => node.id);
      expect(nodeIds).toContain('DataLoaderNode');
      expect(nodeIds).toContain('IndicatorNode');
      expect(nodeIds).toContain('CrossoverSignalNode');
      expect(nodeIds).toContain('BacktestNode');
    });
    
    it('should return nodes with correct structure', async () => {
      const response = await request(app)
        .get('/api/nodes')
        .expect(200);
      
      const firstNode = response.body.data[0];
      expect(firstNode).toHaveProperty('id');
      expect(firstNode).toHaveProperty('name');
      expect(firstNode).toHaveProperty('type');
      expect(firstNode).toHaveProperty('language');
      expect(firstNode).toHaveProperty('description');
      expect(firstNode).toHaveProperty('inputSchema');
      expect(firstNode).toHaveProperty('outputSchema');
    });
  });
  
  describe('GET /api/nodes/builtin', () => {
    it('should return only built-in nodes', async () => {
      const response = await request(app)
        .get('/api/nodes/builtin')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(4);
      
      // All should be built-in type
      response.body.data.forEach((node: any) => {
        expect(node.type).toBe('builtin');
      });
    });
    
    it('should include all expected built-in nodes', async () => {
      const response = await request(app)
        .get('/api/nodes/builtin')
        .expect(200);
      
      const nodeIds = response.body.data.map((node: any) => node.id);
      expect(nodeIds).toContain('DataLoaderNode');
      expect(nodeIds).toContain('IndicatorNode');
      expect(nodeIds).toContain('CrossoverSignalNode');
      expect(nodeIds).toContain('BacktestNode');
    });
  });
  
  describe('GET /api/nodes/custom', () => {
    it('should return empty list when no custom nodes exist', async () => {
      const response = await request(app)
        .get('/api/nodes/custom')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });
  
  describe('GET /api/nodes/:id', () => {
    it('should return specific built-in node', async () => {
      const response = await request(app)
        .get('/api/nodes/DataLoaderNode')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe('DataLoaderNode');
      expect(response.body.data.name).toBe('Data Loader');
      expect(response.body.data.type).toBe('builtin');
      expect(response.body.data.language).toBe('python');
      expect(response.body.data.description).toContain('OHLCV data');
    });
    
    it('should return indicator node with correct schema', async () => {
      const response = await request(app)
        .get('/api/nodes/IndicatorNode')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('IndicatorNode');
      expect(response.body.data.inputSchema.type).toBe('dataframe');
      expect(response.body.data.outputSchema.type).toBe('dataframe');
    });
    
    it('should return crossover signal node with correct schema', async () => {
      const response = await request(app)
        .get('/api/nodes/CrossoverSignalNode')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('CrossoverSignalNode');
      expect(response.body.data.inputSchema.type).toBe('multiple_dataframes');
      expect(response.body.data.outputSchema.type).toBe('dataframe');
      expect(response.body.data.outputSchema.columns).toContain('timestamp');
      expect(response.body.data.outputSchema.columns).toContain('signal');
    });
    
    it('should return backtest node with correct schema', async () => {
      const response = await request(app)
        .get('/api/nodes/BacktestNode')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('BacktestNode');
      expect(response.body.data.inputSchema).toHaveProperty('signals');
      expect(response.body.data.inputSchema).toHaveProperty('data');
      expect(response.body.data.outputSchema.type).toBe('backtest_results');
    });
    
    it('should return 404 for non-existent node', async () => {
      const response = await request(app)
        .get('/api/nodes/NonExistentNode')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Node not found');
    });
    
    it('should handle invalid node ID format', async () => {
      const response = await request(app)
        .get('/api/nodes/@invalid-id')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Node not found');
    });
  });
  
  describe('POST /api/nodes', () => {
    it('should create a new custom JavaScript node', async () => {
      const nodeData = {
        name: 'Test Node',
        language: 'javascript',
        code: `
          export function run(input) {
            return { processed: true, data: input };
          }
        `,
        description: 'A test node',
        author: 'Test Author',
        tags: ['test', 'example']
      };
      
      const response = await request(app)
        .post('/api/nodes')
        .send(nodeData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe('Test Node');
      expect(response.body.data.version).toBe(1);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();
    });

    it('should reject node with invalid code', async () => {
      const nodeData = {
        name: 'Invalid Node',
        language: 'javascript',
        code: 'console.log("no run function");'
      };
      
      const response = await request(app)
        .post('/api/nodes')
        .send(nodeData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject node with missing required fields', async () => {
      const nodeData = {
        description: 'Missing name and code'
      };
      
      const response = await request(app)
        .post('/api/nodes')
        .send(nodeData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject node with duplicate name', async () => {
      const nodeData = {
        name: 'Duplicate Node',
        language: 'javascript',
        code: 'export function run(input) { return input; }'
      };
      
      // Create first node
      await request(app)
        .post('/api/nodes')
        .send(nodeData)
        .expect(201);
      
      // Try to create second node with same name
      const response = await request(app)
        .post('/api/nodes')
        .send(nodeData)
        .expect(409);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('A node with this name already exists');
    });
  });
  
  describe('PUT /api/nodes/:id', () => {
    it('should update an existing custom node', async () => {
      // Create a node first
      const createData = {
        name: 'Original Node',
        language: 'javascript',
        code: 'export function run(input) { return input; }'
      };
      
      const createResponse = await request(app)
        .post('/api/nodes')
        .send(createData)
        .expect(201);
      
      const nodeId = createResponse.body.data.id;
      
      // Update the node
      const updateData = {
        name: 'Updated Node',
        description: 'Updated description',
        changeDescription: 'Updated name and description'
      };
      
      const response = await request(app)
        .put(`/api/nodes/${nodeId}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Node');
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.data.version).toBe(1); // Version doesn't change for non-code updates
    });

    it('should prevent updating built-in nodes', async () => {
      const response = await request(app)
        .put('/api/nodes/DataLoaderNode')
        .send({ name: 'Hacked Built-in' })
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot update built-in nodes');
    });

    it('should return 404 for non-existent node', async () => {
      const response = await request(app)
        .put('/api/nodes/non-existent-id')
        .send({ name: 'Updated Name' })
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Node not found');
    });
  });
  
  describe('DELETE /api/nodes/:id', () => {
    it('should delete an existing custom node', async () => {
      // Create a node first
      const createData = {
        name: 'Node to Delete',
        language: 'javascript',
        code: 'export function run(input) { return input; }'
      };
      
      const createResponse = await request(app)
        .post('/api/nodes')
        .send(createData)
        .expect(201);
      
      const nodeId = createResponse.body.data.id;
      
      // Delete the node
      const response = await request(app)
        .delete(`/api/nodes/${nodeId}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
      expect(response.body.data.nodeId).toBe(nodeId);
      
      // Verify node is actually deleted
      await request(app)
        .get(`/api/nodes/${nodeId}`)
        .expect(404);
    });

    it('should prevent deleting built-in nodes', async () => {
      const response = await request(app)
        .delete('/api/nodes/DataLoaderNode')
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot delete built-in nodes');
    });

    it('should return 404 for non-existent node', async () => {
      const response = await request(app)
        .delete('/api/nodes/non-existent-id')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Node not found');
    });
  });
  
  describe('Versioning and Additional Features', () => {
    it('should get node version history', async () => {
      // Create a node
      const createData = {
        name: 'Versioned Node',
        language: 'javascript',
        code: 'export function run(input) { return input; }'
      };
      
      const createResponse = await request(app)
        .post('/api/nodes')
        .send(createData)
        .expect(201);
      
      const nodeId = createResponse.body.data.id;
      
      // Update it to create a new version
      await request(app)
        .put(`/api/nodes/${nodeId}`)
        .send({ 
          code: 'export function run(input) { return { processed: input }; }',
          changeDescription: 'Added processing wrapper'
        })
        .expect(200);
      
      // Get version history
      const versionsResponse = await request(app)
        .get(`/api/nodes/${nodeId}/versions`)
        .expect(200);
      
      expect(versionsResponse.body.success).toBe(true);
      expect(versionsResponse.body.data).toHaveLength(2);
      expect(versionsResponse.body.data[0].version).toBe(1);
      expect(versionsResponse.body.data[1].version).toBe(2);
    });

    it('should get nodes by tag', async () => {
      // Create nodes with tags - use unique names to avoid conflicts
      const timestamp = Date.now();
      const nodeData1 = {
        name: `Tagged Node 1 ${timestamp}`,
        language: 'javascript',
        code: 'export function run(input) { return input; }',
        tags: ['uniquetest', 'example']
      };
      
      const nodeData2 = {
        name: `Tagged Node 2 ${timestamp}`, 
        language: 'javascript',
        code: 'export function run(input) { return input; }',
        tags: ['uniquetest', 'demo']
      };
      
      await request(app)
        .post('/api/nodes')
        .send(nodeData1)
        .expect(201);
        
      await request(app)
        .post('/api/nodes')
        .send(nodeData2)
        .expect(201);
      
      // Get nodes by tag
      const response = await request(app)
        .get('/api/nodes/tags/uniquetest')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter nodes by search query', async () => {
      // Create test nodes
      const nodeData1 = {
        name: 'Math Calculator',
        language: 'javascript',
        code: 'export function run(input) { return input; }',
        description: 'Performs mathematical calculations'
      };
      
      const nodeData2 = {
        name: 'String Processor',
        language: 'javascript', 
        code: 'export function run(input) { return input; }',
        description: 'Processes text strings'
      };
      
      await request(app)
        .post('/api/nodes')
        .send(nodeData1)
        .expect(201);
        
      await request(app)
        .post('/api/nodes')
        .send(nodeData2)
        .expect(201);
      
      // Search for "math"
      const response = await request(app)
        .get('/api/nodes?search=math')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.some((node: any) => node.name.includes('Math'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent requests for same node', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app).get('/api/nodes/DataLoaderNode')
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
        expect(result.body.data.id).toBe('DataLoaderNode');
      });
    });
    
    it('should handle malformed node IDs', async () => {
      // Skip empty string as it might match different routes
      const malformedIds = ['..', '/etc/passwd', '<script>', 'null', 'undefined'];
      
      for (const id of malformedIds) {
        const response = await request(app)
          .get(`/api/nodes/${encodeURIComponent(id)}`)
          .expect(404);
        
        expect(response.body.success).toBe(false);
      }
    });
    
    it('should handle very long node IDs', async () => {
      const longId = 'a'.repeat(1000);
      
      const response = await request(app)
        .get(`/api/nodes/${longId}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Node not found');
    });
  });
});