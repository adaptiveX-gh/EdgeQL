import { describe, it, expect, beforeEach } from 'vitest';
import { TypeCompatibilityValidator } from '../validators/typeCompatibilityValidator.js';
import { PipelineNode } from '../types.js';

describe('TypeCompatibilityValidator', () => {
  let validator: TypeCompatibilityValidator;
  
  beforeEach(() => {
    validator = new TypeCompatibilityValidator();
  });

  describe('DataLoaderNode Validation', () => {
    it('should reject DataLoaderNode with dependencies', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'invalid_loader',
          type: 'DataLoaderNode',
          depends_on: ['some_dependency'],
          params: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
        }
      ];

      const nodeOutputs = new Map([
        ['some_dependency', { type: 'dataframe' }]
      ]);

      const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('should not have input dependencies');
      expect(errors[0].node).toBe('invalid_loader');
    });

    it('should accept DataLoaderNode without dependencies', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'valid_loader',
          type: 'DataLoaderNode',
          params: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
        }
      ];

      const nodeOutputs = new Map();
      const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
      
      expect(errors).toHaveLength(0);
    });
  });

  describe('IndicatorNode Validation', () => {
    it('should require exactly one dataframe input', () => {
      const testCases = [
        {
          name: 'no dependencies',
          dependencies: [],
          shouldFail: true
        },
        {
          name: 'multiple dependencies',
          dependencies: ['dep1', 'dep2'],
          shouldFail: true
        },
        {
          name: 'single dataframe dependency',
          dependencies: ['dep1'],
          shouldFail: false
        }
      ];

      for (const testCase of testCases) {
        const nodes: PipelineNode[] = [
          {
            id: 'indicator_node',
            type: 'IndicatorNode',
            depends_on: testCase.dependencies,
            params: { indicator: 'SMA', period: 10 }
          }
        ];

        const nodeOutputs = new Map([
          ['dep1', { type: 'dataframe', columns: ['timestamp', 'open', 'high', 'low', 'close'] }],
          ['dep2', { type: 'dataframe', columns: ['timestamp', 'open', 'high', 'low', 'close'] }]
        ]);

        const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
        
        if (testCase.shouldFail) {
          expect(errors.length).toBeGreaterThan(0);
        } else {
          expect(errors).toHaveLength(0);
        }
      }
    });

    it('should validate input has required OHLC columns', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'indicator_node',
          type: 'IndicatorNode',
          depends_on: ['incomplete_data'],
          params: { indicator: 'SMA', period: 10 }
        }
      ];

      const nodeOutputs = new Map([
        ['incomplete_data', { 
          type: 'dataframe', 
          columns: ['timestamp', 'volume'] // Missing OHLC columns
        }]
      ]);

      const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('missing');
      expect(errors[0].message).toContain('open, high, low, close');
    });

    it('should reject non-dataframe input', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'indicator_node',
          type: 'IndicatorNode',
          depends_on: ['wrong_type'],
          params: { indicator: 'SMA', period: 10 }
        }
      ];

      const nodeOutputs = new Map([
        ['wrong_type', { type: 'backtest_results' }]
      ]);

      const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('expects dataframe input');
      expect(errors[0].message).toContain('backtest_results');
    });
  });

  describe('CrossoverSignalNode Validation', () => {
    it('should require at least 2 dataframe inputs', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'crossover_node',
          type: 'CrossoverSignalNode',
          depends_on: ['single_dep'],
          params: { fast_period: 10, slow_period: 20 }
        }
      ];

      const nodeOutputs = new Map([
        ['single_dep', { 
          type: 'dataframe',
          indicator_column: 'sma_10'
        }]
      ]);

      const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('at least 2');
    });

    it('should validate inputs have indicator columns', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'crossover_node',
          type: 'CrossoverSignalNode',
          depends_on: ['no_indicators1', 'no_indicators2'],
          params: { fast_period: 10, slow_period: 20 }
        }
      ];

      const nodeOutputs = new Map([
        ['no_indicators1', { 
          type: 'dataframe',
          columns: ['timestamp', 'open', 'high', 'low', 'close']
        }],
        ['no_indicators2', { 
          type: 'dataframe',
          columns: ['timestamp', 'open', 'high', 'low', 'close']
        }]
      ]);

      const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
      
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toContain('indicator columns');
      expect(errors[1].message).toContain('indicator columns');
    });

    it('should accept inputs with indicator columns', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'crossover_node',
          type: 'CrossoverSignalNode',
          depends_on: ['fast_ma', 'slow_ma'],
          params: { fast_period: 10, slow_period: 20 }
        }
      ];

      const nodeOutputs = new Map([
        ['fast_ma', { 
          type: 'dataframe',
          columns: ['timestamp', 'open', 'high', 'low', 'close', 'sma_10'],
          indicator_column: 'sma_10'
        }],
        ['slow_ma', { 
          type: 'dataframe',
          columns: ['timestamp', 'open', 'high', 'low', 'close', 'sma_20'],
          indicator_column: 'sma_20'
        }]
      ]);

      const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
      
      expect(errors).toHaveLength(0);
    });
  });

  describe('BacktestNode Validation', () => {
    it('should validate single input mode (signals + data combined)', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'backtest_node',
          type: 'BacktestNode',
          depends_on: ['signals_and_data'],
          params: { initial_capital: 10000 }
        }
      ];

      const nodeOutputs = new Map([
        ['signals_and_data', { 
          type: 'dataframe',
          columns: ['timestamp', 'open', 'high', 'low', 'close', 'signal'],
          signal_column: 'signal'
        }]
      ]);

      const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
      
      expect(errors).toHaveLength(0);
    });

    it('should reject single input without signal column', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'backtest_node',
          type: 'BacktestNode',
          depends_on: ['no_signals'],
          params: { initial_capital: 10000 }
        }
      ];

      const nodeOutputs = new Map([
        ['no_signals', { 
          type: 'dataframe',
          columns: ['timestamp', 'open', 'high', 'low', 'close']
        }]
      ]);

      const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
      
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('signal data');
    });

    it('should validate two input mode (separate signals and data)', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'backtest_node',
          type: 'BacktestNode',
          depends_on: ['signals', 'price_data'],
          params: { initial_capital: 10000 }
        }
      ];

      const nodeOutputs = new Map([
        ['signals', { 
          type: 'dataframe',
          columns: ['timestamp', 'signal'],
          signal_column: 'signal'
        }],
        ['price_data', { 
          type: 'dataframe',
          columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume']
        }]
      ]);

      const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
      
      expect(errors).toHaveLength(0);
    });

    it('should reject incorrect number of inputs', () => {
      const testCases = [
        {
          name: 'no inputs',
          dependencies: [],
        },
        {
          name: 'three inputs',
          dependencies: ['dep1', 'dep2', 'dep3'],
        }
      ];

      for (const testCase of testCases) {
        const nodes: PipelineNode[] = [
          {
            id: 'backtest_node',
            type: 'BacktestNode',
            depends_on: testCase.dependencies,
            params: { initial_capital: 10000 }
          }
        ];

        const nodeOutputs = new Map([
          ['dep1', { type: 'dataframe' }],
          ['dep2', { type: 'dataframe' }],
          ['dep3', { type: 'dataframe' }]
        ]);

        const errors = validator.validateTypeCompatibility(nodes, nodeOutputs);
        
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('either 1 input');
      }
    });
  });

  describe('Compatibility Report', () => {
    it('should generate detailed compatibility report', () => {
      const nodes: PipelineNode[] = [
        {
          id: 'data_loader',
          type: 'DataLoaderNode',
          params: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
        },
        {
          id: 'indicator_node',
          type: 'IndicatorNode',
          depends_on: ['data_loader'],
          params: { indicator: 'SMA', period: 10 }
        },
        {
          id: 'incompatible_node',
          type: 'IndicatorNode',
          depends_on: ['non_existent'],
          params: { indicator: 'EMA', period: 20 }
        }
      ];

      const nodeOutputs = new Map([
        ['data_loader', { 
          type: 'dataframe',
          columns: ['timestamp', 'open', 'high', 'low', 'close']
        }]
      ]);

      const report = validator.getCompatibilityReport(nodes, nodeOutputs);
      
      expect(report.compatible).toBe(false);
      expect(report.details).toHaveLength(3);
      
      // Check data_loader (should be compatible)
      const dataLoaderDetails = report.details.find(d => d.nodeId === 'data_loader');
      expect(dataLoaderDetails?.dependencies).toHaveLength(0);
      
      // Check indicator_node (should be compatible)
      const indicatorDetails = report.details.find(d => d.nodeId === 'indicator_node');
      expect(indicatorDetails?.dependencies).toHaveLength(1);
      expect(indicatorDetails?.dependencies[0].compatible).toBe(true);
      
      // Check incompatible_node (should have issues)
      const incompatibleDetails = report.details.find(d => d.nodeId === 'incompatible_node');
      expect(incompatibleDetails?.dependencies).toHaveLength(1);
      expect(incompatibleDetails?.dependencies[0].compatible).toBe(false);
      expect(incompatibleDetails?.dependencies[0].issues.length).toBeGreaterThan(0);
    });
  });
});