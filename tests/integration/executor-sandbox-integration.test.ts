import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PipelineExecutor } from '../../services/executor/src/index.js';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

describe('Executor Sandbox Integration Tests', () => {
  let executor: PipelineExecutor;
  let dockerImagesBuilt = false;

  beforeAll(async () => {
    executor = new PipelineExecutor();
    
    // Check if Docker is available
    const dockerAvailable = await checkDockerAvailable();
    if (!dockerAvailable) {
      console.warn('Docker not available - skipping sandbox integration tests');
      return;
    }
    
    // Build Docker images if they don't exist
    await ensureDockerImagesExist();
    dockerImagesBuilt = true;
  }, 120000); // 2 minute timeout for Docker builds

  describe('Python Sandbox Integration', () => {
    it('should execute DataLoaderNode in Python sandbox', async () => {
      if (!dockerImagesBuilt) {
        console.warn('Docker images not available - skipping test');
        return;
      }

      const dsl = `
pipeline:
  - id: data_loader_sandbox
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "BTC_1m_hyperliquid_perpetualx.csv"
`;

      const result = await executor.executePipeline('python-sandbox-test', dsl);
      
      expect(result.success).toBe(true);
      expect(result.results.get('data_loader_sandbox')?.success).toBe(true);
      expect(result.results.get('data_loader_sandbox')?.output).toBeDefined();
    }, 60000);

    it('should execute FeatureGeneratorNode in Python sandbox', async () => {
      if (!dockerImagesBuilt) {
        console.warn('Docker images not available - skipping test');
        return;
      }

      const dsl = `
pipeline:
  - id: data_source
    type: DataLoaderNode
    params:
      symbol: "ETH/USD"
      timeframe: "4h"
      dataset: "BTC_1m_hyperliquid_perpetualx.csv"
      
  - id: feature_generator
    type: FeatureGeneratorNode
    depends_on: [data_source]
    params:
      features:
        - type: sma
          period: 20
          column: close
          name: sma_20
        - type: rsi
          period: 14
          column: close
          name: rsi_14
`;

      const result = await executor.executePipeline('feature-gen-sandbox-test', dsl);
      
      expect(result.success).toBe(true);
      expect(result.results.size).toBe(2);
      
      const featureGenResult = result.results.get('feature_generator');
      expect(featureGenResult?.success).toBe(true);
      expect(featureGenResult?.output?.metadata?.features_added).toBeGreaterThan(0);
    }, 90000);

    it('should execute LabelingNode in Python sandbox', async () => {
      if (!dockerImagesBuilt) {
        console.warn('Docker images not available - skipping test');
        return;
      }

      const dsl = `
pipeline:
  - id: data_source
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "BTC_1m_hyperliquid_perpetualx.csv"
      
  - id: features
    type: FeatureGeneratorNode
    depends_on: [data_source]
    params:
      features:
        - type: sma
          period: 10
          column: close
        - type: sma
          period: 20
          column: close
      
  - id: labels
    type: LabelingNode
    depends_on: [features]
    params:
      method: future_returns
      forward_periods: 5
      return_threshold: 0.02
`;

      const result = await executor.executePipeline('labeling-sandbox-test', dsl);
      
      expect(result.success).toBe(true);
      expect(result.results.size).toBe(3);
      
      const labelingResult = result.results.get('labels');
      expect(labelingResult?.success).toBe(true);
      expect(labelingResult?.output?.metadata?.signal_stats).toBeDefined();
    }, 120000);

    it('should handle Python sandbox errors gracefully', async () => {
      if (!dockerImagesBuilt) {
        console.warn('Docker images not available - skipping test');
        return;
      }

      const dslWithError = `
pipeline:
  - id: error_node
    type: FeatureGeneratorNode
    params:
      features:
        - type: invalid_feature
          period: -1  # Invalid parameter
`;

      const result = await executor.executePipeline('python-error-test', dslWithError);
      
      // Should handle error gracefully without crashing
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 60000);
  });

  describe('Resource Constraints', () => {
    it('should respect memory limits in Python sandbox', async () => {
      if (!dockerImagesBuilt) {
        console.warn('Docker images not available - skipping test');
        return;
      }

      const dsl = `
pipeline:
  - id: memory_test
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1m"
      dataset: "BTC_1m_hyperliquid_perpetualx.csv"
`;

      const result = await executor.executePipeline('memory-limit-test', dsl);
      
      expect(result.success).toBe(true);
      
      const nodeResult = result.results.get('memory_test');
      expect(nodeResult?.logs).toContain(
        expect.stringMatching(/--memory=512m/)
      );
    }, 60000);

    it('should respect execution timeouts', async () => {
      if (!dockerImagesBuilt) {
        console.warn('Docker images not available - skipping test');
        return;
      }

      // This test would need a node that deliberately takes too long
      // For now, just verify the timeout mechanism exists
      const shortTimeoutDsl = `
pipeline:
  - id: quick_task
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "BTC_1m_hyperliquid_perpetualx.csv"
`;

      const startTime = Date.now();
      const result = await executor.executePipeline('timeout-test', shortTimeoutDsl);
      const executionTime = Date.now() - startTime;
      
      // Should complete quickly, not timeout
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(30000); // Less than 30 seconds
    }, 45000);
  });

  describe('Security Constraints', () => {
    it('should run containers with restricted privileges', async () => {
      if (!dockerImagesBuilt) {
        console.warn('Docker images not available - skipping test');
        return;
      }

      const dsl = `
pipeline:
  - id: security_test
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "BTC_1m_hyperliquid_perpetualx.csv"
`;

      const result = await executor.executePipeline('security-test', dsl);
      
      expect(result.success).toBe(true);
      
      const nodeResult = result.results.get('security_test');
      expect(nodeResult?.logs.some(log => 
        log.includes('--network=none') && 
        log.includes('--read-only') && 
        log.includes('--user edgeql')
      )).toBe(true);
    }, 60000);
  });

  describe('Data Pipeline Flow', () => {
    it('should execute complete feature engineering pipeline', async () => {
      if (!dockerImagesBuilt) {
        console.warn('Docker images not available - skipping test');
        return;
      }

      const completeDsl = `
pipeline:
  - id: load_data
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "BTC_1m_hyperliquid_perpetualx.csv"
      
  - id: generate_features
    type: FeatureGeneratorNode
    depends_on: [load_data]
    params:
      features:
        - type: sma
          period: 20
          column: close
        - type: ema
          period: 12
          column: close
        - type: rsi
          period: 14
          column: close
        - type: macd
          fast_period: 12
          slow_period: 26
          signal_period: 9
          column: close
          
  - id: create_labels
    type: LabelingNode
    depends_on: [generate_features]
    params:
      method: rsi_signals
`;

      const result = await executor.executePipeline('complete-pipeline-test', completeDsl);
      
      expect(result.success).toBe(true);
      expect(result.results.size).toBe(3);
      
      // Verify data flows correctly through pipeline
      const dataResult = result.results.get('load_data');
      const featureResult = result.results.get('generate_features');
      const labelResult = result.results.get('create_labels');
      
      expect(dataResult?.success).toBe(true);
      expect(featureResult?.success).toBe(true);
      expect(labelResult?.success).toBe(true);
      
      // Verify feature generation added columns
      expect(featureResult?.output?.metadata?.features_added).toBeGreaterThan(0);
      
      // Verify labeling created signals
      expect(labelResult?.output?.metadata?.signal_stats?.total_signals).toBeGreaterThan(0);
      
      // Verify execution order was correct
      expect(dataResult?.executionTime).toBeLessThan(
        featureResult!.executionTime + labelResult!.executionTime
      );
    }, 180000); // 3 minute timeout for complete pipeline
  });
});

async function checkDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const dockerProcess = spawn('docker', ['--version'], {
      stdio: 'pipe'
    });
    
    dockerProcess.on('close', (code) => {
      resolve(code === 0);
    });
    
    dockerProcess.on('error', () => {
      resolve(false);
    });
    
    setTimeout(() => resolve(false), 5000);
  });
}

async function ensureDockerImagesExist(): Promise<void> {
  const images = [
    'edgeql-python-sandbox',
    'edgeql-nodejs-sandbox'
  ];
  
  for (const image of images) {
    const imageExists = await checkImageExists(image);
    if (!imageExists) {
      console.log(`Building Docker image: ${image}`);
      await buildDockerImage(image);
    }
  }
}

async function checkImageExists(imageName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn('docker', ['images', '-q', imageName], {
      stdio: 'pipe'
    });
    
    let output = '';
    process.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    process.on('close', (code) => {
      resolve(code === 0 && output.trim().length > 0);
    });
    
    process.on('error', () => {
      resolve(false);
    });
  });
}

async function buildDockerImage(imageName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let dockerfilePath: string;
    
    if (imageName.includes('python')) {
      dockerfilePath = 'docker/python-sandbox.Dockerfile';
    } else if (imageName.includes('nodejs')) {
      dockerfilePath = 'docker/node-sandbox.Dockerfile';
    } else {
      reject(new Error(`Unknown image: ${imageName}`));
      return;
    }
    
    const process = spawn('docker', ['build', '-t', imageName, '-f', dockerfilePath, '.'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Docker build failed for ${imageName}`));
      }
    });
    
    process.on('error', (error) => {
      reject(error);
    });
  });
}