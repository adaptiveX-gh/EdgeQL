import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { nodesRouter } from '../routes/nodes.js';

describe('Nodes API', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/nodes', nodesRouter);
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
    it('should return 501 for unimplemented custom node creation', async () => {
      const nodeData = {
        id: 'CustomNode',
        name: 'My Custom Node',
        code: 'def process(): pass'
      };
      
      const response = await request(app)
        .post('/api/nodes')
        .send(nodeData)
        .expect(501);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not yet implemented');
    });
    
    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({})
        .expect(501);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/nodes/:id', () => {
    it('should return 501 for unimplemented custom node editing', async () => {
      const response = await request(app)
        .put('/api/nodes/test-node')
        .send({ name: 'Updated Name' })
        .expect(501);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not yet implemented');
    });
  });
  
  describe('DELETE /api/nodes/:id', () => {
    it('should return 501 for unimplemented custom node deletion', async () => {
      const response = await request(app)
        .delete('/api/nodes/test-node')
        .expect(501);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not yet implemented');
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
      const malformedIds = ['', ' ', '..', '/etc/passwd'];
      
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