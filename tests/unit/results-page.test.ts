/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import ResultsPage from '../../apps/web/src/routes/results/[runId]/+page.svelte';
import { page } from '$app/stores';
import * as api from '../../apps/web/src/lib/api/client';

// Mock the page store
vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn(),
    params: { runId: 'test-run-id' },
    url: new URL('http://localhost/results/test-run-id')
  }
}));

// Mock the API client
vi.mock('../../apps/web/src/lib/api/client', () => ({
  runApi: {
    get: vi.fn()
  },
  pipelineApi: {
    get: vi.fn()
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  }
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn()
  }
});

const mockRun = {
  id: 'test-run-id',
  pipelineId: 'test-pipeline-id',
  status: 'completed',
  startTime: '2023-01-01T00:00:00Z',
  endTime: '2023-01-01T01:00:00Z',
  logs: ['Starting backtest...', 'Backtest completed'],
  results: {
    totalReturn: 15.5,
    sharpeRatio: 1.8,
    maxDrawdown: -8.2,
    numTrades: 25,
    winRate: 0.68,
    finalCapital: 115500,
    trades: [],
    equityCurve: []
  }
};

const mockPipeline = {
  id: 'test-pipeline-id',
  name: 'Test Strategy',
  description: 'A test strategy',
  dsl: 'strategy: test',
  status: 'ready',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
};

describe('Results Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup page store mock
    const mockPageStore = {
      subscribe: vi.fn((callback) => {
        callback({
          params: { runId: 'test-run-id' },
          url: new URL('http://localhost/results/test-run-id')
        });
        return () => {};
      })
    };
    
    vi.mocked(page).subscribe = mockPageStore.subscribe;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render normal view with edit/run controls', async () => {
    vi.mocked(api.runApi.get).mockResolvedValue(mockRun);
    vi.mocked(api.pipelineApi.get).mockResolvedValue(mockPipeline);

    const { container, getByText } = render(ResultsPage);

    await waitFor(() => {
      expect(getByText('Backtest Results')).toBeInTheDocument();
    });

    // Should show normal view controls
    expect(getByText('Copy Link')).toBeInTheDocument();
    expect(getByText('Share')).toBeInTheDocument();
    expect(getByText('Edit Pipeline')).toBeInTheDocument();
    
    // Should not show shared view banner
    expect(container.querySelector('.alert-info')).not.toBeInTheDocument();
  });

  it('should render shared view with limited controls', async () => {
    vi.mocked(api.runApi.get).mockResolvedValue(mockRun);
    vi.mocked(api.pipelineApi.get).mockResolvedValue(mockPipeline);

    // Mock shared URL
    const mockPageStore = {
      subscribe: vi.fn((callback) => {
        callback({
          params: { runId: 'test-run-id' },
          url: new URL('http://localhost/results/test-run-id?share=true')
        });
        return () => {};
      })
    };
    
    vi.mocked(page).subscribe = mockPageStore.subscribe;

    const { container, getByText, queryByText } = render(ResultsPage);

    await waitFor(() => {
      expect(getByText('Backtest Results')).toBeInTheDocument();
    });

    // Should show shared view banner
    expect(getByText('Shared Results View')).toBeInTheDocument();
    expect(getByText('You\'re viewing shared backtest results in read-only mode.')).toBeInTheDocument();
    
    // Should not show edit/share controls
    expect(queryByText('Copy Link')).not.toBeInTheDocument();
    expect(queryByText('Share')).not.toBeInTheDocument();
    expect(queryByText('Edit Pipeline')).not.toBeInTheDocument();
    
    // Should still show download button
    expect(getByText('Download Results')).toBeInTheDocument();
  });

  it('should copy shareable URL when share button is clicked', async () => {
    vi.mocked(api.runApi.get).mockResolvedValue(mockRun);
    vi.mocked(api.pipelineApi.get).mockResolvedValue(mockPipeline);

    const { getByText } = render(ResultsPage);

    await waitFor(() => {
      expect(getByText('Share')).toBeInTheDocument();
    });

    const shareButton = getByText('Share');
    await fireEvent.click(shareButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'http://localhost/results/test-run-id?share=true'
    );
  });

  it('should show toast notification when share link is copied', async () => {
    vi.mocked(api.runApi.get).mockResolvedValue(mockRun);
    vi.mocked(api.pipelineApi.get).mockResolvedValue(mockPipeline);

    const { getByText } = render(ResultsPage);

    await waitFor(() => {
      expect(getByText('Share')).toBeInTheDocument();
    });

    const shareButton = getByText('Share');
    await fireEvent.click(shareButton);

    await waitFor(() => {
      expect(getByText('Shareable link copied to clipboard!')).toBeInTheDocument();
    });
  });

  it('should display all metrics in both views', async () => {
    vi.mocked(api.runApi.get).mockResolvedValue(mockRun);
    vi.mocked(api.pipelineApi.get).mockResolvedValue(mockPipeline);

    const { getByText } = render(ResultsPage);

    await waitFor(() => {
      expect(getByText('Total Return')).toBeInTheDocument();
      expect(getByText('+15.50%')).toBeInTheDocument();
      expect(getByText('Sharpe Ratio')).toBeInTheDocument();
      expect(getByText('1.80')).toBeInTheDocument();
      expect(getByText('Max Drawdown')).toBeInTheDocument();
      expect(getByText('8.20%')).toBeInTheDocument();
      expect(getByText('Total Trades')).toBeInTheDocument();
      expect(getByText('25')).toBeInTheDocument();
      expect(getByText('Win Rate')).toBeInTheDocument();
      expect(getByText('68.0%')).toBeInTheDocument();
    });
  });
});