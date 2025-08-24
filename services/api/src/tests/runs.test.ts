import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { runsRouter } from '../routes/runs.js';

describe('Runs API', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/runs', runsRouter);
  });
  
  describe('GET /api/runs', () => {
    it('should return empty list when no runs exist', async () => {
      const response = await request(app)
        .get('/api/runs')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
    
    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/runs?limit=10')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('should respect offset parameter', async () => {
      const response = await request(app)
        .get('/api/runs?offset=5')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('should cap limit at 100', async () => {
      const response = await request(app)
        .get('/api/runs?limit=200')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('should handle invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/runs?limit=invalid')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
  
  describe('GET /api/runs/:id', () => {
    it('should return 404 for non-existent run', async () => {
      const response = await request(app)
        .get('/api/runs/non-existent-id')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Run not found');
    });
    
    it('should handle invalid run ID format', async () => {
      const response = await request(app)
        .get('/api/runs/invalid-format')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Run not found');
    });
  });
  
  describe('GET /api/runs/:id/logs', () => {
    it('should return 404 for non-existent run logs', async () => {
      const response = await request(app)
        .get('/api/runs/non-existent-id/logs')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Run not found');
    });
  });
  
  describe('POST /api/runs/:id/cancel', () => {
    it('should return 404 for non-existent run', async () => {
      const response = await request(app)
        .post('/api/runs/non-existent-id/cancel')
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Run not found');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle malformed URLs gracefully', async () => {
      const response = await request(app)
        .get('/api/runs/@#$%')
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('should handle empty request body for cancel operation', async () => {
      const response = await request(app)
        .post('/api/runs/test-id/cancel')
        .send()
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('should handle concurrent requests to same run', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app).get('/api/runs/concurrent-test')
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.status).toBe(404);
        expect(result.body.success).toBe(false);
      });
    });
  });
});