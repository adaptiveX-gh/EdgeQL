import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { CustomNode, ApiResponse } from '../types/index.js';

const router: RouterType = Router();

// In-memory storage for MVP
const nodes = new Map<string, CustomNode>();

// Initialize with built-in node definitions for reference
const builtInNodes = [
  {
    id: 'DataLoaderNode',
    name: 'Data Loader',
    type: 'builtin',
    language: 'python' as const,
    description: 'Loads OHLCV data from CSV files or external sources',
    inputSchema: {},
    outputSchema: {
      type: 'dataframe',
      columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume']
    }
  },
  {
    id: 'IndicatorNode',
    name: 'Technical Indicator',
    type: 'builtin',
    language: 'python' as const,
    description: 'Calculates technical indicators (SMA, EMA, RSI, etc.)',
    inputSchema: {
      type: 'dataframe'
    },
    outputSchema: {
      type: 'dataframe'
    }
  },
  {
    id: 'CrossoverSignalNode',
    name: 'Crossover Signal',
    type: 'builtin',
    language: 'python' as const,
    description: 'Generates buy/sell signals based on indicator crossovers',
    inputSchema: {
      type: 'multiple_dataframes'
    },
    outputSchema: {
      type: 'dataframe',
      columns: ['timestamp', 'signal']
    }
  },
  {
    id: 'BacktestNode',
    name: 'Backtest Engine',
    type: 'builtin',
    language: 'python' as const,
    description: 'Simulates trading strategy and calculates performance metrics',
    inputSchema: {
      signals: { type: 'dataframe' },
      data: { type: 'dataframe' }
    },
    outputSchema: {
      type: 'backtest_results'
    }
  }
];

// GET /api/nodes - List all nodes (built-in and custom)
router.get('/', (req, res) => {
  const customNodes = Array.from(nodes.values());
  const allNodes = [...builtInNodes, ...customNodes];
  
  const response: ApiResponse<any[]> = {
    success: true,
    data: allNodes
  };
  return res.json(response);
});

// GET /api/nodes/builtin - List built-in nodes
router.get('/builtin', (req, res) => {
  const response: ApiResponse<any[]> = {
    success: true,
    data: builtInNodes
  };
  return res.json(response);
});

// GET /api/nodes/custom - List custom nodes
router.get('/custom', (req, res) => {
  const customNodes = Array.from(nodes.values());
  
  const response: ApiResponse<CustomNode[]> = {
    success: true,
    data: customNodes
  };
  return res.json(response);
});

// GET /api/nodes/:id - Get specific node
router.get('/:id', (req, res) => {
  const nodeId = req.params.id;
  
  // Check built-in nodes first
  const builtInNode = builtInNodes.find(node => node.id === nodeId);
  if (builtInNode) {
    const response: ApiResponse<any> = {
      success: true,
      data: builtInNode
    };
    return res.json(response);
  }
  
  // Check custom nodes
  const customNode = nodes.get(nodeId);
  if (customNode) {
    const response: ApiResponse<CustomNode> = {
      success: true,
      data: customNode
    };
    return res.json(response);
  }
  
  return res.status(404).json({
    success: false,
    error: 'Node not found'
  } as ApiResponse);
});

// POST /api/nodes - Create new custom node
router.post('/', (req, res) => {
  // This would be implemented in Sprint 3 for custom JS nodes
  res.status(501).json({
    success: false,
    error: 'Custom node creation not yet implemented (coming in Sprint 3)'
  } as ApiResponse);
});

// PUT /api/nodes/:id - Update custom node
router.put('/:id', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Custom node editing not yet implemented (coming in Sprint 3)'
  } as ApiResponse);
});

// DELETE /api/nodes/:id - Delete custom node
router.delete('/:id', (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Custom node deletion not yet implemented (coming in Sprint 3)'
  } as ApiResponse);
});

export { router as nodesRouter };