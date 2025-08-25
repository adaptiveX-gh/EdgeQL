<script lang="ts">
  import { onMount } from 'svelte';
  import { nodeApi } from '../../lib/api/client.js';
  import type { CustomNode } from '../../lib/api/types.js';
  import CustomNodeEditor from '../../lib/components/CustomNodeEditor.svelte';

  // State
  let builtInNodes: any[] = [];
  let customNodes: CustomNode[] = [];
  let loading = true;
  let error = '';
  
  // Editor state
  let isEditorOpen = false;
  let editingNode: CustomNode | null = null;
  let isOperationInProgress = false;

  // Mock built-in node data for display
  let nodeCategories = [
    {
      name: 'Data Sources',
      description: 'Nodes for loading and preprocessing market data',
      nodes: [
        {
          name: 'DataLoaderNode',
          description: 'Load market data from CSV files or external sources',
          inputs: [],
          outputs: ['data'],
          params: ['symbol', 'timeframe', 'dataset'],
          status: 'stable'
        }
      ]
    },
    {
      name: 'Technical Indicators',
      description: 'Mathematical indicators for technical analysis',
      nodes: [
        {
          name: 'IndicatorNode',
          description: 'Calculate technical indicators like SMA, EMA, RSI',
          inputs: ['data'],
          outputs: ['indicator_values'],
          params: ['indicator', 'period', 'column'],
          status: 'stable'
        }
      ]
    },
    {
      name: 'Feature Engineering',
      description: 'Transform raw data into ML features',
      nodes: [
        {
          name: 'FeatureGeneratorNode',
          description: 'Generate ML features from market data',
          inputs: ['data'],
          outputs: ['features'],
          params: ['lookback_period', 'feature_types'],
          status: 'stable'
        }
      ]
    },
    {
      name: 'Signal Generation',
      description: 'Generate trading signals from indicators',
      nodes: [
        {
          name: 'CrossoverSignalNode',
          description: 'Generate signals based on indicator crossovers',
          inputs: ['indicator1', 'indicator2'],
          outputs: ['signals'],
          params: ['buy_condition', 'sell_condition'],
          status: 'stable'
        }
      ]
    },
    {
      name: 'Labeling',
      description: 'Create labels for supervised learning',
      nodes: [
        {
          name: 'LabelingNode',
          description: 'Label data points for supervised learning',
          inputs: ['data'],
          outputs: ['labels'],
          params: ['labeling_method', 'threshold'],
          status: 'stable'
        }
      ]
    },
    {
      name: 'Backtesting',
      description: 'Execute and evaluate trading strategies',
      nodes: [
        {
          name: 'BacktestNode',
          description: 'Run backtests with portfolio management',
          inputs: ['signals', 'data'],
          outputs: ['results'],
          params: ['initial_capital', 'commission', 'position_sizing'],
          status: 'stable'
        }
      ]
    }
  ];

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'stable':
        return 'badge-success';
      case 'beta':
        return 'badge-warning';
      case 'alpha':
        return 'badge-info';
      case 'deprecated':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  };

  // Load nodes on component mount
  onMount(async () => {
    await loadNodes();
  });

  async function loadNodes() {
    try {
      loading = true;
      error = '';
      
      // Load custom nodes from API
      customNodes = await nodeApi.getCustomNodes();
      
    } catch (err) {
      console.error('Error loading nodes:', err);
      error = 'Failed to load custom nodes';
    } finally {
      loading = false;
    }
  }

  // Custom node operations
  function handleCreateNode() {
    editingNode = null;
    isEditorOpen = true;
  }

  function handleEditNode(node: CustomNode) {
    editingNode = node;
    isEditorOpen = true;
  }

  async function handleDeleteNode(node: CustomNode) {
    if (!confirm(`Are you sure you want to delete the custom node "${node.name}"?`)) {
      return;
    }

    try {
      isOperationInProgress = true;
      await nodeApi.delete(node.id);
      await loadNodes(); // Reload the list
    } catch (err) {
      console.error('Error deleting node:', err);
      alert('Failed to delete node. Please try again.');
    } finally {
      isOperationInProgress = false;
    }
  }

  async function handleSaveNode(event: CustomEvent<CustomNode>) {
    const nodeData = event.detail;
    
    try {
      isOperationInProgress = true;
      
      if (editingNode) {
        // Update existing node
        await nodeApi.update(editingNode.id, nodeData);
      } else {
        // Create new node
        await nodeApi.create(nodeData);
      }
      
      isEditorOpen = false;
      editingNode = null;
      await loadNodes(); // Reload the list
      
    } catch (err) {
      console.error('Error saving node:', err);
      alert('Failed to save node. Please check your code and try again.');
    } finally {
      isOperationInProgress = false;
    }
  }

  function handleCancelEdit() {
    isEditorOpen = false;
    editingNode = null;
  }
</script>

<svelte:head>
  <title>Node Library - EdgeQL ML</title>
</svelte:head>

<div class="max-w-7xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-3xl font-bold text-base-content">Node Library</h1>
      <p class="text-base-content/70 mt-1">Available processing nodes for building pipelines</p>
    </div>
    
    <div class="flex gap-3">
      <button 
        class="btn btn-primary" 
        on:click={handleCreateNode}
        disabled={isOperationInProgress}
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
        </svg>
        New Node (JS)
      </button>
      
      <button class="btn btn-ghost" disabled>
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
        </svg>
        Import Node
      </button>
    </div>
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="alert alert-error mb-6">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.98-.833-2.75 0L3.982 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
      </svg>
      <span>{error}</span>
    </div>
  {/if}

  <div class="space-y-8">
    <!-- Custom Nodes Section -->
    <div class="card bg-base-100 shadow-lg">
      <div class="card-body">
        <div class="card-title text-xl mb-4">
          <div class="flex items-center gap-2">
            <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
            </svg>
            Custom JavaScript Nodes
          </div>
          <div class="badge badge-primary badge-outline">{customNodes.length}</div>
        </div>
        
        <p class="text-base-content/70 mb-6">User-created custom nodes with JavaScript runtime</p>
        
        {#if loading}
          <div class="flex justify-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else if customNodes.length === 0}
          <div class="text-center py-12">
            <svg class="w-16 h-16 mx-auto text-base-content/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
            </svg>
            <h3 class="text-lg font-semibold text-base-content/70 mb-2">No custom nodes yet</h3>
            <p class="text-base-content/50 mb-4">Create your first JavaScript node to extend the pipeline functionality</p>
            <button class="btn btn-primary" on:click={handleCreateNode}>
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              Create First Node
            </button>
          </div>
        {:else}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {#each customNodes as node}
              <div class="card bg-base-200 border border-base-300">
                <div class="card-body p-4">
                  <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-lg">{node.name}</h3>
                    <div class="badge badge-accent badge-sm">
                      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3,3H21V21H3V3M7.73,18.04C8.13,18.89 8.92,19.59 10.27,19.59C11.77,19.59 12.8,18.79 12.8,17.04V11.26H11.1V17C11.1,17.86 10.75,18.08 10.2,18.08C9.62,18.08 9.38,17.68 9.09,17.18L7.73,18.04M13.71,17.86C14.21,18.84 15.22,19.59 16.8,19.59C18.4,19.59 19.6,18.76 19.6,17.23C19.6,15.82 18.79,15.19 17.35,14.57L16.93,14.39C16.2,14.08 15.89,13.87 15.89,13.37C15.89,12.96 16.2,12.64 16.7,12.64C17.18,12.64 17.5,12.85 17.79,13.37L18.95,12.5C18.32,11.5 17.39,11.17 16.7,11.17C15.27,11.17 14.28,12.11 14.28,13.34C14.28,14.66 15.07,15.22 16.24,15.68L16.66,15.87C17.45,16.2 17.86,16.43 17.86,17.03C17.86,17.5 17.45,17.85 16.8,17.85C16.05,17.85 15.63,17.47 15.28,16.85L13.71,17.86Z"/>
                      </svg>
                      JS
                    </div>
                  </div>
                  
                  <p class="text-sm text-base-content/70 mb-4">{node.description || 'Custom JavaScript node'}</p>
                  
                  <div class="space-y-3">
                    <!-- Creation Date -->
                    <div>
                      <h4 class="font-semibold text-sm text-base-content/80 mb-1">Created:</h4>
                      <span class="text-xs text-base-content/60">
                        {new Date(node.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <!-- Last Updated -->
                    <div>
                      <h4 class="font-semibold text-sm text-base-content/80 mb-1">Updated:</h4>
                      <span class="text-xs text-base-content/60">
                        {new Date(node.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div class="card-actions justify-end mt-4">
                    <button 
                      class="btn btn-ghost btn-xs" 
                      on:click={() => handleEditNode(node)}
                      disabled={isOperationInProgress}
                    >
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                      Edit
                    </button>
                    <button 
                      class="btn btn-error btn-xs" 
                      on:click={() => handleDeleteNode(node)}
                      disabled={isOperationInProgress}
                    >
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Built-in Nodes Section -->
    {#each nodeCategories as category}
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body">
          <div class="card-title text-xl mb-4">
            {category.name}
            <div class="badge badge-outline">{category.nodes.length}</div>
          </div>
          
          <p class="text-base-content/70 mb-6">{category.description}</p>
          
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {#each category.nodes as node}
              <div class="card bg-base-200 border border-base-300">
                <div class="card-body p-4">
                  <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-lg">{node.name}</h3>
                    <div class="badge {getStatusBadgeClass(node.status)} badge-sm">
                      {node.status}
                    </div>
                  </div>
                  
                  <p class="text-sm text-base-content/70 mb-4">{node.description}</p>
                  
                  <div class="space-y-3">
                    <!-- Inputs -->
                    <div>
                      <h4 class="font-semibold text-sm text-base-content/80 mb-1">Inputs:</h4>
                      <div class="flex flex-wrap gap-1">
                        {#if node.inputs.length === 0}
                          <span class="text-xs text-base-content/50">None</span>
                        {:else}
                          {#each node.inputs as input}
                            <div class="badge badge-outline badge-sm">{input}</div>
                          {/each}
                        {/if}
                      </div>
                    </div>
                    
                    <!-- Outputs -->
                    <div>
                      <h4 class="font-semibold text-sm text-base-content/80 mb-1">Outputs:</h4>
                      <div class="flex flex-wrap gap-1">
                        {#each node.outputs as output}
                          <div class="badge badge-primary badge-outline badge-sm">{output}</div>
                        {/each}
                      </div>
                    </div>
                    
                    <!-- Parameters -->
                    <div>
                      <h4 class="font-semibold text-sm text-base-content/80 mb-1">Parameters:</h4>
                      <div class="flex flex-wrap gap-1">
                        {#each node.params as param}
                          <div class="badge badge-secondary badge-outline badge-sm">{param}</div>
                        {/each}
                      </div>
                    </div>
                  </div>
                  
                  <div class="card-actions justify-end mt-4">
                    <button class="btn btn-ghost btn-xs" disabled>
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      Documentation
                    </button>
                    <button class="btn btn-primary btn-xs" disabled>
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                      Add to Pipeline
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Development Notice -->
  <div class="alert alert-info mt-8">
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
    <div>
      <h3 class="font-bold">Node Library Features</h3>
      <div class="text-xs">
        <ul class="list-disc list-inside mt-1 space-y-1">
          <li>Create custom JavaScript nodes with Monaco editor</li>
          <li>Edit and manage your custom node library</li>
          <li>Built-in nodes provide core ML/trading functionality</li>
          <li>All nodes can be used in pipeline creation</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- Custom Node Editor Modal -->
<CustomNodeEditor 
  bind:isOpen={isEditorOpen}
  node={editingNode}
  on:save={handleSaveNode}
  on:cancel={handleCancelEdit}
/>