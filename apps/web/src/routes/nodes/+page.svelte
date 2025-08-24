<script lang="ts">
  import { onMount } from 'svelte';
  
  // Mock node data for now - in real implementation this would come from API
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
      <button class="btn btn-secondary" disabled>
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
        </svg>
        Create Custom Node
      </button>
      
      <button class="btn btn-ghost" disabled>
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
        </svg>
        Import Node
      </button>
    </div>
  </div>

  <div class="space-y-8">
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
      <h3 class="font-bold">Development Note</h3>
      <div class="text-xs">
        This is a preview of the node library. In the full implementation, nodes will be dynamically discovered from the backend services and include interactive documentation and examples.
      </div>
    </div>
  </div>
</div>