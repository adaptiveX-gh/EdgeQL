export interface Pipeline {
  id: string;
  name: string;
  description: string;
  dsl: string;
  status: 'ready' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  logs: string[];
  error?: string;
  results?: BacktestResults;
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
  id: string;
  timestamp: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  pnl?: number;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  drawdown: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Dataset {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  columns: string[];
  rows: number;
}