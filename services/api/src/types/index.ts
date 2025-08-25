export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  dsl: string;
  status: 'ready' | 'invalid' | 'running';
  createdAt: string;
  updatedAt: string;
  userId?: string;
  currentVersion?: number;
  // Observer mode support
  observerTokens?: string[];
  readOnly?: boolean;
  isObserverMode?: boolean;
}

export interface PipelineVersion {
  id: string;
  pipelineId: string;
  version: number;
  name?: string;
  description?: string;
  dsl: string;
  commitMessage?: string;
  createdAt: string;
  createdBy?: string;
  isAutoSave: boolean;
  tags?: string[];
}

export interface LogEntry {
  timestamp: string;
  nodeId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: 'system' | 'node';
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  results?: BacktestResults;
  logs: string[]; // Legacy string logs for backward compatibility
  structuredLogs?: LogEntry[]; // New structured logs with node identification
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
  author?: string;
  inputSchema?: any;
  outputSchema?: any;
  createdAt: string;
  updatedAt: string;
  version: number;
  userId?: string;
  tags?: string[];
}

export interface CustomNodeVersion {
  version: number;
  code: string;
  timestamp: string;
  changeDescription?: string;
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

export interface ObserverTokenResponse {
  observerToken: string;
  observerUrl: string;
  expiresAt?: string;
}

export interface ObserverAccess {
  id: string;
  pipelineId: string;
  token: string;
  createdAt: string;
  expiresAt?: string;
  lastAccessedAt?: string;
  accessCount: number;
}