import { YAMLParser } from './parsers/yamlParser.js';
import { PipelineValidator } from './validators/pipelineValidator.js';
import { 
  PipelineDSL, 
  CompiledPipeline, 
  CompiledNode, 
  CompilationResult,
  ValidationError 
} from './types.js';
import { getNodeOutputSchema } from './schemas/nodeSchemas.js';

export class PipelineCompiler {
  private parser: YAMLParser;
  private validator: PipelineValidator;
  
  constructor() {
    this.parser = new YAMLParser();
    this.validator = new PipelineValidator();
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
    
    // Step 2: Validate pipeline
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
}

// CLI interface for testing
export function compileFromString(dslContent: string): CompilationResult {
  const compiler = new PipelineCompiler();
  return compiler.compile(dslContent);
}

// Export types
export * from './types.js';