import { YAMLParser } from './parsers/yamlParser.js';
import { PipelineValidator } from './validators/pipelineValidator.js';
import { EnhancedValidator } from './validators/enhancedValidator.js';
import { 
  PipelineDSL, 
  CompiledPipeline, 
  CompiledNode, 
  CompilationResult,
  ValidationError,
  PipelineIR,
  IRNode,
  IRDependency
} from './types.js';
import { ValidationReport } from './types/validationTypes.js';
import { getNodeOutputSchema } from './schemas/nodeSchemas.js';

export class PipelineCompiler {
  public parser: YAMLParser;
  private validator: PipelineValidator;
  public enhancedValidator: EnhancedValidator;
  
  constructor() {
    this.parser = new YAMLParser();
    this.validator = new PipelineValidator();
    this.enhancedValidator = new EnhancedValidator();
  }
  
  compile(dslContent: string): CompilationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    
    // Step 1: Parse DSL
    const parseResult = this.parser.parse(dslContent);
    if (parseResult.errors) {
      return {
        success: false,
        errors: parseResult.errors
      };
    }
    
    const pipeline = parseResult.pipeline!;
    
    // Step 2: Validate pipeline using enhanced validator
    const validationErrors = this.validator.validate(pipeline);
    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors
      };
    }
    
    // Step 3: Compile to executable format
    try {
      const compiled = this.compilePipeline(pipeline);
      
      return {
        success: true,
        pipeline: compiled,
        ...(warnings.length > 0 && { warnings })
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          type: 'semantic',
          message: `Compilation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
  
  compileToIR(dslContent: string, pipelineId: string = 'pipeline', pipelineName?: string, pipelineDescription?: string): { success: boolean; ir?: PipelineIR; errors?: ValidationError[] } {
    const errors: ValidationError[] = [];
    
    // Step 1: Parse DSL
    const parseResult = this.parser.parse(dslContent);
    if (parseResult.errors) {
      return {
        success: false,
        errors: parseResult.errors
      };
    }
    
    const pipeline = parseResult.pipeline!;
    
    // Step 2: Validate pipeline
    const validationErrors = this.validator.validate(pipeline);
    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors
      };
    }
    
    // Step 3: Generate JSON IR
    try {
      const ir = this.generateIR(pipeline, pipelineId, pipelineName, pipelineDescription);
      return {
        success: true,
        ir
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          type: 'semantic',
          message: `IR generation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
  
  private compilePipeline(pipeline: PipelineDSL): CompiledPipeline {
    const nodeMap = new Map<string, any>();
    pipeline.pipeline.forEach(node => {
      nodeMap.set(node.id, node);
    });
    
    // Determine execution order using topological sort
    const executionOrder = this.topologicalSort(pipeline);
    
    // Compile individual nodes
    const compiledNodes: CompiledNode[] = pipeline.pipeline.map(node => {
      return {
        id: node.id,
        type: node.type,
        runtime: this.determineRuntime(node.type),
        dependencies: node.depends_on || [],
        parameters: node.params,
        inputSchema: this.getInputSchema(node.type),
        outputSchema: getNodeOutputSchema(node.type, node.params)
      };
    });
    
    return {
      nodes: compiledNodes,
      executionOrder,
      metadata: {
        totalNodes: pipeline.pipeline.length,
        compiledAt: new Date().toISOString(),
        version: '0.1.0'
      }
    };
  }
  
  private topologicalSort(pipeline: PipelineDSL): string[] {
    const adjacencyList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Initialize adjacency list and in-degree map
    pipeline.pipeline.forEach(node => {
      adjacencyList.set(node.id, []);
      inDegree.set(node.id, 0);
    });
    
    // Build adjacency list and calculate in-degrees
    pipeline.pipeline.forEach(node => {
      (node.depends_on || []).forEach(depId => {
        // Add edge from dependency to current node
        const deps = adjacencyList.get(depId) || [];
        deps.push(node.id);
        adjacencyList.set(depId, deps);
        
        // Increment in-degree of current node
        inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
      });
    });
    
    // Kahn's algorithm for topological sorting
    const queue: string[] = [];
    const result: string[] = [];
    
    // Add all nodes with zero in-degree to queue
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      // Process all nodes that depend on current node
      const dependents = adjacencyList.get(current) || [];
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent) || 1) - 1;
        inDegree.set(dependent, newDegree);
        
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }
    
    // Check if all nodes were processed (no cycles)
    if (result.length !== pipeline.pipeline.length) {
      throw new Error('Circular dependency detected in pipeline - cannot determine execution order');
    }
    
    return result;
  }
  
  private determineRuntime(nodeType: string): 'builtin' | 'javascript' | 'python' | 'wasm' {
    // For MVP, all nodes are builtin
    const builtinNodes = ['DataLoaderNode', 'IndicatorNode', 'CrossoverSignalNode', 'BacktestNode'];
    
    if (builtinNodes.includes(nodeType)) {
      return 'builtin';
    }
    
    // Future: determine runtime based on custom node definitions
    return 'javascript'; // Default for custom nodes
  }
  
  private getInputSchema(nodeType: string): any {
    const schemas: Record<string, any> = {
      'DataLoaderNode': {},
      'IndicatorNode': { type: 'dataframe' },
      'CrossoverSignalNode': { type: 'multiple_dataframes' },
      'BacktestNode': { 
        signals: { type: 'dataframe' },
        data: { type: 'dataframe' }
      }
    };
    
    return schemas[nodeType] || {};
  }
  
  private getOutputSchema(nodeType: string): any {
    const schemas: Record<string, any> = {
      'DataLoaderNode': { type: 'dataframe' },
      'IndicatorNode': { type: 'dataframe' },
      'CrossoverSignalNode': { type: 'dataframe' },
      'BacktestNode': { type: 'backtest_results' }
    };
    
    return schemas[nodeType] || {};
  }
  
  private generateIR(pipeline: PipelineDSL, pipelineId: string, pipelineName?: string, pipelineDescription?: string): PipelineIR {
    // Build execution order
    const executionOrder = this.topologicalSort(pipeline);
    
    // Generate IR nodes
    const irNodes: IRNode[] = pipeline.pipeline.map(node => {
      return {
        id: node.id,
        type: node.type,
        runtime: this.determineRuntime(node.type),
        parameters: node.params || {},
        inputSchema: this.getInputSchema(node.type),
        outputSchema: getNodeOutputSchema(node.type, node.params),
        metadata: {
          description: `${node.type} node processing pipeline data`,
          tags: [node.type, this.determineRuntime(node.type)]
        }
      };
    });
    
    // Generate dependency edges
    const dependencies: IRDependency[] = [];
    pipeline.pipeline.forEach(node => {
      (node.depends_on || []).forEach(depId => {
        dependencies.push({
          from: depId,
          to: node.id,
          type: 'data',
          dataType: this.inferDataType(depId, node.id, pipeline)
        });
      });
    });
    
    // Check for circular dependencies
    const hasCircularDependencies = this.hasCircularDeps(pipeline);
    
    return {
      id: pipelineId,
      name: pipelineName,
      description: pipelineDescription,
      version: '1.0.0',
      metadata: {
        compiledAt: new Date().toISOString(),
        compiler: 'EdgeQL Pipeline Compiler v0.1.0',
        totalNodes: pipeline.pipeline.length,
        hasCircularDependencies
      },
      nodes: irNodes,
      dependencies,
      executionOrder
    };
  }
  
  private inferDataType(fromNodeId: string, toNodeId: string, pipeline: PipelineDSL): string {
    const fromNode = pipeline.pipeline.find(n => n.id === fromNodeId);
    if (!fromNode) return 'unknown';
    
    // Map node types to their output data types
    const dataTypes: Record<string, string> = {
      'DataLoaderNode': 'dataframe',
      'IndicatorNode': 'dataframe',
      'CrossoverSignalNode': 'signals',
      'BacktestNode': 'backtest_results'
    };
    
    return dataTypes[fromNode.type] || 'unknown';
  }
  
  private hasCircularDeps(pipeline: PipelineDSL): boolean {
    try {
      this.topologicalSort(pipeline);
      return false;
    } catch (error) {
      return error instanceof Error && error.message.includes('Circular dependency');
    }
  }
}

// CLI interface for testing
export function compileFromString(dslContent: string): CompilationResult {
  const compiler = new PipelineCompiler();
  return compiler.compile(dslContent);
}

// Enhanced validation interface
export function validateFromString(dslContent: string): ValidationReport {
  return validatePipelineDetailed(dslContent);
}

/**
 * Enhanced validation with detailed error reporting
 */
export function validatePipelineDetailed(dslContent: string): ValidationReport {
  const compiler = new PipelineCompiler();
  
  // Parse DSL first
  const parseResult = compiler.parser.parse(dslContent);
  if (parseResult.errors) {
    // Convert parse errors to validation report format
    const report: ValidationReport = {
      valid: false,
      errors: parseResult.errors.map(error => ({
        id: `PARSE_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type: 'syntax',
        severity: 'error',
        message: error.message,
        context: {
          ...(error.line && { lineNumber: error.line }),
          ...(error.column && { columnNumber: error.column })
        },
        details: {
          category: 'syntax_error',
          code: 'PARSE_ERROR'
        },
        help: {
          summary: 'DSL parsing failed',
          suggestions: []
        }
      })),
      warnings: [],
      summary: {
        totalIssues: parseResult.errors.length,
        errorCount: parseResult.errors.length,
        warningCount: 0,
        nodesValidated: 0,
        validationTimeMs: 0
      },
      errorsByNode: {},
      errorsByType: {},
      quickFixes: []
    };
    return report;
  }
  
  // Use enhanced validation
  return compiler.enhancedValidator.validatePipeline(parseResult.pipeline!);
}

// Export types
export * from './types.js';
export * from './types/validationTypes.js';