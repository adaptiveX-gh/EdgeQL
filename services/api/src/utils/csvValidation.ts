import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Schema for OHLCV data validation
const OHLCVRowSchema = z.object({
  timestamp: z.string().optional(),
  ts: z.string().optional(),
  time: z.string().optional(),
  datetime: z.string().optional(),
  date: z.string().optional(),
  open: z.union([z.string(), z.number()]),
  high: z.union([z.string(), z.number()]),
  low: z.union([z.string(), z.number()]),
  close: z.union([z.string(), z.number()]),
  volume: z.union([z.string(), z.number()]).optional(),
  vol: z.union([z.string(), z.number()]).optional(),
  v: z.union([z.string(), z.number()]).optional(),
});

export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    totalRows: number;
    columns: string[];
    hasTimestamp: boolean;
    hasRequiredColumns: boolean;
    sampleRows: any[];
  };
}

export interface DatasetMetadata {
  id: string;
  name: string;
  filename: string;
  size: number;
  columns: string[];
  rowCount: number;
  uploadedAt: string;
  filePath: string;
}

/**
 * Validates a CSV file for OHLCV format compatibility
 */
export async function validateCSV(filePath: string): Promise<CSVValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Read the CSV file
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return {
        isValid: false,
        errors: ['File is empty'],
        warnings,
        metadata: {
          totalRows: 0,
          columns: [],
          hasTimestamp: false,
          hasRequiredColumns: false,
          sampleRows: []
        }
      };
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const originalHeaders = lines[0].split(',').map(h => h.trim());
    
    // Check for required columns
    const timestampColumns = ['timestamp', 'ts', 'time', 'datetime', 'date'];
    const hasTimestamp = timestampColumns.some(col => headers.includes(col));
    
    const requiredPriceColumns = ['open', 'high', 'low', 'close'];
    const hasPriceColumns = requiredPriceColumns.every(col => 
      headers.includes(col) || headers.includes(col[0]) // Also check single letter variants
    );
    
    const hasVolumeColumn = headers.includes('volume') || headers.includes('vol') || headers.includes('v');
    
    if (!hasTimestamp) {
      errors.push('Missing timestamp column. Expected one of: timestamp, ts, time, datetime, date');
    }
    
    if (!hasPriceColumns) {
      const missingColumns = requiredPriceColumns.filter(col => 
        !headers.includes(col) && !headers.includes(col[0])
      );
      errors.push(`Missing required price columns: ${missingColumns.join(', ')}`);
    }
    
    if (!hasVolumeColumn) {
      warnings.push('No volume column found. Volume data is recommended for trading strategies.');
    }

    // Sample validation on first few rows
    const sampleRows: any[] = [];
    const maxSampleRows = Math.min(5, lines.length - 1);
    
    for (let i = 1; i <= maxSampleRows; i++) {
      const row = lines[i].split(',').map(cell => cell.trim());
      const rowData: any = {};
      
      originalHeaders.forEach((header, index) => {
        rowData[header.toLowerCase()] = row[index];
      });
      
      sampleRows.push(rowData);
      
      // Validate row structure
      try {
        OHLCVRowSchema.parse(rowData);
      } catch (e) {
        if (e instanceof z.ZodError) {
          errors.push(`Row ${i}: Invalid data format - ${e.errors.map(err => err.message).join(', ')}`);
        }
      }
    }

    const totalRows = lines.length - 1; // Exclude header
    const hasRequiredColumns = hasTimestamp && hasPriceColumns;
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        totalRows,
        columns: originalHeaders,
        hasTimestamp,
        hasRequiredColumns,
        sampleRows
      }
    };
    
  } catch (error) {
    return {
      isValid: false,
      errors: [`Failed to parse CSV: ${error.message}`],
      warnings,
      metadata: {
        totalRows: 0,
        columns: [],
        hasTimestamp: false,
        hasRequiredColumns: false,
        sampleRows: []
      }
    };
  }
}

/**
 * Create dataset metadata from uploaded file
 */
export function createDatasetMetadata(
  file: Express.Multer.File,
  validationResult: CSVValidationResult
): DatasetMetadata {
  const id = path.parse(file.filename).name + '_' + Date.now();
  
  return {
    id,
    name: file.originalname.replace(/\.[^/.]+$/, ''), // Remove extension
    filename: file.filename,
    size: file.size,
    columns: validationResult.metadata.columns,
    rowCount: validationResult.metadata.totalRows,
    uploadedAt: new Date().toISOString(),
    filePath: file.path
  };
}

/**
 * Ensure uploads directory exists
 */
export function ensureUploadsDirectory(uploadsDir: string): void {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}