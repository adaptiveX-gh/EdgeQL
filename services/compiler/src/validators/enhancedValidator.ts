import { PipelineDSL, ValidationError as LegacyValidationError } from '../types.js';
import { 
  DetailedValidationError, 
  ValidationReport, 
  ValidationContext,
  ValidationErrorCodes,
  ValidationErrorCode,
  ErrorMessageTemplates,
  createValidationError
} from '../types/validationTypes.js';

import { SemanticValidator } from './semanticValidator.js';
import { TypeCompatibilityValidator } from './typeCompatibilityValidator.js';
import { ParameterValidator } from './parameterValidator.js';
import { SchemaCompatibilityValidator } from './schemaCompatibilityValidator.js';
import { PipelineDSLSchema } from '../schemas/dslSchema.js';

/**
 * Enhanced validator that combines all validation layers and produces
 * detailed, structured error reports for frontend consumption
 */
export class EnhancedValidator {
  private semanticValidator: SemanticValidator;
  private typeValidator: TypeCompatibilityValidator;
  private parameterValidator: ParameterValidator;
  private schemaValidator: SchemaCompatibilityValidator;
  
  constructor() {
    this.semanticValidator = new SemanticValidator();
    this.typeValidator = new TypeCompatibilityValidator();
    this.parameterValidator = new ParameterValidator();
    this.schemaValidator = new SchemaCompatibilityValidator();
  }
  
  /**
   * Comprehensive validation that produces a detailed report
   */
  validatePipeline(pipeline: PipelineDSL): ValidationReport {
    const startTime = Date.now();
    const errors: DetailedValidationError[] = [];
    const warnings: DetailedValidationError[] = [];
    
    // Phase 1: Schema validation (structural)
    const schemaValidation = this.validatePipelineSchema(pipeline);
    errors.push(...schemaValidation.errors);
    warnings.push(...schemaValidation.warnings);
    
    // If schema validation fails, don't proceed with deeper validation
    if (schemaValidation.errors.length > 0) {
      return this.generateReport(errors, warnings, pipeline.pipeline?.length || 0, startTime);
    }
    
    // Phase 2: Semantic validation
    const semanticValidation = this.validateSemantics(pipeline);
    errors.push(...semanticValidation.errors);
    warnings.push(...semanticValidation.warnings);
    
    // Phase 3: Parameter validation
    const paramValidation = this.validateParameters(pipeline);
    errors.push(...paramValidation.errors);
    warnings.push(...paramValidation.warnings);
    
    // Phase 4: Type compatibility validation
    const typeValidation = this.validateTypeCompatibility(pipeline);
    errors.push(...typeValidation.errors);
    warnings.push(...typeValidation.warnings);
    
    // Phase 5: Schema compatibility validation
    const schemaCompValidation = this.validateSchemaCompatibility(pipeline);
    errors.push(...schemaCompValidation.errors);
    warnings.push(...schemaCompValidation.warnings);
    
    // Phase 6: Generate best practice warnings
    const bestPracticeValidation = this.validateBestPractices(pipeline);
    warnings.push(...bestPracticeValidation.warnings);
    
    return this.generateReport(errors, warnings, pipeline.pipeline.length, startTime);
  }
  
  /**
   * Validate pipeline schema structure
   */
  private validatePipelineSchema(pipeline: PipelineDSL): { errors: DetailedValidationError[]; warnings: DetailedValidationError[] } {
    const errors: DetailedValidationError[] = [];
    const warnings: DetailedValidationError[] = [];
    
    const schemaResult = PipelineDSLSchema.safeParse(pipeline);
    if (!schemaResult.success) {
      schemaResult.error.issues.forEach(issue => {
        const context: ValidationContext = {
          fieldPath: issue.path.join('.')
        };
        
        // Extract node ID if possible
        if (issue.path.length >= 2 && issue.path[0] === 'pipeline' && typeof issue.path[1] === 'number') {
          const nodeIndex = issue.path[1] as number;
          if (pipeline.pipeline && pipeline.pipeline[nodeIndex]) {
            context.nodeId = pipeline.pipeline[nodeIndex].id;
          }
        }
        
        const error = this.createStructuredError(issue, context);
        errors.push(error);
      });
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate semantic rules
   */
  private validateSemantics(pipeline: PipelineDSL): { errors: DetailedValidationError[]; warnings: DetailedValidationError[] } {
    const legacyErrors = this.semanticValidator.validate(pipeline);
    return this.convertLegacyErrors(legacyErrors);
  }
  
  /**
   * Validate parameters
   */
  private validateParameters(pipeline: PipelineDSL): { errors: DetailedValidationError[]; warnings: DetailedValidationError[] } {
    const errors: DetailedValidationError[] = [];
    const warnings: DetailedValidationError[] = [];
    
    for (const node of pipeline.pipeline) {
      const nodeErrors = this.parameterValidator.validateNodeParameters(node);
      const converted = this.convertLegacyErrors(nodeErrors);
      errors.push(...converted.errors);
      warnings.push(...converted.warnings);
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate type compatibility
   */
  private validateTypeCompatibility(pipeline: PipelineDSL): { errors: DetailedValidationError[]; warnings: DetailedValidationError[] } {
    // Build node outputs map first
    const nodeOutputs = new Map<string, any>();
    
    // This is simplified - in practice we'd need to process nodes in dependency order
    for (const node of pipeline.pipeline) {
      // Mock output schema for validation
      nodeOutputs.set(node.id, { type: 'dataframe' });
    }
    
    const legacyErrors = this.typeValidator.validateTypeCompatibility(pipeline.pipeline, nodeOutputs);
    return this.convertLegacyErrors(legacyErrors);
  }
  
  /**
   * Validate schema compatibility
   */
  private validateSchemaCompatibility(pipeline: PipelineDSL): { errors: DetailedValidationError[]; warnings: DetailedValidationError[] } {
    const legacyErrors = this.schemaValidator.validatePipelineSchemaCompatibility(pipeline.pipeline);
    return this.convertLegacyErrors(legacyErrors);
  }
  
  /**
   * Validate best practices and generate warnings
   */
  private validateBestPractices(pipeline: PipelineDSL): { errors: DetailedValidationError[]; warnings: DetailedValidationError[] } {
    const warnings: DetailedValidationError[] = [];
    
    // Check for single-node pipelines
    if (pipeline.pipeline.length === 1 && pipeline.pipeline[0]?.type !== 'DataLoaderNode') {
      warnings.push({
        id: `W_SINGLE_NODE_${Date.now()}`,
        type: 'semantic',
        severity: 'warning',
        message: 'Pipeline contains only one node. Consider adding analysis or output nodes.',
        context: { nodeId: pipeline.pipeline[0]?.id },
        details: {
          category: 'best_practice',
          code: ValidationErrorCodes.BEST_PRACTICE_VIOLATION,
          expected: 'Multi-node pipeline with data processing chain',
          actual: 'Single node pipeline'
        },
        help: {
          summary: 'Single-node pipelines may not provide meaningful analysis',
          explanation: 'Pipelines typically include data loading, processing, and analysis steps.',
          suggestions: [
            {
              type: 'alternative',
              message: 'Add indicator calculation or signal generation nodes',
            }
          ]
        }
      });
    }
    
    // Check for missing backtest nodes
    const hasBacktest = pipeline.pipeline.some(node => node.type === 'BacktestNode');
    const hasSignals = pipeline.pipeline.some(node => 
      node.type === 'CrossoverSignalNode' || 
      (node.params && node.params.signal_column)
    );
    
    if (hasSignals && !hasBacktest) {
      warnings.push({
        id: `W_MISSING_BACKTEST_${Date.now()}`,
        type: 'semantic',
        severity: 'info',
        message: 'Pipeline generates signals but has no backtest analysis',
        context: {},
        details: {
          category: 'best_practice',
          code: ValidationErrorCodes.BEST_PRACTICE_VIOLATION,
          expected: 'BacktestNode to analyze signal performance',
          actual: 'Signal generation without performance analysis'
        },
        help: {
          summary: 'Consider adding a BacktestNode to analyze signal performance',
          explanation: 'BacktestNodes help evaluate the effectiveness of trading signals.',
          suggestions: [
            {
              type: 'alternative',
              message: 'Add a BacktestNode to analyze signal performance',
            }
          ]
        }
      });
    }
    
    // Check for very high commission/slippage rates
    for (const node of pipeline.pipeline) {
      if (node.type === 'BacktestNode') {
        if (node.params.commission && node.params.commission > 0.01) {
          warnings.push({
            id: `W_HIGH_COMMISSION_${Date.now()}`,
            type: 'parameter',
            severity: 'warning',
            message: `Commission rate of ${(node.params.commission * 100).toFixed(2)}% seems high`,
            context: { nodeId: node.id, fieldPath: 'commission' },
            details: {
              category: 'unusual_configuration',
              code: ValidationErrorCodes.UNUSUAL_CONFIGURATION,
              expected: 'Commission rate below 1%',
              actual: `${(node.params.commission * 100).toFixed(2)}%`
            },
            help: {
              summary: 'High commission rates may affect backtest realism',
              explanation: 'Most brokers charge less than 1% commission per trade.',
              suggestions: [
                {
                  type: 'fix',
                  message: 'Consider using a more realistic commission rate (0.001-0.005)',
                }
              ]
            }
          });
        }
      }
    }
    
    return { errors: [], warnings };
  }
  
  /**
   * Convert legacy ValidationError[] to structured format
   */
  private convertLegacyErrors(legacyErrors: LegacyValidationError[]): { errors: DetailedValidationError[]; warnings: DetailedValidationError[] } {
    const errors: DetailedValidationError[] = [];
    const warnings: DetailedValidationError[] = [];
    
    legacyErrors.forEach(error => {
      const converted = this.convertLegacyError(error);
      if (converted.severity === 'warning') {
        warnings.push(converted);
      } else {
        errors.push(converted);
      }
    });
    
    return { errors, warnings };
  }
  
  /**
   * Convert a single legacy error to structured format
   */
  private convertLegacyError(error: LegacyValidationError): DetailedValidationError {
    const errorId = `${error.type.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Determine error code based on message content
    let code: ValidationErrorCode = ValidationErrorCodes.PARAMETER_CONSTRAINT_VIOLATION;
    if (error.message.includes('Duplicate node ID')) code = ValidationErrorCodes.DUPLICATE_NODE_ID;
    else if (error.message.includes('Unknown node type')) code = ValidationErrorCodes.UNKNOWN_NODE_TYPE;
    else if (error.message.includes('Missing required parameter')) code = ValidationErrorCodes.MISSING_REQUIRED_PARAMETER;
    else if (error.message.includes('Circular dependency')) code = ValidationErrorCodes.CIRCULAR_DEPENDENCY;
    else if (error.message.includes('Dependency not found')) code = ValidationErrorCodes.MISSING_DEPENDENCY;
    
    return {
      id: errorId,
      type: error.type,
      severity: 'error',
      message: error.message,
      context: {
        ...(error.node && { nodeId: error.node }),
        ...(error.field && { fieldPath: error.field }),
        ...(error.line && { lineNumber: error.line }),
        ...(error.column && { columnNumber: error.column })
      },
      details: {
        category: this.getErrorCategory(error.message),
        code: code,
        expected: undefined,
        actual: undefined
      },
      help: {
        summary: this.generateHelpSummary(error.message),
        suggestions: this.generateSuggestions(error.message, error.node, error.field)
      }
    };
  }
  
  /**
   * Create structured error from Zod validation issue
   */
  private createStructuredError(issue: any, context: ValidationContext): DetailedValidationError {
    const errorId = `SCHEMA_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    let code: ValidationErrorCode = ValidationErrorCodes.INVALID_PARAMETER_TYPE;
    if (issue.code === 'invalid_enum_value') code = ValidationErrorCodes.INVALID_PARAMETER_VALUE;
    else if (issue.code === 'too_small') code = ValidationErrorCodes.PARAMETER_OUT_OF_RANGE;
    else if (issue.code === 'invalid_type' && issue.message.includes('Required')) code = ValidationErrorCodes.MISSING_REQUIRED_PARAMETER;
    
    return {
      id: errorId,
      type: 'schema',
      severity: 'error',
      message: this.formatZodError(issue),
      context,
      details: {
        category: issue.code,
        code: code,
        expected: issue.expected,
        actual: issue.received
      },
      help: {
        summary: this.generateZodHelpSummary(issue),
        suggestions: this.generateZodSuggestions(issue, context)
      }
    };
  }
  
  /**
   * Generate final validation report
   */
  private generateReport(
    errors: DetailedValidationError[],
    warnings: DetailedValidationError[],
    nodeCount: number,
    startTime: number
  ): ValidationReport {
    const endTime = Date.now();
    
    // Group errors by node
    const errorsByNode: { [nodeId: string]: DetailedValidationError[] } = {};
    const errorsByType: { [type: string]: DetailedValidationError[] } = {};
    
    [...errors, ...warnings].forEach(error => {
      if (error.context.nodeId) {
        if (!errorsByNode[error.context.nodeId]) {
          errorsByNode[error.context.nodeId] = [];
        }
        errorsByNode[error.context.nodeId]!.push(error);
      }
      
      if (!errorsByType[error.type]) {
        errorsByType[error.type] = [];
      }
      errorsByType[error.type]!.push(error);
    });
    
    // Generate quick fixes
    const quickFixes = this.generateQuickFixes(errors);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalIssues: errors.length + warnings.length,
        errorCount: errors.length,
        warningCount: warnings.length,
        nodesValidated: nodeCount,
        validationTimeMs: endTime - startTime
      },
      errorsByNode,
      errorsByType,
      quickFixes
    };
  }
  
  /**
   * Helper methods for error processing
   */
  private getErrorCategory(message: string): string {
    if (message.includes('parameter')) return 'parameter_validation';
    if (message.includes('dependency')) return 'dependency_validation';
    if (message.includes('type')) return 'type_validation';
    return 'general_validation';
  }
  
  private generateHelpSummary(message: string): string {
    if (message.includes('Missing required parameter')) return 'This node requires additional parameters to function';
    if (message.includes('Unknown node type')) return 'The specified node type is not recognized';
    if (message.includes('Duplicate node ID')) return 'Each node must have a unique identifier';
    return 'Validation error occurred';
  }
  
  private generateSuggestions(message: string, nodeId?: string, field?: string): any[] {
    const suggestions = [];
    
    if (message.includes('Missing required parameter') && field) {
      suggestions.push({
        type: 'fix',
        message: `Add the '${field}' parameter with an appropriate value`,
        action: { type: 'add_field', field }
      });
    }
    
    if (message.includes('Unknown node type')) {
      suggestions.push({
        type: 'alternative',
        message: 'Check the available node types: DataLoaderNode, IndicatorNode, CrossoverSignalNode, BacktestNode'
      });
    }
    
    return suggestions;
  }
  
  private formatZodError(issue: any): string {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  }
  
  private generateZodHelpSummary(issue: any): string {
    return `Schema validation failed: ${issue.code}`;
  }
  
  private generateZodSuggestions(issue: any, context: ValidationContext): any[] {
    return [];
  }
  
  private generateQuickFixes(errors: DetailedValidationError[]): any[] {
    return []; // TODO: Implement intelligent quick fix generation
  }
}