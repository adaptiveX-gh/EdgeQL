import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Pipeline, PipelineRun, ApiResponse } from '../types/index.js';

const router: RouterType = Router();

// In-memory storage for MVP (replace with database later)
const pipelines = new Map<string, Pipeline>();
const runs = new Map<string, PipelineRun>();

// Initialize with sample pipeline
pipelines.set('sample-ma-crossover', {
  id: 'sample-ma-crossover',
  name: 'Moving Average Crossover (Sample)',
  description: 'A simple moving average crossover strategy for demonstration',
  dsl: `# Moving Average Crossover Strategy
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "sample_ohlcv.csv"
      
  - id: sma_fast
    type: IndicatorNode
    depends_on: [data_loader]
    params:
      indicator: "SMA"
      period: 10
      column: "close"
      
  - id: sma_slow
    type: IndicatorNode
    depends_on: [data_loader]
    params:
      indicator: "SMA"
      period: 20
      column: "close"
      
  - id: signals
    type: CrossoverSignalNode
    depends_on: [sma_fast, sma_slow]
    params:
      buy_condition: "fast > slow"
      sell_condition: "fast < slow"
      
  - id: backtest
    type: BacktestNode
    depends_on: [signals, data_loader]
    params:
      initial_capital: 100000
      commission: 0.001`,
  status: 'ready',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// GET /api/pipelines - List all pipelines
router.get('/', (req, res) => {
  const response: ApiResponse<Pipeline[]> = {
    success: true,
    data: Array.from(pipelines.values())
  };
  return res.json(response);
});

// GET /api/pipelines/:id - Get specific pipeline
router.get('/:id', (req, res) => {
  const pipeline = pipelines.get(req.params.id);
  
  if (!pipeline) {
    return res.status(404).json({
      success: false,
      error: 'Pipeline not found'
    } as ApiResponse);
  }
  
  const response: ApiResponse<Pipeline> = {
    success: true,
    data: pipeline
  };
  return res.json(response);
});

// POST /api/pipelines/:id/run - Run a pipeline
router.post('/:id/run', async (req, res) => {
  const pipelineId = req.params.id;
  const { dsl } = req.body;
  
  const pipeline = pipelines.get(pipelineId);
  if (!pipeline) {
    return res.status(404).json({
      success: false,
      error: 'Pipeline not found'
    } as ApiResponse);
  }
  
  const runId = uuidv4();
  const run: PipelineRun = {
    id: runId,
    pipelineId,
    status: 'pending',
    startTime: new Date().toISOString(),
    logs: [`Starting pipeline execution for ${pipelineId}`]
  };
  
  runs.set(runId, run);
  
  // Simulate async execution
  setImmediate(async () => {
    try {
      // Update status to running
      run.status = 'running';
      run.logs.push('Compiling DSL...');
      run.logs.push('Validating pipeline structure...');
      run.logs.push('Starting node execution...');
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock successful completion
      run.status = 'completed';
      run.endTime = new Date().toISOString();
      run.logs.push('Pipeline execution completed successfully');
      run.results = {
        totalReturn: 15.4 + Math.random() * 10 - 5, // Add some randomness
        sharpeRatio: 1.23 + Math.random() * 0.5 - 0.25,
        maxDrawdown: -8.7 - Math.random() * 5,
        numTrades: 42 + Math.floor(Math.random() * 20 - 10),
        winRate: 0.67 + Math.random() * 0.2 - 0.1,
        finalCapital: 115400 + Math.random() * 20000 - 10000,
        trades: [],
        equityCurve: []
      };
    } catch (error) {
      run.status = 'failed';
      run.endTime = new Date().toISOString();
      run.error = error instanceof Error ? error.message : 'Unknown error';
      run.logs.push(`Error: ${run.error}`);
    }
  });
  
  const response: ApiResponse<{ runId: string }> = {
    success: true,
    data: { runId },
    message: 'Pipeline execution started'
  };
  return res.json(response);
});

// GET /api/pipelines/:id/runs - Get pipeline runs
router.get('/:id/runs', (req, res) => {
  const pipelineId = req.params.id;
  const pipelineRuns = Array.from(runs.values())
    .filter(run => run.pipelineId === pipelineId)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  
  const response: ApiResponse<PipelineRun[]> = {
    success: true,
    data: pipelineRuns
  };
  return res.json(response);
});

export { router as pipelinesRouter };