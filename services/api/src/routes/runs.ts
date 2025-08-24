import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { PipelineRun, ApiResponse } from '../types/index.js';

const router: RouterType = Router();

// Mock runs storage (shared with pipelines router for MVP)
// In real implementation, this would be a database
let mockRuns: Map<string, PipelineRun>;

// Initialize mock storage access
const getRuns = (): Map<string, PipelineRun> => {
  if (!mockRuns) {
    // This is a hack for MVP - normally we'd use shared storage/database
    mockRuns = new Map();
  }
  return mockRuns;
};

// GET /api/runs/:id - Get specific run details
router.get('/:id', (req, res) => {
  const runs = getRuns();
  const run = runs.get(req.params.id);
  
  if (!run) {
    return res.status(404).json({
      success: false,
      error: 'Run not found'
    } as ApiResponse);
  }
  
  const response: ApiResponse<PipelineRun> = {
    success: true,
    data: run
  };
  return res.json(response);
});

// GET /api/runs/:id/logs - Get run logs
router.get('/:id/logs', (req, res) => {
  const runs = getRuns();
  const run = runs.get(req.params.id);
  
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
});

// POST /api/runs/:id/cancel - Cancel a running pipeline
router.post('/:id/cancel', (req, res) => {
  const runs = getRuns();
  const run = runs.get(req.params.id);
  
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
  
  run.status = 'cancelled';
  run.endTime = new Date().toISOString();
  run.logs.push('Run cancelled by user');
  
  const response: ApiResponse<PipelineRun> = {
    success: true,
    data: run,
    message: 'Run cancelled successfully'
  };
  return res.json(response);
});

// GET /api/runs - List recent runs (optional query params for filtering)
router.get('/', (req, res) => {
  const runs = getRuns();
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  
  const allRuns = Array.from(runs.values())
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(offset, offset + limit);
  
  const response: ApiResponse<PipelineRun[]> = {
    success: true,
    data: allRuns
  };
  return res.json(response);
});

export { router as runsRouter };