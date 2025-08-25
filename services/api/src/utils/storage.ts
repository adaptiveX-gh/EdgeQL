import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Pipeline, PipelineRun, PipelineVersion, CustomNode, CustomNodeVersion, ObserverAccess } from '../types/index.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PIPELINES_FILE = path.join(DATA_DIR, 'pipelines.json');
const RUNS_FILE = path.join(DATA_DIR, 'runs.json');
const VERSIONS_FILE = path.join(DATA_DIR, 'pipeline-versions.json');
const CUSTOM_NODES_DIR = path.join(DATA_DIR, 'custom-nodes');
const CUSTOM_NODES_FILE = path.join(DATA_DIR, 'custom-nodes.json');
const CUSTOM_NODE_VERSIONS_FILE = path.join(DATA_DIR, 'custom-node-versions.json');
const OBSERVER_ACCESS_FILE = path.join(DATA_DIR, 'observer-access.json');

// Ensure data directory exists
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

// Pipeline storage
export class PipelineStorage {
  private static pipelines: Map<string, Pipeline> = new Map();
  private static initialized = false;

  private static async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await ensureDataDir();
    
    try {
      const data = await fs.readFile(PIPELINES_FILE, 'utf-8');
      const pipelinesArray: Pipeline[] = JSON.parse(data);
      this.pipelines = new Map(pipelinesArray.map(p => [p.id, p]));
    } catch (error) {
      // File doesn't exist or is invalid, start with empty map
      this.pipelines = new Map();
    }
    
    this.initialized = true;
  }

  private static async save(): Promise<void> {
    const pipelinesArray = Array.from(this.pipelines.values());
    await fs.writeFile(PIPELINES_FILE, JSON.stringify(pipelinesArray, null, 2));
  }

  static async getAll(): Promise<Pipeline[]> {
    await this.initialize();
    return Array.from(this.pipelines.values());
  }

  static async get(id: string): Promise<Pipeline | undefined> {
    await this.initialize();
    return this.pipelines.get(id);
  }

  static async set(pipeline: Pipeline): Promise<void> {
    await this.initialize();
    this.pipelines.set(pipeline.id, pipeline);
    await this.save();
  }

  static async delete(id: string): Promise<boolean> {
    await this.initialize();
    const deleted = this.pipelines.delete(id);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }
}

// Run storage
export class RunStorage {
  private static runs: Map<string, PipelineRun> = new Map();
  private static initialized = false;

  private static async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await ensureDataDir();
    
    try {
      const data = await fs.readFile(RUNS_FILE, 'utf-8');
      const runsArray: PipelineRun[] = JSON.parse(data);
      this.runs = new Map(runsArray.map(r => [r.id, r]));
    } catch (error) {
      // File doesn't exist or is invalid, start with empty map
      this.runs = new Map();
    }
    
    this.initialized = true;
  }

  private static async save(): Promise<void> {
    const runsArray = Array.from(this.runs.values());
    await fs.writeFile(RUNS_FILE, JSON.stringify(runsArray, null, 2));
  }

  static async getAll(): Promise<PipelineRun[]> {
    await this.initialize();
    return Array.from(this.runs.values());
  }

  static async get(id: string): Promise<PipelineRun | undefined> {
    await this.initialize();
    return this.runs.get(id);
  }

  static async set(run: PipelineRun): Promise<void> {
    await this.initialize();
    this.runs.set(run.id, run);
    await this.save();
  }

  static async getByPipeline(pipelineId: string): Promise<PipelineRun[]> {
    await this.initialize();
    return Array.from(this.runs.values())
      .filter(run => run.pipelineId === pipelineId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  static async delete(id: string): Promise<boolean> {
    await this.initialize();
    const deleted = this.runs.delete(id);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }
}

// Custom Node storage with versioning
export class CustomNodeStorage {
  private static nodes: Map<string, CustomNode> = new Map();
  private static versions: Map<string, CustomNodeVersion[]> = new Map();
  private static initialized = false;

  private static async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await ensureDataDir();
    await this.ensureCustomNodesDir();
    
    try {
      const data = await fs.readFile(CUSTOM_NODES_FILE, 'utf-8');
      const nodesArray: CustomNode[] = JSON.parse(data);
      this.nodes = new Map(nodesArray.map(n => [n.id, n]));
    } catch (error) {
      // File doesn't exist or is invalid, start with empty map
      this.nodes = new Map();
    }

    try {
      const versionsData = await fs.readFile(CUSTOM_NODE_VERSIONS_FILE, 'utf-8');
      const versionsMap: Record<string, CustomNodeVersion[]> = JSON.parse(versionsData);
      this.versions = new Map(Object.entries(versionsMap));
    } catch (error) {
      // File doesn't exist or is invalid, start with empty map
      this.versions = new Map();
    }
    
    this.initialized = true;
  }

  private static async ensureCustomNodesDir(): Promise<void> {
    try {
      await fs.mkdir(CUSTOM_NODES_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private static async save(): Promise<void> {
    const nodesArray = Array.from(this.nodes.values());
    await fs.writeFile(CUSTOM_NODES_FILE, JSON.stringify(nodesArray, null, 2));

    const versionsObject = Object.fromEntries(this.versions.entries());
    await fs.writeFile(CUSTOM_NODE_VERSIONS_FILE, JSON.stringify(versionsObject, null, 2));
  }

  private static async saveNodeCode(nodeId: string, code: string, version: number): Promise<void> {
    const nodeFilePath = path.join(CUSTOM_NODES_DIR, `${nodeId}_v${version}.js`);
    await fs.writeFile(nodeFilePath, code, 'utf-8');
  }

  private static async loadNodeCode(nodeId: string, version?: number): Promise<string | undefined> {
    if (version) {
      const nodeFilePath = path.join(CUSTOM_NODES_DIR, `${nodeId}_v${version}.js`);
      try {
        return await fs.readFile(nodeFilePath, 'utf-8');
      } catch (error) {
        return undefined;
      }
    }
    
    // Load current version
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;
    
    const nodeFilePath = path.join(CUSTOM_NODES_DIR, `${nodeId}_v${node.version}.js`);
    try {
      return await fs.readFile(nodeFilePath, 'utf-8');
    } catch (error) {
      return node.code; // Fallback to stored code
    }
  }

  static async getAll(filter?: { search?: string; tags?: string[] }): Promise<CustomNode[]> {
    await this.initialize();
    let nodes = Array.from(this.nodes.values());

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      nodes = nodes.filter(node => 
        node.name.toLowerCase().includes(searchLower) ||
        node.description?.toLowerCase().includes(searchLower) ||
        node.author?.toLowerCase().includes(searchLower)
      );
    }

    if (filter?.tags && filter.tags.length > 0) {
      nodes = nodes.filter(node => 
        node.tags?.some(tag => filter.tags!.includes(tag))
      );
    }

    return nodes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  static async get(id: string, version?: number): Promise<CustomNode | undefined> {
    await this.initialize();
    const node = this.nodes.get(id);
    
    if (!node) return undefined;

    if (version && version !== node.version) {
      // Load specific version
      const code = await this.loadNodeCode(id, version);
      if (code) {
        return { ...node, code, version };
      }
      return undefined;
    }

    // Load current version code
    const code = await this.loadNodeCode(id);
    return { ...node, code: code || node.code };
  }

  static async create(nodeData: Omit<CustomNode, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<CustomNode> {
    await this.initialize();
    
    const id = uuidv4();
    const now = new Date().toISOString();
    const node: CustomNode = {
      ...nodeData,
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.nodes.set(id, node);
    
    // Save code to file system
    await this.saveNodeCode(id, node.code, 1);
    
    // Initialize version history
    const initialVersion: CustomNodeVersion = {
      version: 1,
      code: node.code,
      timestamp: now,
      changeDescription: 'Initial version'
    };
    this.versions.set(id, [initialVersion]);

    await this.save();
    return node;
  }

  static async update(id: string, updates: Partial<Omit<CustomNode, 'id' | 'createdAt' | 'version'>>, changeDescription?: string): Promise<CustomNode | undefined> {
    await this.initialize();
    
    const existingNode = this.nodes.get(id);
    if (!existingNode) return undefined;

    const now = new Date().toISOString();
    const codeUpdated = updates.code && updates.code !== existingNode.code;
    const newVersion = codeUpdated ? existingNode.version + 1 : existingNode.version;
    
    const updatedNode: CustomNode = {
      ...existingNode,
      ...updates,
      version: newVersion,
      updatedAt: now,
    };

    this.nodes.set(id, updatedNode);
    
    // If code was updated, save new version and add to version history
    if (codeUpdated) {
      await this.saveNodeCode(id, updates.code!, newVersion);
      
      const nodeVersions = this.versions.get(id) || [];
      const newVersionEntry: CustomNodeVersion = {
        version: newVersion,
        code: updates.code!,
        timestamp: now,
        changeDescription: changeDescription || `Update to version ${newVersion}`
      };
      nodeVersions.push(newVersionEntry);
      this.versions.set(id, nodeVersions);
    }

    await this.save();
    return updatedNode;
  }

  static async delete(id: string): Promise<boolean> {
    await this.initialize();
    
    const deleted = this.nodes.delete(id);
    if (deleted) {
      // Get version history before deleting it
      const nodeVersions = this.versions.get(id) || [];
      
      // Delete version history
      this.versions.delete(id);
      
      // Delete code files
      for (const version of nodeVersions) {
        const nodeFilePath = path.join(CUSTOM_NODES_DIR, `${id}_v${version.version}.js`);
        try {
          await fs.unlink(nodeFilePath);
        } catch (error) {
          // File might not exist, continue
        }
      }
      
      await this.save();
    }
    return deleted;
  }

  static async getVersions(id: string): Promise<CustomNodeVersion[]> {
    await this.initialize();
    return this.versions.get(id) || [];
  }

  static async getByTag(tag: string): Promise<CustomNode[]> {
    await this.initialize();
    return Array.from(this.nodes.values())
      .filter(node => node.tags?.includes(tag))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

// Pipeline version storage
export class PipelineVersionStorage {
  private static versions: Map<string, PipelineVersion> = new Map();
  private static initialized = false;

  private static async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await ensureDataDir();
    
    try {
      const data = await fs.readFile(VERSIONS_FILE, 'utf-8');
      const versionsArray: PipelineVersion[] = JSON.parse(data);
      this.versions = new Map(versionsArray.map(v => [v.id, v]));
    } catch (error) {
      // File doesn't exist or is invalid, start with empty map
      this.versions = new Map();
    }
    
    this.initialized = true;
  }

  private static async save(): Promise<void> {
    const versionsArray = Array.from(this.versions.values());
    await fs.writeFile(VERSIONS_FILE, JSON.stringify(versionsArray, null, 2));
  }

  static async getAll(): Promise<PipelineVersion[]> {
    await this.initialize();
    return Array.from(this.versions.values());
  }

  static async get(id: string): Promise<PipelineVersion | undefined> {
    await this.initialize();
    return this.versions.get(id);
  }

  static async set(version: PipelineVersion): Promise<void> {
    await this.initialize();
    this.versions.set(version.id, version);
    await this.save();
  }

  static async delete(id: string): Promise<boolean> {
    await this.initialize();
    const deleted = this.versions.delete(id);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }

  static async getByPipeline(pipelineId: string): Promise<PipelineVersion[]> {
    await this.initialize();
    return Array.from(this.versions.values())
      .filter(version => version.pipelineId === pipelineId)
      .sort((a, b) => b.version - a.version); // Latest versions first
  }

  static async getLatestVersion(pipelineId: string): Promise<PipelineVersion | undefined> {
    const versions = await this.getByPipeline(pipelineId);
    return versions[0]; // First item is the latest due to sorting
  }

  static async getNextVersionNumber(pipelineId: string): Promise<number> {
    const latestVersion = await this.getLatestVersion(pipelineId);
    return (latestVersion?.version ?? 0) + 1;
  }

  static async createVersion(
    pipelineId: string,
    dsl: string,
    options: {
      commitMessage?: string;
      createdBy?: string;
      isAutoSave?: boolean;
      tags?: string[];
    } = {}
  ): Promise<PipelineVersion> {
    const version = await this.getNextVersionNumber(pipelineId);
    const versionId = uuidv4();
    
    const pipelineVersion: PipelineVersion = {
      id: versionId,
      pipelineId,
      version,
      dsl,
      commitMessage: options.commitMessage || (options.isAutoSave ? 'Auto-save' : `Version ${version}`),
      createdAt: new Date().toISOString(),
      createdBy: options.createdBy,
      isAutoSave: options.isAutoSave ?? false,
      tags: options.tags || []
    };

    await this.set(pipelineVersion);
    return pipelineVersion;
  }

  static async deleteVersionsForPipeline(pipelineId: string): Promise<void> {
    await this.initialize();
    const versionsToDelete = Array.from(this.versions.entries())
      .filter(([_, version]) => version.pipelineId === pipelineId)
      .map(([id]) => id);
    
    for (const id of versionsToDelete) {
      this.versions.delete(id);
    }
    
    if (versionsToDelete.length > 0) {
      await this.save();
    }
  }
}

// Observer access storage
export class ObserverStorage {
  private static observers: Map<string, ObserverAccess> = new Map();
  private static initialized = false;

  private static async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await ensureDataDir();
    
    try {
      const data = await fs.readFile(OBSERVER_ACCESS_FILE, 'utf-8');
      const observersArray: ObserverAccess[] = JSON.parse(data);
      this.observers = new Map(observersArray.map(o => [o.token, o]));
    } catch (error) {
      // File doesn't exist or is invalid, start with empty map
      this.observers = new Map();
    }
    
    this.initialized = true;
  }

  private static async save(): Promise<void> {
    const observersArray = Array.from(this.observers.values());
    await fs.writeFile(OBSERVER_ACCESS_FILE, JSON.stringify(observersArray, null, 2));
  }

  static async generateObserverToken(pipelineId: string): Promise<string> {
    await this.initialize();
    
    // Generate a secure random token
    const token = uuidv4() + '-' + uuidv4();
    
    const observerAccess: ObserverAccess = {
      id: uuidv4(),
      pipelineId,
      token,
      createdAt: new Date().toISOString(),
      accessCount: 0
    };

    this.observers.set(token, observerAccess);
    await this.save();
    
    return token;
  }

  static async validateToken(token: string): Promise<ObserverAccess | null> {
    await this.initialize();
    const observerAccess = this.observers.get(token);
    
    if (!observerAccess) {
      return null;
    }

    // Check if token is expired (optional - could add expiration logic here)
    if (observerAccess.expiresAt && new Date(observerAccess.expiresAt) < new Date()) {
      return null;
    }

    return observerAccess;
  }

  static async recordAccess(token: string): Promise<void> {
    await this.initialize();
    const observerAccess = this.observers.get(token);
    
    if (observerAccess) {
      observerAccess.lastAccessedAt = new Date().toISOString();
      observerAccess.accessCount += 1;
      this.observers.set(token, observerAccess);
      await this.save();
    }
  }

  static async getByPipeline(pipelineId: string): Promise<ObserverAccess[]> {
    await this.initialize();
    return Array.from(this.observers.values())
      .filter(observer => observer.pipelineId === pipelineId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static async revokeToken(token: string): Promise<boolean> {
    await this.initialize();
    const deleted = this.observers.delete(token);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }

  static async cleanupExpiredTokens(): Promise<void> {
    await this.initialize();
    const now = new Date();
    let hasChanges = false;
    
    for (const [token, access] of this.observers.entries()) {
      if (access.expiresAt && new Date(access.expiresAt) < now) {
        this.observers.delete(token);
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      await this.save();
    }
  }
}