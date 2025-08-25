export interface ExecutionContext {
  runId: string;
  pipelineId: string;
  workingDir: string;
  artifacts: Map<string, any>;
  datasets: Map<string, string>; // dataset name -> file path
  cancelled?: boolean; // Add cancellation flag
}

export interface LogEntry {
  timestamp: string;
  nodeId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: 'system' | 'node';
}

export interface ExecutionResult {
  success: boolean;
  nodeId: string;
  output?: any;
  error?: string;
  logs: string[]; // Keep legacy string logs for backward compatibility
  structuredLogs?: LogEntry[]; // New structured logs (optional for backward compatibility)
  executionTime: number;
  memoryUsage?: number;
  peakMemory?: number; // Peak memory usage for sandbox monitoring
  sandboxStats?: any; // Additional sandbox statistics
}

export interface NodeRunner {
  canHandle(nodeType: string): boolean;
  execute(
    nodeId: string,
    nodeType: string,
    parameters: Record<string, any>,
    inputs: Map<string, any>,
    context: ExecutionContext
  ): Promise<ExecutionResult>;
  cancel?(runId: string): Promise<void>; // Optional cancel method for cleanup
}

export interface PipelineExecutionResult {
  success: boolean;
  runId: string;
  results: Map<string, ExecutionResult>;
  totalExecutionTime: number;
  finalOutputs: Map<string, any>;
  error?: string;
  cancelled?: boolean; // Add cancelled flag
}