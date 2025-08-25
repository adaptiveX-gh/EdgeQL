import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PipelineExecutor } from '@edgeql/executor';
import { PipelineCompiler } from '@edgeql/compiler';
import { Pipeline, PipelineRun, ApiResponse } from '../types/index.js';
import { PipelineStorage, RunStorage } from '../utils/storage.js';

const router: RouterType = Router();

// Initialize executor and compiler as singletons
const executor = new PipelineExecutor();
const compiler = new PipelineCompiler();

// Export the executor instance for use by other routes
export { executor };

// Initialize sample pipeline on first load
const initializeSampleData = async () => {
  const existing = await PipelineStorage.get('sample-ma-crossover');
  if (!existing) {
    const samplePipeline: Pipeline = {
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
    };
    await PipelineStorage.set(samplePipeline);
  }
};

// Initialize on startup
initializeSampleData().catch(console.error);

// GET /api/pipelines - List all pipelines
router.get('/', async (req, res) => {
  try {
    const pipelines = await PipelineStorage.getAll();
    const response: ApiResponse<Pipeline[]> = {
      success: true,
      data: pipelines
    };
    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve pipelines'
    } as ApiResponse);
  }
});

// GET /api/pipelines/:id - Get specific pipeline
router.get('/:id', async (req, res) => {
  try {
    const pipeline = await PipelineStorage.get(req.params.id);
    
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
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve pipeline'
    } as ApiResponse);
  }
});

// POST /api/pipelines/validate - Validate DSL content
router.post('/validate', async (req, res) => {
  const { dsl } = req.body;
  
  if (!dsl || typeof dsl !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'DSL content is required'
    } as ApiResponse);
  }
  
  try {
    const result = compiler.compile(dsl);
    
    if (result.success) {
      const response: ApiResponse<{ valid: true, warnings?: string[] }> = {
        success: true,
        data: { 
          valid: true,
          ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {})
        }
      };
      return res.json(response);
    } else {
      // Return validation errors without failing the HTTP request
      const response: ApiResponse<{ valid: false, errors: any[] }> = {
        success: true,
        data: { 
          valid: false,
          errors: result.errors || []
        }
      };
      return res.json(response);
    }
  } catch (error) {
    console.error('DSL validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate DSL'
    } as ApiResponse);
  }
});

// POST /api/pipelines/:id/run - Run a pipeline
router.post('/:id/run', async (req, res) => {
  const pipelineId = req.params.id;
  const { dsl } = req.body;
  
  try {
    const pipeline = await PipelineStorage.get(pipelineId);
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
    
    await RunStorage.set(run);
    
    // Start async execution
    setImmediate(async () => {
      try {
        // Update status to running
        run.status = 'running';
        run.logs.push('Compiling DSL and validating pipeline structure...');
        await RunStorage.set(run);
        
        // Use the actual DSL content from request or pipeline
        const dslToExecute = dsl || pipeline.dsl;
        
        // Execute pipeline using the real executor
        const executionResult = await executor.executePipeline(pipelineId, dslToExecute);
        
        if (executionResult.success) {
          run.status = 'completed';
          run.endTime = new Date().toISOString();
          run.logs.push('Pipeline execution completed successfully');
          
          // Extract backtest results from final outputs
          const backtestResult = Array.from(executionResult.finalOutputs.values())
            .find((output: any) => output.type === 'backtest_results');
          
          if (backtestResult && (backtestResult as any).data) {
            run.results = (backtestResult as any).data;
            run.logs.push(`Backtest completed: ${JSON.stringify((backtestResult as any).data, null, 2)}`);
          } else {
            // Fallback: Try to extract results from node outputs
            const backtestOutput = executionResult.finalOutputs.get('backtest');
            if (backtestOutput && backtestOutput.type === 'backtest_results' && backtestOutput.data) {
              run.results = backtestOutput.data;
              run.logs.push(`Backtest completed: ${JSON.stringify(backtestOutput.data, null, 2)}`);
            } else {
              // Final fallback: Extract from logs if backtest completed message exists
              const backtestLogIndex = run.logs.findIndex(log => log.includes('Backtest completed:'));
              if (backtestLogIndex !== -1) {
                try {
                  const backtestLogLine = run.logs[backtestLogIndex];
                  if (backtestLogLine) {
                    const jsonStart = backtestLogLine.indexOf('{');
                    if (jsonStart !== -1) {
                      const jsonStr = backtestLogLine.substring(jsonStart);
                      const parsedResults = JSON.parse(jsonStr);
                      run.results = parsedResults;
                      console.log('Extracted backtest results from logs');
                    }
                  }
                } catch (error) {
                  console.error('Failed to parse backtest results from logs:', error);
                }
              }
            }
          }
          
          // Add execution logs from each node
          for (const [nodeId, result] of executionResult.results.entries()) {
            if (result.logs) {
              run.logs.push(`Node ${nodeId}:`);
              run.logs.push(...result.logs.map((log: string) => `  ${log}`));
            }
          }
        } else {
          run.status = 'failed';
          run.endTime = new Date().toISOString();
          run.error = executionResult.error || 'Unknown execution error';
          run.logs.push(`Error: ${run.error}`);
          
          // Add any partial execution logs
          for (const [nodeId, result] of executionResult.results.entries()) {
            if (result.logs) {
              run.logs.push(`Node ${nodeId} logs:`);
              run.logs.push(...result.logs.map((log: string) => `  ${log}`));
            }
          }
        }
        
        await RunStorage.set(run);
        
      } catch (error) {
        run.status = 'failed';
        run.endTime = new Date().toISOString();
        run.error = error instanceof Error ? error.message : 'Unknown error';
        run.logs.push(`Execution error: ${run.error}`);
        await RunStorage.set(run);
      }
    });
    
    const response: ApiResponse<{ runId: string }> = {
      success: true,
      data: { runId },
      message: 'Pipeline execution started'
    };
    return res.json(response);
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to start pipeline execution'
    } as ApiResponse);
  }
});

// GET /api/pipelines/:id/runs - Get pipeline runs
router.get('/:id/runs', async (req, res) => {
  try {
    const pipelineId = req.params.id;
    const pipelineRuns = await RunStorage.getByPipeline(pipelineId);
    
    const response: ApiResponse<PipelineRun[]> = {
      success: true,
      data: pipelineRuns
    };
    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve pipeline runs'
    } as ApiResponse);
  }
});

// POST /api/pipelines/:id/compile - Compile pipeline to JSON IR
router.post('/:id/compile', async (req, res) => {
  const pipelineId = req.params.id;
  const { dsl } = req.body;
  
  try {
    const pipeline = await PipelineStorage.get(pipelineId);
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      } as ApiResponse);
    }
    
    // Use the actual DSL content from request or pipeline
    const dslToCompile = dsl || pipeline.dsl;
    
    // Compile to JSON IR
    const result = compiler.compileToIR(dslToCompile, pipelineId, pipeline.name, pipeline.description);
    
    if (result.success && result.ir) {
      const response: ApiResponse<any> = {
        success: true,
        data: result.ir,
        message: 'Pipeline compiled to JSON IR successfully'
      };
      return res.json(response);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Compilation failed',
        data: result.errors
      } as ApiResponse);
    }
    
  } catch (error) {
    console.error('Pipeline compilation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to compile pipeline',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as ApiResponse);
  }
});

export { router as pipelinesRouter };