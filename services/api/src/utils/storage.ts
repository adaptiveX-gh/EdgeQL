import { promises as fs } from 'fs';
import path from 'path';
import { Pipeline, PipelineRun } from '../types/index.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PIPELINES_FILE = path.join(DATA_DIR, 'pipelines.json');
const RUNS_FILE = path.join(DATA_DIR, 'runs.json');

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