import { CustomNode } from '../types/index.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class NodeValidator {
  /**
   * Validates JavaScript node code for basic structure and security
   */
  static validateJavaScriptNode(code: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if code is provided
    if (!code || code.trim().length === 0) {
      errors.push('Node code cannot be empty');
      return { isValid: false, errors, warnings };
    }

    // Check for required run function
    if (!this.hasRunFunction(code)) {
      errors.push('Node code must export a "run" function');
    }

    // Check for dangerous patterns
    const dangerousPatterns = this.checkForDangerousPatterns(code);
    if (dangerousPatterns.length > 0) {
      errors.push(...dangerousPatterns);
    }

    // Check for suspicious patterns
    const suspiciousPatterns = this.checkForSuspiciousPatterns(code);
    if (suspiciousPatterns.length > 0) {
      warnings.push(...suspiciousPatterns);
    }

    // Check for basic syntax validity
    const syntaxCheck = this.checkSyntax(code);
    if (!syntaxCheck.isValid) {
      errors.push(...syntaxCheck.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates complete node data before creation/update
   */
  static validateNodeData(nodeData: Partial<CustomNode>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!nodeData.name || nodeData.name.trim().length === 0) {
      errors.push('Node name is required');
    } else if (nodeData.name.length > 100) {
      errors.push('Node name must be 100 characters or less');
    }

    if (!nodeData.language) {
      errors.push('Node language is required');
    } else if (!['javascript', 'python', 'wasm'].includes(nodeData.language)) {
      errors.push('Node language must be one of: javascript, python, wasm');
    }

    if (!nodeData.code) {
      errors.push('Node code is required');
    }

    // Optional fields validation
    if (nodeData.description && nodeData.description.length > 500) {
      warnings.push('Node description is quite long (>500 characters)');
    }

    if (nodeData.author && nodeData.author.length > 100) {
      errors.push('Author name must be 100 characters or less');
    }

    if (nodeData.tags) {
      if (!Array.isArray(nodeData.tags)) {
        errors.push('Tags must be an array');
      } else {
        if (nodeData.tags.length > 10) {
          warnings.push('Node has many tags (>10), consider reducing for better organization');
        }
        
        const invalidTags = nodeData.tags.filter(tag => 
          typeof tag !== 'string' || tag.length === 0 || tag.length > 50
        );
        if (invalidTags.length > 0) {
          errors.push('All tags must be non-empty strings with max 50 characters');
        }
      }
    }

    // JavaScript-specific validation
    if (nodeData.language === 'javascript' && nodeData.code) {
      const codeValidation = this.validateJavaScriptNode(nodeData.code);
      errors.push(...codeValidation.errors);
      warnings.push(...codeValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static hasRunFunction(code: string): boolean {
    // Check for various run function export patterns
    const patterns = [
      /export\s+function\s+run\s*\(/,
      /exports\.run\s*=/,
      /module\.exports\.run\s*=/,
      /export\s*{\s*run\s*}/,
      /export\s+const\s+run\s*=/,
      /export\s+let\s+run\s*=/,
    ];

    return patterns.some(pattern => pattern.test(code));
  }

  private static checkForDangerousPatterns(code: string): string[] {
    const errors: string[] = [];
    
    const dangerousPatterns = [
      { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/, message: 'Direct filesystem access is not allowed' },
      { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/, message: 'Child process execution is not allowed' },
      { pattern: /require\s*\(\s*['"`]os['"`]\s*\)/, message: 'OS module access is restricted' },
      { pattern: /require\s*\(\s*['"`]net['"`]\s*\)/, message: 'Network access is restricted' },
      { pattern: /require\s*\(\s*['"`]http['"`]\s*\)/, message: 'HTTP module access is restricted' },
      { pattern: /require\s*\(\s*['"`]https['"`]\s*\)/, message: 'HTTPS module access is restricted' },
      { pattern: /eval\s*\(/, message: 'eval() usage is not allowed for security reasons' },
      { pattern: /Function\s*\(/, message: 'Function constructor usage is not allowed' },
      { pattern: /process\.exit/, message: 'process.exit() is not allowed' },
      { pattern: /global\./, message: 'Global object modification is not allowed' },
      { pattern: /globalThis\./, message: 'globalThis modification is not allowed' },
      { pattern: /__dirname/, message: '__dirname access is restricted in sandbox environment' },
      { pattern: /__filename/, message: '__filename access is restricted in sandbox environment' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(message);
      }
    }

    return errors;
  }

  private static checkForSuspiciousPatterns(code: string): string[] {
    const warnings: string[] = [];
    
    const suspiciousPatterns = [
      { pattern: /console\.log/, message: 'Consider using proper logging instead of console.log' },
      { pattern: /setTimeout/, message: 'Timeout usage detected - ensure proper cleanup' },
      { pattern: /setInterval/, message: 'Interval usage detected - ensure proper cleanup' },
      { pattern: /while\s*\(\s*true\s*\)/, message: 'Infinite loop detected - ensure proper exit conditions' },
      { pattern: /for\s*\(\s*;\s*;\s*\)/, message: 'Infinite loop detected - ensure proper exit conditions' },
    ];

    for (const { pattern, message } of suspiciousPatterns) {
      if (pattern.test(code)) {
        warnings.push(message);
      }
    }

    return warnings;
  }

  private static checkSyntax(code: string): { isValid: boolean; errors: string[] } {
    try {
      // For ES6 modules with export statements, we need a different approach
      // Remove export statements for basic syntax validation
      const codeWithoutExports = code
        .replace(/export\s+/g, '')
        .replace(/import\s+.*?from\s+['"][^'"]*['"];?/g, '');
      
      new Function(codeWithoutExports);
      return { isValid: true, errors: [] };
    } catch (error) {
      return { 
        isValid: false, 
        errors: [`Syntax error: ${error instanceof Error ? error.message : 'Invalid JavaScript syntax'}`]
      };
    }
  }

  /**
   * Validates node input/output schema structure
   */
  static validateSchema(schema: any, schemaType: 'input' | 'output'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!schema) {
      warnings.push(`${schemaType} schema is not defined`);
      return { isValid: true, errors, warnings };
    }

    // Basic schema structure validation
    if (typeof schema !== 'object') {
      errors.push(`${schemaType} schema must be an object`);
      return { isValid: false, errors, warnings };
    }

    // Check for required type field
    if (!schema.type) {
      warnings.push(`${schemaType} schema should specify a type`);
    }

    return { isValid: true, errors, warnings };
  }
}