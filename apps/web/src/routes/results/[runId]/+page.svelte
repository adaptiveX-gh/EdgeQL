<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { runApi, pipelineApi, ApiError } from '$lib/api/client.js';
  import type { PipelineRun, Pipeline, LogEntry } from '$lib/api/types.js';
  import EquityCurveChart from '$lib/charts/EquityCurveChart.svelte';
  
  let runId = $page.params.runId;
  let run: PipelineRun | null = null;
  let pipeline: Pipeline | null = null;
  let loading = true;
  let error: string | null = null;
  let showToast = false;
  let toastMessage = '';
  let cancelling = false;
  
  // Structured logs state
  let structuredLogs: LogEntry[] = [];
  let showStructuredLogs = false;
  let selectedLogLevel: string = 'all';
  let selectedLogSource: string = 'all';
  let selectedNodeId: string = 'all';
  let availableNodeIds: string[] = [];
  
  // Check if this is a shared/read-only view
  $: isSharedView = $page.url.searchParams.has('share');

  onMount(async () => {
    if (!runId) {
      error = 'Run ID not found';
      loading = false;
      return;
    }
    
    try {
      run = await runApi.get(runId);
      if (run.pipelineId) {
        try {
          pipeline = await pipelineApi.get(run.pipelineId);
        } catch (err) {
          // Pipeline might have been deleted, but we can still show run results
          console.warn('Failed to load pipeline:', err);
        }
      }
    } catch (err) {
      console.error('Failed to load run:', err);
      if (err instanceof ApiError && err.status === 404) {
        error = 'Run not found';
      } else {
        error = 'Failed to load run results';
      }
    } finally {
      loading = false;
    }
  });

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast = true;
    toastMessage = 'Link copied to clipboard!';
    setTimeout(() => {
      showToast = false;
    }, 3000);
  };
  
  const copyShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('share', 'true');
    navigator.clipboard.writeText(url.toString());
    showToast = true;
    toastMessage = 'Shareable link copied to clipboard!';
    setTimeout(() => {
      showToast = false;
    }, 3000);
  };

  const downloadResults = () => {
    if (!run?.results) return;
    
    const data = {
      runId: run.id,
      pipelineId: run.pipelineId,
      pipelineName: pipeline?.name,
      startTime: run.startTime,
      endTime: run.endTime,
      results: run.results,
      logs: run.logs
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest-results-${run.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTrades = async () => {
    if (!run) return;
    
    try {
      await runApi.downloadTrades(run.id);
      showToast = true;
      toastMessage = 'Trade history exported successfully!';
      setTimeout(() => {
        showToast = false;
      }, 3000);
    } catch (error) {
      console.error('Failed to export trades:', error);
      showToast = true;
      toastMessage = 'Failed to export trades. Please try again.';
      setTimeout(() => {
        showToast = false;
      }, 3000);
    }
  };

  const downloadMetrics = async () => {
    if (!run) return;
    
    try {
      await runApi.downloadMetrics(run.id);
      showToast = true;
      toastMessage = 'Metrics exported successfully!';
      setTimeout(() => {
        showToast = false;
      }, 3000);
    } catch (error) {
      console.error('Failed to export metrics:', error);
      showToast = true;
      toastMessage = 'Failed to export metrics. Please try again.';
      setTimeout(() => {
        showToast = false;
      }, 3000);
    }
  };

  const cancelRun = async () => {
    if (!run) return;
    
    try {
      cancelling = true;
      await runApi.cancel(run.id);
      
      showToast = true;
      toastMessage = 'Run cancelled successfully!';
      setTimeout(() => {
        showToast = false;
        // Reload the run to get updated status
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Failed to cancel run:', err);
      if (err instanceof ApiError) {
        showToast = true;
        toastMessage = `Failed to cancel run: ${err.message}`;
      } else {
        showToast = true;
        toastMessage = 'Failed to cancel run. Please try again.';
      }
      setTimeout(() => {
        showToast = false;
      }, 3000);
    } finally {
      cancelling = false;
    }
  };

  const loadStructuredLogs = async () => {
    if (!run) return;
    
    try {
      const options: any = {};
      if (selectedLogLevel !== 'all') options.level = selectedLogLevel;
      if (selectedLogSource !== 'all') options.source = selectedLogSource;
      if (selectedNodeId !== 'all') options.nodeId = selectedNodeId;
      
      const response = await runApi.getStructuredLogs(run.id, options);
      structuredLogs = response.logs;
    } catch (err) {
      console.error('Failed to load structured logs:', err);
    }
  };

  const extractAvailableNodeIds = (logs: LogEntry[]) => {
    const nodeIds = new Set(logs.map(log => log.nodeId));
    return Array.from(nodeIds).sort();
  };

  const formatLogLevel = (level: string) => {
    const colors: Record<string, string> = {
      info: 'text-info',
      warn: 'text-warning',
      error: 'text-error',
      debug: 'text-gray-500'
    };
    return colors[level] || 'text-gray-700';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Load structured logs when run is loaded or filters change
  $: if (run && showStructuredLogs) {
    loadStructuredLogs();
  }

  // Extract available node IDs when run changes
  $: if (run?.structuredLogs) {
    availableNodeIds = extractAvailableNodeIds(run.structuredLogs);
  };
</script>

<svelte:head>
  <title>{isSharedView ? 'Shared Results' : 'Run Results'} - {runId}</title>
  <meta name="description" content="Backtest results for pipeline run {runId}" />
</svelte:head>

<div class="max-w-6xl mx-auto">
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
  {:else if run}
    <!-- Shared View Banner -->
    {#if isSharedView}
      <div class="alert alert-info mb-6">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
        </svg>
        <div>
          <h3 class="font-bold">Shared Results View</h3>
          <div class="text-xs">You're viewing shared backtest results in read-only mode.</div>
        </div>
      </div>
    {/if}

    <!-- Header -->
    <div class="flex justify-between items-start mb-6">
      <div>
        <h1 class="text-3xl font-bold text-base-content">Backtest Results</h1>
        {#if pipeline}
          <p class="text-base-content/70 mt-1">{pipeline.name}</p>
        {/if}
        <div class="text-sm text-base-content/50 mt-1">
          Run ID: {run.id} • {new Date(run.startTime).toLocaleString()}
        </div>
      </div>
      
      <div class="flex gap-3">
        {#if run?.status === 'running' || run?.status === 'pending'}
          <button 
            class="btn btn-error btn-sm" 
            disabled={cancelling}
            on:click={cancelRun}
          >
            {#if cancelling}
              <span class="loading loading-spinner loading-xs mr-2"></span>
              Cancelling...
            {:else}
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              Cancel Run
            {/if}
          </button>
        {/if}
        
        {#if !isSharedView}
          <button class="btn btn-ghost btn-sm" on:click={copyLink}>
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            Copy Link
          </button>
          
          <button class="btn btn-outline btn-sm" on:click={copyShareLink}>
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
            </svg>
            Share
          </button>
        {/if}
        
        {#if run.results}
          <!-- Export dropdown -->
          <div class="dropdown dropdown-end">
            <label tabindex="0" class="btn btn-primary btn-sm">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-4-4m4 4l4-4m-6 6h8"></path>
              </svg>
              Export
              <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </label>
            <ul tabindex="0" class="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 z-50">
              <li>
                <button on:click={downloadResults} class="text-left">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  All Results (JSON)
                </button>
              </li>
              {#if run.results.trades && run.results.trades.length > 0}
                <li>
                  <button on:click={downloadTrades} class="text-left">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Trade History (CSV)
                  </button>
                </li>
              {/if}
              <li>
                <button on:click={downloadMetrics} class="text-left">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  Performance Metrics (JSON)
                </button>
              </li>
            </ul>
          </div>
        {/if}
        
        {#if pipeline && !isSharedView}
          <a href="/pipeline/{pipeline.id}" class="btn btn-secondary btn-sm">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
            </svg>
            Edit Pipeline
          </a>
        {/if}
      </div>
    </div>

    <!-- Status Alert -->
    <div class="alert mb-6" 
         class:alert-success={run.status === 'completed'}
         class:alert-error={run.status === 'failed'}
         class:alert-warning={run.status === 'cancelled'}
         class:alert-info={run.status === 'running' || run.status === 'pending'}>
      {#if run.status === 'completed'}
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span><strong>Completed</strong> - Backtest finished successfully</span>
      {:else if run.status === 'failed'}
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <span><strong>Failed</strong> - {run.error || 'Unknown error occurred'}</span>
      {:else if run.status === 'cancelled'}
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span><strong>Cancelled</strong> - Run was cancelled before completion</span>
      {:else}
        <span class="loading loading-spinner loading-sm"></span>
        <span><strong>Running</strong> - Backtest in progress...</span>
      {/if}
    </div>

    {#if run.results}
      <!-- Key Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div class="stat bg-base-100 shadow rounded-lg">
          <div class="stat-title">Total Return</div>
          <div class="stat-value text-2xl" class:text-success={run.results.totalReturn > 0} class:text-error={run.results.totalReturn < 0}>
            {run.results.totalReturn > 0 ? '+' : ''}{run.results.totalReturn.toFixed(2)}%
          </div>
          <div class="stat-desc">
            {run.results.totalReturn > 0 ? 'Profit' : 'Loss'}
          </div>
        </div>

        <div class="stat bg-base-100 shadow rounded-lg">
          <div class="stat-title">Sharpe Ratio</div>
          <div class="stat-value text-2xl">{run.results.sharpeRatio.toFixed(2)}</div>
          <div class="stat-desc">
            Risk-adjusted return
          </div>
        </div>

        <div class="stat bg-base-100 shadow rounded-lg">
          <div class="stat-title">Max Drawdown</div>
          <div class="stat-value text-2xl text-error">{run.results.maxDrawdown.toFixed(2)}%</div>
          <div class="stat-desc">
            Worst peak-to-trough
          </div>
        </div>

        <div class="stat bg-base-100 shadow rounded-lg">
          <div class="stat-title">Total Trades</div>
          <div class="stat-value text-2xl">{run.results.numTrades}</div>
          <div class="stat-desc">
            Executed trades
          </div>
        </div>

        <div class="stat bg-base-100 shadow rounded-lg">
          <div class="stat-title">Win Rate</div>
          <div class="stat-value text-2xl">{(run.results.winRate * 100).toFixed(1)}%</div>
          <div class="stat-desc">
            Winning trades
          </div>
        </div>
      </div>

      <!-- Additional Details -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title">Performance Summary</h3>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="text-base-content/70">Final Capital:</span>
                <span class="font-mono">${run.results.finalCapital.toLocaleString()}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/70">Start Time:</span>
                <span>{new Date(run.startTime).toLocaleString()}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/70">End Time:</span>
                <span>{run.endTime ? new Date(run.endTime).toLocaleString() : 'N/A'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/70">Duration:</span>
                <span>
                  {#if run.endTime}
                    {Math.round((new Date(run.endTime).getTime() - new Date(run.startTime).getTime()) / 1000)}s
                  {:else}
                    N/A
                  {/if}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <h3 class="card-title">Trade Analysis</h3>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="text-base-content/70">Total Trades:</span>
                <span>{run.results.numTrades}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/70">Winning Trades:</span>
                <span class="text-success">{Math.round(run.results.numTrades * run.results.winRate)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/70">Losing Trades:</span>
                <span class="text-error">{run.results.numTrades - Math.round(run.results.numTrades * run.results.winRate)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/70">Win Rate:</span>
                <span>{(run.results.winRate * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Execution Logs -->
    {#if run.logs && run.logs.length > 0}
      <div class="card bg-base-100 shadow-lg mb-8">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h3 class="card-title">Execution Logs</h3>
            <div class="flex gap-2">
              {#if run.structuredLogs && run.structuredLogs.length > 0}
                <button 
                  class="btn btn-sm btn-outline"
                  class:btn-active={showStructuredLogs}
                  on:click={() => showStructuredLogs = !showStructuredLogs}
                >
                  {showStructuredLogs ? 'Show Legacy' : 'Show Structured'}
                </button>
              {/if}
            </div>
          </div>
          
          {#if showStructuredLogs && run.structuredLogs}
            <!-- Structured Logs View -->
            <div class="space-y-4">
              <!-- Filters -->
              <div class="flex flex-wrap gap-4">
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Node</span>
                  </label>
                  <select class="select select-sm select-bordered" bind:value={selectedNodeId} on:change={loadStructuredLogs}>
                    <option value="all">All Nodes</option>
                    {#each availableNodeIds as nodeId}
                      <option value={nodeId}>{nodeId}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Level</span>
                  </label>
                  <select class="select select-sm select-bordered" bind:value={selectedLogLevel} on:change={loadStructuredLogs}>
                    <option value="all">All Levels</option>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                
                <div class="form-control">
                  <label class="label">
                    <span class="label-text">Source</span>
                  </label>
                  <select class="select select-sm select-bordered" bind:value={selectedLogSource} on:change={loadStructuredLogs}>
                    <option value="all">All Sources</option>
                    <option value="system">System</option>
                    <option value="node">Node</option>
                  </select>
                </div>
              </div>
              
              <!-- Structured Log Entries -->
              <div class="bg-base-300 rounded p-4 max-h-96 overflow-y-auto">
                {#if structuredLogs.length === 0}
                  <div class="text-center py-8 text-base-content/50">
                    No logs match the current filters
                  </div>
                {:else}
                  {#each structuredLogs as log}
                    <div class="flex items-start gap-4 py-2 border-b border-base-content/10 last:border-b-0">
                      <div class="text-xs text-base-content/70 min-w-[80px] font-mono">
                        {formatTimestamp(log.timestamp)}
                      </div>
                      <div class="min-w-[60px]">
                        <span class="badge badge-xs {formatLogLevel(log.level)}">
                          {log.level.toUpperCase()}
                        </span>
                      </div>
                      <div class="min-w-[120px] text-xs text-base-content/70">
                        <span class="badge badge-outline badge-xs">{log.nodeId}</span>
                        <span class="ml-1 text-xs">({log.source})</span>
                      </div>
                      <div class="flex-1 text-sm font-mono">
                        {log.message}
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {:else}
            <!-- Legacy Logs View -->
            <div class="bg-base-300 rounded p-4 max-h-64 overflow-y-auto">
              {#each run.logs as log}
                <div class="text-sm font-mono py-1">{log}</div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Interactive Equity Curve Chart -->
    <div class="mb-8">
      <h3 class="text-2xl font-bold text-base-content mb-4">Portfolio Performance</h3>
      {#if run?.results && run.results.equityCurve}
        <EquityCurveChart 
          equityCurve={run.results.equityCurve} 
          trades={run.results.trades || []}
          title="Interactive Equity Curve"
          height="500px"
          showDrawdown={true}
          showTrades={true}
        />
      {:else}
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body">
            <div class="flex items-center justify-center h-64 bg-base-200 rounded">
              <div class="text-center">
                <svg class="w-16 h-16 mx-auto text-base-content/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <h4 class="text-lg font-semibold mb-2">No Chart Data</h4>
                <p class="text-base-content/70">No equity curve data available for this run.</p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Toast Notification -->
{#if showToast}
  <div class="toast toast-top toast-center z-50">
    <div class="alert alert-success">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <span>{toastMessage}</span>
    </div>
  </div>
{/if}