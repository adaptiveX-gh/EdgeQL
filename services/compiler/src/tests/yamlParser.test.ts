import { describe, it, expect, beforeEach } from 'vitest';
import { YAMLParser } from '../parsers/yamlParser.js';

describe('YAMLParser', () => {
  let parser: YAMLParser;
  
  beforeEach(() => {
    parser = new YAMLParser();
  });
  
  describe('valid DSL parsing', () => {
    it('should parse a simple valid pipeline', () => {
      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "sample.csv"
`;
      
      const result = parser.parse(dsl);
      
      expect(result.errors).toBeUndefined();
      expect(result.pipeline).toBeDefined();
      expect(result.pipeline!.pipeline).toHaveLength(1);
      expect(result.pipeline!.pipeline[0].id).toBe('data_loader');
      expect(result.pipeline!.pipeline[0].type).toBe('DataLoaderNode');
    });
    
    it('should parse pipeline with dependencies', () => {
      const dsl = `
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
  - id: indicator
    type: IndicatorNode
    depends_on: [data_loader]
    params:
      indicator: "SMA"
      period: 10
`;
      
      const result = parser.parse(dsl);
      
      expect(result.errors).toBeUndefined();
      expect(result.pipeline!.pipeline[1].depends_on).toEqual(['data_loader']);
    });
  });
  
  describe('invalid DSL handling', () => {
    it('should return syntax error for invalid YAML', () => {
      const dsl = `
pipeline:
  - id: test
    invalid yaml: [unclosed array
`;
      
      const result = parser.parse(dsl);
      
      expect(result.pipeline).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors![0].type).toBe('syntax');
    });
    
    it('should return error for missing pipeline array', () => {
      const dsl = `
nodes:
  - id: test
`;
      
      const result = parser.parse(dsl);
      
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('Missing or invalid pipeline array');
    });
    
    it('should return error for missing node id', () => {
      const dsl = `
pipeline:
  - type: DataLoaderNode
    params:
      symbol: "BTC/USD"
`;
      
      const result = parser.parse(dsl);
      
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('Missing or invalid \'id\' field');
    });
    
    it('should return error for invalid depends_on format', () => {
      const dsl = `
pipeline:
  - id: test
    type: TestNode
    depends_on: "not_an_array"
    params: {}
`;
      
      const result = parser.parse(dsl);
      
      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain('depends_on\' must be an array');
    });
  });
});