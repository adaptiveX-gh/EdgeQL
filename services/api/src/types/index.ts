export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  dsl: string;
  status: 'ready' | 'invalid' | 'running';
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  results?: BacktestResults;
  logs: string[];
  error?: string;
}

export interface BacktestResults {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  numTrades: number;
  winRate: number;
  finalCapital: number;
  trades: Trade[];
  equityCurve: EquityPoint[];
}

export interface Trade {
  timestamp: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  pnl?: number;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
}

export interface CustomNode {
  id: string;
  name: string;
  type: string;
  language: 'javascript' | 'python' | 'wasm';
  code: string;
  description?: string;
  inputSchema?: any;
  outputSchema?: any;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface Dataset {
  id: string;
  name: string;
  filename: string;
  size: number;
  columns: string[];
  rowCount: number;
  uploadedAt: string;
  userId?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}