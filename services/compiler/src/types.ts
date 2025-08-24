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
  node?: string;
  field?: string;
  line?: number;
  column?: number;
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