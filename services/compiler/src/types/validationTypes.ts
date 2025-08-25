/**
 * Enhanced validation types with structured error reporting for frontend consumption
 */

export interface ValidationContext {
  nodeId?: string | undefined;
  fieldPath?: string | undefined;
  dependencyId?: string | undefined;
  lineNumber?: number | undefined;
  columnNumber?: number | undefined;
}

export interface ValidationSuggestion {
  type: 'fix' | 'alternative' | 'documentation';
  message: string;
  action?: {
    type: 'replace_value' | 'add_field' | 'remove_field' | 'add_dependency';
    field?: string;
    value?: any;
    target?: string;
  };
}

export interface DetailedValidationError {
  // Core error information
  id: string; // Unique identifier for this error type
  type: 'syntax' | 'semantic' | 'schema' | 'type_compatibility' | 'parameter' | 'dependency';
  severity: 'error' | 'warning' | 'info';
  message: string;
  
  // Context information
  context: ValidationContext;
  
  // Detailed error information
  details: {
    category: string; // e.g., 'missing_parameter', 'invalid_type', 'circular_dependency'
    code: string;     // Error code for programmatic handling
    expected?: any;   // What was expected
    actual?: any;     // What was found
    constraints?: string[]; // Additional constraints that were violated
  };
  
  // Help information
  help: {
    summary: string;
    explanation?: string;
    suggestions: ValidationSuggestion[];
    documentationUrl?: string;
    relatedErrors?: string[]; // IDs of related errors
  };
  
  // Source location (for DSL text)
  location?: {
    line: number;
    column: number;
    length?: number;
    snippet?: string;
  };
}

export interface ValidationReport {
  valid: boolean;
  errors: DetailedValidationError[];
  warnings: DetailedValidationError[];
  summary: {
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    nodesValidated: number;
    validationTimeMs: number;
  };
  
  // Grouped errors for better UX
  errorsByNode: { [nodeId: string]: DetailedValidationError[] };
  errorsByType: { [type: string]: DetailedValidationError[] };
  
  // Suggested fixes
  quickFixes: Array<{
    title: string;
    description: string;
    errors: string[]; // Error IDs this fix addresses
    action: {
      type: 'batch_edit' | 'single_edit' | 'template_replacement';
      changes: Array<{
        nodeId: string;
        field: string;
        operation: 'set' | 'add' | 'remove';
        value?: any;
      }>;
    };
  }>;
}

export interface NodeValidationContext {
  nodeId: string;
  nodeType: string;
  dependencies: string[];
  parameters: Record<string, any>;
  expectedInputs: any;
  expectedOutputs: any;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: 'structural' | 'semantic' | 'performance' | 'best_practice';
  severity: 'error' | 'warning' | 'info';
  applies: (context: NodeValidationContext) => boolean;
  validate: (context: NodeValidationContext) => DetailedValidationError[];
}

/**
 * Validation error codes for consistent error handling
 */
export const ValidationErrorCodes = {
  // Structural errors
  DUPLICATE_NODE_ID: 'E001',
  INVALID_NODE_ID_FORMAT: 'E002',
  MISSING_NODE_TYPE: 'E003',
  UNKNOWN_NODE_TYPE: 'E004',
  EMPTY_PIPELINE: 'E005',
  
  // Dependency errors
  MISSING_DEPENDENCY: 'E101',
  CIRCULAR_DEPENDENCY: 'E102',
  INVALID_DEPENDENCY_REFERENCE: 'E103',
  DEPENDENCY_TYPE_MISMATCH: 'E104',
  
  // Parameter errors
  MISSING_REQUIRED_PARAMETER: 'E201',
  INVALID_PARAMETER_TYPE: 'E202',
  INVALID_PARAMETER_VALUE: 'E203',
  PARAMETER_OUT_OF_RANGE: 'E204',
  PARAMETER_CONSTRAINT_VIOLATION: 'E205',
  
  // Schema compatibility errors
  INPUT_SCHEMA_MISMATCH: 'E301',
  OUTPUT_SCHEMA_INCOMPATIBLE: 'E302',
  MISSING_REQUIRED_COLUMNS: 'E303',
  COLUMN_TYPE_MISMATCH: 'E304',
  
  // Type compatibility errors
  INCOMPATIBLE_INPUT_TYPE: 'E401',
  INCOMPATIBLE_OUTPUT_TYPE: 'E402',
  WRONG_INPUT_COUNT: 'E403',
  MISSING_SIGNAL_DATA: 'E404',
  
  // Warnings
  DEPRECATED_PARAMETER: 'W001',
  PERFORMANCE_CONCERN: 'W002',
  BEST_PRACTICE_VIOLATION: 'W003',
  UNUSUAL_CONFIGURATION: 'W004'
} as const;

export type ValidationErrorCode = typeof ValidationErrorCodes[keyof typeof ValidationErrorCodes];

/**
 * Error message templates for consistent formatting
 */
export const ErrorMessageTemplates = {
  [ValidationErrorCodes.DUPLICATE_NODE_ID]: (nodeId: string) => ({
    message: `Node ID '${nodeId}' is already used in this pipeline`,
    help: {
      summary: 'Each node must have a unique identifier',
      explanation: 'Node IDs must be unique within a pipeline to avoid conflicts during execution.',
      suggestions: [
        {
          type: 'fix' as const,
          message: `Try adding a suffix like '${nodeId}_2' or '${nodeId}_alt'`,
          action: {
            type: 'replace_value' as const,
            field: 'id',
            value: `${nodeId}_2`
          }
        }
      ]
    }
  }),
  
  [ValidationErrorCodes.MISSING_REQUIRED_PARAMETER]: (nodeType: string, parameter: string) => ({
    message: `Missing required parameter '${parameter}' for ${nodeType}`,
    help: {
      summary: `${nodeType} requires the '${parameter}' parameter to function correctly`,
      explanation: `This parameter is essential for ${nodeType} to process data properly.`,
      suggestions: [
        {
          type: 'fix' as const,
          message: `Add the '${parameter}' parameter with an appropriate value`,
          action: {
            type: 'add_field' as const,
            field: parameter
          }
        }
      ]
    }
  }),
  
  [ValidationErrorCodes.CIRCULAR_DEPENDENCY]: (cycle: string[]) => ({
    message: `Circular dependency detected: ${cycle.join(' → ')}`,
    help: {
      summary: 'Nodes cannot depend on themselves directly or indirectly',
      explanation: 'Circular dependencies prevent the pipeline from determining a valid execution order.',
      suggestions: [
        {
          type: 'fix' as const,
          message: 'Remove one of the dependencies in the cycle',
        },
        {
          type: 'alternative' as const,
          message: 'Restructure the pipeline to avoid the circular relationship',
        }
      ]
    }
  })
};

/**
 * Helper function to create detailed validation errors
 */
export function createValidationError(
  code: ValidationErrorCode,
  context: ValidationContext,
  customMessage?: string,
  additionalDetails?: Partial<DetailedValidationError['details']>
): DetailedValidationError {
  const errorId = `${code}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  return {
    id: errorId,
    type: getErrorType(code),
    severity: getErrorSeverity(code),
    message: customMessage || `Validation error: ${code}`,
    context,
    details: {
      category: getErrorCategory(code),
      code,
      ...additionalDetails
    },
    help: {
      summary: 'Validation error occurred',
      suggestions: []
    }
  };
}

function getErrorType(code: ValidationErrorCode): DetailedValidationError['type'] {
  if (code.startsWith('E0')) return 'semantic';
  if (code.startsWith('E1')) return 'dependency';
  if (code.startsWith('E2')) return 'parameter';
  if (code.startsWith('E3')) return 'schema';
  if (code.startsWith('E4')) return 'type_compatibility';
  return 'semantic';
}

function getErrorSeverity(code: ValidationErrorCode): DetailedValidationError['severity'] {
  return code.startsWith('W') ? 'warning' : 'error';
}

function getErrorCategory(code: ValidationErrorCode): string {
  const categoryMap: { [key: string]: string } = {
    'E001': 'duplicate_id',
    'E002': 'invalid_id_format',
    'E003': 'missing_node_type',
    'E004': 'unknown_node_type',
    'E005': 'empty_pipeline',
    'E101': 'missing_dependency',
    'E102': 'circular_dependency',
    'E103': 'invalid_dependency',
    'E104': 'dependency_type_mismatch',
    'E201': 'missing_parameter',
    'E202': 'invalid_parameter_type',
    'E203': 'invalid_parameter_value',
    'E204': 'parameter_range',
    'E205': 'parameter_constraint',
    'E301': 'schema_mismatch',
    'E302': 'schema_incompatible',
    'E303': 'missing_columns',
    'E304': 'column_type_mismatch',
    'E401': 'input_type_incompatible',
    'E402': 'output_type_incompatible',
    'E403': 'wrong_input_count',
    'E404': 'missing_signal_data'
  };
  
  return categoryMap[code] || 'unknown';
}