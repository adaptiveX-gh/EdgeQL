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
  logs: string[]; // Legacy string logs for backward compatibility
  structuredLogs?: LogEntry[]; // New structured logs with node identification
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

// JSON IR types for compiled pipelines
export interface PipelineIR {
  id: string;
  name?: string;
  description?: string;
  version: string;
  metadata: {
    compiledAt: string;
    compiler: string;
    totalNodes: number;
    hasCircularDependencies: boolean;
  };
  nodes: IRNode[];
  dependencies: IRDependency[];
  executionOrder: string[];
}

export interface IRNode {
  id: string;
  type: string;
  runtime: 'builtin' | 'javascript' | 'python' | 'wasm';
  parameters: Record<string, any>;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  metadata: {
    position?: { x: number; y: number };
    description?: string;
    tags?: string[];
  };
}

export interface IRDependency {
  from: string;
  to: string;
  type: 'data' | 'control';
  dataType?: string;
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

export interface NodeTemplate {
  name: string;
  description: string;
  code: string;
  language: 'javascript' | 'python';
  inputSchema?: any;
  outputSchema?: any;
}