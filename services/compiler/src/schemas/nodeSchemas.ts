import { z } from 'zod';
import { getCustomNodeRegistry } from '../registry/CustomNodeRegistry.js';

// Base data type schemas for node inputs/outputs
export const DataframeSchema = z.object({
  type: z.literal('dataframe'),
  columns: z.array(z.string()).optional(),
  required_columns: z.array(z.string()).optional(),
  row_count: z.number().optional()
});

export const SignalsSchema = z.object({
  type: z.literal('signals'),
  signal_columns: z.array(z.string()).default(['signal']),
  timestamp_column: z.string().default('timestamp')
});

export const BacktestResultsSchema = z.object({
  type: z.literal('backtest_results'),
  metrics: z.array(z.string()).default([
    'total_return',
    'sharpe_ratio', 
    'max_drawdown',
    'win_rate',
    'profit_factor'
  ]),
  trade_log: z.boolean().default(true)
});

export const MultipleInputsSchema = z.object({
  type: z.literal('multiple_inputs'),
  min_inputs: z.number().default(2),
  max_inputs: z.number().optional(),
  input_types: z.array(z.string()).optional()
});

// Node input/output contract definitions
export const NodeIOContracts = {
  DataLoaderNode: {
    input: z.null(), // No inputs required
    output: DataframeSchema
  },
  
  IndicatorNode: {
    input: DataframeSchema,
    output: DataframeSchema.extend({
      // Indicators add their own column to the dataframe
      indicator_column: z.string().optional()
    })
  },
  
  CrossoverSignalNode: {
    input: z.union([
      DataframeSchema, // Single dataframe input
      MultipleInputsSchema.extend({ // Multiple dataframe inputs
        min_inputs: z.literal(2)
      })
    ]),
    output: DataframeSchema.extend({
      // CrossoverSignalNode outputs a dataframe with signal column added
      signal_column: z.string().default('signal')
    })
  },
  
  BacktestNode: {
    input: z.union([
      // Option 1: Single dataframe with signal column (from CrossoverSignalNode)
      DataframeSchema.extend({
        signal_column: z.string().optional()
      }),
      // Option 2: Separate signals and data inputs (legacy support)
      z.object({
        signals: SignalsSchema,
        data: DataframeSchema
      })
    ]),
    output: BacktestResultsSchema
  }
} as const;

// Utility function to validate node input/output compatibility
export function validateNodeIOCompatibility(
  nodeType: string,
  dependencies: string[],
  nodeOutputs: Map<string, any>
): { compatible: boolean; errors: string[] } {
  const contract = NodeIOContracts[nodeType as keyof typeof NodeIOContracts];
  if (!contract) {
    return { compatible: false, errors: [`Unknown node type: ${nodeType}`] };
  }
  
  const errors: string[] = [];
  
  // Validate input requirements based on node type
  if (contract.input === null || (contract.input as any)?._def?.typeName === 'ZodNull') {
    // No inputs required (e.g., DataLoaderNode) - dependencies should be empty
    // Note: We allow DataLoaderNode to have no dependencies as it's a source node
    return { compatible: true, errors: [] };
  } else if (nodeType === 'BacktestNode') {
    // BacktestNode can accept either:
    // 1. Single dependency with dataframe containing signals (from CrossoverSignalNode)
    // 2. Two dependencies: signals and data (legacy support)
    if (dependencies.length === 1) {
      // Single dependency case - must be a dataframe with signal column
      const dep = nodeOutputs.get(dependencies[0]!);
      if (!dep) {
        errors.push(`BacktestNode dependency must have valid output schema`);
      } else if (dep.type !== 'dataframe') {
        errors.push(`BacktestNode single dependency must output dataframe, got ${dep.type}`);
      }
      // Additional validation for signal column could be added here
    } else if (dependencies.length === 2) {
      // Two dependency case - legacy support for separate signals and data
      const signalsDep = nodeOutputs.get(dependencies[0]!);
      const dataDep = nodeOutputs.get(dependencies[1]!);
      
      if (!signalsDep || !dataDep) {
        errors.push(`BacktestNode dependencies must have valid output schemas`);
      }
      // Note: We skip detailed schema validation for BacktestNode for now
      // as it requires special handling of named inputs
    } else {
      errors.push(`BacktestNode requires either 1 dependency (dataframe with signals) or 2 dependencies (signals and data), got ${dependencies.length}`);
    }
  } else if (dependencies.length === 0) {
    errors.push(`Node type ${nodeType} requires input dependencies`);
  } else {
    // For other node types, validate each dependency's output against expected input
    for (const depId of dependencies) {
      const depOutput = nodeOutputs.get(depId);
      if (!depOutput) {
        errors.push(`Dependency ${depId} output schema not found`);
        continue;
      }
      
      // For single input nodes, validate compatibility
      if (nodeType === 'IndicatorNode') {
        // IndicatorNode expects a dataframe input
        if (depOutput.type !== 'dataframe') {
          errors.push(`IndicatorNode expects dataframe input, got ${depOutput.type} from ${depId}`);
        }
      } else if (nodeType === 'CrossoverSignalNode') {
        // CrossoverSignalNode can accept multiple dataframe inputs
        if (depOutput.type !== 'dataframe') {
          errors.push(`CrossoverSignalNode expects dataframe inputs, got ${depOutput.type} from ${depId}`);
        }
      }
    }
  }
  
  return { 
    compatible: errors.length === 0, 
    errors 
  };
}

// Utility function to get expected output schema for a node type
export function getNodeOutputSchema(nodeType: string, parameters?: any): any {
  const contract = NodeIOContracts[nodeType as keyof typeof NodeIOContracts];
  if (!contract) {
    return null;
  }
  
  // Customize output schema based on parameters
  switch (nodeType) {
    case 'DataLoaderNode':
      return {
        type: 'dataframe',
        columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume'],
        required_columns: ['timestamp', 'close']
      };
      
    case 'IndicatorNode':
      const indicator = parameters?.indicator || 'unknown';
      return {
        type: 'dataframe',
        columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume', indicator.toLowerCase()],
        indicator_column: indicator.toLowerCase()
      };
      
    case 'CrossoverSignalNode':
      const signalCol = parameters?.signal_column || 'signal';
      return {
        type: 'dataframe',
        columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume', signalCol],
        signal_column: signalCol
      };
      
    case 'BacktestNode':
      return {
        type: 'backtest_results',
        metrics: [
          'total_return',
          'sharpe_ratio',
          'max_drawdown', 
          'win_rate',
          'profit_factor'
        ],
        trade_log: true
      };
      
    default:
      return contract.output;
  }
}

// Enhanced validation function that checks the entire pipeline flow
export function validatePipelineDataFlow(
  nodes: Array<{ id: string; type: string; depends_on?: string[]; params: any }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeOutputs = new Map<string, any>();
  
  // Process nodes in dependency order (simplified - assumes they're already sorted)
  for (const node of nodes) {
    // Get expected output for this node
    const outputSchema = getNodeOutputSchema(node.type, node.params);
    if (outputSchema) {
      nodeOutputs.set(node.id, outputSchema);
    }
    
    // Validate input compatibility
    const ioValidation = validateNodeIOCompatibility(
      node.type,
      node.depends_on || [],
      nodeOutputs
    );
    
    if (!ioValidation.compatible) {
      errors.push(...ioValidation.errors.map(err => 
        `Node ${node.id}: ${err}`
      ));
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Custom node support functions
export function isCustomNode(nodeType: string): boolean {
  try {
    const registry = getCustomNodeRegistry();
    return registry.isCustomNode(nodeType);
  } catch (error) {
    console.warn(`Failed to check if ${nodeType} is custom node:`, error);
    return false;
  }
}

export function getCustomNodeSchemas(nodeType: string): { inputSchema: any; outputSchema: any } | undefined {
  try {
    const registry = getCustomNodeRegistry();
    return registry.getNodeSchemas(nodeType);
  } catch (error) {
    console.warn(`Failed to get custom node schemas for ${nodeType}:`, error);
    return undefined;
  }
}

export function validateCustomNodeReferences(nodeTypes: string[]): { valid: boolean; missingNodes: string[] } {
  try {
    const registry = getCustomNodeRegistry();
    return registry.validateNodeReferences(nodeTypes);
  } catch (error) {
    console.warn(`Failed to validate custom node references:`, error);
    return { valid: true, missingNodes: [] };
  }
}

// Enhanced getNodeOutputSchema to support custom nodes
export function getNodeOutputSchemaEnhanced(nodeType: string, parameters?: any): any {
  // First check if it's a custom node
  if (isCustomNode(nodeType)) {
    const schemas = getCustomNodeSchemas(nodeType);
    if (schemas) {
      return schemas.outputSchema;
    }
  }
  
  // Fall back to built-in node logic
  return getNodeOutputSchema(nodeType, parameters);
}

// Enhanced validateNodeIOCompatibility to support custom nodes
export function validateNodeIOCompatibilityEnhanced(
  nodeType: string,
  dependencies: string[],
  nodeOutputs: Map<string, any>
): { compatible: boolean; errors: string[] } {
  // Check if it's a custom node
  if (isCustomNode(nodeType)) {
    return validateCustomNodeIOCompatibility(nodeType, dependencies, nodeOutputs);
  }
  
  // Fall back to built-in node validation
  return validateNodeIOCompatibility(nodeType, dependencies, nodeOutputs);
}

function validateCustomNodeIOCompatibility(
  nodeType: string,
  dependencies: string[],
  nodeOutputs: Map<string, any>
): { compatible: boolean; errors: string[] } {
  const schemas = getCustomNodeSchemas(nodeType);
  if (!schemas) {
    return { compatible: false, errors: [`Custom node schema not found for: ${nodeType}`] };
  }
  
  const errors: string[] = [];
  
  // Basic validation - check if dependencies match expected inputs
  if (Object.keys(schemas.inputSchema).length === 0) {
    // No inputs required
    if (dependencies.length > 0) {
      errors.push(`Custom node ${nodeType} expects no inputs but has ${dependencies.length} dependencies`);
    }
  } else {
    // Has input requirements - basic compatibility check
    if (dependencies.length === 0) {
      errors.push(`Custom node ${nodeType} requires inputs but has no dependencies`);
    } else {
      // Check each dependency output compatibility (simplified validation)
      for (const depId of dependencies) {
        const depOutput = nodeOutputs.get(depId);
        if (!depOutput) {
          errors.push(`Dependency ${depId} output schema not found for custom node ${nodeType}`);
        }
      }
    }
  }
  
  return {
    compatible: errors.length === 0,
    errors
  };
}

// Enhanced pipeline data flow validation with custom node support
export function validatePipelineDataFlowEnhanced(
  nodes: Array<{ id: string; type: string; depends_on?: string[]; params: any }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeOutputs = new Map<string, any>();
  
  // First, validate that all custom node references exist
  const customNodeTypes = nodes.filter(node => !isBuiltinNode(node.type)).map(node => node.type);
  const customNodeValidation = validateCustomNodeReferences(customNodeTypes);
  
  if (!customNodeValidation.valid) {
    errors.push(...customNodeValidation.missingNodes.map(nodeType => 
      `Custom node type not found: ${nodeType}`
    ));
    // Don't continue if custom nodes are missing
    return { valid: false, errors };
  }
  
  // Process nodes in dependency order (simplified - assumes they're already sorted)
  for (const node of nodes) {
    // Get expected output for this node (built-in or custom)
    const outputSchema = getNodeOutputSchemaEnhanced(node.type, node.params);
    if (outputSchema) {
      nodeOutputs.set(node.id, outputSchema);
    }
    
    // Validate input compatibility (built-in or custom)
    const ioValidation = validateNodeIOCompatibilityEnhanced(
      node.type,
      node.depends_on || [],
      nodeOutputs
    );
    
    if (!ioValidation.compatible) {
      errors.push(...ioValidation.errors.map(err => 
        `Node ${node.id}: ${err}`
      ));
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function isBuiltinNode(nodeType: string): boolean {
  const builtinNodes = ['DataLoaderNode', 'IndicatorNode', 'CrossoverSignalNode', 'BacktestNode'];
  return builtinNodes.includes(nodeType);
}

// Type exports
export type DataframeType = z.infer<typeof DataframeSchema>;
export type SignalsType = z.infer<typeof SignalsSchema>;
export type BacktestResultsType = z.infer<typeof BacktestResultsSchema>;
export type NodeIOContract = {
  input: z.ZodSchema | null;
  output: z.ZodSchema;
};