import { Router } from 'express';
import type { Router as RouterType } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Dataset, ApiResponse } from '../types/index.js';
import { validateCSV, createDatasetMetadata, ensureUploadsDirectory, type DatasetMetadata } from '../utils/csvValidation.js';

const router: RouterType = Router();

// In-memory storage for MVP
const datasets = new Map<string, Dataset>();

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'datasets');
ensureUploadsDirectory(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

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

// POST /api/datasets/upload - Upload new dataset
router.post('/upload', upload.single('dataset'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      } as ApiResponse);
    }

    // Validate the CSV file
    const validationResult = await validateCSV(req.file.path);
    
    if (!validationResult.isValid) {
      // Clean up the uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      
      return res.status(400).json({
        success: false,
        error: 'CSV validation failed',
        details: {
          errors: validationResult.errors,
          warnings: validationResult.warnings
        }
      } as ApiResponse);
    }

    // Create dataset metadata
    const metadata = createDatasetMetadata(req.file, validationResult);
    
    // Convert to Dataset interface format
    const dataset: Dataset = {
      id: metadata.id,
      name: metadata.name,
      filename: metadata.filename,
      size: metadata.size,
      columns: metadata.columns,
      rowCount: metadata.rowCount,
      uploadedAt: metadata.uploadedAt,
      userId: req.body.userId // Optional user ID from request
    };

    // Store in memory (in production, this would go to a database)
    datasets.set(dataset.id, dataset);

    const response: ApiResponse<Dataset> = {
      success: true,
      data: dataset,
      message: validationResult.warnings.length > 0 
        ? `Upload successful with warnings: ${validationResult.warnings.join(', ')}`
        : 'Upload successful'
    };

    return res.json(response);

  } catch (error) {
    // Clean up file if there's an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      } as ApiResponse);
    }

    return res.status(500).json({
      success: false,
      error: `Upload failed: ${error.message}`
    } as ApiResponse);
  }
});

// GET /api/datasets/:id/preview - Preview dataset contents
router.get('/:id/preview', async (req, res) => {
  const dataset = datasets.get(req.params.id);
  
  if (!dataset) {
    return res.status(404).json({
      success: false,
      error: 'Dataset not found'
    } as ApiResponse);
  }
  
  try {
    // For sample datasets, use existing mock data
    if (dataset.id === 'sample_ohlcv.csv') {
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
      
      return res.json({
        success: true,
        data: previewData
      } as ApiResponse<any[]>);
    }

    // For uploaded datasets, read from the actual file
    const filePath = path.join(uploadsDir, dataset.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Dataset file not found'
      } as ApiResponse);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return res.json({
        success: true,
        data: []
      } as ApiResponse<any[]>);
    }

    // Parse header and first few rows for preview
    const headers = lines[0].split(',').map(h => h.trim());
    const previewRows = lines.slice(1, 6); // First 5 data rows
    
    const previewData = previewRows.map(line => {
      const values = line.split(',').map(v => v.trim());
      const rowData: any = {};
      
      headers.forEach((header, index) => {
        rowData[header] = values[index] || '';
      });
      
      return rowData;
    });

    return res.json({
      success: true,
      data: previewData
    } as ApiResponse<any[]>);

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Failed to preview dataset: ${error.message}`
    } as ApiResponse);
  }
});

// DELETE /api/datasets/:id - Delete dataset
router.delete('/:id', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Dataset deletion not yet implemented'
  } as ApiResponse);
});

export { router as datasetsRouter };