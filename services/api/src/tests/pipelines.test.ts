import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pipelinesRouter } from '../routes/pipelines.js';

describe('Pipelines API', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/pipelines', pipelinesRouter);
  });
  
  describe('GET /api/pipelines', () => {
    it('should return list of pipelines', async () => {
      const response = await request(app)
        .get('/api/pipelines')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });
  
  describe('GET /api/pipelines/:id', () => {
    it('should return specific pipeline', async () => {
      const response = await request(app)
        .get('/api/pipelines/sample-ma-crossover')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe('sample-ma-crossover');
      expect(response.body.data.name).toContain('Moving Average Crossover');
    });
    
    it('should return 404 for non-existent pipeline', async () => {
      const response = await request(app)
        .get('/api/pipelines/non-existent')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Pipeline not found');
    });
  });
  
  describe('POST /api/pipelines/:id/run', () => {
    it('should start pipeline execution', async () => {
      const dsl = `
pipeline:
  - id: test
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "sample_ohlcv.csv"
`;
      
      const response = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .send({ dsl })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.runId).toBeDefined();
      expect(response.body.message).toContain('execution started');
    });
    
    it('should return 404 for non-existent pipeline', async () => {
      const response = await request(app)
        .post('/api/pipelines/non-existent/run')
        .send({ dsl: 'test' })
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/pipelines/:id/runs', () => {
    it('should return empty runs list for pipeline with no runs', async () => {
      const response = await request(app)
        .get('/api/pipelines/sample-ma-crossover/runs')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});