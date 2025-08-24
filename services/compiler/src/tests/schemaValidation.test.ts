import { describe, it, expect } from 'vitest';
import { 
  validateNodeParameters, 
  getParameterSchema,
  PipelineDSLSchema 
} from '../schemas/dslSchema.js';
import { 
  validatePipelineDataFlow,
  validateNodeIOCompatibility,
  getNodeOutputSchema 
} from '../schemas/nodeSchemas.js';

describe('Schema Validation Tests', () => {
  describe('Parameter Schema Validation', () => {
    it('should validate DataLoaderNode parameters', () => {
      const validParams = {
        symbol: 'BTC/USD',
        timeframe: '1h',
        dataset: 'test.csv'
      };
      
      const result = validateNodeParameters('DataLoaderNode', validParams);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid DataLoaderNode parameters', () => {
      const invalidParams = {
        symbol: '',
        timeframe: '2h', // Invalid timeframe
        dataset: 'test.csv'
      };
      
      const result = validateNodeParameters('DataLoaderNode', invalidParams);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should validate IndicatorNode parameters', () => {
      const validParams = {
        indicator: 'SMA',
        period: 20,
        column: 'close'
      };
      
      const result = validateNodeParameters('IndicatorNode', validParams);
      expect(result.success).toBe(true);
    });
    
    it('should reject negative periods for IndicatorNode', () => {
      const invalidParams = {
        indicator: 'SMA',
        period: -5
      };
      
      const result = validateNodeParameters('IndicatorNode', invalidParams);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('positive'))).toBe(true);
    });
    
    it('should validate BacktestNode parameters', () => {
      const validParams = {
        initial_capital: 10000,
        commission: 0.001,
        slippage: 0.0005
      };
      
      const result = validateNodeParameters('BacktestNode', validParams);
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid BacktestNode parameters', () => {
      const invalidParams = {
        initial_capital: -1000, // Negative capital
        commission: 1.5, // > 100%
        position_size: 2.0 // > 100%
      };
      
      const result = validateNodeParameters('BacktestNode', invalidParams);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Pipeline DSL Schema Validation', () => {
    it('should validate correct pipeline structure', () => {
      const validPipeline = {
        pipeline: [
          {
            id: 'test_node',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'test.csv'
            }
          }
        ]
      };
      
      const result = PipelineDSLSchema.safeParse(validPipeline);
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid node IDs', () => {
      const invalidPipeline = {
        pipeline: [
          {
            id: '123invalid', // Cannot start with number
            type: 'DataLoaderNode',
            params: {}
          }
        ]
      };
      
      const result = PipelineDSLSchema.safeParse(invalidPipeline);
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('start with letter');
    });
    
    it('should reject empty pipeline', () => {
      const emptyPipeline = {
        pipeline: []
      };
      
      const result = PipelineDSLSchema.safeParse(emptyPipeline);
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message).toContain('at least one node');
    });
  });
  
  describe('Node I/O Schema Validation', () => {
    it('should generate correct output schema for DataLoaderNode', () => {
      const schema = getNodeOutputSchema('DataLoaderNode');
      
      expect(schema.type).toBe('dataframe');
      expect(schema.columns).toContain('timestamp');
      expect(schema.columns).toContain('close');
      expect(schema.required_columns).toContain('timestamp');
      expect(schema.required_columns).toContain('close');
    });
    
    it('should generate correct output schema for IndicatorNode', () => {
      const params = { indicator: 'SMA', period: 20 };
      const schema = getNodeOutputSchema('IndicatorNode', params);
      
      expect(schema.type).toBe('dataframe');
      expect(schema.indicator_column).toBe('sma');
      expect(schema.columns).toContain('sma');
    });
    
    it('should generate correct output schema for CrossoverSignalNode', () => {
      const params = { buy_condition: 'fast > slow', sell_condition: 'fast < slow' };
      const schema = getNodeOutputSchema('CrossoverSignalNode', params);
      
      expect(schema.type).toBe('signals');
      expect(schema.signal_columns).toContain('signal');
      expect(schema.timestamp_column).toBe('timestamp');
    });
    
    it('should generate correct output schema for BacktestNode', () => {
      const schema = getNodeOutputSchema('BacktestNode');
      
      expect(schema.type).toBe('backtest_results');
      expect(schema.metrics).toContain('total_return');
      expect(schema.metrics).toContain('sharpe_ratio');
      expect(schema.trade_log).toBe(true);
    });
  });
  
  describe('Pipeline Data Flow Validation', () => {
    it('should validate correct data flow', () => {
      const nodes = [
        {
          id: 'data_source',
          type: 'DataLoaderNode',
          params: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
        },
        {
          id: 'indicator',
          type: 'IndicatorNode',
          depends_on: ['data_source'],
          params: { indicator: 'SMA', period: 20 }
        },
        {
          id: 'backtest',
          type: 'BacktestNode',
          depends_on: ['indicator', 'data_source'],
          params: { initial_capital: 10000 }
        }
      ];
      
      const result = validatePipelineDataFlow(nodes);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect incompatible data flow', () => {
      const nodes = [
        {
          id: 'data_source',
          type: 'DataLoaderNode',
          params: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
        },
        {
          id: 'backtest',
          type: 'BacktestNode',
          depends_on: ['data_source'], // Missing signals input
          params: { initial_capital: 10000 }
        }
      ];
      
      const result = validatePipelineDataFlow(nodes);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should detect nodes with inappropriate dependencies', () => {
      const nodes = [
        {
          id: 'data_source_1',
          type: 'DataLoaderNode',
          params: { symbol: 'BTC/USD', timeframe: '1h', dataset: 'test.csv' }
        },
        {
          id: 'data_source_2',
          type: 'DataLoaderNode',
          depends_on: ['data_source_1'], // DataLoader should not have dependencies
          params: { symbol: 'ETH/USD', timeframe: '1h', dataset: 'test2.csv' }
        }
      ];
      
      const result = validatePipelineDataFlow(nodes);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('should not have dependencies'))).toBe(true);
    });
  });
  
  describe('Node I/O Compatibility', () => {
    it('should validate compatible inputs', () => {
      const outputs = new Map();
      outputs.set('data_source', {
        type: 'dataframe',
        columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume']
      });
      
      const result = validateNodeIOCompatibility(
        'IndicatorNode',
        ['data_source'],
        outputs
      );
      
      expect(result.compatible).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect incompatible inputs', () => {
      const outputs = new Map();
      outputs.set('signals_source', {
        type: 'signals',
        signal_columns: ['signal']
      });
      
      const result = validateNodeIOCompatibility(
        'IndicatorNode', // Expects dataframe input
        ['signals_source'], // Provides signals output
        outputs
      );
      
      expect(result.compatible).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});