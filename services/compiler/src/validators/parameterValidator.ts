import { PipelineNode, ValidationError } from '../types.js';
import { getParameterSchema } from '../schemas/dslSchema.js';

/**
 * Granular parameter validator with field-specific error reporting
 */
export class ParameterValidator {
  
  /**
   * Validate node parameters with detailed field-level error reporting
   */
  validateNodeParameters(node: PipelineNode): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Get the Zod schema for this node type
    const schema = getParameterSchema(node.type);
    if (!schema) {
      return [{
        type: 'semantic',
        message: `No parameter schema defined for node type '${node.type}'`,
        node: node.id,
        field: 'type'
      }];
    }
    
    // Validate against schema
    const result = schema.safeParse(node.params);
    if (!result.success) {
      // Convert Zod errors to our ValidationError format
      result.error.issues.forEach(issue => {
        errors.push({
          type: 'semantic',
          message: this.formatParameterError(issue.code, issue.message, issue.path),
          node: node.id,
          field: issue.path.join('.')
        });
      });
    }
    
    // Additional custom validation beyond schema
    errors.push(...this.validateParameterLogic(node));
    
    return errors;
  }
  
  /**
   * Format Zod validation errors for better user experience
   */
  private formatParameterError(code: string, message: string, path: (string | number)[]): string {
    const fieldPath = path.join('.');
    
    switch (code) {
      case 'invalid_type':
        if (message.includes('Required')) {
          return `Missing required parameter '${fieldPath}'`;
        }
        return `Parameter '${fieldPath}' has invalid type: ${message}`;
      
      case 'too_small':
        if (message.includes('greater than')) {
          return `Parameter '${fieldPath}' must be greater than the minimum allowed value`;
        }
        return `Parameter '${fieldPath}' value is too small: ${message}`;
      
      case 'too_big':
        return `Parameter '${fieldPath}' value is too large: ${message}`;
      
      case 'invalid_enum_value':
        return `Parameter '${fieldPath}' has invalid value: ${message}`;
      
      case 'invalid_string':
        if (message.includes('min')) {
          return `Parameter '${fieldPath}' cannot be empty`;
        }
        return `Parameter '${fieldPath}' string validation failed: ${message}`;
      
      case 'custom':
        return `Parameter validation failed for '${fieldPath}': ${message}`;
      
      default:
        return `Parameter '${fieldPath}' validation error: ${message}`;
    }
  }
  
  /**
   * Additional logical parameter validation beyond basic type checking
   */
  private validateParameterLogic(node: PipelineNode): ValidationError[] {
    const errors: ValidationError[] = [];
    
    switch (node.type) {
      case 'DataLoaderNode':
        errors.push(...this.validateDataLoaderParams(node));
        break;
      case 'IndicatorNode':
        errors.push(...this.validateIndicatorParams(node));
        break;
      case 'CrossoverSignalNode':
        errors.push(...this.validateCrossoverParams(node));
        break;
      case 'BacktestNode':
        errors.push(...this.validateBacktestParams(node));
        break;
      case 'FeatureGeneratorNode':
        errors.push(...this.validateFeatureGeneratorParams(node));
        break;
      case 'LabelingNode':
        errors.push(...this.validateLabelingParams(node));
        break;
    }
    
    return errors;
  }
  
  /**
   * DataLoaderNode parameter validation
   */
  private validateDataLoaderParams(node: PipelineNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const params = node.params;
    
    // Symbol validation
    if (params.symbol) {
      if (!/^[A-Z0-9\/\-_]+$/i.test(params.symbol)) {
        errors.push({
          type: 'semantic',
          message: 'Symbol must contain only letters, numbers, slashes, hyphens, and underscores',
          node: node.id,
          field: 'symbol'
        });
      }
    }
    
    // Dataset file validation
    if (params.dataset) {
      const validExtensions = ['.csv', '.parquet', '.json'];
      if (!validExtensions.some(ext => params.dataset.toLowerCase().endsWith(ext))) {
        errors.push({
          type: 'semantic',
          message: `Dataset file must have one of these extensions: ${validExtensions.join(', ')}`,
          node: node.id,
          field: 'dataset'
        });
      }
    }
    
    // Date range validation
    if (params.start_date && params.end_date) {
      try {
        const startDate = new Date(params.start_date);
        const endDate = new Date(params.end_date);
        
        if (isNaN(startDate.getTime())) {
          errors.push({
            type: 'semantic',
            message: 'start_date must be a valid date in YYYY-MM-DD format',
            node: node.id,
            field: 'start_date'
          });
        }
        
        if (isNaN(endDate.getTime())) {
          errors.push({
            type: 'semantic',
            message: 'end_date must be a valid date in YYYY-MM-DD format',
            node: node.id,
            field: 'end_date'
          });
        }
        
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          if (startDate >= endDate) {
            errors.push({
              type: 'semantic',
              message: 'start_date must be earlier than end_date',
              node: node.id,
              field: 'end_date'
            });
          }
          
          // Check for reasonable date range (not too far in the future/past)
          const now = new Date();
          const maxFutureDate = new Date(now.getFullYear() + 1, 11, 31);
          const minPastDate = new Date(2000, 0, 1);
          
          if (endDate > maxFutureDate) {
            errors.push({
              type: 'semantic',
              message: 'end_date cannot be more than 1 year in the future',
              node: node.id,
              field: 'end_date'
            });
          }
          
          if (startDate < minPastDate) {
            errors.push({
              type: 'semantic',
              message: 'start_date cannot be before year 2000',
              node: node.id,
              field: 'start_date'
            });
          }
        }
      } catch (error) {
        errors.push({
          type: 'semantic',
          message: 'Invalid date format. Use YYYY-MM-DD format',
          node: node.id,
          field: 'start_date'
        });
      }
    }
    
    return errors;
  }
  
  /**
   * IndicatorNode parameter validation
   */
  private validateIndicatorParams(node: PipelineNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const params = node.params;
    
    // Indicator-specific parameter validation
    switch (params.indicator) {
      case 'MACD':
        if (params.fast_period && params.slow_period) {
          if (params.fast_period >= params.slow_period) {
            errors.push({
              type: 'semantic',
              message: 'MACD fast_period must be less than slow_period',
              node: node.id,
              field: 'slow_period'
            });
          }
        }
        if (!params.signal_period) {
          errors.push({
            type: 'semantic',
            message: 'MACD indicator requires signal_period parameter',
            node: node.id,
            field: 'signal_period'
          });
        } else if (params.signal_period <= 0 || params.signal_period > 50) {
          errors.push({
            type: 'semantic',
            message: 'MACD signal_period should be between 1 and 50',
            node: node.id,
            field: 'signal_period'
          });
        }
        break;
        
      case 'BB': // Bollinger Bands
        if (!params.std_dev) {
          errors.push({
            type: 'semantic',
            message: 'Bollinger Bands indicator requires std_dev parameter',
            node: node.id,
            field: 'std_dev'
          });
        } else if (params.std_dev <= 0 || params.std_dev > 5) {
          errors.push({
            type: 'semantic',
            message: 'Bollinger Bands std_dev should be between 0 and 5',
            node: node.id,
            field: 'std_dev'
          });
        }
        break;
        
      case 'RSI':
        if (params.period && (params.period < 2 || params.period > 100)) {
          errors.push({
            type: 'semantic',
            message: 'RSI period should be between 2 and 100',
            node: node.id,
            field: 'period'
          });
        }
        break;
        
      case 'STOCH':
        if (params.k_period && (params.k_period < 1 || params.k_period > 50)) {
          errors.push({
            type: 'semantic',
            message: 'Stochastic %K period should be between 1 and 50',
            node: node.id,
            field: 'k_period'
          });
        }
        if (params.d_period && (params.d_period < 1 || params.d_period > 20)) {
          errors.push({
            type: 'semantic',
            message: 'Stochastic %D period should be between 1 and 20',
            node: node.id,
            field: 'd_period'
          });
        }
        break;
    }
    
    // General period validation
    if (params.period) {
      if (params.period < 1) {
        errors.push({
          type: 'semantic',
          message: 'Period must be at least 1',
          node: node.id,
          field: 'period'
        });
      } else if (params.period > 1000) {
        errors.push({
          type: 'semantic',
          message: 'Period cannot exceed 1000 (impractical for most use cases)',
          node: node.id,
          field: 'period'
        });
      }
    }
    
    return errors;
  }
  
  /**
   * CrossoverSignalNode parameter validation
   */
  private validateCrossoverParams(node: PipelineNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const params = node.params;
    
    // Period relationship validation
    if (params.fast_period >= params.slow_period) {
      errors.push({
        type: 'semantic',
        message: 'fast_period must be less than slow_period for meaningful crossover signals',
        node: node.id,
        field: 'slow_period'
      });
    }
    
    // Threshold validation
    if (params.buy_threshold !== undefined && params.sell_threshold !== undefined) {
      if (params.buy_threshold <= params.sell_threshold) {
        errors.push({
          type: 'semantic',
          message: 'buy_threshold should be greater than sell_threshold',
          node: node.id,
          field: 'buy_threshold'
        });
      }
    }
    
    // Signal column name validation
    if (params.signal_column && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(params.signal_column)) {
      errors.push({
        type: 'semantic',
        message: 'signal_column name must start with a letter and contain only alphanumeric characters and underscores',
        node: node.id,
        field: 'signal_column'
      });
    }
    
    // Confirmation periods validation
    if (params.confirmation_periods && (params.confirmation_periods < 1 || params.confirmation_periods > 10)) {
      errors.push({
        type: 'semantic',
        message: 'confirmation_periods should be between 1 and 10',
        node: node.id,
        field: 'confirmation_periods'
      });
    }
    
    return errors;
  }
  
  /**
   * BacktestNode parameter validation
   */
  private validateBacktestParams(node: PipelineNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const params = node.params;
    
    // Initial capital validation
    if (params.initial_capital <= 0) {
      errors.push({
        type: 'semantic',
        message: 'initial_capital must be greater than 0',
        node: node.id,
        field: 'initial_capital'
      });
    } else if (params.initial_capital < 1000) {
      errors.push({
        type: 'semantic',
        message: 'initial_capital should be at least 1000 for realistic backtesting',
        node: node.id,
        field: 'initial_capital'
      });
    }
    
    // Commission validation
    if (params.commission !== undefined) {
      if (params.commission < 0) {
        errors.push({
          type: 'semantic',
          message: 'commission cannot be negative',
          node: node.id,
          field: 'commission'
        });
      } else if (params.commission > 0.1) {
        errors.push({
          type: 'semantic',
          message: 'commission rate above 10% seems unrealistic',
          node: node.id,
          field: 'commission'
        });
      }
    }
    
    // Slippage validation
    if (params.slippage !== undefined) {
      if (params.slippage < 0) {
        errors.push({
          type: 'semantic',
          message: 'slippage cannot be negative',
          node: node.id,
          field: 'slippage'
        });
      } else if (params.slippage > 0.05) {
        errors.push({
          type: 'semantic',
          message: 'slippage rate above 5% seems excessive',
          node: node.id,
          field: 'slippage'
        });
      }
    }
    
    // Position size validation
    if (params.position_size !== undefined) {
      if (params.position_size <= 0) {
        errors.push({
          type: 'semantic',
          message: 'position_size must be greater than 0',
          node: node.id,
          field: 'position_size'
        });
      } else if (params.position_size > 1) {
        errors.push({
          type: 'semantic',
          message: 'position_size cannot exceed 1.0 (100% of capital)',
          node: node.id,
          field: 'position_size'
        });
      }
    }
    
    return errors;
  }
  
  /**
   * FeatureGeneratorNode parameter validation
   */
  private validateFeatureGeneratorParams(node: PipelineNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const params = node.params;
    
    // Features array validation
    if (params.features && Array.isArray(params.features)) {
      params.features.forEach((feature: any, index: number) => {
        if (typeof feature !== 'string' || feature.trim() === '') {
          errors.push({
            type: 'semantic',
            message: `Feature at index ${index} must be a non-empty string`,
            node: node.id,
            field: `features[${index}]`
          });
        }
      });
    }
    
    // Window size validation
    if (params.window_size !== undefined) {
      if (params.window_size < 1 || params.window_size > 1000) {
        errors.push({
          type: 'semantic',
          message: 'window_size should be between 1 and 1000',
          node: node.id,
          field: 'window_size'
        });
      }
    }
    
    return errors;
  }
  
  /**
   * LabelingNode parameter validation
   */
  private validateLabelingParams(node: PipelineNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const params = node.params;
    
    // Target column validation
    if (params.target_column && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(params.target_column)) {
      errors.push({
        type: 'semantic',
        message: 'target_column name must start with a letter and contain only alphanumeric characters and underscores',
        node: node.id,
        field: 'target_column'
      });
    }
    
    // Lookahead periods validation
    if (params.lookahead_periods < 1 || params.lookahead_periods > 100) {
      errors.push({
        type: 'semantic',
        message: 'lookahead_periods should be between 1 and 100',
        node: node.id,
        field: 'lookahead_periods'
      });
    }
    
    // Threshold validation
    if (params.threshold !== undefined && params.threshold <= 0) {
      errors.push({
        type: 'semantic',
        message: 'threshold must be greater than 0',
        node: node.id,
        field: 'threshold'
      });
    }
    
    return errors;
  }
}