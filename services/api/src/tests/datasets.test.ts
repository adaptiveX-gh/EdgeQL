import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { datasetsRouter } from '../routes/datasets.js';

describe('Datasets API', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/datasets', datasetsRouter);
  });
  
  describe('GET /api/datasets', () => {
    it('should return list of datasets including sample data', async () => {
      const response = await request(app)
        .get('/api/datasets')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Should include sample dataset
      const datasetIds = response.body.data.map((dataset: any) => dataset.id);
      expect(datasetIds).toContain('sample_ohlcv.csv');
    });
    
    it('should return datasets with correct structure', async () => {
      const response = await request(app)
        .get('/api/datasets')
        .expect(200);
      
      const firstDataset = response.body.data[0];
      expect(firstDataset).toHaveProperty('id');
      expect(firstDataset).toHaveProperty('name');
      expect(firstDataset).toHaveProperty('filename');
      expect(firstDataset).toHaveProperty('size');
      expect(firstDataset).toHaveProperty('columns');
      expect(firstDataset).toHaveProperty('rowCount');
      expect(firstDataset).toHaveProperty('uploadedAt');
      expect(Array.isArray(firstDataset.columns)).toBe(true);
      expect(typeof firstDataset.size).toBe('number');
      expect(typeof firstDataset.rowCount).toBe('number');
    });
    
    it('should return sample dataset with expected properties', async () => {
      const response = await request(app)
        .get('/api/datasets')
        .expect(200);
      
      const sampleDataset = response.body.data.find((d: any) => d.id === 'sample_ohlcv.csv');
      expect(sampleDataset).toBeDefined();
      expect(sampleDataset.name).toBe('BTC/USD 1m Sample Data');
      expect(sampleDataset.filename).toBe('BTC_1m_hyperliquid_perpetualx.csv');
      expect(sampleDataset.columns).toContain('ts');
      expect(sampleDataset.columns).toContain('open');
      expect(sampleDataset.columns).toContain('high');
      expect(sampleDataset.columns).toContain('low');
      expect(sampleDataset.columns).toContain('close');
      expect(sampleDataset.columns).toContain('volume');
    });
  });
  
  describe('GET /api/datasets/:id', () => {
    it('should return specific dataset details', async () => {
      const response = await request(app)
        .get('/api/datasets/sample_ohlcv.csv')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe('sample_ohlcv.csv');
      expect(response.body.data.name).toBe('BTC/USD 1m Sample Data');
      expect(response.body.data.filename).toBe('BTC_1m_hyperliquid_perpetualx.csv');
      expect(response.body.data.size).toBeGreaterThan(0);
      expect(response.body.data.rowCount).toBeGreaterThan(0);
      expect(Array.isArray(response.body.data.columns)).toBe(true);
      expect(response.body.data.uploadedAt).toBeDefined();
    });
    
    it('should return 404 for non-existent dataset', async () => {
      const response = await request(app)
        .get('/api/datasets/non-existent.csv')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Dataset not found');
    });
    
    it('should handle invalid dataset ID format', async () => {
      const response = await request(app)
        .get('/api/datasets/@invalid-id')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Dataset not found');
    });
    
    it('should handle empty dataset ID', async () => {
      const response = await request(app)
        .get('/api/datasets/')
        .expect(200); // This will hit the list endpoint
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
  
  describe('GET /api/datasets/:id/preview', () => {
    it('should return preview data for existing dataset', async () => {
      const response = await request(app)
        .get('/api/datasets/sample_ohlcv.csv/preview')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Check structure of preview data
      const firstRow = response.body.data[0];
      expect(firstRow).toHaveProperty('ts');
      expect(firstRow).toHaveProperty('open');
      expect(firstRow).toHaveProperty('high');
      expect(firstRow).toHaveProperty('low');
      expect(firstRow).toHaveProperty('close');
      expect(firstRow).toHaveProperty('volume');
      expect(firstRow).toHaveProperty('coin');
      expect(firstRow).toHaveProperty('exchange_id');
      expect(firstRow).toHaveProperty('data_type');
    });
    
    it('should return consistent preview data structure', async () => {
      const response = await request(app)
        .get('/api/datasets/sample_ohlcv.csv/preview')
        .expect(200);
      
      response.body.data.forEach((row: any) => {
        expect(typeof row.ts).toBe('string');
        expect(typeof row.open).toBe('string');
        expect(typeof row.high).toBe('string');
        expect(typeof row.low).toBe('string');
        expect(typeof row.close).toBe('string');
        expect(typeof row.volume).toBe('string');
        expect(row.coin).toBe('BTC');
        expect(row.exchange_id).toBe('2');
        expect(row.data_type).toBe('perpetual');
      });
    });
    
    it('should return 404 for preview of non-existent dataset', async () => {
      const response = await request(app)
        .get('/api/datasets/non-existent.csv/preview')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Dataset not found');
    });
  });
  
  describe('POST /api/datasets/upload', () => {
    it('should return 501 for unimplemented upload feature', async () => {
      const response = await request(app)
        .post('/api/datasets/upload')
        .attach('file', Buffer.from('test,data'), 'test.csv')
        .expect(501);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not yet implemented');
    });
    
    it('should handle empty upload request', async () => {
      const response = await request(app)
        .post('/api/datasets/upload')
        .send({})
        .expect(501);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('DELETE /api/datasets/:id', () => {
    it('should return 501 for unimplemented delete feature', async () => {
      const response = await request(app)
        .delete('/api/datasets/test.csv')
        .expect(501);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not yet implemented');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle concurrent requests for same dataset', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app).get('/api/datasets/sample_ohlcv.csv')
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
        expect(result.body.data.id).toBe('sample_ohlcv.csv');
      });
    });
    
    it('should handle malformed dataset IDs', async () => {
      const malformedIds = ['', ' ', '..', '/etc/passwd', '../secret.txt'];
      
      for (const id of malformedIds) {
        const response = await request(app)
          .get(`/api/datasets/${encodeURIComponent(id)}`)
          .expect(404);
        
        expect(response.body.success).toBe(false);
      }
    });
    
    it('should handle very long dataset IDs', async () => {
      const longId = 'a'.repeat(1000) + '.csv';
      
      const response = await request(app)
        .get(`/api/datasets/${longId}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Dataset not found');
    });
    
    it('should handle special characters in dataset IDs', async () => {
      const specialIds = ['test%20file.csv', 'test+file.csv', 'test&file.csv'];
      
      for (const id of specialIds) {
        const response = await request(app)
          .get(`/api/datasets/${id}`)
          .expect(404);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Dataset not found');
      }
    });
    
    it('should handle concurrent preview requests', async () => {
      const promises = Array(5).fill(null).map(() =>
        request(app).get('/api/datasets/sample_ohlcv.csv/preview')
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
        expect(Array.isArray(result.body.data)).toBe(true);
        expect(result.body.data.length).toBeGreaterThan(0);
      });
    });
  });
});