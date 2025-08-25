import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { PipelineRun, ApiResponse } from '../types/index.js';
import { RunStorage } from '../utils/storage.js';
import { executor } from './pipelines.js';

// Helper function to convert snake_case results to camelCase for frontend
function transformBacktestResults(results: any): any {
  if (!results || typeof results !== 'object') return results;
  
  const transformed: any = {};
  
  // Handle snake_case to camelCase conversion
  const keyMapping: Record<string, string> = {
    'total_return': 'totalReturn',
    'annual_return': 'annualReturn', 
    'sharpe_ratio': 'sharpeRatio',
    'max_drawdown': 'maxDrawdown',
    'max_drawdown_duration': 'maxDrawdownDuration',
    'num_trades': 'numTrades',
    'win_rate': 'winRate',
    'profit_factor': 'profitFactor',
    'avg_trade_return': 'avgTradeReturn',
    'final_capital': 'finalCapital',
    'equity_curve': 'equityCurve'
  };
  
  for (const [key, value] of Object.entries(results)) {
    const camelKey = keyMapping[key] || key;
    transformed[camelKey] = value;
  }
  
  return transformed;
}

const router: RouterType = Router();

// GET /api/runs/:id - Get specific run details
router.get('/:id', async (req, res) => {
  try {
    const run = await RunStorage.get(req.params.id);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found'
      } as ApiResponse);
    }
    
    // Transform results to camelCase for frontend compatibility
    const transformedRun = {
      ...run,
      results: run.results ? transformBacktestResults(run.results) : undefined
    };
    
    const response: ApiResponse<PipelineRun> = {
      success: true,
      data: transformedRun
    };
    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve run'
    } as ApiResponse);
  }
});

// GET /api/runs/:id/logs - Get run logs
router.get('/:id/logs', async (req, res) => {
  try {
    const run = await RunStorage.get(req.params.id);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found'
      } as ApiResponse);
    }
    
    const response: ApiResponse<string[]> = {
      success: true,
      data: run.logs
    };
    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve run logs'
    } as ApiResponse);
  }
});

// GET /api/runs/:id/logs/stream - Stream run logs in real-time via SSE
router.get('/:id/logs/stream', async (req, res) => {
  try {
    const run = await RunStorage.get(req.params.id);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found'
      } as ApiResponse);
    }
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Send initial logs
    let lastLogIndex = 0;
    if (run.logs.length > 0) {
      res.write(`data: ${JSON.stringify({ logs: run.logs })}\n\n`);
      lastLogIndex = run.logs.length;
    }
    
    // Poll for updates every second
    const intervalId = setInterval(async () => {
      try {
        const updatedRun = await RunStorage.get(req.params.id);
        if (!updatedRun) {
          res.write(`data: ${JSON.stringify({ error: 'Run not found' })}\n\n`);
          res.end();
          clearInterval(intervalId);
          return;
        }
        
        // Send new logs if any
        if (updatedRun.logs.length > lastLogIndex) {
          const newLogs = updatedRun.logs.slice(lastLogIndex);
          res.write(`data: ${JSON.stringify({ 
            newLogs, 
            status: updatedRun.status,
            totalLogs: updatedRun.logs.length
          })}\n\n`);
          lastLogIndex = updatedRun.logs.length;
        }
        
        // End stream if run is completed, failed, or cancelled
        if (['completed', 'failed', 'cancelled'].includes(updatedRun.status)) {
          res.write(`data: ${JSON.stringify({ 
            status: updatedRun.status,
            final: true,
            results: updatedRun.results ? transformBacktestResults(updatedRun.results) : undefined
          })}\n\n`);
          res.end();
          clearInterval(intervalId);
        }
      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: 'Failed to fetch updates' })}\n\n`);
        res.end();
        clearInterval(intervalId);
      }
    }, 1000);
    
    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(intervalId);
    });
    
    // This return is not reached since SSE keeps connection open
    // but TypeScript requires all code paths to return
    return;
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to stream run logs'
    } as ApiResponse);
    return;
  }
});

// POST /api/runs/:id/cancel - Cancel a running pipeline
router.post('/:id/cancel', async (req, res) => {
  try {
    const run = await RunStorage.get(req.params.id);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found'
      } as ApiResponse);
    }
    
    if (run.status !== 'running' && run.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Run cannot be cancelled in current status'
      } as ApiResponse);
    }
    
    // Try to cancel the running pipeline in the shared executor
    const cancelled = await executor.cancelPipeline(req.params.id);
    
    run.status = 'cancelled';
    run.endTime = new Date().toISOString();
    run.logs.push('Run cancelled by user');
    if (cancelled) {
      run.logs.push('Docker containers and resources cleaned up');
    } else {
      run.logs.push('Warning: May not have cleaned up all resources');
    }
    
    await RunStorage.set(run);
    
    const response: ApiResponse<PipelineRun> = {
      success: true,
      data: run,
      message: 'Run cancelled successfully'
    };
    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel run'
    } as ApiResponse);
  }
});

// GET /api/runs - List recent runs (optional query params for filtering)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const allRuns = await RunStorage.getAll();
    const paginatedRuns = allRuns
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(offset, offset + limit)
      .map(run => ({
        ...run,
        results: run.results ? transformBacktestResults(run.results) : undefined
      }));
    
    const response: ApiResponse<PipelineRun[]> = {
      success: true,
      data: paginatedRuns
    };
    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve runs'
    } as ApiResponse);
  }
});

export { router as runsRouter };