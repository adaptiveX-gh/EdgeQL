import { pipelineApi } from '../api/client.js';
import type { PipelineVersion } from '../api/types.js';

export interface AutoSaveOptions {
  interval: number; // ms
  significant: boolean; // Whether this change is significant enough to create a version
  enabled: boolean;
  onSave?: (version: PipelineVersion) => void;
  onError?: (error: Error) => void;
}

export class AutoSave {
  private timeoutId: number | null = null;
  private lastSavedContent: string = '';
  private lastSignificantSave: number = 0;
  private readonly significantInterval: number = 30000; // 30 seconds minimum between significant saves

  constructor(
    private pipelineId: string,
    private options: AutoSaveOptions
  ) {}

  /**
   * Schedule an auto-save for the given content
   */
  schedule(content: string, isSignificantChange: boolean = false): void {
    if (!this.options.enabled) return;
    
    // Don't save if content hasn't changed
    if (content === this.lastSavedContent) return;
    
    // Clear existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    const now = Date.now();
    const shouldCreateVersion = isSignificantChange && 
      (now - this.lastSignificantSave) > this.significantInterval;

    // Schedule the save
    this.timeoutId = window.setTimeout(async () => {
      try {
        await this.performSave(content, shouldCreateVersion);
        if (shouldCreateVersion) {
          this.lastSignificantSave = now;
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
        this.options.onError?.(error as Error);
      }
    }, this.options.interval);
  }

  /**
   * Force an immediate save
   */
  async saveNow(content: string, createVersion: boolean = true): Promise<PipelineVersion | null> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    try {
      const version = await this.performSave(content, createVersion);
      if (createVersion) {
        this.lastSignificantSave = Date.now();
      }
      return version;
    } catch (error) {
      console.error('Manual save failed:', error);
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  private async performSave(content: string, createVersion: boolean): Promise<PipelineVersion | null> {
    this.lastSavedContent = content;

    if (createVersion) {
      const version = await pipelineApi.createVersion(this.pipelineId, {
        dsl: content,
        isAutoSave: true,
        commitMessage: 'Auto-save'
      });
      
      this.options.onSave?.(version);
      return version;
    }

    return null;
  }

  /**
   * Cancel any pending auto-save
   */
  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Update configuration
   */
  updateOptions(options: Partial<AutoSaveOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancel();
  }
}

/**
 * Detect if a change is "significant" enough to warrant version creation
 * This is a heuristic-based approach
 */
export function isSignificantChange(oldContent: string, newContent: string): boolean {
  if (!oldContent || !newContent) return false;

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Significant if line count changed substantially
  if (Math.abs(oldLines.length - newLines.length) > 2) {
    return true;
  }

  // Check for structural changes (new nodes, removed nodes)
  const oldNodeLines = oldLines.filter(line => line.trim().startsWith('- id:'));
  const newNodeLines = newLines.filter(line => line.trim().startsWith('- id:'));
  
  if (oldNodeLines.length !== newNodeLines.length) {
    return true;
  }

  // Check for parameter changes in nodes
  let significantChanges = 0;
  for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
    const oldLine = oldLines[i].trim();
    const newLine = newLines[i].trim();
    
    if (oldLine !== newLine) {
      // Check if it's a parameter line
      if (oldLine.includes(':') && newLine.includes(':')) {
        const oldKey = oldLine.split(':')[0].trim();
        const newKey = newLine.split(':')[0].trim();
        
        // If the key is the same but value changed, it might be significant
        if (oldKey === newKey && ['type', 'depends_on', 'params'].includes(oldKey)) {
          significantChanges++;
        }
      }
    }
  }

  // Consider it significant if multiple structural elements changed
  return significantChanges >= 2;
}

/**
 * Default auto-save configuration
 */
export const defaultAutoSaveOptions: AutoSaveOptions = {
  interval: 5000, // 5 seconds
  significant: true,
  enabled: true
};