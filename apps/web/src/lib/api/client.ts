import type { 
  Pipeline, 
  PipelineRun, 
  PipelineVersion,
  ApiResponse, 
  Dataset,
  PipelineIR,
  CustomNode,
  LogEntry
} from './types.js';

// Base API configuration
const API_BASE = '/api';

class ApiError extends Error {
  constructor(public status: number, message: string, public response?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    // Check if response is JSON by looking at Content-Type header
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    
    if (!isJson) {
      // If response is not JSON (e.g., HTML error page), handle it differently
      const text = await response.text();
      throw new ApiError(
        response.status,
        response.ok ? 'Unexpected response format' : `Server returned ${response.status}: ${response.statusText}`,
        { status: response.status, body: text }
      );
    }
    
    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data.error || `HTTP ${response.status}`,
        data
      );
    }

    if (!data.success) {
      throw new ApiError(
        response.status,
        data.error || 'API request failed',
        data
      );
    }

    return data.data!;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle JSON parsing errors more specifically
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      throw new ApiError(0, 'Server returned invalid JSON. Check if the API server is running.', error);
    }
    
    // Network or other parsing errors
    throw new ApiError(0, `Network error: ${error.message}`, error);
  }
}

// Pipeline API methods
export const pipelineApi = {
  async list(): Promise<Pipeline[]> {
    return fetchApi<Pipeline[]>('/pipelines');
  },

  async get(id: string): Promise<Pipeline> {
    return fetchApi<Pipeline>(`/pipelines/${id}`);
  },

  async run(id: string, dsl?: string): Promise<{ runId: string }> {
    return fetchApi<{ runId: string }>(`/pipelines/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ dsl }),
    });
  },

  async getRuns(id: string): Promise<PipelineRun[]> {
    return fetchApi<PipelineRun[]>(`/pipelines/${id}/runs`);
  },

  async validate(dsl: string): Promise<{ valid: boolean; errors?: any[]; warnings?: string[] }> {
    return fetchApi<{ valid: boolean; errors?: any[]; warnings?: string[] }>('/pipelines/validate', {
      method: 'POST',
      body: JSON.stringify({ dsl }),
    });
  },

  async compile(id: string, dsl?: string): Promise<PipelineIR> {
    return fetchApi<PipelineIR>(`/pipelines/${id}/compile`, {
      method: 'POST',
      body: JSON.stringify({ dsl }),
    });
  },

  // Version management methods
  async getVersions(id: string): Promise<PipelineVersion[]> {
    return fetchApi<PipelineVersion[]>(`/pipelines/${id}/versions`);
  },

  async getVersion(id: string, versionId: string): Promise<PipelineVersion> {
    return fetchApi<PipelineVersion>(`/pipelines/${id}/versions/${versionId}`);
  },

  async createVersion(id: string, options: {
    dsl: string;
    commitMessage?: string;
    isAutoSave?: boolean;
    tags?: string[];
    createdBy?: string;
  }): Promise<PipelineVersion> {
    return fetchApi<PipelineVersion>(`/pipelines/${id}/versions`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  async restoreVersion(id: string, versionId: string, options?: {
    createBackup?: boolean;
    commitMessage?: string;
  }): Promise<{ restoredVersion: PipelineVersion; backupVersion?: PipelineVersion }> {
    return fetchApi<{ restoredVersion: PipelineVersion; backupVersion?: PipelineVersion }>(`/pipelines/${id}/versions/${versionId}/restore`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },

  async deleteVersion(id: string, versionId: string): Promise<{ deleted: boolean }> {
    return fetchApi<{ deleted: boolean }>(`/pipelines/${id}/versions/${versionId}`, {
      method: 'DELETE',
    });
  },
};

// Run API methods
export const runApi = {
  async get(id: string): Promise<PipelineRun> {
    return fetchApi<PipelineRun>(`/runs/${id}`);
  },

  async getLogs(id: string): Promise<string[]> {
    return fetchApi<string[]>(`/runs/${id}/logs`);
  },

  async getStructuredLogs(id: string, options?: {
    nodeId?: string;
    level?: 'info' | 'warn' | 'error' | 'debug';
    source?: 'system' | 'node';
    limit?: number;
    offset?: number;
  }): Promise<{ logs: LogEntry[]; total: number; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (options?.nodeId) params.set('nodeId', options.nodeId);
    if (options?.level) params.set('level', options.level);
    if (options?.source) params.set('source', options.source);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    
    const query = params.toString();
    const url = query ? `/runs/${id}/structured-logs?${query}` : `/runs/${id}/structured-logs`;
    
    return fetchApi<{ logs: LogEntry[]; total: number; hasMore: boolean }>(url);
  },

  async cancel(id: string): Promise<PipelineRun> {
    return fetchApi<PipelineRun>(`/runs/${id}/cancel`, {
      method: 'POST',
    });
  },

  async list(limit = 50, offset = 0): Promise<PipelineRun[]> {
    return fetchApi<PipelineRun[]>(`/runs?limit=${limit}&offset=${offset}`);
  },

  // Export functionality - returns download URLs that trigger browser downloads
  exportTrades(id: string): string {
    return `${API_BASE}/runs/${id}/export/trades`;
  },

  exportMetrics(id: string): string {
    return `${API_BASE}/runs/${id}/export/metrics`;
  },

  // Helper method to trigger downloads programmatically
  async downloadTrades(id: string): Promise<void> {
    const url = this.exportTrades(id);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trades-${id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async downloadMetrics(id: string): Promise<void> {
    const url = this.exportMetrics(id);
    const link = document.createElement('a');
    link.href = url;
    link.download = `metrics-${id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

// Dataset API methods  
export const datasetApi = {
  async list(): Promise<Dataset[]> {
    return fetchApi<Dataset[]>('/datasets');
  },

  async get(name: string): Promise<Dataset> {
    return fetchApi<Dataset>(`/datasets/${name}`);
  },

  async upload(file: File): Promise<Dataset> {
    const formData = new FormData();
    formData.append('dataset', file);

    const response = await fetch(`${API_BASE}/datasets/upload`, {
      method: 'POST',
      body: formData,
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    
    if (!isJson) {
      throw new ApiError(
        response.status,
        response.ok ? 'Unexpected response format' : `Server returned ${response.status}: ${response.statusText}`,
        { status: response.status }
      );
    }
    
    const data: ApiResponse<Dataset> = await response.json();

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data.error || `HTTP ${response.status}`,
        data
      );
    }

    if (!data.success) {
      throw new ApiError(
        response.status,
        data.error || 'Upload failed',
        data
      );
    }

    return data.data!;
  },

  async preview(id: string): Promise<any[]> {
    return fetchApi<any[]>(`/datasets/${id}/preview`);
  },
};

// Polling utility for run status
export class RunPoller {
  private intervalId: number | null = null;
  private callbacks: ((run: PipelineRun) => void)[] = [];

  constructor(
    private runId: string, 
    private intervalMs: number = 2000
  ) {}

  onUpdate(callback: (run: PipelineRun) => void): void {
    this.callbacks.push(callback);
  }

  start(): void {
    if (this.intervalId) return;

    const poll = async () => {
      try {
        const run = await runApi.get(this.runId);
        
        // Notify all callbacks
        this.callbacks.forEach(callback => callback(run));
        
        // Stop polling if run is finished
        if (['completed', 'failed', 'cancelled'].includes(run.status)) {
          this.stop();
        }
      } catch (error) {
        console.error('Error polling run status:', error);
        // Don't stop polling on errors - just log them
      }
    };

    // Poll immediately
    poll();
    
    // Then poll at intervals
    this.intervalId = window.setInterval(poll, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  destroy(): void {
    this.stop();
    this.callbacks = [];
  }
}

// Node API methods
export const nodeApi = {
  async list(): Promise<any[]> {
    return fetchApi<any[]>('/nodes');
  },

  async getBuiltIn(): Promise<any[]> {
    return fetchApi<any[]>('/nodes/builtin');
  },

  async getCustomNodes(): Promise<CustomNode[]> {
    return fetchApi<CustomNode[]>('/nodes/custom');
  },

  async get(id: string): Promise<CustomNode> {
    return fetchApi<CustomNode>(`/nodes/${id}`);
  },

  async create(node: {
    name: string;
    description?: string;
    code: string;
    inputSchema?: any;
    outputSchema?: any;
  }): Promise<CustomNode> {
    return fetchApi<CustomNode>('/nodes', {
      method: 'POST',
      body: JSON.stringify(node),
    });
  },

  async update(id: string, node: {
    name?: string;
    description?: string;
    code?: string;
    inputSchema?: any;
    outputSchema?: any;
  }): Promise<CustomNode> {
    return fetchApi<CustomNode>(`/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(node),
    });
  },

  async delete(id: string): Promise<{ deleted: boolean }> {
    return fetchApi<{ deleted: boolean }>(`/nodes/${id}`, {
      method: 'DELETE',
    });
  },
};

// Export the error class
export { ApiError };