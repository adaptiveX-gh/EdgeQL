// Local type shim to satisfy TS when resolving compiler subpath imports during dev
declare module '@edgeql/compiler/registry/CustomNodeRegistry.js' {
  export interface CustomNodeDefinition {
    id: string;
    name: string;
    description?: string;
    version: string;
    runtime: 'javascript';
    entryPoint: string;
    inputSchema: any;
    outputSchema: any;
    requiredParams: string[];
    optionalParams: string[];
    paramSchema?: Record<string, any>;
    metadata: { author?: string; tags?: string[]; category?: string };
  }
  export class CustomNodeRegistry {
    getNode(id: string): CustomNodeDefinition | undefined;
    isCustomNode(type: string): boolean;
    getNodeSchemas(type: string): { inputSchema: any; outputSchema: any } | undefined;
    validateNodeReferences(nodeTypes: string[]): { valid: boolean; missingNodes: string[] };
    getNodeTypes(): string[];
  }
  export function getCustomNodeRegistry(config?: any): CustomNodeRegistry;
}
