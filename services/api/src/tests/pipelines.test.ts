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

  describe('POST /api/pipelines/:id/duplicate', () => {
    it('should duplicate a pipeline with new ID and name', async () => {
      const response = await request(app)
        .post('/api/pipelines/sample-ma-crossover/duplicate')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.id).not.toBe('sample-ma-crossover');
      expect(response.body.data.name).toContain('Moving Average Crossover');
      expect(response.body.data.name).toContain('(Copy)');
      expect(response.body.data.dsl).toBeDefined();
      expect(response.body.data.status).toBe('ready');
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();
    });
    
    it('should return 404 when duplicating non-existent pipeline', async () => {
      const response = await request(app)
        .post('/api/pipelines/non-existent/duplicate')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Pipeline not found');
    });
  });

  describe('Observer Mode', () => {
    describe('POST /api/pipelines/:id/observer', () => {
      it('should generate observer token for a pipeline', async () => {
        const response = await request(app)
          .post('/api/pipelines/sample-ma-crossover/observer')
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.observerToken).toBeDefined();
        expect(response.body.data.observerUrl).toBeDefined();
        expect(typeof response.body.data.observerToken).toBe('string');
        expect(response.body.data.observerToken.length).toBeGreaterThan(10);
      });
      
      it('should return 404 when generating observer token for non-existent pipeline', async () => {
        const response = await request(app)
          .post('/api/pipelines/non-existent/observer')
          .expect(404);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Pipeline not found');
      });
    });

    describe('GET /api/pipelines/:id with observer token', () => {
      it('should return pipeline data with readOnly flag when using valid observer token', async () => {
        // First generate observer token
        const tokenResponse = await request(app)
          .post('/api/pipelines/sample-ma-crossover/observer')
          .expect(200);
        
        const observerToken = tokenResponse.body.data.observerToken;
        
        // Then access with observer token
        const response = await request(app)
          .get(`/api/pipelines/sample-ma-crossover?observer=${observerToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.id).toBe('sample-ma-crossover');
        expect(response.body.data.readOnly).toBe(true);
        expect(response.body.data.isObserverMode).toBe(true);
      });
      
      it('should return 401 when using invalid observer token', async () => {
        const response = await request(app)
          .get('/api/pipelines/sample-ma-crossover?observer=invalid-token')
          .expect(401);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid observer token');
      });
      
      it('should return normal pipeline data without observer token', async () => {
        const response = await request(app)
          .get('/api/pipelines/sample-ma-crossover')
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.id).toBe('sample-ma-crossover');
        expect(response.body.data.readOnly).toBeFalsy();
        expect(response.body.data.isObserverMode).toBeFalsy();
      });
    });

    describe('POST /api/pipelines/:id/run with observer mode', () => {
      it('should reject pipeline execution when using observer token', async () => {
        // First generate observer token
        const tokenResponse = await request(app)
          .post('/api/pipelines/sample-ma-crossover/observer')
          .expect(200);
        
        const observerToken = tokenResponse.body.data.observerToken;
        
        // Then try to run with observer token
        const response = await request(app)
          .post(`/api/pipelines/sample-ma-crossover/run?observer=${observerToken}`)
          .send({ dsl: 'test' })
          .expect(403);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Read-only access');
      });
    });
  });
});