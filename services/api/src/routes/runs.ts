import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { PipelineRun, ApiResponse, LogEntry } from '../types/index.js';
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

// GET /api/runs/:id/structured-logs - Get structured logs with optional filtering
router.get('/:id/structured-logs', async (req, res) => {
  try {
    const run = await RunStorage.get(req.params.id);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found'
      } as ApiResponse);
    }
    
    let logs = run.structuredLogs || [];
    
    // Apply filters based on query parameters
    const { nodeId, level, source, limit, offset } = req.query;
    
    if (nodeId) {
      logs = logs.filter(log => log.nodeId === nodeId);
    }
    
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    
    if (source) {
      logs = logs.filter(log => log.source === source);
    }
    
    // Apply pagination
    const limitNum = limit ? Math.min(parseInt(limit as string), 1000) : 1000;
    const offsetNum = offset ? parseInt(offset as string) : 0;
    
    const paginatedLogs = logs.slice(offsetNum, offsetNum + limitNum);
    
    const response: ApiResponse<{ logs: LogEntry[]; total: number; hasMore: boolean }> = {
      success: true,
      data: {
        logs: paginatedLogs,
        total: logs.length,
        hasMore: offsetNum + limitNum < logs.length
      }
    };
    
    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve structured logs'
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

// GET /api/runs/:id/export/trades - Export trade history as CSV
router.get('/:id/export/trades', async (req, res) => {
  try {
    const run = await RunStorage.get(req.params.id);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found'
      } as ApiResponse);
    }

    if (!run.results?.trades || run.results.trades.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No trade data available for this run'
      } as ApiResponse);
    }

    // Create CSV header
    const csvHeader = 'entry_time,exit_time,symbol,side,quantity,entry_price,exit_price,pnl,return_pct,commission_paid,slippage_cost,status\n';
    
    // Convert trades to CSV rows
    const csvRows = run.results.trades.map(trade => {
      const symbol = 'BTC-USD'; // Default symbol, could be extracted from pipeline or dataset
      return `${trade.entry_time || ''},${trade.exit_time || ''},${symbol},${trade.side},${trade.quantity},${trade.entry_price},${trade.exit_price},${trade.pnl || 0},${trade.return_pct || 0},${trade.commission_paid || 0},${trade.slippage_cost || 0},${trade.status || 'closed'}`;
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    // Set appropriate headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="trades-${run.id}.csv"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // For large exports, let compression middleware handle it automatically
    if (csvContent.length > 1024) {
      res.setHeader('Content-Encoding', 'gzip');
    }
    
    // Send CSV content
    return res.send(csvContent);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to export trades'
    } as ApiResponse);
  }
});

// GET /api/runs/:id/export/metrics - Export metrics as formatted JSON
router.get('/:id/export/metrics', async (req, res) => {
  try {
    const run = await RunStorage.get(req.params.id);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found'
      } as ApiResponse);
    }

    if (!run.results) {
      return res.status(404).json({
        success: false,
        error: 'No metrics data available for this run'
      } as ApiResponse);
    }

    // Transform results to include all metrics in camelCase
    const transformedResults = transformBacktestResults(run.results);
    
    // Create comprehensive metrics export
    const metricsExport = {
      runId: run.id,
      pipelineId: run.pipelineId,
      status: run.status,
      startTime: run.startTime,
      endTime: run.endTime,
      exportedAt: new Date().toISOString(),
      performance: {
        returns: {
          totalReturn: transformedResults.totalReturn,
          annualReturn: transformedResults.annualReturn || 0
        },
        risk: {
          sharpeRatio: transformedResults.sharpeRatio,
          maxDrawdown: transformedResults.maxDrawdown,
          maxDrawdownDuration: transformedResults.maxDrawdownDuration || 0
        },
        trading: {
          numTrades: transformedResults.numTrades,
          winRate: transformedResults.winRate,
          profitFactor: transformedResults.profitFactor || 0,
          avgTradeReturn: transformedResults.avgTradeReturn || 0
        },
        capital: {
          initialCapital: 100000, // Default initial capital
          finalCapital: transformedResults.finalCapital
        }
      },
      summary: {
        profitable: transformedResults.totalReturn > 0,
        totalTrades: transformedResults.numTrades,
        winningTrades: Math.round(transformedResults.numTrades * transformedResults.winRate),
        losingTrades: transformedResults.numTrades - Math.round(transformedResults.numTrades * transformedResults.winRate)
      }
    };

    // Set appropriate headers for JSON download
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="metrics-${run.id}.json"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Send formatted JSON with compression support
    return res.json(metricsExport);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to export metrics'
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