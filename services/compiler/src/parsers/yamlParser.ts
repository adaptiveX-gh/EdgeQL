import yaml from 'yaml';
import { PipelineDSL, ValidationError } from '../types.js';

export class YAMLParser {
  parse(dslContent: string): { pipeline?: PipelineDSL; errors?: ValidationError[] } {
    const errors: ValidationError[] = [];
    
    try {
      // Parse YAML content
      const parsed = yaml.parse(dslContent);
      
      // Basic structure validation
      if (!parsed || typeof parsed !== 'object') {
        errors.push({
          type: 'syntax',
          message: 'Invalid DSL format: Expected object at root level'
        });
        return { errors };
      }
      
      if (!parsed.pipeline || !Array.isArray(parsed.pipeline)) {
        errors.push({
          type: 'syntax',
          message: 'Invalid DSL format: Missing or invalid pipeline array'
        });
        return { errors };
      }
      
      // Validate node structure
      for (let i = 0; i < parsed.pipeline.length; i++) {
        const node = parsed.pipeline[i];
        const nodeIndex = i + 1;
        
        if (!node.id || typeof node.id !== 'string') {
          errors.push({
            type: 'syntax',
            message: `Node ${nodeIndex}: Missing or invalid 'id' field`,
            node: node.id || `node_${nodeIndex}`
          });
        }
        
        if (!node.type || typeof node.type !== 'string') {
          errors.push({
            type: 'syntax',
            message: `Node ${nodeIndex}: Missing or invalid 'type' field`,
            node: node.id || `node_${nodeIndex}`
          });
        }
        
        if (node.depends_on && !Array.isArray(node.depends_on)) {
          errors.push({
            type: 'syntax',
            message: `Node ${nodeIndex}: 'depends_on' must be an array`,
            node: node.id || `node_${nodeIndex}`
          });
        }
        
        if (!node.params || typeof node.params !== 'object') {
          errors.push({
            type: 'syntax',
            message: `Node ${nodeIndex}: Missing or invalid 'params' object`,
            node: node.id || `node_${nodeIndex}`
          });
        }
      }
      
      if (errors.length > 0) {
        return { errors };
      }
      
      return { pipeline: parsed as PipelineDSL };
      
    } catch (yamlError: any) {
      errors.push({
        type: 'syntax',
        message: `YAML parsing error: ${yamlError.message}`,
        line: yamlError.mark?.line,
        column: yamlError.mark?.column
      });
      return { errors };
    }
  }
}