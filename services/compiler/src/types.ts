export interface PipelineNode {
  id: string;
  type: string;
  depends_on?: string[];
  params: Record<string, any>;
}

export interface PipelineDSL {
  pipeline: PipelineNode[];
}

export interface CompiledPipeline {
  nodes: CompiledNode[];
  executionOrder: string[];
  metadata: {
    totalNodes: number;
    compiledAt: string;
    version: string;
  };
}

// JSON IR schema for the execution graph
export interface PipelineIR {
  id: string;
  name?: string | undefined;
  description?: string | undefined;
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

export interface CompiledNode {
  id: string;
  type: string;
  runtime: 'builtin' | 'javascript' | 'python' | 'wasm';
  dependencies: string[];
  parameters: Record<string, any>;
  inputSchema?: any;
  outputSchema?: any;
}

export interface ValidationError {
  type: 'syntax' | 'semantic' | 'schema';
  message: string;
  node?: string | undefined;
  field?: string | undefined;
  line?: number | undefined;
  column?: number | undefined;
}

export interface CompilationResult {
  success: boolean;
  pipeline?: CompiledPipeline;
  errors?: ValidationError[];
  warnings?: string[];
}

export interface NodeDefinition {
  id: string;
  name: string;
  runtime: 'builtin' | 'javascript' | 'python' | 'wasm';
  inputSchema: any;
  outputSchema: any;
  requiredParams: string[];
  optionalParams?: string[];
}