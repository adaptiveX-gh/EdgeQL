import { PipelineNode, ValidationError } from '../types.js';
import { getNodeOutputSchema } from '../schemas/nodeSchemas.js';

/**
 * Validates input/output schema compatibility across the entire pipeline
 */
export class SchemaCompatibilityValidator {
  
  /**
   * Validate schema compatibility across the entire pipeline
   */
  validatePipelineSchemaCompatibility(nodes: PipelineNode[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const nodeOutputs = new Map<string, any>();
    
    // Build dependency graph and validate in topological order
    const sortedNodes = this.topologicalSort(nodes);
    if (!sortedNodes) {
      errors.push({
        type: 'semantic',
        message: 'Cannot validate schema compatibility due to circular dependencies'
      });
      return errors;
    }
    
    // Process nodes in execution order
    for (const node of sortedNodes) {
      // Generate output schema for this node
      const outputSchema = getNodeOutputSchema(node.type, node.params);
      if (outputSchema) {
        nodeOutputs.set(node.id, outputSchema);
      }
      
      // Validate input schema compatibility with dependencies
      const schemaErrors = this.validateNodeSchemaCompatibility(node, nodeOutputs);
      errors.push(...schemaErrors);
    }
    
    return errors;
  }
  
  /**
   * Validate schema compatibility for a single node
   */
  private validateNodeSchemaCompatibility(
    node: PipelineNode,
    nodeOutputs: Map<string, any>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const dependencies = node.depends_on || [];
    
    if (dependencies.length === 0 && node.type !== 'DataLoaderNode') {
      // Non-source nodes should have dependencies
      errors.push({
        type: 'semantic',
        message: `Node '${node.type}' requires input dependencies but none are specified`,
        node: node.id,
        field: 'depends_on'
      });
      return errors;
    }
    
    // Collect dependency outputs
    const dependencySchemas: { [key: string]: any } = {};
    for (const depId of dependencies) {
      const depSchema = nodeOutputs.get(depId);
      if (depSchema) {
        dependencySchemas[depId] = depSchema;
      }
    }
    
    // Validate schema compatibility based on node type
    switch (node.type) {
      case 'DataLoaderNode':
        errors.push(...this.validateDataLoaderSchema(node, dependencySchemas));
        break;
      case 'IndicatorNode':
        errors.push(...this.validateIndicatorSchema(node, dependencySchemas));
        break;
      case 'CrossoverSignalNode':
        errors.push(...this.validateCrossoverSchema(node, dependencySchemas));
        break;
      case 'BacktestNode':
        errors.push(...this.validateBacktestSchema(node, dependencySchemas));
        break;
      case 'FeatureGeneratorNode':
        errors.push(...this.validateFeatureGeneratorSchema(node, dependencySchemas));
        break;
      case 'LabelingNode':
        errors.push(...this.validateLabelingSchema(node, dependencySchemas));
        break;
    }
    
    return errors;
  }
  
  /**
   * Validate DataLoaderNode schema requirements
   */
  private validateDataLoaderSchema(
    node: PipelineNode,
    dependencySchemas: { [key: string]: any }
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // DataLoaderNode should not have dependencies
    if (Object.keys(dependencySchemas).length > 0) {
      errors.push({
        type: 'semantic',
        message: 'DataLoaderNode is a source node and should not have dependencies',
        node: node.id,
        field: 'depends_on'
      });
    }
    
    return errors;
  }
  
  /**
   * Validate IndicatorNode schema requirements
   */
  private validateIndicatorSchema(
    node: PipelineNode,
    dependencySchemas: { [key: string]: any }
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (Object.keys(dependencySchemas).length !== 1) {
      errors.push({
        type: 'semantic',
        message: 'IndicatorNode requires exactly one dataframe input',
        node: node.id,
        field: 'depends_on'
      });
      return errors;
    }
    
    const firstEntry = Object.entries(dependencySchemas)[0];
    if (!firstEntry) {
      errors.push({
        type: 'semantic',
        message: 'IndicatorNode requires a dependency but none were found',
        node: node.id,
        field: 'depends_on'
      });
      return errors;
    }
    const [depId, depSchema] = firstEntry;
    
    // Validate input is a dataframe
    if (depSchema.type !== 'dataframe') {
      errors.push({
        type: 'semantic',
        message: `IndicatorNode requires dataframe input, but dependency '${depId}' outputs '${depSchema.type}'`,
        node: node.id,
        field: 'depends_on'
      });
      return errors;
    }
    
    // Validate required columns are present
    const requiredColumns = ['timestamp', 'close'];
    const additionalRequired = this.getIndicatorRequiredColumns(node.params.indicator);
    const allRequired = [...requiredColumns, ...additionalRequired];
    
    if (depSchema.columns && Array.isArray(depSchema.columns)) {
      const missingColumns = allRequired.filter(col => !depSchema.columns.includes(col));
      if (missingColumns.length > 0) {
        errors.push({
          type: 'semantic',
          message: `IndicatorNode '${node.params.indicator}' requires columns [${allRequired.join(', ')}], but dependency '${depId}' is missing: ${missingColumns.join(', ')}`,
          node: node.id,
          field: 'depends_on'
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Validate CrossoverSignalNode schema requirements
   */
  private validateCrossoverSchema(
    node: PipelineNode,
    dependencySchemas: { [key: string]: any }
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (Object.keys(dependencySchemas).length < 2) {
      errors.push({
        type: 'semantic',
        message: 'CrossoverSignalNode requires at least 2 dataframe inputs for crossover calculation',
        node: node.id,
        field: 'depends_on'
      });
      return errors;
    }
    
    // Validate all inputs are dataframes with indicators
    for (const [depId, depSchema] of Object.entries(dependencySchemas)) {
      if (depSchema.type !== 'dataframe') {
        errors.push({
          type: 'semantic',
          message: `CrossoverSignalNode requires dataframe inputs, but dependency '${depId}' outputs '${depSchema.type}'`,
          node: node.id,
          field: 'depends_on'
        });
        continue;
      }
      
      // Check for indicator columns or explicit indicator_column
      const hasIndicatorColumn = depSchema.indicator_column || 
        (depSchema.columns && this.hasIndicatorColumns(depSchema.columns));
      
      if (!hasIndicatorColumn) {
        errors.push({
          type: 'semantic',
          message: `CrossoverSignalNode requires dataframes with indicator columns, but dependency '${depId}' does not provide indicators. Connect IndicatorNodes as dependencies.`,
          node: node.id,
          field: 'depends_on'
        });
      }
    }
    
    // Validate timestamp alignment
    const timestampColumns = Object.values(dependencySchemas).map(schema => 
      schema.columns?.includes('timestamp') ? 'timestamp' : null
    ).filter(Boolean);
    
    if (timestampColumns.length !== Object.keys(dependencySchemas).length) {
      errors.push({
        type: 'semantic',
        message: 'All CrossoverSignalNode inputs must have timestamp columns for proper alignment',
        node: node.id,
        field: 'depends_on'
      });
    }
    
    return errors;
  }
  
  /**
   * Validate BacktestNode schema requirements
   */
  private validateBacktestSchema(
    node: PipelineNode,
    dependencySchemas: { [key: string]: any }
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const depCount = Object.keys(dependencySchemas).length;
    
    if (depCount === 1) {
      // Single input mode: signals and data combined
      const firstEntry = Object.entries(dependencySchemas)[0];
      if (!firstEntry) {
        errors.push({
          type: 'semantic',
          message: 'BacktestNode requires dependencies but none were found',
          node: node.id,
          field: 'depends_on'
        });
        return errors;
      }
      const [depId, depSchema] = firstEntry;
      
      if (depSchema.type !== 'dataframe') {
        errors.push({
          type: 'semantic',
          message: `BacktestNode single input must be dataframe, but dependency '${depId}' outputs '${depSchema.type}'`,
          node: node.id,
          field: 'depends_on'
        });
        return errors;
      }
      
      // Check for signal column
      const hasSignalColumn = depSchema.signal_column || 
        (depSchema.columns && depSchema.columns.includes('signal'));
      
      if (!hasSignalColumn) {
        errors.push({
          type: 'semantic',
          message: `BacktestNode requires signal data, but dependency '${depId}' does not have signal column. Connect a CrossoverSignalNode or similar signal generator.`,
          node: node.id,
          field: 'depends_on'
        });
      }
      
      // Check for OHLC columns
      const requiredPriceColumns = ['timestamp', 'open', 'high', 'low', 'close'];
      if (depSchema.columns) {
        const missingColumns = requiredPriceColumns.filter(col => 
          !depSchema.columns.includes(col)
        );
        if (missingColumns.length > 0) {
          errors.push({
            type: 'semantic',
            message: `BacktestNode requires OHLC price data, but dependency '${depId}' is missing: ${missingColumns.join(', ')}`,
            node: node.id,
            field: 'depends_on'
          });
        }
      }
      
    } else if (depCount === 2) {
      // Two input mode: separate signals and data
      const depEntries = Object.entries(dependencySchemas);
      
      if (!depEntries[0] || !depEntries[1]) {
        errors.push({
          type: 'semantic',
          message: 'BacktestNode requires valid dependencies but some were not found',
          node: node.id,
          field: 'depends_on'
        });
        return errors;
      }
      
      const [firstDepId, firstSchema] = depEntries[0];
      const [secondDepId, secondSchema] = depEntries[1];
      
      // First input should be signals, second should be price data
      const signalInput = this.identifySignalInput(firstSchema, secondSchema);
      const priceInput = signalInput === firstSchema ? secondSchema : firstSchema;
      const signalDepId = signalInput === firstSchema ? firstDepId : secondDepId;
      const priceDepId = priceInput === secondSchema ? secondDepId : firstDepId;
      
      // Validate signal input
      if (signalInput.type !== 'dataframe' || 
          (!signalInput.signal_column && 
           !(signalInput.columns && signalInput.columns.includes('signal')))) {
        errors.push({
          type: 'semantic',
          message: `BacktestNode first input should contain signals, but dependency '${signalDepId}' does not have signal data`,
          node: node.id,
          field: 'depends_on'
        });
      }
      
      // Validate price input
      if (priceInput.type !== 'dataframe') {
        errors.push({
          type: 'semantic',
          message: `BacktestNode second input should be price data (dataframe), but dependency '${priceDepId}' outputs '${priceInput.type}'`,
          node: node.id,
          field: 'depends_on'
        });
      } else {
        const requiredPriceColumns = ['timestamp', 'open', 'high', 'low', 'close'];
        if (priceInput.columns) {
          const missingColumns = requiredPriceColumns.filter(col => 
            !priceInput.columns.includes(col)
          );
          if (missingColumns.length > 0) {
            errors.push({
              type: 'semantic',
              message: `BacktestNode requires OHLC price data, but dependency '${priceDepId}' is missing: ${missingColumns.join(', ')}`,
              node: node.id,
              field: 'depends_on'
            });
          }
        }
      }
      
    } else {
      errors.push({
        type: 'semantic',
        message: `BacktestNode requires either 1 input (signals+data combined) or 2 inputs (signals and data separate), but got ${depCount} inputs`,
        node: node.id,
        field: 'depends_on'
      });
    }
    
    return errors;
  }
  
  /**
   * Validate FeatureGeneratorNode schema requirements
   */
  private validateFeatureGeneratorSchema(
    node: PipelineNode,
    dependencySchemas: { [key: string]: any }
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (Object.keys(dependencySchemas).length !== 1) {
      errors.push({
        type: 'semantic',
        message: 'FeatureGeneratorNode requires exactly one dataframe input',
        node: node.id,
        field: 'depends_on'
      });
      return errors;
    }
    
    const firstEntry = Object.entries(dependencySchemas)[0];
    if (!firstEntry) {
      errors.push({
        type: 'semantic',
        message: 'FeatureGeneratorNode requires a dependency but none were found',
        node: node.id,
        field: 'depends_on'
      });
      return errors;
    }
    const [depId, depSchema] = firstEntry;
    
    if (depSchema.type !== 'dataframe') {
      errors.push({
        type: 'semantic',
        message: `FeatureGeneratorNode requires dataframe input, but dependency '${depId}' outputs '${depSchema.type}'`,
        node: node.id,
        field: 'depends_on'
      });
    }
    
    return errors;
  }
  
  /**
   * Validate LabelingNode schema requirements
   */
  private validateLabelingSchema(
    node: PipelineNode,
    dependencySchemas: { [key: string]: any }
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (Object.keys(dependencySchemas).length !== 1) {
      errors.push({
        type: 'semantic',
        message: 'LabelingNode requires exactly one dataframe input',
        node: node.id,
        field: 'depends_on'
      });
      return errors;
    }
    
    const firstEntry = Object.entries(dependencySchemas)[0];
    if (!firstEntry) {
      errors.push({
        type: 'semantic',
        message: 'LabelingNode requires a dependency but none were found',
        node: node.id,
        field: 'depends_on'
      });
      return errors;
    }
    const [depId, depSchema] = firstEntry;
    
    if (depSchema.type !== 'dataframe') {
      errors.push({
        type: 'semantic',
        message: `LabelingNode requires dataframe input, but dependency '${depId}' outputs '${depSchema.type}'`,
        node: node.id,
        field: 'depends_on'
      });
      return errors;
    }
    
    // Validate target column exists in input
    if (node.params.target_column && depSchema.columns && Array.isArray(depSchema.columns)) {
      if (!depSchema.columns.includes(node.params.target_column)) {
        errors.push({
          type: 'semantic',
          message: `LabelingNode target_column '${node.params.target_column}' not found in input columns from dependency '${depId}'. Available columns: ${depSchema.columns.join(', ')}`,
          node: node.id,
          field: 'target_column'
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Helper methods
   */
  private getIndicatorRequiredColumns(indicator: string): string[] {
    switch (indicator) {
      case 'MACD':
        return [];
      case 'BB': // Bollinger Bands
        return [];
      case 'RSI':
        return [];
      case 'STOCH':
        return ['high', 'low'];
      case 'ATR':
        return ['high', 'low'];
      default:
        return [];
    }
  }
  
  private hasIndicatorColumns(columns: string[]): boolean {
    const indicatorPatterns = [
      /^sma_?\d+$/i, /^ema_?\d+$/i, /^rsi(_?\d+)?$/i,
      /^macd/i, /^bb_/i, /^stoch/i, /^atr(_?\d+)?$/i
    ];
    
    return columns.some(col => 
      indicatorPatterns.some(pattern => pattern.test(col))
    );
  }
  
  private identifySignalInput(schema1: any, schema2: any): any {
    // Prefer the schema with explicit signal column
    if (schema1.signal_column || 
        (schema1.columns && schema1.columns.includes('signal'))) {
      return schema1;
    }
    if (schema2.signal_column || 
        (schema2.columns && schema2.columns.includes('signal'))) {
      return schema2;
    }
    
    // Default to first schema if neither has clear signal indication
    return schema1;
  }
  
  private topologicalSort(nodes: PipelineNode[]): PipelineNode[] | null {
    const nodeMap = new Map<string, PipelineNode>();
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();
    
    // Initialize
    for (const node of nodes) {
      nodeMap.set(node.id, node);
      inDegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
    }
    
    // Build graph
    for (const node of nodes) {
      for (const depId of node.depends_on || []) {
        if (adjacencyList.has(depId)) {
          adjacencyList.get(depId)!.push(node.id);
          inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
        }
      }
    }
    
    // Kahn's algorithm
    const queue: string[] = [];
    const result: PipelineNode[] = [];
    
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = nodeMap.get(currentId)!;
      result.push(currentNode);
      
      const dependents = adjacencyList.get(currentId) || [];
      for (const dependentId of dependents) {
        const newDegree = (inDegree.get(dependentId) || 1) - 1;
        inDegree.set(dependentId, newDegree);
        
        if (newDegree === 0) {
          queue.push(dependentId);
        }
      }
    }
    
    return result.length === nodes.length ? result : null;
  }
}