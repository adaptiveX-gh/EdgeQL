import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedValidator } from '../validators/enhancedValidator.js';
import { PipelineDSL } from '../types.js';
import { ValidationErrorCodes } from '../types/validationTypes.js';

describe('EnhancedValidator', () => {
  let validator: EnhancedValidator;
  
  beforeEach(() => {
    validator = new EnhancedValidator();
  });

  describe('Pipeline Structure Validation', () => {
    it('should validate empty pipeline', () => {
      const pipeline: PipelineDSL = { pipeline: [] };
      
      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].message).toContain('at least one node');
    });

    it('should detect duplicate node IDs', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'duplicate_id',
            type: 'DataLoaderNode',
            params: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
          },
          {
            id: 'duplicate_id',
            type: 'IndicatorNode',
            params: { indicator: 'SMA', period: 10 }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => e.details.code === ValidationErrorCodes.DUPLICATE_NODE_ID)).toBe(true);
    });

    it('should validate node ID format', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: '123invalid',  // Cannot start with number
            type: 'DataLoaderNode',
            params: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => e.message.includes('Node ID must start with letter'))).toBe(true);
    });
  });

  describe('Node Type Validation', () => {
    it('should detect unknown node types', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'unknown_node',
            type: 'UnknownNodeType',
            params: {}
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => 
        e.details.code === ValidationErrorCodes.UNKNOWN_NODE_TYPE
      )).toBe(true);
      expect(report.errors.some(e => 
        e.message.includes('Available types:')
      )).toBe(true);
    });

    it('should validate available node types', () => {
      const validTypes = ['DataLoaderNode', 'IndicatorNode', 'CrossoverSignalNode', 'BacktestNode', 'FeatureGeneratorNode', 'LabelingNode'];
      
      for (const nodeType of validTypes) {
        const pipeline: PipelineDSL = {
          pipeline: [
            {
              id: 'test_node',
              type: nodeType,
              params: nodeType === 'DataLoaderNode' 
                ? { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
                : nodeType === 'IndicatorNode'
                ? { indicator: 'SMA', period: 10 }
                : nodeType === 'CrossoverSignalNode'
                ? { fast_period: 10, slow_period: 20 }
                : nodeType === 'BacktestNode'
                ? { initial_capital: 10000 }
                : nodeType === 'FeatureGeneratorNode'
                ? { features: ['sma_10'] }
                : { target_column: 'close', lookahead_periods: 5 }
            }
          ]
        };

        const report = validator.validatePipeline(pipeline);
        
        // Should not have unknown node type errors
        expect(report.errors.some(e => 
          e.details.code === ValidationErrorCodes.UNKNOWN_NODE_TYPE
        )).toBe(false);
      }
    });
  });

  describe('Parameter Validation', () => {
    it('should detect missing required parameters', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'incomplete_data_loader',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD'
              // Missing timeframe and dataset
            }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => 
        e.details.code === ValidationErrorCodes.MISSING_REQUIRED_PARAMETER
      )).toBe(true);
    });

    it('should validate DataLoaderNode parameters', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'data_loader',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'invalid_extension.xyz',  // Invalid extension
              start_date: 'invalid-date',        // Invalid date format
              end_date: '2023-01-01'
            }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => e.message.includes('extension'))).toBe(true);
      expect(report.errors.some(e => e.message.includes('date format'))).toBe(true);
    });

    it('should validate IndicatorNode parameters', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'invalid_indicator',
            type: 'IndicatorNode',
            params: {
              indicator: 'INVALID_INDICATOR',
              period: -5  // Negative period
            }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => e.message.includes('INVALID_INDICATOR'))).toBe(true);
      expect(report.errors.some(e => e.message.includes('positive'))).toBe(true);
    });

    it('should validate CrossoverSignalNode parameter relationships', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'invalid_crossover',
            type: 'CrossoverSignalNode',
            params: {
              fast_period: 50,  // Should be less than slow_period
              slow_period: 20
            }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => 
        e.message.includes('fast_period must be less than slow_period')
      )).toBe(true);
    });

    it('should validate BacktestNode financial parameters', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'invalid_backtest',
            type: 'BacktestNode',
            params: {
              initial_capital: -1000,  // Negative capital
              commission: 1.5,         // > 100% commission
              slippage: -0.1           // Negative slippage
            }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => e.message.includes('initial_capital'))).toBe(true);
      expect(report.errors.some(e => e.message.includes('commission'))).toBe(true);
      expect(report.errors.some(e => e.message.includes('slippage'))).toBe(true);
    });
  });

  describe('Dependency Validation', () => {
    it('should detect missing dependencies', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'dependent_node',
            type: 'IndicatorNode',
            depends_on: ['non_existent_node'],
            params: { indicator: 'SMA', period: 10 }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => 
        e.details.code === ValidationErrorCodes.MISSING_DEPENDENCY
      )).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'node_a',
            type: 'IndicatorNode',
            depends_on: ['node_b'],
            params: { indicator: 'SMA', period: 10 }
          },
          {
            id: 'node_b',
            type: 'IndicatorNode',
            depends_on: ['node_c'],
            params: { indicator: 'EMA', period: 20 }
          },
          {
            id: 'node_c',
            type: 'IndicatorNode',
            depends_on: ['node_a'],  // Creates circular dependency
            params: { indicator: 'RSI', period: 14 }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.errors.some(e => 
        e.details.code === ValidationErrorCodes.CIRCULAR_DEPENDENCY
      )).toBe(true);
    });

    it('should validate dependency count for different node types', () => {
      const testCases = [
        {
          nodeType: 'DataLoaderNode',
          dependencies: ['some_node'],  // Should not have dependencies
          shouldFail: true
        },
        {
          nodeType: 'IndicatorNode',
          dependencies: [],  // Should have exactly 1 dependency
          shouldFail: true
        },
        {
          nodeType: 'CrossoverSignalNode',
          dependencies: ['node1'],  // Should have at least 2 dependencies
          shouldFail: true
        }
      ];

      for (const testCase of testCases) {
        const pipeline: PipelineDSL = {
          pipeline: [
            {
              id: 'data_source',
              type: 'DataLoaderNode',
              params: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
            },
            {
              id: 'test_node',
              type: testCase.nodeType,
              depends_on: testCase.dependencies,
              params: testCase.nodeType === 'DataLoaderNode' 
                ? { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
                : testCase.nodeType === 'IndicatorNode'
                ? { indicator: 'SMA', period: 10 }
                : { fast_period: 10, slow_period: 20 }
            }
          ]
        };

        const report = validator.validatePipeline(pipeline);
        
        if (testCase.shouldFail) {
          expect(report.valid).toBe(false);
        }
      }
    });
  });

  describe('Best Practice Warnings', () => {
    it('should warn about single-node pipelines', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'single_node',
            type: 'IndicatorNode',
            params: { indicator: 'SMA', period: 10 }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.warnings.some(w => 
        w.message.includes('only one node')
      )).toBe(true);
    });

    it('should warn about missing backtest with signals', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'data_loader',
            type: 'DataLoaderNode',
            params: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
          },
          {
            id: 'signal_generator',
            type: 'CrossoverSignalNode',
            depends_on: ['data_loader'],
            params: { fast_period: 10, slow_period: 20 }
          }
          // Missing BacktestNode
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.warnings.some(w => 
        w.message.includes('backtest analysis')
      )).toBe(true);
    });

    it('should warn about high commission rates', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'expensive_backtest',
            type: 'BacktestNode',
            params: {
              initial_capital: 10000,
              commission: 0.02  // 2% commission - very high
            }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.warnings.some(w => 
        w.message.includes('Commission rate') && w.message.includes('high')
      )).toBe(true);
    });
  });

  describe('Validation Report Structure', () => {
    it('should provide detailed error information', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'test_node',
            type: 'UnknownType',
            params: {}
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(false);
      expect(report.summary.totalIssues).toBeGreaterThan(0);
      expect(report.summary.errorCount).toBeGreaterThan(0);
      expect(report.summary.validationTimeMs).toBeGreaterThanOrEqual(0);
      
      // Check error structure
      const error = report.errors[0];
      expect(error.id).toBeDefined();
      expect(error.type).toBeDefined();
      expect(error.severity).toBeDefined();
      expect(error.message).toBeDefined();
      expect(error.context).toBeDefined();
      expect(error.details).toBeDefined();
      expect(error.help).toBeDefined();
    });

    it('should group errors by node', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'problematic_node',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD'
              // Missing required parameters
            }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.errorsByNode).toBeDefined();
      expect(report.errorsByNode['problematic_node']).toBeDefined();
      expect(report.errorsByNode['problematic_node'].length).toBeGreaterThan(0);
    });

    it('should group errors by type', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'test_node',
            type: 'UnknownType',
            params: {}
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.errorsByType).toBeDefined();
      expect(Object.keys(report.errorsByType).length).toBeGreaterThan(0);
    });
  });

  describe('Valid Pipeline Validation', () => {
    it('should validate a correct moving average crossover pipeline', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'price_data',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'test.csv'
            }
          },
          {
            id: 'fast_ma',
            type: 'IndicatorNode',
            depends_on: ['price_data'],
            params: {
              indicator: 'SMA',
              period: 20
            }
          },
          {
            id: 'slow_ma',
            type: 'IndicatorNode',
            depends_on: ['price_data'],
            params: {
              indicator: 'SMA',
              period: 50
            }
          },
          {
            id: 'crossover_signals',
            type: 'CrossoverSignalNode',
            depends_on: ['fast_ma', 'slow_ma'],
            params: {
              fast_period: 20,
              slow_period: 50
            }
          },
          {
            id: 'backtest_results',
            type: 'BacktestNode',
            depends_on: ['crossover_signals'],
            params: {
              initial_capital: 10000,
              commission: 0.001
            }
          }
        ]
      };

      const report = validator.validatePipeline(pipeline);
      
      expect(report.valid).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.summary.nodesValidated).toBe(5);
    });
  });
});