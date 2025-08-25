import { PipelineDSL, PipelineNode, ValidationError, NodeDefinition } from '../types.js';
import { getParameterSchema, validateNodeParameters } from '../schemas/dslSchema.js';
import { validateNodeIOCompatibility, getNodeOutputSchema, validatePipelineDataFlow } from '../schemas/nodeSchemas.js';

/**
 * Enhanced semantic validator that provides detailed error messages
 * with specific node and field information for better frontend integration
 */
export class SemanticValidator {
  private nodeDefinitions: Map<string, NodeDefinition>;
  
  constructor() {
    this.nodeDefinitions = new Map();
    this.initializeBuiltinNodes();
  }
  
  private initializeBuiltinNodes() {
    // Built-in node definitions with enhanced metadata
    const builtinNodes: NodeDefinition[] = [
      {
        id: 'DataLoaderNode',
        name: 'Data Loader',
        runtime: 'builtin',
        inputSchema: {},
        outputSchema: { type: 'dataframe' },
        requiredParams: ['symbol', 'timeframe', 'dataset'],
        optionalParams: ['start_date', 'end_date']
      },
      {
        id: 'IndicatorNode',
        name: 'Technical Indicator',
        runtime: 'builtin',
        inputSchema: { type: 'dataframe' },
        outputSchema: { type: 'dataframe' },
        requiredParams: ['indicator', 'period'],
        optionalParams: ['column']
      },
      {
        id: 'CrossoverSignalNode',
        name: 'Crossover Signal Generator',
        runtime: 'builtin',
        inputSchema: { type: 'multiple_dataframes' },
        outputSchema: { type: 'dataframe' },
        requiredParams: ['fast_period', 'slow_period'],
        optionalParams: ['signal_column', 'fast_ma_column', 'slow_ma_column', 'buy_threshold', 'sell_threshold', 'confirmation_periods']
      },
      {
        id: 'BacktestNode',
        name: 'Backtest Engine',
        runtime: 'builtin',
        inputSchema: { 
          signals: { type: 'dataframe' },
          data: { type: 'dataframe' }
        },
        outputSchema: { type: 'backtest_results' },
        requiredParams: ['initial_capital'],
        optionalParams: ['commission', 'slippage', 'position_size']
      },
      {
        id: 'FeatureGeneratorNode',
        name: 'Feature Generator',
        runtime: 'builtin',
        inputSchema: { type: 'dataframe' },
        outputSchema: { type: 'dataframe' },
        requiredParams: ['features'],
        optionalParams: ['window_size', 'shift_periods']
      },
      {
        id: 'LabelingNode',
        name: 'Label Generator',
        runtime: 'builtin',
        inputSchema: { type: 'dataframe' },
        outputSchema: { type: 'dataframe' },
        requiredParams: ['target_column', 'lookahead_periods'],
        optionalParams: ['threshold', 'method']
      }
    ];
    
    builtinNodes.forEach(node => {
      this.nodeDefinitions.set(node.id, node);
    });
  }
  
  /**
   * Comprehensive semantic validation with detailed error reporting
   */
  validate(pipeline: PipelineDSL): ValidationError[] {
    const errors: ValidationError[] = [];
    const nodeIds = new Set<string>();
    const nodeOutputs = new Map<string, any>();
    
    // Phase 1: Basic structural validation
    errors.push(...this.validatePipelineStructure(pipeline, nodeIds));
    
    // Phase 2: Node-level validation
    for (const node of pipeline.pipeline) {
      errors.push(...this.validateNode(node, nodeIds, nodeOutputs));
    }
    
    // Phase 3: Graph-level validation (dependencies and flow)
    if (errors.length === 0) {
      errors.push(...this.validatePipelineGraph(pipeline));
      errors.push(...this.validateDataFlow(pipeline));
    }
    
    return errors;
  }
  
  /**
   * Validate basic pipeline structure
   */
  private validatePipelineStructure(pipeline: PipelineDSL, nodeIds: Set<string>): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!pipeline.pipeline || pipeline.pipeline.length === 0) {
      errors.push({
        type: 'semantic',
        message: 'Pipeline must contain at least one node'
      });
      return errors;
    }
    
    // Check for duplicate node IDs
    for (const node of pipeline.pipeline) {
      if (nodeIds.has(node.id)) {
        errors.push({
          type: 'semantic',
          message: `Duplicate node ID found`,
          node: node.id,
          field: 'id'
        });
      }
      nodeIds.add(node.id);
      
      // Validate node ID format
      if (!this.isValidNodeId(node.id)) {
        errors.push({
          type: 'semantic',
          message: 'Node ID must start with a letter and contain only alphanumeric characters and underscores',
          node: node.id,
          field: 'id'
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Validate individual node
   */
  private validateNode(
    node: PipelineNode, 
    allNodeIds: Set<string>,
    nodeOutputs: Map<string, any>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check if node type exists
    const nodeDefinition = this.nodeDefinitions.get(node.type);
    if (!nodeDefinition) {
      const availableTypes = Array.from(this.nodeDefinitions.keys()).join(', ');
      errors.push({
        type: 'semantic',
        message: `Unknown node type '${node.type}'. Available types: ${availableTypes}`,
        node: node.id,
        field: 'type'
      });
      return errors; // Skip further validation if type is unknown
    }
    
    // Validate dependencies exist
    if (node.depends_on) {
      for (const depId of node.depends_on) {
        if (!allNodeIds.has(depId)) {
          errors.push({
            type: 'semantic',
            message: `Referenced dependency '${depId}' does not exist in pipeline`,
            node: node.id,
            field: 'depends_on'
          });
        }
      }
    }
    
    // Validate parameters using Zod schema
    const paramValidation = validateNodeParameters(node.type, node.params);
    if (!paramValidation.success) {
      paramValidation.errors.forEach(error => {
        const fieldPath = error.includes(':') ? error.split(':')[0] : undefined;
        const errorObj: ValidationError = {
          type: 'semantic',
          message: `Parameter validation failed: ${error}`,
          node: node.id
        };
        if (fieldPath) {
          errorObj.field = fieldPath;
        }
        errors.push(errorObj);
      });
    }
    
    // Additional semantic parameter validation
    errors.push(...this.validateParameterSemantics(node, nodeDefinition));
    
    // Store output schema for data flow validation
    const outputSchema = getNodeOutputSchema(node.type, node.params);
    if (outputSchema) {
      nodeOutputs.set(node.id, outputSchema);
    }
    
    return errors;
  }
  
  /**
   * Validate parameter semantics beyond basic type checking
   */
  private validateParameterSemantics(node: PipelineNode, definition: NodeDefinition): ValidationError[] {
    const errors: ValidationError[] = [];
    
    switch (definition.id) {
      case 'DataLoaderNode':
        // Validate dataset file extension
        if (node.params.dataset && typeof node.params.dataset === 'string') {
          const validExtensions = ['.csv', '.parquet', '.json'];
          const hasValidExtension = validExtensions.some(ext => 
            node.params.dataset.toLowerCase().endsWith(ext)
          );
          if (!hasValidExtension) {
            errors.push({
              type: 'semantic',
              message: `Dataset file must have one of these extensions: ${validExtensions.join(', ')}`,
              node: node.id,
              field: 'dataset'
            });
          }
        }
        
        // Validate date format if provided
        if (node.params.start_date && !this.isValidDateString(node.params.start_date)) {
          errors.push({
            type: 'semantic',
            message: 'start_date must be in YYYY-MM-DD format',
            node: node.id,
            field: 'start_date'
          });
        }
        if (node.params.end_date && !this.isValidDateString(node.params.end_date)) {
          errors.push({
            type: 'semantic',
            message: 'end_date must be in YYYY-MM-DD format',
            node: node.id,
            field: 'end_date'
          });
        }
        
        // Validate date range
        if (node.params.start_date && node.params.end_date) {
          const startDate = new Date(node.params.start_date);
          const endDate = new Date(node.params.end_date);
          if (startDate >= endDate) {
            errors.push({
              type: 'semantic',
              message: 'start_date must be earlier than end_date',
              node: node.id,
              field: 'end_date'
            });
          }
        }
        break;
        
      case 'IndicatorNode':
        // Validate MACD-specific parameters
        if (node.params.indicator === 'MACD' && !node.params.signal_period) {
          errors.push({
            type: 'semantic',
            message: 'MACD indicator requires signal_period parameter',
            node: node.id,
            field: 'signal_period'
          });
        }
        
        // Validate Bollinger Bands parameters
        if (node.params.indicator === 'BB' && !node.params.std_dev) {
          errors.push({
            type: 'semantic',
            message: 'Bollinger Bands indicator requires std_dev parameter',
            node: node.id,
            field: 'std_dev'
          });
        }
        break;
        
      case 'CrossoverSignalNode':
        // Validate period relationship
        if (node.params.fast_period >= node.params.slow_period) {
          errors.push({
            type: 'semantic',
            message: 'fast_period must be less than slow_period for meaningful crossover signals',
            node: node.id,
            field: 'slow_period'
          });
        }
        
        // Validate threshold values
        if (node.params.buy_threshold && node.params.sell_threshold) {
          if (node.params.buy_threshold <= node.params.sell_threshold) {
            errors.push({
              type: 'semantic',
              message: 'buy_threshold should be greater than sell_threshold',
              node: node.id,
              field: 'buy_threshold'
            });
          }
        }
        break;
        
      case 'BacktestNode':
        // Validate commission and slippage rates
        if (node.params.commission && (node.params.commission < 0 || node.params.commission > 0.1)) {
          errors.push({
            type: 'semantic',
            message: 'commission should be between 0 and 0.1 (10%)',
            node: node.id,
            field: 'commission'
          });
        }
        
        if (node.params.slippage && (node.params.slippage < 0 || node.params.slippage > 0.1)) {
          errors.push({
            type: 'semantic',
            message: 'slippage should be between 0 and 0.1 (10%)',
            node: node.id,
            field: 'slippage'
          });
        }
        break;
    }
    
    return errors;
  }
  
  /**
   * Validate pipeline graph structure (dependencies, cycles)
   */
  private validatePipelineGraph(pipeline: PipelineDSL): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Detect circular dependencies
    const circularPath = this.detectCircularDependencies(pipeline);
    if (circularPath.length > 0) {
      errors.push({
        type: 'semantic',
        message: `Circular dependency detected in path: ${circularPath.join(' → ')}`
      });
    }
    
    // Validate execution order can be determined
    try {
      this.topologicalSort(pipeline);
    } catch (error) {
      errors.push({
        type: 'semantic',
        message: `Cannot determine execution order: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
    
    return errors;
  }
  
  /**
   * Validate data flow compatibility between nodes
   */
  private validateDataFlow(pipeline: PipelineDSL): ValidationError[] {
    const dataFlowValidation = validatePipelineDataFlow(pipeline.pipeline);
    
    if (!dataFlowValidation.valid) {
      return dataFlowValidation.errors.map(error => ({
        type: 'semantic' as const,
        message: error
      }));
    }
    
    return [];
  }
  
  /**
   * Utility functions
   */
  private isValidNodeId(id: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(id);
  }
  
  private isValidDateString(dateStr: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return false;
    
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime()) && 
           date.toISOString().slice(0, 10) === dateStr;
  }
  
  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(pipeline: PipelineDSL): string[] {
    const adjacencyList = new Map<string, string[]>();
    
    // Build adjacency list
    for (const node of pipeline.pipeline) {
      adjacencyList.set(node.id, node.depends_on || []);
    }
    
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const pathStack: string[] = [];
    
    for (const nodeId of adjacencyList.keys()) {
      if (!visited.has(nodeId)) {
        const cyclePath = this.detectCycleDFS(
          nodeId,
          adjacencyList,
          visited,
          recursionStack,
          pathStack
        );
        if (cyclePath.length > 0) {
          return cyclePath;
        }
      }
    }
    
    return [];
  }
  
  private detectCycleDFS(
    nodeId: string,
    adjacencyList: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>,
    pathStack: string[]
  ): string[] {
    if (recursionStack.has(nodeId)) {
      const cycleStartIndex = pathStack.indexOf(nodeId);
      return pathStack.slice(cycleStartIndex).concat([nodeId]);
    }
    
    if (visited.has(nodeId)) {
      return [];
    }
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    pathStack.push(nodeId);
    
    const dependencies = adjacencyList.get(nodeId) || [];
    for (const depId of dependencies) {
      if (adjacencyList.has(depId)) {
        const cyclePath = this.detectCycleDFS(
          depId,
          adjacencyList,
          visited,
          recursionStack,
          pathStack
        );
        if (cyclePath.length > 0) {
          return cyclePath;
        }
      }
    }
    
    recursionStack.delete(nodeId);
    pathStack.pop();
    
    return [];
  }
  
  /**
   * Topological sort for execution order validation
   */
  private topologicalSort(pipeline: PipelineDSL): string[] {
    const adjacencyList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Initialize
    pipeline.pipeline.forEach(node => {
      adjacencyList.set(node.id, []);
      inDegree.set(node.id, 0);
    });
    
    // Build adjacency list and calculate in-degrees
    pipeline.pipeline.forEach(node => {
      (node.depends_on || []).forEach(depId => {
        const deps = adjacencyList.get(depId) || [];
        deps.push(node.id);
        adjacencyList.set(depId, deps);
        inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
      });
    });
    
    // Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];
    
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      const dependents = adjacencyList.get(current) || [];
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent) || 1) - 1;
        inDegree.set(dependent, newDegree);
        
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }
    
    if (result.length !== pipeline.pipeline.length) {
      throw new Error('Circular dependency detected - cannot determine execution order');
    }
    
    return result;
  }
}