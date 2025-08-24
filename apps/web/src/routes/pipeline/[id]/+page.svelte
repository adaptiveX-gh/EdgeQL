<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import MonacoEditor from '../../../lib/monaco/MonacoEditor.svelte';
  import { pipelineApi, runApi, RunPoller, ApiError } from '../../../lib/api/client.js';
  import type { Pipeline, PipelineRun } from '../../../lib/api/types.js';
  
  export let pipelineId = '';
  
  // Get pipeline ID from URL if not provided as prop
  onMount(() => {
    if (!pipelineId) {
      const path = window.location.pathname;
      const match = path.match(/\/pipeline\/([^/]+)/);
      if (match) {
        pipelineId = match[1];
      }
    }
  });
  let pipeline: Pipeline | null = null;
  let dslContent = '';
  let loading = true;
  let error: string | null = null;

  let runStatus = '';
  let currentRun: PipelineRun | null = null;
  let isRunning = false;
  let runPoller: RunPoller | null = null;
  
  onMount(async () => {
    try {
      pipeline = await pipelineApi.get(pipelineId);
      dslContent = pipeline.dsl;
    } catch (err) {
      console.error('Failed to load pipeline:', err);
      if (err instanceof ApiError && err.status === 404) {
        error = 'Pipeline not found';
      } else {
        error = 'Failed to load pipeline';
      }
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (runPoller) {
      runPoller.destroy();
    }
  });

  const handleDslChange = (event: CustomEvent<{ value: string }>) => {
    dslContent = event.detail.value;
  };
  
  const runPipeline = async () => {
    if (!pipeline) return;
    
    isRunning = true;
    runStatus = 'Starting pipeline execution...';
    currentRun = null;
    
    try {
      const result = await pipelineApi.run(pipelineId, dslContent);
      
      runStatus = `Pipeline running with ID: ${result.runId}`;
      
      // Start polling for run status
      runPoller = new RunPoller(result.runId);
      runPoller.onUpdate((run) => {
        currentRun = run;
        updateRunStatus(run);
      });
      runPoller.start();
      
    } catch (err) {
      console.error('Failed to run pipeline:', err);
      runStatus = `Error: ${err instanceof ApiError ? err.message : 'Failed to start pipeline'}`;
      isRunning = false;
    }
  };

  const updateRunStatus = (run: PipelineRun) => {
    switch (run.status) {
      case 'pending':
        runStatus = 'Pipeline queued for execution...';
        break;
      case 'running':
        runStatus = 'Pipeline is running...';
        break;
      case 'completed':
        runStatus = 'Pipeline completed successfully!';
        isRunning = false;
        break;
      case 'failed':
        runStatus = `Pipeline failed: ${run.error || 'Unknown error'}`;
        isRunning = false;
        break;
      case 'cancelled':
        runStatus = 'Pipeline was cancelled';
        isRunning = false;
        break;
    }
  };

  const cancelRun = async () => {
    if (!currentRun || !isRunning) return;
    
    try {
      await runApi.cancel(currentRun.id);
      runStatus = 'Cancelling pipeline...';
    } catch (err) {
      console.error('Failed to cancel run:', err);
    }
  };

  const viewResults = (runId: string) => {
    // Use the global navigate function
    if (window.navigate) {
      window.navigate('results', { runId });
    } else {
      // Fallback to direct navigation
      window.location.href = `/results/${runId}`;
    }
  };
</script>

<svelte:head>
  <title>Pipeline Editor - {pipelineId}</title>
</svelte:head>

<div class="max-w-7xl mx-auto">
  {#if loading}
    <div class="flex justify-center items-center h-64">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
      </svg>
      <div>
        <h3 class="font-bold">Error</h3>
        <div class="text-xs">{error}</div>
      </div>
      <a href="/" class="btn btn-sm btn-outline">Back to Pipelines</a>
    </div>
  {:else if pipeline}
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-3xl font-bold text-base-content">{pipeline.name}</h1>
        <p class="text-base-content/70 mt-1">{pipeline.description}</p>
      </div>
      
      <div class="flex gap-3">
        <button class="btn btn-secondary" disabled>
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          Save
        </button>
        
        {#if isRunning}
          <button class="btn btn-error btn-outline" on:click={cancelRun}>
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            Cancel
          </button>
        {/if}
        
        <button 
          class="btn btn-primary" 
          class:loading={isRunning} 
          disabled={isRunning || !pipeline} 
          on:click={runPipeline}
        >
          {#if isRunning}
            <span class="loading loading-spinner loading-sm"></span>
            Running...
          {:else}
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1M9 16h1m4 0h1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Run Pipeline
          {/if}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- DSL Editor -->
      <div class="lg:col-span-2">
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body p-0">
            <div class="bg-base-200 px-4 py-2 border-b">
              <h3 class="font-semibold text-sm">Pipeline DSL</h3>
            </div>
            <div class="p-4">
              <MonacoEditor
                bind:value={dslContent}
                language="dsl"
                theme="vs-dark"
                height="400px"
                on:change={handleDslChange}
                options={{
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  fontSize: 14
                }}
              />
            </div>
          </div>
        </div>
      </div>

    <!-- Sidebar with status and results -->
    <div class="space-y-6">
        <!-- Run Status -->
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title text-lg">Run Status</h3>
            
            {#if runStatus}
              <div class="alert" class:alert-info={isRunning} class:alert-success={currentRun?.status === 'completed'} class:alert-error={currentRun?.status === 'failed'}>
                {#if isRunning}
                  <span class="loading loading-spinner loading-sm"></span>
                {:else if currentRun?.status === 'completed'}
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                {:else if currentRun?.status === 'failed'}
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                  </svg>
                {:else}
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                {/if}
                <span class="text-sm">{runStatus}</span>
              </div>
            {:else}
              <p class="text-base-content/70 text-sm">No active runs</p>
            {/if}
            
            {#if currentRun}
              <div class="text-xs text-base-content/50 mt-2">
                Run ID: {currentRun.id}
              </div>
              {#if currentRun.logs && currentRun.logs.length > 0}
                <div class="mt-3">
                  <details class="collapse collapse-arrow">
                    <summary class="collapse-title text-sm font-medium">View Logs</summary>
                    <div class="collapse-content">
                      <div class="bg-base-300 rounded p-2 max-h-32 overflow-y-auto">
                        {#each currentRun.logs as log}
                          <div class="text-xs font-mono">{log}</div>
                        {/each}
                      </div>
                    </div>
                  </details>
                </div>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Results -->
        {#if currentRun?.status === 'completed' && currentRun.results}
          <div class="card bg-base-100 shadow-lg">
            <div class="card-body">
              <h3 class="card-title text-lg">Backtest Results</h3>
              
              <div class="stats stats-vertical shadow">
                <div class="stat">
                  <div class="stat-title">Total Return</div>
                  <div class="stat-value text-sm" class:text-success={currentRun.results.totalReturn > 0} class:text-error={currentRun.results.totalReturn < 0}>
                    {currentRun.results.totalReturn > 0 ? '+' : ''}{currentRun.results.totalReturn.toFixed(2)}%
                  </div>
                </div>
                
                <div class="stat">
                  <div class="stat-title">Sharpe Ratio</div>
                  <div class="stat-value text-sm">{currentRun.results.sharpeRatio.toFixed(2)}</div>
                </div>
                
                <div class="stat">
                  <div class="stat-title">Max Drawdown</div>
                  <div class="stat-value text-sm text-error">{currentRun.results.maxDrawdown.toFixed(2)}%</div>
                </div>
                
                <div class="stat">
                  <div class="stat-title">Trades</div>
                  <div class="stat-value text-sm">{currentRun.results.numTrades}</div>
                </div>
                
                <div class="stat">
                  <div class="stat-title">Win Rate</div>
                  <div class="stat-value text-sm">{(currentRun.results.winRate * 100).toFixed(1)}%</div>
                </div>
              </div>
              
              <div class="mt-4 space-y-2">
                <button 
                  class="btn btn-sm btn-primary w-full"
                  on:click={() => viewResults(currentRun.id)}
                >
                  View Full Report
                </button>
                <div class="text-xs text-center text-base-content/50">
                  Final Capital: ${currentRun.results.finalCapital.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Pipeline Info -->
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title text-lg">Pipeline Info</h3>
            
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-base-content/70">Status:</span>
                <span class="badge badge-success badge-sm">{pipeline.status}</span>
              </div>
              
              <div class="flex justify-between">
                <span class="text-base-content/70">Created:</span>
                <span>{new Date(pipeline.createdAt).toLocaleDateString()}</span>
              </div>
              
              <div class="flex justify-between">
                <span class="text-base-content/70">Modified:</span>
                <span>{new Date(pipeline.updatedAt).toLocaleDateString()}</span>
              </div>
              
              <div class="flex justify-between">
                <span class="text-base-content/70">Last Run:</span>
                <span>{currentRun ? new Date(currentRun.startTime).toLocaleDateString() : 'Never'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>