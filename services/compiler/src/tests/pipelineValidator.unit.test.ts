import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineValidator } from '../validators/pipelineValidator.js';
import { PipelineDSL, ValidationError } from '../types.js';
import { dslFixtures } from '../../../tests/helpers/fixtures.js';

describe('PipelineValidator Unit Tests', () => {
  let validator: PipelineValidator;
  
  beforeEach(() => {
    validator = new PipelineValidator();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with built-in node definitions', () => {
      expect(validator).toBeDefined();
      
      // Test that validator can validate known node types
      const validPipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'test_data_loader',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'test.csv'
            }
          }
        ]
      };
      
      const errors = validator.validate(validPipeline);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Basic Validation Rules', () => {
    it('should validate a simple valid pipeline', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'price_data',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'sample.csv'
            }
          },
          {
            id: 'sma_indicator',
            type: 'IndicatorNode',
            depends_on: ['price_data'],
            params: {
              indicator: 'SMA',
              period: 20
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors).toHaveLength(0);
    });

    it('should reject pipeline with empty node list', () => {
      const pipeline: PipelineDSL = {
        pipeline: []
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const emptyError = errors.find(e => 
        e.message.includes('at least one node')
      );
      expect(emptyError).toBeDefined();
    });

    it('should detect duplicate node IDs', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'duplicate_id',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'test.csv'
            }
          },
          {
            id: 'duplicate_id',
            type: 'IndicatorNode',
            params: {
              indicator: 'SMA',
              period: 10
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const duplicateError = errors.find(e => 
        e.message.includes('Duplicate node ID')
      );
      expect(duplicateError).toBeDefined();
      expect(duplicateError!.type).toBe('semantic');
    });

    it('should validate node ID format', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: '123invalid',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'test.csv'
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const idError = errors.find(e => 
        e.message.includes('Node ID must start with letter')
      );
      expect(idError).toBeDefined();
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
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const typeError = errors.find(e => 
        e.message.includes('Unknown node type')
      );
      expect(typeError).toBeDefined();
      expect(typeError!.node).toBe('unknown_node');
    });

    it('should validate all built-in node types', () => {
      const nodeTypes = ['DataLoaderNode', 'IndicatorNode', 'CrossoverSignalNode', 'BacktestNode'];
      
      nodeTypes.forEach(nodeType => {
        let params: any = {};
        
        // Set required parameters based on node type
        switch (nodeType) {
          case 'DataLoaderNode':
            params = { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' };
            break;
          case 'IndicatorNode':
            params = { indicator: 'SMA', period: 20 };
            break;
          case 'CrossoverSignalNode':
            params = { buy_condition: 'a > b', sell_condition: 'a < b' };
            break;
          case 'BacktestNode':
            params = { initial_capital: 10000 };
            break;
        }
        
        const pipeline: PipelineDSL = {
          pipeline: [
            {
              id: `test_${nodeType.toLowerCase()}`,
              type: nodeType,
              params
            }
          ]
        };
        
        const errors = validator.validate(pipeline);
        const typeErrors = errors.filter(e => e.message.includes('Unknown node type'));
        expect(typeErrors).toHaveLength(0);
      });
    });
  });

  describe('Parameter Validation', () => {
    it('should detect missing required parameters for DataLoaderNode', () => {
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
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const paramErrors = errors.filter(e => 
        e.message.includes('Missing required parameter')
      );
      expect(paramErrors.length).toBeGreaterThanOrEqual(2); // timeframe and dataset
    });

    it('should detect missing required parameters for IndicatorNode', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'incomplete_indicator',
            type: 'IndicatorNode',
            params: {
              indicator: 'SMA'
              // Missing period
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const periodError = errors.find(e => 
        e.message.includes('period')
      );
      expect(periodError).toBeDefined();
    });

    it('should validate timeframe parameter values', () => {
      const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
      
      // Test valid timeframes
      validTimeframes.forEach(timeframe => {
        const pipeline: PipelineDSL = {
          pipeline: [
            {
              id: `test_${timeframe}`,
              type: 'DataLoaderNode',
              params: {
                symbol: 'BTC/USD',
                timeframe,
                dataset: 'test.csv'
              }
            }
          ]
        };
        
        const errors = validator.validate(pipeline);
        const timeframeErrors = errors.filter(e => e.message.includes('Invalid timeframe'));
        expect(timeframeErrors).toHaveLength(0);
      });
      
      // Test invalid timeframe
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'invalid_timeframe',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '2h',
              dataset: 'test.csv'
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      const timeframeError = errors.find(e => 
        e.message.includes('Invalid timeframe')
      );
      expect(timeframeError).toBeDefined();
    });

    it('should validate indicator types', () => {
      const validIndicators = ['SMA', 'EMA', 'RSI', 'MACD', 'BB'];
      
      // Test valid indicators
      validIndicators.forEach(indicator => {
        const pipeline: PipelineDSL = {
          pipeline: [
            {
              id: `test_${indicator.toLowerCase()}`,
              type: 'IndicatorNode',
              params: {
                indicator,
                period: 14
              }
            }
          ]
        };
        
        const errors = validator.validate(pipeline);
        const indicatorErrors = errors.filter(e => e.message.includes('Invalid indicator'));
        expect(indicatorErrors).toHaveLength(0);
      });
      
      // Test invalid indicator
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'invalid_indicator',
            type: 'IndicatorNode',
            params: {
              indicator: 'INVALID_INDICATOR',
              period: 14
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      const indicatorError = errors.find(e => 
        e.message.includes('Invalid indicator')
      );
      expect(indicatorError).toBeDefined();
    });

    it('should validate period parameter as positive number', () => {
      const invalidPeriods = [-5, 0, 'ten', null, undefined];
      
      invalidPeriods.forEach(period => {
        const pipeline: PipelineDSL = {
          pipeline: [
            {
              id: `test_period_${typeof period}_${period}`,
              type: 'IndicatorNode',
              params: {
                indicator: 'SMA',
                period
              }
            }
          ]
        };
        
        const errors = validator.validate(pipeline);
        const periodError = errors.find(e => 
          e.message.includes('period') && e.message.includes('positive')
        );
        expect(periodError).toBeDefined();
      });
    });

    it('should validate initial_capital as positive number', () => {
      const invalidCapitals = [-1000, 0, 'thousand', null];
      
      invalidCapitals.forEach(capital => {
        const pipeline: PipelineDSL = {
          pipeline: [
            {
              id: `test_capital_${typeof capital}_${capital}`,
              type: 'BacktestNode',
              params: {
                initial_capital: capital
              }
            }
          ]
        };
        
        const errors = validator.validate(pipeline);
        const capitalError = errors.find(e => 
          e.message.includes('initial_capital') && e.message.includes('positive')
        );
        expect(capitalError).toBeDefined();
      });
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
            params: {
              indicator: 'SMA',
              period: 10
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const depError = errors.find(e => 
        e.message.includes('Dependency not found')
      );
      expect(depError).toBeDefined();
      expect(depError!.node).toBe('dependent_node');
    });

    it('should allow valid dependencies', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'data_source',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'test.csv'
            }
          },
          {
            id: 'indicator',
            type: 'IndicatorNode',
            depends_on: ['data_source'],
            params: {
              indicator: 'SMA',
              period: 20
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      const depErrors = errors.filter(e => e.message.includes('Dependency not found'));
      expect(depErrors).toHaveLength(0);
    });

    it('should handle multiple dependencies', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'data_source',
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
            depends_on: ['data_source'],
            params: {
              indicator: 'SMA',
              period: 10
            }
          },
          {
            id: 'slow_ma',
            type: 'IndicatorNode',
            depends_on: ['data_source'],
            params: {
              indicator: 'SMA',
              period: 20
            }
          },
          {
            id: 'crossover_signals',
            type: 'CrossoverSignalNode',
            depends_on: ['fast_ma', 'slow_ma'],
            params: {
              buy_condition: 'fast > slow',
              sell_condition: 'fast < slow'
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      const depErrors = errors.filter(e => e.message.includes('Dependency not found'));
      expect(depErrors).toHaveLength(0);
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect simple circular dependency', () => {
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
            depends_on: ['node_a'],
            params: { indicator: 'EMA', period: 20 }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const circularError = errors.find(e => 
        e.message.includes('Circular dependency')
      );
      expect(circularError).toBeDefined();
    });

    it('should detect complex circular dependency', () => {
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
            depends_on: ['node_a'],
            params: { indicator: 'RSI', period: 14 }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const circularError = errors.find(e => 
        e.message.includes('Circular dependency')
      );
      expect(circularError).toBeDefined();
    });

    it('should not flag valid complex dependency graph', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'data_source',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'test.csv'
            }
          },
          {
            id: 'indicator_1',
            type: 'IndicatorNode',
            depends_on: ['data_source'],
            params: { indicator: 'SMA', period: 20 }
          },
          {
            id: 'indicator_2',
            type: 'IndicatorNode',
            depends_on: ['data_source'],
            params: { indicator: 'EMA', period: 50 }
          },
          {
            id: 'combined_signals',
            type: 'CrossoverSignalNode',
            depends_on: ['indicator_1', 'indicator_2'],
            params: {
              buy_condition: 'sma > ema',
              sell_condition: 'sma < ema'
            }
          },
          {
            id: 'final_backtest',
            type: 'BacktestNode',
            depends_on: ['combined_signals', 'data_source'],
            params: { initial_capital: 10000 }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      const circularErrors = errors.filter(e => e.message.includes('Circular dependency'));
      expect(circularErrors).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty parameters object', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'empty_params',
            type: 'DataLoaderNode',
            params: {}
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      // Should have errors for all missing required parameters
      const requiredParams = ['symbol', 'timeframe', 'dataset'];
      requiredParams.forEach(param => {
        const paramError = errors.find(e => 
          e.message.includes(`Missing required parameter: ${param}`)
        );
        expect(paramError).toBeDefined();
      });
    });

    it('should handle null/undefined parameter values', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'null_params',
            type: 'IndicatorNode',
            params: {
              indicator: null,
              period: undefined
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      // Should validate that parameters are not null/undefined
      const indicatorError = errors.find(e => 
        e.message.includes('indicator')
      );
      expect(indicatorError).toBeDefined();
    });

    it('should handle very large dependency chains', () => {
      const nodes = [];
      
      // Create a chain of 100 nodes
      for (let i = 0; i < 100; i++) {
        const node: any = {
          id: `node_${i}`,
          type: 'IndicatorNode',
          params: {
            indicator: 'SMA',
            period: 10
          }
        };
        
        if (i > 0) {
          node.depends_on = [`node_${i - 1}`];
        }
        
        nodes.push(node);
      }
      
      // Add initial data loader
      nodes.unshift({
        id: 'data_source',
        type: 'DataLoaderNode',
        params: {
          symbol: 'BTC/USD',
          timeframe: '1h',
          dataset: 'test.csv'
        }
      });
      
      // Update first indicator to depend on data source
      nodes[1].depends_on = ['data_source'];
      
      const pipeline: PipelineDSL = { pipeline: nodes };
      
      const errors = validator.validate(pipeline);
      const circularErrors = errors.filter(e => e.message.includes('Circular dependency'));
      expect(circularErrors).toHaveLength(0);
    });

    it('should validate self-dependency as circular', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'self_dependent',
            type: 'IndicatorNode',
            depends_on: ['self_dependent'],
            params: {
              indicator: 'SMA',
              period: 10
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const circularError = errors.find(e => 
        e.message.includes('Circular dependency')
      );
      expect(circularError).toBeDefined();
    });
  });

  describe('Integration with Real DSL Examples', () => {
    it('should validate moving average crossover DSL from fixtures', () => {
      // This would require parsing the YAML first
      // For unit test, we'll create the parsed structure
      const parsedDsl: PipelineDSL = {
        pipeline: [
          {
            id: 'price_data',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'sample_ohlcv.csv'
            }
          },
          {
            id: 'fast_ma',
            type: 'IndicatorNode',
            depends_on: ['price_data'],
            params: {
              indicator: 'SMA',
              period: 10,
              column: 'close'
            }
          },
          {
            id: 'slow_ma',
            type: 'IndicatorNode',
            depends_on: ['price_data'],
            params: {
              indicator: 'SMA',
              period: 20,
              column: 'close'
            }
          },
          {
            id: 'ma_signals',
            type: 'CrossoverSignalNode',
            depends_on: ['fast_ma', 'slow_ma'],
            params: {
              buy_condition: 'fast > slow',
              sell_condition: 'fast < slow'
            }
          },
          {
            id: 'backtest_results',
            type: 'BacktestNode',
            depends_on: ['ma_signals', 'price_data'],
            params: {
              initial_capital: 10000,
              commission: 0.001
            }
          }
        ]
      };
      
      const errors = validator.validate(parsedDsl);
      expect(errors).toHaveLength(0);
    });

    it('should provide detailed error information', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'bad_node',
            type: 'UnknownType',
            params: {
              invalid_param: 'value'
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      
      const error = errors[0];
      expect(error).toHaveProperty('type');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('node');
      expect(error.type).toBe('semantic');
      expect(error.node).toBe('bad_node');
    });
  });
});