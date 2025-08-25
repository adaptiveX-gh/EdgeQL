import { describe, it, expect, beforeEach } from 'vitest';
import { ParameterValidator } from '../validators/parameterValidator.js';
import { PipelineNode } from '../types.js';

describe('ParameterValidator', () => {
  let validator: ParameterValidator;
  
  beforeEach(() => {
    validator = new ParameterValidator();
  });

  describe('DataLoaderNode Parameter Validation', () => {
    it('should validate required parameters', () => {
      const node: PipelineNode = {
        id: 'incomplete_loader',
        type: 'DataLoaderNode',
        params: {
          symbol: 'BTC/USD'
          // Missing timeframe and dataset
        }
      };

      const errors = validator.validateNodeParameters(node);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('timeframe'))).toBe(true);
      expect(errors.some(e => e.message.includes('dataset'))).toBe(true);
    });

    it('should validate symbol format', () => {
      const node: PipelineNode = {
        id: 'invalid_symbol',
        type: 'DataLoaderNode',
        params: {
          symbol: 'invalid!symbol@',
          timeframe: '1h',
          dataset: 'test.csv'
        }
      };

      const errors = validator.validateNodeParameters(node);
      
      expect(errors.some(e => 
        e.message.includes('letters, numbers, slashes')
      )).toBe(true);
      expect(errors.some(e => e.field === 'symbol')).toBe(true);
    });

    it('should validate dataset file extensions', () => {
      const validExtensions = ['.csv', '.parquet', '.json'];
      const invalidExtension = '.xyz';

      const node: PipelineNode = {
        id: 'invalid_dataset',
        type: 'DataLoaderNode',
        params: {
          symbol: 'BTC/USD',
          timeframe: '1h',
          dataset: `test${invalidExtension}`
        }
      };

      const errors = validator.validateNodeParameters(node);
      
      expect(errors.some(e => 
        e.message.includes('extension')
      )).toBe(true);
      expect(errors.some(e => e.field === 'dataset')).toBe(true);

      // Test valid extensions don't generate errors
      for (const ext of validExtensions) {
        const validNode: PipelineNode = {
          ...node,
          params: { ...node.params, dataset: `test${ext}` }
        };
        
        const validErrors = validator.validateNodeParameters(validNode);
        expect(validErrors.some(e => e.message.includes('extension'))).toBe(false);
      }
    });

    it('should validate date formats and ranges', () => {
      const testCases = [
        {
          name: 'invalid date format',
          start_date: 'invalid-date',
          end_date: '2023-12-31',
          expectError: true,
          errorField: 'start_date'
        },
        {
          name: 'end date before start date',
          start_date: '2023-12-31',
          end_date: '2023-01-01',
          expectError: true,
          errorField: 'end_date'
        },
        {
          name: 'future date too far',
          start_date: '2023-01-01',
          end_date: '2030-12-31',
          expectError: true,
          errorField: 'end_date'
        },
        {
          name: 'past date too old',
          start_date: '1990-01-01',
          end_date: '2023-12-31',
          expectError: true,
          errorField: 'start_date'
        },
        {
          name: 'valid date range',
          start_date: '2023-01-01',
          end_date: '2023-12-31',
          expectError: false
        }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'date_test',
          type: 'DataLoaderNode',
          params: {
            symbol: 'BTC/USD',
            timeframe: '1h',
            dataset: 'test.csv',
            start_date: testCase.start_date,
            end_date: testCase.end_date
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.length).toBeGreaterThan(0);
          if (testCase.errorField) {
            expect(errors.some(e => e.field === testCase.errorField)).toBe(true);
          }
        } else {
          expect(errors.filter(e => e.field?.includes('date')).length).toBe(0);
        }
      }
    });
  });

  describe('IndicatorNode Parameter Validation', () => {
    it('should validate indicator-specific parameters', () => {
      const testCases = [
        {
          name: 'MACD missing signal_period',
          params: {
            indicator: 'MACD',
            period: 12,
            fast_period: 12,
            slow_period: 26
            // Missing signal_period
          },
          expectError: true,
          errorMessage: 'signal_period'
        },
        {
          name: 'MACD invalid signal_period',
          params: {
            indicator: 'MACD',
            period: 12,
            signal_period: -5
          },
          expectError: true,
          errorMessage: 'signal_period should be between'
        },
        {
          name: 'MACD fast_period >= slow_period',
          params: {
            indicator: 'MACD',
            fast_period: 26,
            slow_period: 12,
            signal_period: 9
          },
          expectError: true,
          errorMessage: 'fast_period must be less than slow_period'
        },
        {
          name: 'Bollinger Bands missing std_dev',
          params: {
            indicator: 'BB',
            period: 20
            // Missing std_dev
          },
          expectError: true,
          errorMessage: 'std_dev'
        },
        {
          name: 'Bollinger Bands invalid std_dev',
          params: {
            indicator: 'BB',
            period: 20,
            std_dev: 10
          },
          expectError: true,
          errorMessage: 'std_dev should be between'
        },
        {
          name: 'RSI invalid period',
          params: {
            indicator: 'RSI',
            period: 1
          },
          expectError: true,
          errorMessage: 'period should be between'
        },
        {
          name: 'Stochastic invalid periods',
          params: {
            indicator: 'STOCH',
            k_period: 0,
            d_period: 25
          },
          expectError: true
        }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'indicator_test',
          type: 'IndicatorNode',
          params: testCase.params
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.length).toBeGreaterThan(0);
          if (testCase.errorMessage) {
            expect(errors.some(e => 
              e.message.includes(testCase.errorMessage)
            )).toBe(true);
          }
        }
      }
    });

    it('should validate general period constraints', () => {
      const testCases = [
        {
          name: 'zero period',
          period: 0,
          expectError: true
        },
        {
          name: 'negative period',
          period: -10,
          expectError: true
        },
        {
          name: 'extremely large period',
          period: 2000,
          expectError: true
        },
        {
          name: 'valid period',
          period: 20,
          expectError: false
        }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'period_test',
          type: 'IndicatorNode',
          params: {
            indicator: 'SMA',
            period: testCase.period
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.message.includes('Period') || e.message.includes('period')
          )).toBe(true);
        }
      }
    });
  });

  describe('CrossoverSignalNode Parameter Validation', () => {
    it('should validate period relationships', () => {
      const node: PipelineNode = {
        id: 'invalid_crossover',
        type: 'CrossoverSignalNode',
        params: {
          fast_period: 50,
          slow_period: 20  // Should be greater than fast_period
        }
      };

      const errors = validator.validateNodeParameters(node);
      
      expect(errors.some(e => 
        e.message.includes('fast_period must be less than slow_period')
      )).toBe(true);
      expect(errors.some(e => e.field === 'slow_period')).toBe(true);
    });

    it('should validate threshold relationships', () => {
      const node: PipelineNode = {
        id: 'invalid_thresholds',
        type: 'CrossoverSignalNode',
        params: {
          fast_period: 10,
          slow_period: 20,
          buy_threshold: 0.5,
          sell_threshold: 1.0  // Should be less than buy_threshold
        }
      };

      const errors = validator.validateNodeParameters(node);
      
      expect(errors.some(e => 
        e.message.includes('buy_threshold should be greater than sell_threshold')
      )).toBe(true);
    });

    it('should validate column name format', () => {
      const testCases = [
        {
          name: 'invalid signal column name',
          signal_column: '123invalid',  // Cannot start with number
          expectError: true
        },
        {
          name: 'valid signal column name',
          signal_column: 'my_signal_123',
          expectError: false
        }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'column_test',
          type: 'CrossoverSignalNode',
          params: {
            fast_period: 10,
            slow_period: 20,
            signal_column: testCase.signal_column
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.message.includes('start with a letter')
          )).toBe(true);
        }
      }
    });

    it('should validate confirmation periods', () => {
      const testCases = [
        { confirmation_periods: 0, expectError: true },
        { confirmation_periods: 11, expectError: true },
        { confirmation_periods: 5, expectError: false }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'confirmation_test',
          type: 'CrossoverSignalNode',
          params: {
            fast_period: 10,
            slow_period: 20,
            confirmation_periods: testCase.confirmation_periods
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.message.includes('confirmation_periods')
          )).toBe(true);
        }
      }
    });
  });

  describe('BacktestNode Parameter Validation', () => {
    it('should validate initial capital', () => {
      const testCases = [
        {
          name: 'negative capital',
          initial_capital: -1000,
          expectError: true,
          errorMessage: 'greater than 0'
        },
        {
          name: 'zero capital',
          initial_capital: 0,
          expectError: true,
          errorMessage: 'greater than 0'
        },
        {
          name: 'very small capital',
          initial_capital: 500,
          expectError: true,
          errorMessage: 'at least 1000'
        },
        {
          name: 'valid capital',
          initial_capital: 10000,
          expectError: false
        }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'capital_test',
          type: 'BacktestNode',
          params: {
            initial_capital: testCase.initial_capital
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.message.includes(testCase.errorMessage)
          )).toBe(true);
        }
      }
    });

    it('should validate commission and slippage rates', () => {
      const testCases = [
        {
          name: 'negative commission',
          params: { initial_capital: 10000, commission: -0.001 },
          expectError: true,
          errorMessage: 'commission cannot be negative'
        },
        {
          name: 'excessive commission',
          params: { initial_capital: 10000, commission: 0.2 },
          expectError: true,
          errorMessage: 'commission rate above'
        },
        {
          name: 'negative slippage',
          params: { initial_capital: 10000, slippage: -0.001 },
          expectError: true,
          errorMessage: 'slippage cannot be negative'
        },
        {
          name: 'excessive slippage',
          params: { initial_capital: 10000, slippage: 0.1 },
          expectError: true,
          errorMessage: 'slippage rate above'
        },
        {
          name: 'valid rates',
          params: { initial_capital: 10000, commission: 0.001, slippage: 0.001 },
          expectError: false
        }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'rates_test',
          type: 'BacktestNode',
          params: testCase.params
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.message.includes(testCase.errorMessage)
          )).toBe(true);
        } else {
          expect(errors.filter(e => 
            e.message.includes('commission') || e.message.includes('slippage')
          ).length).toBe(0);
        }
      }
    });

    it('should validate position size', () => {
      const testCases = [
        {
          name: 'zero position size',
          position_size: 0,
          expectError: true
        },
        {
          name: 'negative position size',
          position_size: -0.5,
          expectError: true
        },
        {
          name: 'position size over 100%',
          position_size: 1.5,
          expectError: true
        },
        {
          name: 'valid position size',
          position_size: 0.8,
          expectError: false
        }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'position_test',
          type: 'BacktestNode',
          params: {
            initial_capital: 10000,
            position_size: testCase.position_size
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.message.includes('position_size')
          )).toBe(true);
        }
      }
    });
  });

  describe('FeatureGeneratorNode Parameter Validation', () => {
    it('should validate features array', () => {
      const testCases = [
        {
          name: 'empty string in features',
          features: ['sma_10', '', 'rsi_14'],
          expectError: true
        },
        {
          name: 'non-string in features',
          features: ['sma_10', 123, 'rsi_14'],
          expectError: true
        },
        {
          name: 'valid features array',
          features: ['sma_10', 'ema_20', 'rsi_14'],
          expectError: false
        }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'features_test',
          type: 'FeatureGeneratorNode',
          params: {
            features: testCase.features
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.field?.startsWith('features[')
          )).toBe(true);
        }
      }
    });

    it('should validate window size', () => {
      const testCases = [
        { window_size: 0, expectError: true },
        { window_size: 1500, expectError: true },
        { window_size: 50, expectError: false }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'window_test',
          type: 'FeatureGeneratorNode',
          params: {
            features: ['sma_10'],
            window_size: testCase.window_size
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.field === 'window_size'
          )).toBe(true);
        }
      }
    });
  });

  describe('LabelingNode Parameter Validation', () => {
    it('should validate target column name format', () => {
      const testCases = [
        {
          name: 'invalid target column name',
          target_column: '123invalid',
          expectError: true
        },
        {
          name: 'valid target column name',
          target_column: 'target_return',
          expectError: false
        }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'target_test',
          type: 'LabelingNode',
          params: {
            target_column: testCase.target_column,
            lookahead_periods: 5
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.message.includes('start with a letter')
          )).toBe(true);
        }
      }
    });

    it('should validate lookahead periods', () => {
      const testCases = [
        { lookahead_periods: 0, expectError: true },
        { lookahead_periods: 150, expectError: true },
        { lookahead_periods: 10, expectError: false }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'lookahead_test',
          type: 'LabelingNode',
          params: {
            target_column: 'close',
            lookahead_periods: testCase.lookahead_periods
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.field === 'lookahead_periods'
          )).toBe(true);
        }
      }
    });

    it('should validate threshold', () => {
      const testCases = [
        { threshold: 0, expectError: true },
        { threshold: -0.5, expectError: true },
        { threshold: 0.05, expectError: false }
      ];

      for (const testCase of testCases) {
        const node: PipelineNode = {
          id: 'threshold_test',
          type: 'LabelingNode',
          params: {
            target_column: 'close',
            lookahead_periods: 5,
            threshold: testCase.threshold
          }
        };

        const errors = validator.validateNodeParameters(node);
        
        if (testCase.expectError) {
          expect(errors.some(e => 
            e.field === 'threshold'
          )).toBe(true);
        }
      }
    });
  });
});