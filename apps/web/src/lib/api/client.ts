import type { 
  Pipeline, 
  PipelineRun, 
  ApiResponse, 
  Dataset 
} from './types.js';

// Base API configuration
const API_BASE = 'http://localhost:3002/api';

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
    
    // Network or parsing errors
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
};

// Run API methods
export const runApi = {
  async get(id: string): Promise<PipelineRun> {
    return fetchApi<PipelineRun>(`/runs/${id}`);
  },

  async getLogs(id: string): Promise<string[]> {
    return fetchApi<string[]>(`/runs/${id}/logs`);
  },

  async cancel(id: string): Promise<PipelineRun> {
    return fetchApi<PipelineRun>(`/runs/${id}/cancel`, {
      method: 'POST',
    });
  },

  async list(limit = 50, offset = 0): Promise<PipelineRun[]> {
    return fetchApi<PipelineRun[]>(`/runs?limit=${limit}&offset=${offset}`);
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

// Export the error class
export { ApiError };