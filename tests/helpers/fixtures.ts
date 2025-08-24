/**
 * Test fixtures and helpers for comprehensive testing
 * Provides reusable test data, mocks, and utilities across all test suites
 */

import { v4 as uuidv4 } from 'uuid';

// Sample DSL strategies for testing
export const dslFixtures = {
  // Valid strategies
  simpleMovingAverage: `
pipeline:
  - id: price_data
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "sample_ohlcv.csv"
      
  - id: sma_20
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "SMA"
      period: 20
      column: "close"
`,

  movingAverageCrossover: `
pipeline:
  - id: price_data
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "sample_ohlcv.csv"
      
  - id: fast_ma
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "SMA"
      period: 10
      column: "close"
      
  - id: slow_ma
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "SMA"
      period: 20
      column: "close"
      
  - id: ma_signals
    type: CrossoverSignalNode
    depends_on: [fast_ma, slow_ma]
    params:
      buy_condition: "fast > slow"
      sell_condition: "fast < slow"
      
  - id: backtest_results
    type: BacktestNode
    depends_on: [ma_signals, price_data]
    params:
      initial_capital: 10000
      commission: 0.001
`,

  rsiStrategy: `
pipeline:
  - id: price_data
    type: DataLoaderNode
    params:
      symbol: "ETH/USD"
      timeframe: "4h"
      dataset: "sample_ohlcv.csv"
      
  - id: rsi_indicator
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "RSI"
      period: 14
      column: "close"
      
  - id: rsi_signals
    type: CrossoverSignalNode
    depends_on: [rsi_indicator]
    params:
      buy_condition: "rsi < 30"
      sell_condition: "rsi > 70"
      
  - id: backtest_results
    type: BacktestNode
    depends_on: [rsi_signals, price_data]
    params:
      initial_capital: 5000
      commission: 0.002
`,

  complexMultiIndicator: `
pipeline:
  - id: price_data
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "sample_ohlcv.csv"
      
  - id: sma_20
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "SMA"
      period: 20
      column: "close"
      
  - id: ema_12
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "EMA"
      period: 12
      column: "close"
      
  - id: rsi_14
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "RSI"
      period: 14
      column: "close"
      
  - id: macd_signals
    type: CrossoverSignalNode
    depends_on: [ema_12, sma_20]
    params:
      buy_condition: "ema > sma"
      sell_condition: "ema < sma"
      
  - id: combined_signals
    type: CrossoverSignalNode
    depends_on: [macd_signals, rsi_14]
    params:
      buy_condition: "signal == 1 and rsi < 80"
      sell_condition: "signal == -1 or rsi > 80"
      
  - id: backtest_results
    type: BacktestNode
    depends_on: [combined_signals, price_data]
    params:
      initial_capital: 10000
      commission: 0.001
      stop_loss: 0.05
      take_profit: 0.10
`,

  // Invalid strategies for error testing
  invalidSyntax: `
pipeline:
  - id: broken
    invalid yaml: [unclosed array
`,

  missingRequiredParams: `
pipeline:
  - id: incomplete_node
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      # Missing timeframe and dataset
`,

  circularDependency: `
pipeline:
  - id: node_a
    type: IndicatorNode
    depends_on: [node_b]
    params:
      indicator: "SMA"
      period: 10
      
  - id: node_b
    type: IndicatorNode
    depends_on: [node_c]
    params:
      indicator: "EMA"
      period: 20
      
  - id: node_c
    type: IndicatorNode
    depends_on: [node_a]
    params:
      indicator: "RSI"
      period: 14
`,

  duplicateNodeIds: `
pipeline:
  - id: duplicate_id
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"
      
  - id: duplicate_id
    type: IndicatorNode
    params:
      indicator: "SMA"
      period: 10
`,

  unknownNodeType: `
pipeline:
  - id: unknown_node
    type: UnknownNodeType
    params:
      some_param: "value"
`,

  missingDependency: `
pipeline:
  - id: dependent_node
    type: IndicatorNode
    depends_on: [non_existent_node]
    params:
      indicator: "SMA"
      period: 10
`,

  invalidParameters: `
pipeline:
  - id: invalid_params
    type: IndicatorNode
    params:
      indicator: "INVALID_INDICATOR"
      period: -5
`,

  emptyPipeline: `
pipeline: []
`,

  invalidNodeId: `
pipeline:
  - id: "123invalid"
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "test.csv"
`
};

// Mock pipeline run data
export const mockPipelineRuns = {
  running: {
    id: uuidv4(),
    pipelineId: 'ma-crossover',
    status: 'running' as const,
    startTime: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
    endTime: null,
    logs: [
      'Pipeline execution started',
      'Loading data from sample_ohlcv.csv',
      'Calculating fast MA (10 periods)',
      'Calculating slow MA (20 periods)'
    ],
    results: {},
    error: null
  },

  completed: {
    id: uuidv4(),
    pipelineId: 'rsi-strategy',
    status: 'completed' as const,
    startTime: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    endTime: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
    logs: [
      'Pipeline execution started',
      'Loading data from sample_ohlcv.csv',
      'Calculating RSI (14 periods)',
      'Generating crossover signals',
      'Running backtest simulation',
      'Pipeline execution completed successfully'
    ],
    results: {
      total_return: 15.23,
      sharpe_ratio: 1.42,
      max_drawdown: 8.5,
      num_trades: 25
    },
    error: null
  },

  failed: {
    id: uuidv4(),
    pipelineId: 'failed-strategy',
    status: 'failed' as const,
    startTime: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
    endTime: new Date(Date.now() - 110000).toISOString(), // 1:50 ago
    logs: [
      'Pipeline execution started',
      'Error: Dataset not found: non_existent.csv',
      'Pipeline execution failed'
    ],
    results: {},
    error: 'DataLoader failed: Dataset not found'
  },

  cancelled: {
    id: uuidv4(),
    pipelineId: 'cancelled-strategy',
    status: 'cancelled' as const,
    startTime: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago
    endTime: new Date(Date.now() - 150000).toISOString(), // 2:30 ago
    logs: [
      'Pipeline execution started',
      'Loading data from sample_ohlcv.csv',
      'Run cancelled by user'
    ],
    results: {},
    error: null
  }
};

// Mock dataset schemas
export const mockDatasets = {
  sampleOhlcv: {
    id: 'sample_ohlcv.csv',
    name: 'BTC/USD 1m Sample Data',
    filename: 'BTC_1m_hyperliquid_perpetualx.csv',
    size: 51200,
    columns: ['ts', 'open', 'high', 'low', 'close', 'volume', 'coin', 'exchange_id', 'data_type'],
    rowCount: 1000,
    uploadedAt: new Date('2024-01-01T00:00:00Z').toISOString()
  },

  ethData: {
    id: 'eth_4h_data.csv',
    name: 'ETH/USD 4h Historical Data',
    filename: 'ETH_4h_binance.csv',
    size: 25600,
    columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume'],
    rowCount: 500,
    uploadedAt: new Date('2024-01-02T00:00:00Z').toISOString()
  },

  largeDataset: {
    id: 'large_dataset.csv',
    name: 'Large Multi-Asset Dataset',
    filename: 'multi_asset_1m.csv',
    size: 10485760, // 10MB
    columns: ['ts', 'symbol', 'open', 'high', 'low', 'close', 'volume'],
    rowCount: 50000,
    uploadedAt: new Date('2024-01-03T00:00:00Z').toISOString()
  }
};

// Sample OHLCV data for testing
export const sampleOhlcvData = [
  {
    ts: '1640995200000',
    open: '46000.50',
    high: '46500.25',
    low: '45800.75',
    close: '46200.00',
    volume: '15.25',
    coin: 'BTC',
    exchange_id: '1',
    data_type: 'spot'
  },
  {
    ts: '1640995260000',
    open: '46200.00',
    high: '46350.80',
    low: '46100.25',
    close: '46150.50',
    volume: '12.85',
    coin: 'BTC',
    exchange_id: '1',
    data_type: 'spot'
  },
  {
    ts: '1640995320000',
    open: '46150.50',
    high: '46400.00',
    low: '46050.25',
    close: '46300.75',
    volume: '18.90',
    coin: 'BTC',
    exchange_id: '1',
    data_type: 'spot'
  }
];

// Mock node execution results
export const mockNodeResults = {
  dataLoader: {
    success: true,
    nodeId: 'price_data',
    executionTime: 150,
    output: {
      type: 'dataframe',
      data: sampleOhlcvData,
      metadata: {
        rows: 1000,
        columns: 9,
        symbol: 'BTC/USD',
        timeframe: '1h'
      }
    },
    error: null
  },

  smaIndicator: {
    success: true,
    nodeId: 'sma_20',
    executionTime: 85,
    output: {
      type: 'dataframe',
      data: sampleOhlcvData.map((row, i) => ({
        ...row,
        sma_20: (46000 + i * 50).toFixed(2) // Mock SMA values
      })),
      metadata: {
        indicator: 'SMA',
        period: 20,
        column: 'close'
      }
    },
    error: null
  },

  failedNode: {
    success: false,
    nodeId: 'failed_node',
    executionTime: 25,
    output: null,
    error: 'Node execution failed: Invalid parameter value'
  }
};

// Test utilities
export const testUtils = {
  /**
   * Generate a random run ID
   */
  generateRunId: () => uuidv4(),

  /**
   * Generate test timestamps
   */
  generateTimestamp: (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString(),

  /**
   * Create a mock pipeline run with custom properties
   */
  createMockRun: (overrides = {}) => ({
    id: uuidv4(),
    pipelineId: 'test-pipeline',
    status: 'completed' as const,
    startTime: new Date(Date.now() - 60000).toISOString(),
    endTime: new Date().toISOString(),
    logs: ['Pipeline execution completed'],
    results: {},
    error: null,
    ...overrides
  }),

  /**
   * Create sample OHLCV data with specified length
   */
  generateOhlcvData: (length = 100, symbol = 'BTC') => {
    const data = [];
    const basePrice = symbol === 'BTC' ? 46000 : 3500;
    const baseTimestamp = 1640995200000; // Jan 1, 2022

    for (let i = 0; i < length; i++) {
      const price = basePrice + (Math.random() - 0.5) * 1000;
      data.push({
        ts: (baseTimestamp + i * 60000).toString(), // 1 minute intervals
        open: (price + Math.random() * 50).toFixed(2),
        high: (price + Math.random() * 100 + 50).toFixed(2),
        low: (price - Math.random() * 100).toFixed(2),
        close: (price + (Math.random() - 0.5) * 50).toFixed(2),
        volume: (Math.random() * 50).toFixed(2),
        coin: symbol,
        exchange_id: '1',
        data_type: 'spot'
      });
    }

    return data;
  },

  /**
   * Create a mock API response
   */
  createApiResponse: (data: any, success = true, message?: string) => ({
    success,
    data: success ? data : undefined,
    error: success ? undefined : data,
    message
  }),

  /**
   * Wait for a specified number of milliseconds
   */
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate a random string for testing
   */
  randomString: (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  },

  /**
   * Create error scenarios for testing
   */
  createErrorScenarios: () => ({
    networkTimeout: new Error('Network timeout'),
    invalidJson: new Error('Invalid JSON response'),
    unauthorized: new Error('Unauthorized access'),
    notFound: new Error('Resource not found'),
    serverError: new Error('Internal server error'),
    compilationError: new Error('DSL compilation failed'),
    runtimeError: new Error('Node runtime error')
  })
};

// Performance testing utilities
export const performanceUtils = {
  /**
   * Measure execution time of a function
   */
  measureTime: async <T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> => {
    const start = Date.now();
    const result = await fn();
    const timeMs = Date.now() - start;
    return { result, timeMs };
  },

  /**
   * Create concurrent test requests
   */
  createConcurrentRequests: <T>(fn: () => Promise<T>, count = 10): Promise<T[]> => {
    return Promise.all(Array(count).fill(null).map(() => fn()));
  },

  /**
   * Test memory usage patterns
   */
  createMemoryStressTest: (sizeKb = 100) => {
    const data = new Array(sizeKb * 1024).fill(0).map((_, i) => ({ id: i, data: testUtils.randomString(100) }));
    return data;
  }
};

// Mock Docker container responses for sandbox testing
export const mockDockerResponses = {
  pythonSuccess: {
    stdout: JSON.stringify({
      success: true,
      output: {
        type: 'dataframe',
        data: sampleOhlcvData
      }
    }),
    stderr: '',
    exitCode: 0
  },

  pythonError: {
    stdout: '',
    stderr: 'Traceback (most recent call last):\nError: Invalid input data',
    exitCode: 1
  },

  nodeSuccess: {
    stdout: JSON.stringify({
      success: true,
      output: {
        type: 'json',
        data: { processed: true }
      }
    }),
    stderr: '',
    exitCode: 0
  },

  timeout: {
    stdout: '',
    stderr: 'Process timeout',
    exitCode: 124
  }
};