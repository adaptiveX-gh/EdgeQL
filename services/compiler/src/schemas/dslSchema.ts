import { z } from 'zod';

// Base parameter schemas for different data types
export const StringParamSchema = z.string().min(1);
export const NumberParamSchema = z.number();
export const PositiveNumberParamSchema = z.number().positive();
export const BooleanParamSchema = z.boolean();
export const ArrayParamSchema = z.array(z.string());

// Timeframe validation
export const TimeframeSchema = z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);

// Indicator types
export const IndicatorTypeSchema = z.enum(['SMA', 'EMA', 'RSI', 'MACD', 'BB', 'STOCH', 'ATR']);

// Column reference for OHLCV data
export const OHLCVColumnSchema = z.enum(['open', 'high', 'low', 'close', 'volume']);

// Node parameter schemas for each node type
export const DataLoaderParamsSchema = z.object({
  symbol: StringParamSchema,
  timeframe: TimeframeSchema,
  dataset: StringParamSchema,
  start_date: z.string().optional(),
  end_date: z.string().optional()
});

export const IndicatorParamsSchema = z.object({
  indicator: IndicatorTypeSchema,
  period: PositiveNumberParamSchema,
  column: OHLCVColumnSchema.optional().default('close')
});

export const CrossoverSignalParamsSchema = z.object({
  fast_period: PositiveNumberParamSchema,
  slow_period: PositiveNumberParamSchema,
  signal_column: StringParamSchema.optional().default('signal'),
  fast_ma_column: StringParamSchema.optional(),
  slow_ma_column: StringParamSchema.optional(),
  buy_threshold: z.number().min(0).optional().default(0.0),
  sell_threshold: z.number().min(0).optional().default(0.0),
  confirmation_periods: PositiveNumberParamSchema.optional().default(1)
}).refine((data) => data.fast_period < data.slow_period, {
  message: "fast_period must be less than slow_period",
  path: ["slow_period"]
});

export const BacktestParamsSchema = z.object({
  initial_capital: PositiveNumberParamSchema,
  commission: z.number().min(0).max(1).optional().default(0.001),
  slippage: z.number().min(0).max(1).optional().default(0.001),
  position_size: z.number().min(0).max(1).optional().default(1.0)
});

// Map node types to their parameter schemas
export const NodeParameterSchemas = {
  'DataLoaderNode': DataLoaderParamsSchema,
  'IndicatorNode': IndicatorParamsSchema,
  'CrossoverSignalNode': CrossoverSignalParamsSchema,
  'BacktestNode': BacktestParamsSchema
} as const;

// Pipeline node schema
export const PipelineNodeSchema = z.object({
  id: z.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Node ID must start with letter and contain only alphanumeric characters and underscores'),
  type: z.string().min(1),
  depends_on: z.array(z.string()).optional(),
  params: z.record(z.any()) // Will be validated against specific schema based on type
});

// Pipeline DSL schema
export const PipelineDSLSchema = z.object({
  pipeline: z.array(PipelineNodeSchema).min(1, 'Pipeline must contain at least one node')
});

// Input/Output schema definitions
export const DataframeSchema = z.object({
  type: z.literal('dataframe'),
  columns: z.array(z.string()).optional(),
  required_columns: z.array(z.string()).optional()
});

export const BacktestResultsSchema = z.object({
  type: z.literal('backtest_results'),
  metrics: z.array(z.string()).optional()
});

export const MultipleDataframesSchema = z.object({
  type: z.literal('multiple_dataframes'),
  min_inputs: z.number().optional().default(2),
  max_inputs: z.number().optional()
});

// Node definition schema for validation
export const NodeDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  runtime: z.enum(['builtin', 'javascript', 'python', 'wasm']),
  inputSchema: z.any(),
  outputSchema: z.any(),
  requiredParams: z.array(z.string()),
  optionalParams: z.array(z.string()).optional()
});

// Compiled pipeline schema
export const CompiledNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  runtime: z.enum(['builtin', 'javascript', 'python', 'wasm']),
  dependencies: z.array(z.string()),
  parameters: z.record(z.any()),
  inputSchema: z.any().optional(),
  outputSchema: z.any().optional()
});

export const CompiledPipelineSchema = z.object({
  nodes: z.array(CompiledNodeSchema),
  executionOrder: z.array(z.string()),
  metadata: z.object({
    totalNodes: z.number(),
    compiledAt: z.string(),
    version: z.string()
  })
});

// Validation error schema
export const ValidationErrorSchema = z.object({
  type: z.enum(['syntax', 'semantic', 'schema']),
  message: z.string(),
  node: z.string().optional(),
  field: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional()
});

// Compilation result schema
export const CompilationResultSchema = z.object({
  success: z.boolean(),
  pipeline: CompiledPipelineSchema.optional(),
  errors: z.array(ValidationErrorSchema).optional(),
  warnings: z.array(z.string()).optional()
});

// Type exports for runtime type safety
export type PipelineNodeType = z.infer<typeof PipelineNodeSchema>;
export type PipelineDSLType = z.infer<typeof PipelineDSLSchema>;
export type CompiledPipelineType = z.infer<typeof CompiledPipelineSchema>;
export type ValidationErrorType = z.infer<typeof ValidationErrorSchema>;
export type CompilationResultType = z.infer<typeof CompilationResultSchema>;

// Utility function to get parameter schema by node type
export function getParameterSchema(nodeType: string): z.ZodSchema | null {
  return NodeParameterSchemas[nodeType as keyof typeof NodeParameterSchemas] || null;
}

// Utility function to validate node parameters
export function validateNodeParameters(nodeType: string, params: any): { success: boolean; errors: string[] } {
  const schema = getParameterSchema(nodeType);
  if (!schema) {
    return { success: false, errors: [`Unknown node type: ${nodeType}`] };
  }

  const result = schema.safeParse(params);
  if (result.success) {
    return { success: true, errors: [] };
  }

  const errors = result.error.issues.map(issue => 
    `${issue.path.join('.')}: ${issue.message}`
  );
  
  return { success: false, errors };
}