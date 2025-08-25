import { z } from 'zod';
import { readdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';

// Schema for custom node definition manifest files
const CustomNodeDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  runtime: z.literal('javascript'),
  entryPoint: z.string(),
  inputSchema: z.record(z.any()),
  outputSchema: z.record(z.any()),
  requiredParams: z.array(z.string()).default([]),
  optionalParams: z.array(z.string()).default([]),
  paramSchema: z.record(z.any()).optional(),
  metadata: z.object({
    author: z.string().optional(),
    tags: z.array(z.string()).default([]),
    category: z.string().optional()
  }).default({})
});

export type CustomNodeDefinition = z.infer<typeof CustomNodeDefinitionSchema>;

export interface CustomNodeRegistryConfig {
  customNodesPath?: string;
  enableAutoDiscovery?: boolean;
}

export class CustomNodeRegistry {
  private nodes = new Map<string, CustomNodeDefinition>();
  private customNodesPath: string;
  private enableAutoDiscovery: boolean;
  
  constructor(config: CustomNodeRegistryConfig = {}) {
    this.customNodesPath = config.customNodesPath || this.getDefaultNodesPath();
    this.enableAutoDiscovery = config.enableAutoDiscovery ?? true;
    
    if (this.enableAutoDiscovery) {
      this.discoverNodes();
    }
  }
  
  private getDefaultNodesPath(): string {
    // Find the project root and construct default custom nodes path
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.workspaces) {
            return path.join(currentDir, 'nodes', 'js');
          }
        } catch (e) {
          // Continue looking
        }
      }
      currentDir = path.dirname(currentDir);
    }
    
    // Fallback to relative path
    return path.join(process.cwd(), 'nodes', 'js');
  }
  
  /**
   * Discover custom nodes from the filesystem
   * Looks for node.json manifest files or directories with package.json
   */
  public discoverNodes(): void {
    this.nodes.clear();
    
    if (!existsSync(this.customNodesPath)) {
      return;
    }
    
    try {
      const entries = readdirSync(this.customNodesPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          this.discoverNodeInDirectory(path.join(this.customNodesPath, entry.name));
        } else if (entry.name.endsWith('.node.json')) {
          this.loadNodeDefinition(path.join(this.customNodesPath, entry.name));
        }
      }
    } catch (error) {
      console.warn(`Failed to discover custom nodes in ${this.customNodesPath}:`, error);
    }
  }
  
  private discoverNodeInDirectory(dirPath: string): void {
    const manifestPath = path.join(dirPath, 'node.json');
    if (existsSync(manifestPath)) {
      this.loadNodeDefinition(manifestPath);
      return;
    }
    
    // Check for package.json with edgeql node configuration
    const packageJsonPath = path.join(dirPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.edgeql?.nodeDefinition) {
          this.loadNodeFromPackageJson(dirPath, packageJson.edgeql.nodeDefinition);
        }
      } catch (error) {
        console.warn(`Failed to parse package.json in ${dirPath}:`, error);
      }
    }
  }
  
  private loadNodeDefinition(manifestPath: string): void {
    try {
      const content = readFileSync(manifestPath, 'utf-8');
      const rawDefinition = JSON.parse(content);
      const definition = CustomNodeDefinitionSchema.parse(rawDefinition);
      
      // Resolve entry point relative to manifest location
      if (!path.isAbsolute(definition.entryPoint)) {
        definition.entryPoint = path.resolve(path.dirname(manifestPath), definition.entryPoint);
      }
      
      this.registerNode(definition);
    } catch (error) {
      console.warn(`Failed to load custom node definition from ${manifestPath}:`, error);
    }
  }
  
  private loadNodeFromPackageJson(dirPath: string, nodeConfig: any): void {
    try {
      const definition = CustomNodeDefinitionSchema.parse({
        ...nodeConfig,
        entryPoint: path.resolve(dirPath, nodeConfig.entryPoint || 'index.js')
      });
      
      this.registerNode(definition);
    } catch (error) {
      console.warn(`Failed to load custom node from package.json in ${dirPath}:`, error);
    }
  }
  
  /**
   * Register a custom node definition
   */
  public registerNode(definition: CustomNodeDefinition): void {
    // Validate that the entry point exists
    if (!existsSync(definition.entryPoint)) {
      throw new Error(`Custom node entry point not found: ${definition.entryPoint}`);
    }
    
    this.nodes.set(definition.id, definition);
  }
  
  /**
   * Get a custom node definition by ID
   */
  public getNode(nodeId: string): CustomNodeDefinition | undefined {
    return this.nodes.get(nodeId);
  }
  
  /**
   * Check if a node type is a registered custom node
   */
  public isCustomNode(nodeType: string): boolean {
    return this.nodes.has(nodeType);
  }
  
  /**
   * Get all registered custom nodes
   */
  public getAllNodes(): CustomNodeDefinition[] {
    return Array.from(this.nodes.values());
  }
  
  /**
   * Get all node type names
   */
  public getNodeTypes(): string[] {
    return Array.from(this.nodes.keys());
  }
  
  /**
   * Validate that all referenced custom node types exist
   */
  public validateNodeReferences(nodeTypes: string[]): { valid: boolean; missingNodes: string[] } {
    const missingNodes: string[] = [];
    
    for (const nodeType of nodeTypes) {
      if (!this.isBuiltinNode(nodeType) && !this.isCustomNode(nodeType)) {
        missingNodes.push(nodeType);
      }
    }
    
    return {
      valid: missingNodes.length === 0,
      missingNodes
    };
  }
  
  private isBuiltinNode(nodeType: string): boolean {
    const builtinNodes = [
      'DataLoaderNode',
      'IndicatorNode', 
      'CrossoverSignalNode',
      'BacktestNode'
    ];
    return builtinNodes.includes(nodeType);
  }
  
  /**
   * Get input/output schemas for custom node validation
   */
  public getNodeSchemas(nodeType: string): { inputSchema: any; outputSchema: any } | undefined {
    const definition = this.getNode(nodeType);
    if (!definition) {
      return undefined;
    }
    
    return {
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema
    };
  }
  
  /**
   * Refresh the registry by re-discovering nodes
   */
  public refresh(): void {
    if (this.enableAutoDiscovery) {
      this.discoverNodes();
    }
  }
  
  /**
   * Get registry statistics
   */
  public getStats(): {
    totalNodes: number;
    nodesByCategory: Record<string, number>;
    path: string;
  } {
    const nodesByCategory: Record<string, number> = {};
    
    for (const node of this.nodes.values()) {
      const category = node.metadata.category || 'uncategorized';
      nodesByCategory[category] = (nodesByCategory[category] || 0) + 1;
    }
    
    return {
      totalNodes: this.nodes.size,
      nodesByCategory,
      path: this.customNodesPath
    };
  }
}

// Singleton instance for global use
let globalRegistry: CustomNodeRegistry | undefined;

export function getCustomNodeRegistry(config?: CustomNodeRegistryConfig): CustomNodeRegistry {
  if (!globalRegistry) {
    globalRegistry = new CustomNodeRegistry(config);
  }
  return globalRegistry;
}

export function resetCustomNodeRegistry(): void {
  globalRegistry = undefined;
}