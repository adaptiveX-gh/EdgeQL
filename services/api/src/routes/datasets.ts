import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { Dataset, ApiResponse } from '../types/index.js';

const router: RouterType = Router();

// In-memory storage for MVP
const datasets = new Map<string, Dataset>();

// Initialize with sample dataset
datasets.set('sample_ohlcv.csv', {
  id: 'sample_ohlcv.csv',
  name: 'BTC/USD 1m Sample Data',
  filename: 'BTC_1m_hyperliquid_perpetualx.csv',
  size: 1024 * 50, // Approximate size
  columns: ['ts', 'open', 'high', 'low', 'close', 'volume', 'coin', 'exchange_id', 'data_type'],
  rowCount: 1000, // Approximate
  uploadedAt: new Date().toISOString()
});

// GET /api/datasets - List all datasets
router.get('/', (req, res) => {
  const response: ApiResponse<Dataset[]> = {
    success: true,
    data: Array.from(datasets.values())
  };
  return res.json(response);
});

// GET /api/datasets/:id - Get specific dataset info
router.get('/:id', (req, res) => {
  const dataset = datasets.get(req.params.id);
  
  if (!dataset) {
    return res.status(404).json({
      success: false,
      error: 'Dataset not found'
    } as ApiResponse);
  }
  
  const response: ApiResponse<Dataset> = {
    success: true,
    data: dataset
  };
  return res.json(response);
});

// POST /api/datasets/upload - Upload new dataset (placeholder)
router.post('/upload', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Dataset upload not yet implemented (coming in Sprint 2)'
  } as ApiResponse);
});

// GET /api/datasets/:id/preview - Preview dataset contents
router.get('/:id/preview', (req, res) => {
  const dataset = datasets.get(req.params.id);
  
  if (!dataset) {
    return res.status(404).json({
      success: false,
      error: 'Dataset not found'
    } as ApiResponse);
  }
  
  // Mock preview data
  const previewData = [
    {
      ts: '1754682180000',
      open: '116503',
      high: '116508',
      low: '116486.2',
      close: '116486.21',
      volume: '1.19355',
      coin: 'BTC',
      exchange_id: '2',
      data_type: 'perpetual'
    },
    {
      ts: '1754682240000',
      open: '116507',
      high: '116507',
      low: '116440',
      close: '116440.01',
      volume: '8.7253',
      coin: 'BTC',
      exchange_id: '2',
      data_type: 'perpetual'
    }
  ];
  
  const response: ApiResponse<any[]> = {
    success: true,
    data: previewData
  };
  return res.json(response);
});

// DELETE /api/datasets/:id - Delete dataset
router.delete('/:id', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Dataset deletion not yet implemented'
  } as ApiResponse);
});

export { router as datasetsRouter };