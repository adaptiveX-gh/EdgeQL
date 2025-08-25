import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PipelineExecutor } from '@edgeql/executor';
import { PipelineCompiler } from '@edgeql/compiler';
import { Pipeline, PipelineRun, PipelineVersion, ApiResponse, ObserverTokenResponse } from '../types/index.js';
import { PipelineStorage, RunStorage, PipelineVersionStorage, ObserverStorage } from '../utils/storage.js';

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

// Helper function to check observer mode
async function checkObserverMode(req: any): Promise<{ isObserver: boolean; pipeline?: Pipeline }> {
  const observerToken = req.query.observer as string;
  
  if (!observerToken) {
    return { isObserver: false };
  }
  
  const observerAccess = await ObserverStorage.validateToken(observerToken);
  if (!observerAccess) {
    throw new Error('Invalid observer token');
  }
  
  // Record access
  await ObserverStorage.recordAccess(observerToken);
  
  // Get pipeline
  const pipeline = await PipelineStorage.get(observerAccess.pipelineId);
  if (!pipeline) {
    throw new Error('Pipeline not found');
  }
  
  return { 
    isObserver: true, 
    pipeline: {
      ...pipeline,
      readOnly: true,
      isObserverMode: true
    }
  };
}

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
    // Check observer mode first
    try {
      const observerCheck = await checkObserverMode(req);
      if (observerCheck.isObserver && observerCheck.pipeline) {
        // Verify the requested pipeline matches the observer token's pipeline
        if (observerCheck.pipeline.id === req.params.id) {
          const response: ApiResponse<Pipeline> = {
            success: true,
            data: observerCheck.pipeline
          };
          return res.json(response);
        } else {
          return res.status(403).json({
            success: false,
            error: 'Observer token not valid for this pipeline'
          } as ApiResponse);
        }
      }
    } catch (observerError) {
      return res.status(401).json({
        success: false,
        error: (observerError as Error).message
      } as ApiResponse);
    }
    
    // Normal pipeline access
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
    // Check if this is an observer mode request
    try {
      const observerCheck = await checkObserverMode(req);
      if (observerCheck.isObserver) {
        return res.status(403).json({
          success: false,
          error: 'Read-only access: Pipeline execution not allowed in observer mode'
        } as ApiResponse);
      }
    } catch (observerError) {
      // If observer token is invalid, proceed with normal validation
      // This allows non-observer requests to continue
    }
    
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

// Version management routes

// GET /api/pipelines/:id/versions - Get all versions for a pipeline
router.get('/:id/versions', async (req, res) => {
  try {
    const pipelineId = req.params.id;
    const pipeline = await PipelineStorage.get(pipelineId);
    
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      } as ApiResponse);
    }
    
    const versions = await PipelineVersionStorage.getByPipeline(pipelineId);
    
    const response: ApiResponse<PipelineVersion[]> = {
      success: true,
      data: versions
    };
    return res.json(response);
  } catch (error) {
    console.error('Failed to retrieve pipeline versions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve pipeline versions'
    } as ApiResponse);
  }
});

// POST /api/pipelines/:id/versions - Create a new version
router.post('/:id/versions', async (req, res) => {
  try {
    const pipelineId = req.params.id;
    const { dsl, commitMessage, isAutoSave = false, tags = [], createdBy } = req.body;
    
    if (!dsl || typeof dsl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'DSL content is required'
      } as ApiResponse);
    }
    
    const pipeline = await PipelineStorage.get(pipelineId);
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      } as ApiResponse);
    }
    
    // Create new version
    const newVersion = await PipelineVersionStorage.createVersion(pipelineId, dsl, {
      commitMessage,
      isAutoSave,
      tags,
      createdBy
    });
    
    // Update pipeline's current version and DSL
    pipeline.dsl = dsl;
    pipeline.currentVersion = newVersion.version;
    pipeline.updatedAt = new Date().toISOString();
    await PipelineStorage.set(pipeline);
    
    const response: ApiResponse<PipelineVersion> = {
      success: true,
      data: newVersion,
      message: 'Version created successfully'
    };
    return res.json(response);
    
  } catch (error) {
    console.error('Failed to create pipeline version:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create pipeline version'
    } as ApiResponse);
  }
});

// GET /api/pipelines/:id/versions/:versionId - Get specific version
router.get('/:id/versions/:versionId', async (req, res) => {
  try {
    const { id: pipelineId, versionId } = req.params;
    
    const pipeline = await PipelineStorage.get(pipelineId);
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      } as ApiResponse);
    }
    
    const version = await PipelineVersionStorage.get(versionId);
    if (!version || version.pipelineId !== pipelineId) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      } as ApiResponse);
    }
    
    const response: ApiResponse<PipelineVersion> = {
      success: true,
      data: version
    };
    return res.json(response);
    
  } catch (error) {
    console.error('Failed to retrieve pipeline version:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve pipeline version'
    } as ApiResponse);
  }
});

// POST /api/pipelines/:id/versions/:versionId/restore - Restore a version
router.post('/:id/versions/:versionId/restore', async (req, res) => {
  try {
    const { id: pipelineId, versionId } = req.params;
    const { createBackup = true, commitMessage } = req.body;
    
    const pipeline = await PipelineStorage.get(pipelineId);
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      } as ApiResponse);
    }
    
    const versionToRestore = await PipelineVersionStorage.get(versionId);
    if (!versionToRestore || versionToRestore.pipelineId !== pipelineId) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      } as ApiResponse);
    }
    
    // Create backup of current state if requested
    let backupVersion: PipelineVersion | null = null;
    if (createBackup && pipeline.dsl !== versionToRestore.dsl) {
      backupVersion = await PipelineVersionStorage.createVersion(pipelineId, pipeline.dsl, {
        commitMessage: `Backup before restoring to v${versionToRestore.version}`,
        isAutoSave: true
      });
    }
    
    // Create new version with restored content
    const restoredVersion = await PipelineVersionStorage.createVersion(pipelineId, versionToRestore.dsl, {
      commitMessage: commitMessage || `Restored from v${versionToRestore.version}`,
      isAutoSave: false,
      tags: ['restored']
    });
    
    // Update pipeline
    pipeline.dsl = versionToRestore.dsl;
    pipeline.currentVersion = restoredVersion.version;
    pipeline.updatedAt = new Date().toISOString();
    await PipelineStorage.set(pipeline);
    
    const response: ApiResponse<{ 
      restoredVersion: PipelineVersion; 
      backupVersion?: PipelineVersion;
    }> = {
      success: true,
      data: { 
        restoredVersion,
        ...(backupVersion && { backupVersion })
      },
      message: `Successfully restored to version ${versionToRestore.version}`
    };
    return res.json(response);
    
  } catch (error) {
    console.error('Failed to restore pipeline version:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to restore pipeline version'
    } as ApiResponse);
  }
});

// DELETE /api/pipelines/:id/versions/:versionId - Delete a version
router.delete('/:id/versions/:versionId', async (req, res) => {
  try {
    const { id: pipelineId, versionId } = req.params;
    
    const pipeline = await PipelineStorage.get(pipelineId);
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      } as ApiResponse);
    }
    
    const version = await PipelineVersionStorage.get(versionId);
    if (!version || version.pipelineId !== pipelineId) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      } as ApiResponse);
    }
    
    // Don't allow deletion of the current version
    if (pipeline.currentVersion === version.version) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the current version'
      } as ApiResponse);
    }
    
    const deleted = await PipelineVersionStorage.delete(versionId);
    
    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted },
      message: deleted ? 'Version deleted successfully' : 'Version not found'
    };
    return res.json(response);
    
  } catch (error) {
    console.error('Failed to delete pipeline version:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete pipeline version'
    } as ApiResponse);
  }
});

// POST /api/pipelines/:id/duplicate - Duplicate a pipeline
router.post('/:id/duplicate', async (req, res) => {
  try {
    const originalPipeline = await PipelineStorage.get(req.params.id);
    if (!originalPipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      } as ApiResponse);
    }

    // Create duplicate with new ID and name
    const duplicateId = uuidv4();
    const duplicatePipeline: Pipeline = {
      ...originalPipeline,
      id: duplicateId,
      name: `${originalPipeline.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentVersion: undefined, // Reset version counter for new pipeline
      // Remove observer-specific fields for clean copy
      observerTokens: undefined,
      readOnly: undefined,
      isObserverMode: undefined
    };

    await PipelineStorage.set(duplicatePipeline);

    const response: ApiResponse<Pipeline> = {
      success: true,
      data: duplicatePipeline,
      message: 'Pipeline duplicated successfully'
    };
    return res.json(response);

  } catch (error) {
    console.error('Pipeline duplication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to duplicate pipeline'
    } as ApiResponse);
  }
});

// POST /api/pipelines/:id/observer - Generate observer token
router.post('/:id/observer', async (req, res) => {
  try {
    const pipeline = await PipelineStorage.get(req.params.id);
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      } as ApiResponse);
    }

    const observerToken = await ObserverStorage.generateObserverToken(req.params.id);
    
    // Construct observer URL (could be configurable via environment)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const observerUrl = `${baseUrl}/pipeline/${req.params.id}?observer=${observerToken}`;

    const response: ApiResponse<ObserverTokenResponse> = {
      success: true,
      data: {
        observerToken,
        observerUrl
      },
      message: 'Observer token generated successfully'
    };
    return res.json(response);

  } catch (error) {
    console.error('Observer token generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate observer token'
    } as ApiResponse);
  }
});

// GET /api/pipelines/:id/observers - Get observer access records for pipeline
router.get('/:id/observers', async (req, res) => {
  try {
    const pipeline = await PipelineStorage.get(req.params.id);
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      } as ApiResponse);
    }

    const observers = await ObserverStorage.getByPipeline(req.params.id);
    
    // Remove sensitive token data from response
    const safeObservers = observers.map(obs => ({
      id: obs.id,
      createdAt: obs.createdAt,
      lastAccessedAt: obs.lastAccessedAt,
      accessCount: obs.accessCount,
      expiresAt: obs.expiresAt
    }));

    const response: ApiResponse<any[]> = {
      success: true,
      data: safeObservers
    };
    return res.json(response);

  } catch (error) {
    console.error('Failed to get observers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve observer records'
    } as ApiResponse);
  }
});

// DELETE /api/pipelines/:id/observers/:token - Revoke observer token
router.delete('/:id/observers/:token', async (req, res) => {
  try {
    const pipeline = await PipelineStorage.get(req.params.id);
    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      } as ApiResponse);
    }

    const revoked = await ObserverStorage.revokeToken(req.params.token);

    const response: ApiResponse<{ revoked: boolean }> = {
      success: true,
      data: { revoked },
      message: revoked ? 'Observer token revoked successfully' : 'Token not found'
    };
    return res.json(response);

  } catch (error) {
    console.error('Failed to revoke observer token:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke observer token'
    } as ApiResponse);
  }
});

export { router as pipelinesRouter };