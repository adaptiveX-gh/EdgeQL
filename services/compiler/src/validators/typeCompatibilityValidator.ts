import { PipelineNode, ValidationError } from '../types.js';
import { getNodeOutputSchema, NodeIOContracts } from '../schemas/nodeSchemas.js';

/**
 * Advanced type compatibility validator for node connections
 */
export class TypeCompatibilityValidator {
  
  /**
   * Validates type compatibility between connected nodes
   */
  validateTypeCompatibility(
    nodes: PipelineNode[],
    nodeOutputs: Map<string, any>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const node of nodes) {
      const nodeErrors = this.validateNodeInputCompatibility(node, nodeOutputs);
      errors.push(...nodeErrors);
    }
    
    return errors;
  }
  
  /**
   * Validate input compatibility for a specific node
   */
  private validateNodeInputCompatibility(
    node: PipelineNode,
    nodeOutputs: Map<string, any>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const dependencies = node.depends_on || [];
    
    // Get expected input schema for this node type
    const inputRequirements = this.getInputRequirements(node.type);
    if (!inputRequirements) {
      return errors; // Unknown node type (handled by semantic validator)
    }
    
    // Validate each dependency's output compatibility
    for (let i = 0; i < dependencies.length; i++) {
      const depId = dependencies[i];
      if (!depId) {
        continue; // Skip undefined dependency IDs
      }
      
      const depOutput = nodeOutputs.get(depId);
      
      if (!depOutput) {
        continue; // Missing dependency (handled by semantic validator)
      }
      
      const compatibilityErrors = this.checkTypeCompatibility(
        node.type,
        node.id,
        depId,
        depOutput,
        inputRequirements,
        i
      );
      errors.push(...compatibilityErrors);
    }
    
    // Validate input count requirements
    const countErrors = this.validateInputCount(node, dependencies.length);
    errors.push(...countErrors);
    
    return errors;
  }
  
  /**
   * Get input requirements for a node type
   */
  private getInputRequirements(nodeType: string): any {
    const contract = NodeIOContracts[nodeType as keyof typeof NodeIOContracts];
    return contract?.input || null;
  }
  
  /**
   * Check type compatibility between dependency output and node input expectation
   */
  private checkTypeCompatibility(
    nodeType: string,
    nodeId: string,
    depId: string,
    depOutput: any,
    inputRequirements: any,
    inputIndex: number
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    switch (nodeType) {
      case 'DataLoaderNode':
        // DataLoaderNode should not have dependencies
        if (depOutput) {
          errors.push({
            type: 'semantic',
            message: 'DataLoaderNode should not have input dependencies as it is a source node',
            node: nodeId,
            field: 'depends_on'
          });
        }
        break;
        
      case 'IndicatorNode':
        // IndicatorNode expects a single dataframe input
        if (depOutput.type !== 'dataframe') {
          errors.push({
            type: 'semantic',
            message: `IndicatorNode expects dataframe input, but dependency '${depId}' outputs '${depOutput.type}'`,
            node: nodeId,
            field: 'depends_on'
          });
        } else {
          // Check if required columns are present
          const requiredColumns = ['timestamp', 'open', 'high', 'low', 'close'];
          if (depOutput.columns && Array.isArray(depOutput.columns)) {
            const missingColumns = requiredColumns.filter(col => 
              !depOutput.columns.includes(col)
            );
            if (missingColumns.length > 0) {
              errors.push({
                type: 'semantic',
                message: `IndicatorNode requires OHLC columns, but dependency '${depId}' is missing: ${missingColumns.join(', ')}`,
                node: nodeId,
                field: 'depends_on'
              });
            }
          }
        }
        break;
        
      case 'CrossoverSignalNode':
        // CrossoverSignalNode expects dataframe inputs with indicators
        if (depOutput.type !== 'dataframe') {
          errors.push({
            type: 'semantic',
            message: `CrossoverSignalNode expects dataframe input, but dependency '${depId}' outputs '${depOutput.type}'`,
            node: nodeId,
            field: 'depends_on'
          });
        } else {
          // Check if the dataframe has indicator columns
          if (!depOutput.indicator_column && (!depOutput.columns || !this.hasIndicatorColumns(depOutput.columns))) {
            errors.push({
              type: 'semantic',
              message: `CrossoverSignalNode expects dataframes with indicator columns, but dependency '${depId}' does not provide indicators`,
              node: nodeId,
              field: 'depends_on'
            });
          }
        }
        break;
        
      case 'BacktestNode':
        // BacktestNode has flexible input requirements
        if (inputIndex === 0) {
          // First input should be signals (dataframe with signal column or signal schema)
          if (depOutput.type === 'dataframe') {
            if (!depOutput.signal_column && (!depOutput.columns || !depOutput.columns.includes('signal'))) {
              errors.push({
                type: 'semantic',
                message: `BacktestNode expects first input to contain signal data, but dependency '${depId}' does not have signal column`,
                node: nodeId,
                field: 'depends_on'
              });
            }
          } else if (depOutput.type !== 'signals') {
            errors.push({
              type: 'semantic',
              message: `BacktestNode expects first input to be signals or dataframe with signals, but dependency '${depId}' outputs '${depOutput.type}'`,
              node: nodeId,
              field: 'depends_on'
            });
          }
        } else if (inputIndex === 1) {
          // Second input should be price data (dataframe with OHLC)
          if (depOutput.type !== 'dataframe') {
            errors.push({
              type: 'semantic',
              message: `BacktestNode expects second input to be price data (dataframe), but dependency '${depId}' outputs '${depOutput.type}'`,
              node: nodeId,
              field: 'depends_on'
            });
          } else {
            const requiredPriceColumns = ['timestamp', 'open', 'high', 'low', 'close'];
            if (depOutput.columns && Array.isArray(depOutput.columns)) {
              const missingColumns = requiredPriceColumns.filter(col => 
                !depOutput.columns.includes(col)
              );
              if (missingColumns.length > 0) {
                errors.push({
                  type: 'semantic',
                  message: `BacktestNode requires OHLC price data, but dependency '${depId}' is missing: ${missingColumns.join(', ')}`,
                  node: nodeId,
                  field: 'depends_on'
                });
              }
            }
          }
        }
        break;
        
      case 'FeatureGeneratorNode':
        // FeatureGeneratorNode expects dataframe input
        if (depOutput.type !== 'dataframe') {
          errors.push({
            type: 'semantic',
            message: `FeatureGeneratorNode expects dataframe input, but dependency '${depId}' outputs '${depOutput.type}'`,
            node: nodeId,
            field: 'depends_on'
          });
        }
        break;
        
      case 'LabelingNode':
        // LabelingNode expects dataframe input
        if (depOutput.type !== 'dataframe') {
          errors.push({
            type: 'semantic',
            message: `LabelingNode expects dataframe input, but dependency '${depId}' outputs '${depOutput.type}'`,
            node: nodeId,
            field: 'depends_on'
          });
        }
        break;
    }
    
    return errors;
  }
  
  /**
   * Validate input count requirements for a node
   */
  private validateInputCount(node: PipelineNode, actualCount: number): ValidationError[] {
    const errors: ValidationError[] = [];
    
    switch (node.type) {
      case 'DataLoaderNode':
        if (actualCount > 0) {
          errors.push({
            type: 'semantic',
            message: 'DataLoaderNode should not have any dependencies (it is a source node)',
            node: node.id,
            field: 'depends_on'
          });
        }
        break;
        
      case 'IndicatorNode':
        if (actualCount !== 1) {
          errors.push({
            type: 'semantic',
            message: `IndicatorNode requires exactly 1 input dependency, got ${actualCount}`,
            node: node.id,
            field: 'depends_on'
          });
        }
        break;
        
      case 'CrossoverSignalNode':
        if (actualCount < 2) {
          errors.push({
            type: 'semantic',
            message: `CrossoverSignalNode requires at least 2 input dependencies for crossover calculation, got ${actualCount}`,
            node: node.id,
            field: 'depends_on'
          });
        } else if (actualCount > 3) {
          errors.push({
            type: 'semantic',
            message: `CrossoverSignalNode accepts at most 3 input dependencies, got ${actualCount}`,
            node: node.id,
            field: 'depends_on'
          });
        }
        break;
        
      case 'BacktestNode':
        if (actualCount !== 1 && actualCount !== 2) {
          errors.push({
            type: 'semantic',
            message: `BacktestNode requires either 1 dependency (signals+data combined) or 2 dependencies (signals and data separate), got ${actualCount}`,
            node: node.id,
            field: 'depends_on'
          });
        }
        break;
        
      case 'FeatureGeneratorNode':
      case 'LabelingNode':
        if (actualCount !== 1) {
          errors.push({
            type: 'semantic',
            message: `${node.type} requires exactly 1 input dependency, got ${actualCount}`,
            node: node.id,
            field: 'depends_on'
          });
        }
        break;
    }
    
    return errors;
  }
  
  /**
   * Check if columns array contains indicator-like columns
   */
  private hasIndicatorColumns(columns: string[]): boolean {
    const indicatorPatterns = [
      /^sma_?\d+$/i,      // SMA indicators
      /^ema_?\d+$/i,      // EMA indicators  
      /^rsi(_?\d+)?$/i,   // RSI indicators
      /^macd/i,           // MACD indicators
      /^bb_/i,            // Bollinger Band indicators
      /^stoch/i,          // Stochastic indicators
      /^atr(_?\d+)?$/i    // ATR indicators
    ];
    
    return columns.some(col => 
      indicatorPatterns.some(pattern => pattern.test(col))
    );
  }
  
  /**
   * Get detailed compatibility report for debugging
   */
  getCompatibilityReport(
    nodes: PipelineNode[],
    nodeOutputs: Map<string, any>
  ): {
    compatible: boolean;
    details: Array<{
      nodeId: string;
      nodeType: string;
      dependencies: Array<{
        depId: string;
        depType: string;
        compatible: boolean;
        issues: string[];
      }>;
    }>;
  } {
    const details: any[] = [];
    let overallCompatible = true;
    
    for (const node of nodes) {
      const dependencies = (node.depends_on || []).map(depId => {
        const depOutput = nodeOutputs.get(depId);
        const errors = this.checkTypeCompatibility(
          node.type,
          node.id,
          depId,
          depOutput,
          this.getInputRequirements(node.type),
          0
        );
        
        const compatible = errors.length === 0;
        if (!compatible) overallCompatible = false;
        
        return {
          depId,
          depType: depOutput?.type || 'unknown',
          compatible,
          issues: errors.map(e => e.message)
        };
      });
      
      details.push({
        nodeId: node.id,
        nodeType: node.type,
        dependencies
      });
    }
    
    return {
      compatible: overallCompatible,
      details
    };
  }
}