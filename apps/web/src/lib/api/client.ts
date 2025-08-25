import type { 
  Pipeline, 
  PipelineRun, 
  ApiResponse, 
  Dataset,
  PipelineIR
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

// Export the error class
export { ApiError };