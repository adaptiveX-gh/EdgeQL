import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineValidator } from '../validators/pipelineValidator.js';
import { PipelineDSL } from '../types.js';

describe('PipelineValidator', () => {
  let validator: PipelineValidator;
  
  beforeEach(() => {
    validator = new PipelineValidator();
  });
  
  describe('valid pipeline validation', () => {
    it('should validate a correct pipeline', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'data_loader',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD',
              timeframe: '1h',
              dataset: 'sample.csv'
            }
          },
          {
            id: 'indicator',
            type: 'IndicatorNode',
            depends_on: ['data_loader'],
            params: {
              indicator: 'SMA',
              period: 10
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors).toHaveLength(0);
    });
  });
  
  describe('dependency validation', () => {
    it('should detect missing dependencies', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'indicator',
            type: 'IndicatorNode',
            depends_on: ['missing_node'],
            params: {
              indicator: 'SMA',
              period: 10
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Dependency not found: missing_node');
    });
    
    it('should detect duplicate node IDs', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'duplicate',
            type: 'DataLoaderNode',
            params: { symbol: 'BTC', timeframe: '1h', dataset: 'test.csv' }
          },
          {
            id: 'duplicate',
            type: 'IndicatorNode',
            params: { indicator: 'SMA', period: 10 }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.some(e => e.message.includes('Duplicate node ID'))).toBe(true);
    });
  });
  
  describe('node type validation', () => {
    it('should detect unknown node types', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'test',
            type: 'UnknownNode',
            params: {}
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Unknown node type: UnknownNode');
    });
  });
  
  describe('parameter validation', () => {
    it('should detect missing required parameters', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'data_loader',
            type: 'DataLoaderNode',
            params: {
              symbol: 'BTC/USD'
              // missing timeframe and dataset
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('Missing required parameter'))).toBe(true);
    });
    
    it('should validate indicator parameters', () => {
      const pipeline: PipelineDSL = {
        pipeline: [
          {
            id: 'indicator',
            type: 'IndicatorNode',
            params: {
              indicator: 'INVALID_INDICATOR',
              period: -5
            }
          }
        ]
      };
      
      const errors = validator.validate(pipeline);
      expect(errors.some(e => e.message.includes('Invalid indicator'))).toBe(true);
      expect(errors.some(e => e.message.includes('must be a positive number'))).toBe(true);
    });
  });
});