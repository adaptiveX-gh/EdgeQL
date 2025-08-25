import { PipelineDSL, ValidationError, NodeDefinition } from '../types.js';
import { 
  PipelineDSLSchema, 
  validateNodeParameters,
  getParameterSchema 
} from '../schemas/dslSchema.js';
import { validatePipelineDataFlow, validatePipelineDataFlowEnhanced, isCustomNode } from '../schemas/nodeSchemas.js';
import { getCustomNodeRegistry } from '../registry/CustomNodeRegistry.js';

export class PipelineValidator {
  private nodeDefinitions: Map<string, NodeDefinition>;
  
  constructor() {
    this.nodeDefinitions = new Map();
    this.initializeBuiltinNodes();
  }
  
  private initializeBuiltinNodes() {
    // Built-in node definitions for validation
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
        name: 'Crossover Signal',
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
        optionalParams: ['commission', 'slippage']
      }
    ];
    
    builtinNodes.forEach(node => {
      this.nodeDefinitions.set(node.id, node);
    });
  }
  
  validate(pipeline: PipelineDSL): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // First validate the overall pipeline structure using Zod schema
    const schemaResult = PipelineDSLSchema.safeParse(pipeline);
    if (!schemaResult.success) {
      schemaResult.error.issues.forEach(issue => {
        errors.push({
          type: 'schema',
          message: `Schema validation error: ${issue.message}`,
          field: issue.path.join('.')
        });
      });
      return errors; // Return early if schema validation fails
    }
    
    const nodeIds = new Set<string>();
    
    // Check for duplicate node IDs
    for (const node of pipeline.pipeline) {
      if (nodeIds.has(node.id)) {
        errors.push({
          type: 'semantic',
          message: `Duplicate node ID: ${node.id}`,
          node: node.id
        });
      }
      nodeIds.add(node.id);
    }
    
    // Validate each node
    for (const node of pipeline.pipeline) {
      errors.push(...this.validateNode(node, nodeIds));
    }
    
    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(pipeline);
    if (circularDeps.length > 0) {
      errors.push({
        type: 'semantic',
        message: `Circular dependency detected: ${circularDeps.join(' -> ')}`
      });
    }
    
    // Validate input/output data flow compatibility (enhanced version supports custom nodes)
    if (errors.length === 0) { // Only validate data flow if other validations pass
      const dataFlowValidation = validatePipelineDataFlowEnhanced(pipeline.pipeline);
      if (!dataFlowValidation.valid) {
        dataFlowValidation.errors.forEach(error => {
          errors.push({
            type: 'semantic',
            message: `Data flow validation error: ${error}`
          });
        });
      }
    }
    
    return errors;
  }
  
  private validateNode(node: any, allNodeIds: Set<string>): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check if node type exists (built-in or custom)
    const nodeDefinition = this.nodeDefinitions.get(node.type);
    const isCustomNodeType = isCustomNode(node.type);
    
    if (!nodeDefinition && !isCustomNodeType) {
      errors.push({
        type: 'semantic',
        message: `Unknown node type: ${node.type}`,
        node: node.id
      });
      return errors; // Skip further validation if type is unknown
    }
    
    // Validate dependencies exist
    if (node.depends_on) {
      for (const depId of node.depends_on) {
        if (!allNodeIds.has(depId)) {
          errors.push({
            type: 'semantic',
            message: `Dependency not found: ${depId}`,
            node: node.id
          });
        }
      }
    }
    
    if (isCustomNodeType) {
      // Custom node parameter validation
      this.validateCustomNodeParameters(node, errors);
    } else if (nodeDefinition) {
      // Use Zod schema validation for parameters if available
      const paramValidation = validateNodeParameters(node.type, node.params);
      if (!paramValidation.success) {
        paramValidation.errors.forEach(error => {
          errors.push({
            type: 'semantic',
            message: `Parameter validation error: ${error}`,
            node: node.id
          });
        });
      } else {
        // Fallback to legacy validation for required parameters
        for (const requiredParam of nodeDefinition.requiredParams) {
          if (!(requiredParam in node.params)) {
            errors.push({
              type: 'semantic',
              message: `Missing required parameter: ${requiredParam}`,
              node: node.id,
              field: requiredParam
            });
          }
        }
        
        // Additional custom validation
        this.validateParameters(node, nodeDefinition, errors);
      }
    }
    
    return errors;
  }
  
  private validateParameters(node: any, definition: NodeDefinition, errors: ValidationError[]) {
    // Basic parameter validation based on node type
    switch (definition.id) {
      case 'DataLoaderNode':
        if (node.params.timeframe && !['1m', '5m', '15m', '30m', '1h', '4h', '1d'].includes(node.params.timeframe)) {
          errors.push({
            type: 'semantic',
            message: `Invalid timeframe: ${node.params.timeframe}`,
            node: node.id,
            field: 'timeframe'
          });
        }
        break;
        
      case 'IndicatorNode':
        const validIndicators = ['SMA', 'EMA', 'RSI', 'MACD', 'BB'];
        if (!validIndicators.includes(node.params.indicator)) {
          errors.push({
            type: 'semantic',
            message: `Invalid indicator: ${node.params.indicator}. Valid options: ${validIndicators.join(', ')}`,
            node: node.id,
            field: 'indicator'
          });
        }
        
        if (typeof node.params.period !== 'number' || node.params.period <= 0) {
          errors.push({
            type: 'semantic',
            message: 'Parameter "period" must be a positive number',
            node: node.id,
            field: 'period'
          });
        }
        break;
        
      case 'BacktestNode':
        if (typeof node.params.initial_capital !== 'number' || node.params.initial_capital <= 0) {
          errors.push({
            type: 'semantic',
            message: 'Parameter "initial_capital" must be a positive number',
            node: node.id,
            field: 'initial_capital'
          });
        }
        break;
    }
  }
  
  private detectCircularDependencies(pipeline: PipelineDSL): string[] {
    const adjacencyList = new Map<string, string[]>();
    
    // Build adjacency list (reverse direction for dependency tracking)
    for (const node of pipeline.pipeline) {
      adjacencyList.set(node.id, node.depends_on || []);
    }
    
    // DFS-based cycle detection with path tracking
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
    // If we encounter a node already in the current path, we found a cycle
    if (recursionStack.has(nodeId)) {
      // Extract the cycle from the path
      const cycleStartIndex = pathStack.indexOf(nodeId);
      return pathStack.slice(cycleStartIndex).concat([nodeId]);
    }
    
    // If already fully explored, no cycle through this path
    if (visited.has(nodeId)) {
      return [];
    }
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    pathStack.push(nodeId);
    
    const dependencies = adjacencyList.get(nodeId) || [];
    for (const depId of dependencies) {
      // Only check dependencies that exist in our pipeline
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
    
    // Backtrack
    recursionStack.delete(nodeId);
    pathStack.pop();
    
    return [];
  }
  
  private validateCustomNodeParameters(node: any, errors: ValidationError[]) {
    let registry;
    try {
      registry = getCustomNodeRegistry();
    } catch (error) {
      console.warn(`Failed to get custom node registry for validation:`, error);
      return;
    }
    const customNodeDef = registry.getNode(node.type);
    
    if (!customNodeDef) {
      errors.push({
        type: 'semantic',
        message: `Custom node definition not found: ${node.type}`,
        node: node.id
      });
      return;
    }
    
    // Check required parameters
    for (const requiredParam of customNodeDef.requiredParams) {
      if (!(requiredParam in node.params)) {
        errors.push({
          type: 'semantic',
          message: `Missing required parameter: ${requiredParam}`,
          node: node.id,
          field: requiredParam
        });
      }
    }
    
    // Check for unexpected parameters if paramSchema is defined
    if (customNodeDef.paramSchema) {
      const definedParams = new Set([
        ...customNodeDef.requiredParams,
        ...customNodeDef.optionalParams
      ]);
      
      for (const paramName of Object.keys(node.params)) {
        if (!definedParams.has(paramName)) {
          errors.push({
            type: 'semantic',
            message: `Unexpected parameter: ${paramName}`,
            node: node.id,
            field: paramName
          });
        }
      }
    }
    
    // TODO: Add more sophisticated parameter validation using paramSchema (Zod validation)
    // This would require parsing and validating against the custom node's parameter schema
  }
}