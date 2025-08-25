import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { CustomNode, ApiResponse } from '../types/index.js';
import { CustomNodeStorage } from '../utils/storage.js';
import { NodeValidator } from '../utils/nodeValidation.js';

const router: RouterType = Router();

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

// GET /api/nodes - List all nodes (built-in and custom) with filtering
router.get('/', async (req, res) => {
  try {
    const { search, tags, type } = req.query;
    
    // Get custom nodes with filtering
    const customNodes = await CustomNodeStorage.getAll({
      search: search as string,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined
    });

    let allNodes: any[] = [...builtInNodes, ...customNodes];

    // Apply type filter
    if (type && typeof type === 'string') {
      allNodes = allNodes.filter(node => node.type === type);
    }

    // Apply search filter to built-in nodes as well
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      allNodes = allNodes.filter(node => 
        node.name.toLowerCase().includes(searchLower) ||
        node.description?.toLowerCase().includes(searchLower)
      );
    }
    
    const response: ApiResponse<any[]> = {
      success: true,
      data: allNodes
    };
    return res.json(response);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch nodes'
    } as ApiResponse);
  }
});

// GET /api/nodes/builtin - List built-in nodes
router.get('/builtin', (req, res) => {
  const response: ApiResponse<any[]> = {
    success: true,
    data: builtInNodes
  };
  return res.json(response);
});

// GET /api/nodes/custom - List custom nodes with filtering
router.get('/custom', async (req, res) => {
  try {
    const { search, tags } = req.query;
    
    const customNodes = await CustomNodeStorage.getAll({
      search: search as string,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined
    });
    
    const response: ApiResponse<CustomNode[]> = {
      success: true,
      data: customNodes
    };
    return res.json(response);
  } catch (error) {
    console.error('Error fetching custom nodes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch custom nodes'
    } as ApiResponse);
  }
});

// GET /api/nodes/:id - Get specific node (with optional version)
router.get('/:id', async (req, res) => {
  try {
    const nodeId = req.params.id;
    const version = req.query.version ? parseInt(req.query.version as string) : undefined;
    
    // Check built-in nodes first (built-in nodes don't have versions)
    if (!version) {
      const builtInNode = builtInNodes.find(node => node.id === nodeId);
      if (builtInNode) {
        const response: ApiResponse<any> = {
          success: true,
          data: builtInNode
        };
        return res.json(response);
      }
    }
    
    // Check custom nodes
    const customNode = await CustomNodeStorage.get(nodeId, version);
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
  } catch (error) {
    console.error('Error fetching node:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch node'
    } as ApiResponse);
  }
});

// POST /api/nodes - Create new custom node
router.post('/', async (req, res) => {
  try {
    const nodeData = req.body;

    // Validate input data
    const validation = NodeValidator.validateNodeData(nodeData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      } as ApiResponse);
    }

    // Check for duplicate names
    const existingNodes = await CustomNodeStorage.getAll();
    const nameExists = existingNodes.some(node => 
      node.name.toLowerCase() === nodeData.name.toLowerCase()
    );
    if (nameExists) {
      return res.status(409).json({
        success: false,
        error: 'A node with this name already exists'
      } as ApiResponse);
    }

    // Set defaults
    const nodeToCreate = {
      name: nodeData.name,
      type: 'custom',
      language: nodeData.language || 'javascript' as const,
      code: nodeData.code,
      description: nodeData.description || '',
      author: nodeData.author,
      inputSchema: nodeData.inputSchema,
      outputSchema: nodeData.outputSchema,
      tags: nodeData.tags || [],
      userId: nodeData.userId
    };

    // Create the node
    const createdNode = await CustomNodeStorage.create(nodeToCreate);

    const response: ApiResponse<CustomNode> = {
      success: true,
      data: createdNode,
      message: validation.warnings.length > 0 ? `Node created with warnings: ${validation.warnings.join(', ')}` : 'Node created successfully'
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Error creating node:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create node'
    } as ApiResponse);
  }
});

// PUT /api/nodes/:id - Update custom node
router.put('/:id', async (req, res) => {
  try {
    const nodeId = req.params.id;
    const updateData = req.body;
    const { changeDescription } = req.body;

    // Don't allow updating built-in nodes
    if (builtInNodes.find(node => node.id === nodeId)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot update built-in nodes'
      } as ApiResponse);
    }

    // Check if node exists
    const existingNode = await CustomNodeStorage.get(nodeId);
    if (!existingNode) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      } as ApiResponse);
    }

    // Validate updated data
    const nodeDataToValidate = { ...existingNode, ...updateData };
    const validation = NodeValidator.validateNodeData(nodeDataToValidate);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      } as ApiResponse);
    }

    // Check for name conflicts if name is being changed
    if (updateData.name && updateData.name !== existingNode.name) {
      const allNodes = await CustomNodeStorage.getAll();
      const nameExists = allNodes.some(node => 
        node.id !== nodeId && node.name.toLowerCase() === updateData.name.toLowerCase()
      );
      if (nameExists) {
        return res.status(409).json({
          success: false,
          error: 'A node with this name already exists'
        } as ApiResponse);
      }
    }

    // Update the node
    const updatedNode = await CustomNodeStorage.update(nodeId, updateData, changeDescription);
    if (!updatedNode) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      } as ApiResponse);
    }

    const response: ApiResponse<CustomNode> = {
      success: true,
      data: updatedNode,
      message: validation.warnings.length > 0 ? `Node updated with warnings: ${validation.warnings.join(', ')}` : 'Node updated successfully'
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error updating custom node:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update custom node'
    } as ApiResponse);
  }
});

// DELETE /api/nodes/:id - Delete custom node
router.delete('/:id', async (req, res) => {
  try {
    const nodeId = req.params.id;

    // Don't allow deleting built-in nodes
    if (builtInNodes.find(node => node.id === nodeId)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete built-in nodes'
      } as ApiResponse);
    }

    // Check if node exists before attempting deletion
    const existingNode = await CustomNodeStorage.get(nodeId);
    if (!existingNode) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      } as ApiResponse);
    }

    // Delete the node (this also removes all versions and files)
    const deleted = await CustomNodeStorage.delete(nodeId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      } as ApiResponse);
    }

    const response: ApiResponse<{ deleted: boolean; nodeId: string }> = {
      success: true,
      data: { deleted: true, nodeId },
      message: 'Node and all its versions have been deleted successfully'
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error deleting custom node:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete custom node'
    } as ApiResponse);
  }
});

// GET /api/nodes/:id/versions - Get version history for a custom node
router.get('/:id/versions', async (req, res) => {
  try {
    const nodeId = req.params.id;

    // Check if node exists
    const node = await CustomNodeStorage.get(nodeId);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'Node not found'
      } as ApiResponse);
    }

    const versions = await CustomNodeStorage.getVersions(nodeId);
    
    const response: ApiResponse<any[]> = {
      success: true,
      data: versions
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error fetching node versions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch node versions'
    } as ApiResponse);
  }
});

// GET /api/nodes/tags/:tag - Get nodes by tag
router.get('/tags/:tag', async (req, res) => {
  try {
    const tag = req.params.tag;
    const nodes = await CustomNodeStorage.getByTag(tag);
    
    const response: ApiResponse<CustomNode[]> = {
      success: true,
      data: nodes
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error fetching nodes by tag:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch nodes by tag'
    } as ApiResponse);
  }
});

export { router as nodesRouter };