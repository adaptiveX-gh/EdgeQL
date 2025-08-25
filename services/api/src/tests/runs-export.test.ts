import request from 'supertest';
import app from '../server.js';
import { RunStorage } from '../utils/storage.js';
import type { PipelineRun } from '../types/index.js';

const mockRun: PipelineRun = {
  id: 'test-run-id-export',
  pipelineId: 'test-pipeline',
  status: 'completed',
  startTime: '2025-01-01T00:00:00Z',
  endTime: '2025-01-01T00:05:00Z',
  logs: [],
  results: {
    totalReturn: 10.5,
    sharpeRatio: 1.2,
    maxDrawdown: 5.0,
    numTrades: 3,
    winRate: 0.67,
    finalCapital: 110500,
    trades: [
      {
        entry_time: '2025-01-01T00:01:00Z',
        exit_time: '2025-01-01T00:02:00Z',
        entry_price: 100,
        exit_price: 105,
        quantity: 1,
        side: 'long',
        pnl: 5,
        return_pct: 0.05,
        commission_paid: 0.1,
        slippage_cost: 0.05,
        status: 'closed'
      },
      {
        entry_time: '2025-01-01T00:03:00Z',
        exit_time: '2025-01-01T00:04:00Z',
        entry_price: 105,
        exit_price: 110,
        quantity: 1,
        side: 'long',
        pnl: 5,
        return_pct: 0.048,
        commission_paid: 0.1,
        slippage_cost: 0.05,
        status: 'closed'
      }
    ],
    equityCurve: [
      { timestamp: '2025-01-01T00:00:00Z', equity: 100000 },
      { timestamp: '2025-01-01T00:05:00Z', equity: 110500 }
    ]
  }
};

describe('Runs Export API', () => {
  beforeAll(async () => {
    // Store mock run for testing
    await RunStorage.set(mockRun);
  });

  afterAll(async () => {
    // Clean up test data
    const allRuns = await RunStorage.getAll();
    const testRuns = allRuns.filter(run => run.id.startsWith('test-'));
    for (const run of testRuns) {
      await RunStorage.delete(run.id);
    }
  });

  describe('GET /api/runs/:id/export/trades', () => {
    it('should export trades as CSV', async () => {
      const response = await request(app)
        .get('/api/runs/test-run-id-export/export/trades')
        .expect(200)
        .expect('Content-Type', 'text/csv; charset=utf-8')
        .expect('Content-Disposition', 'attachment; filename="trades-test-run-id-export.csv"');

      const csvContent = response.text;
      expect(csvContent).toContain('entry_time,exit_time,symbol,side,quantity');
      expect(csvContent).toContain('2025-01-01T00:01:00Z,2025-01-01T00:02:00Z,BTC-USD,long,1');
      expect(csvContent).toContain('2025-01-01T00:03:00Z,2025-01-01T00:04:00Z,BTC-USD,long,1');

      // Should have header + 2 trade rows
      const lines = csvContent.trim().split('\n');
      expect(lines).toHaveLength(3);
    });

    it('should return 404 for non-existent run', async () => {
      const response = await request(app)
        .get('/api/runs/non-existent-run/export/trades')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Run not found');
    });

    it('should return 404 for run with no trades', async () => {
      const runWithoutTrades: PipelineRun = {
        ...mockRun,
        id: 'test-run-no-trades',
        results: {
          ...mockRun.results!,
          trades: []
        }
      };
      await RunStorage.set(runWithoutTrades);

      const response = await request(app)
        .get('/api/runs/test-run-no-trades/export/trades')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No trade data available for this run');
    });
  });

  describe('GET /api/runs/:id/export/metrics', () => {
    it('should export metrics as JSON', async () => {
      const response = await request(app)
        .get('/api/runs/test-run-id-export/export/metrics')
        .expect(200)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .expect('Content-Disposition', 'attachment; filename="metrics-test-run-id-export.json"');

      const metrics = response.body;
      expect(metrics.runId).toBe('test-run-id-export');
      expect(metrics.pipelineId).toBe('test-pipeline');
      expect(metrics.status).toBe('completed');
      expect(metrics.exportedAt).toBeDefined();

      // Check performance metrics
      expect(metrics.performance.returns.totalReturn).toBe(10.5);
      expect(metrics.performance.risk.sharpeRatio).toBe(1.2);
      expect(metrics.performance.risk.maxDrawdown).toBe(5.0);
      expect(metrics.performance.trading.numTrades).toBe(3);
      expect(metrics.performance.trading.winRate).toBe(0.67);
      expect(metrics.performance.capital.finalCapital).toBe(110500);

      // Check summary
      expect(metrics.summary.profitable).toBe(true);
      expect(metrics.summary.totalTrades).toBe(3);
      expect(metrics.summary.winningTrades).toBe(2); // Math.round(3 * 0.67)
      expect(metrics.summary.losingTrades).toBe(1);
    });

    it('should return 404 for non-existent run', async () => {
      const response = await request(app)
        .get('/api/runs/non-existent-run/export/metrics')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Run not found');
    });

    it('should return 404 for run with no results', async () => {
      const runWithoutResults: PipelineRun = {
        ...mockRun,
        id: 'test-run-no-results',
        results: undefined
      };
      await RunStorage.set(runWithoutResults);

      const response = await request(app)
        .get('/api/runs/test-run-no-results/export/metrics')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No metrics data available for this run');
    });
  });
});