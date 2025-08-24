<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { runApi, pipelineApi, ApiError } from '$lib/api/client.js';
  import type { PipelineRun, Pipeline } from '$lib/api/types.js';
  import PerformanceChart from '$lib/charts/PerformanceChart.svelte';
  
  let runId = $page.params.runId;
  let run: PipelineRun | null = null;
  let pipeline: Pipeline | null = null;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
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
    // Could add a toast notification here
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
</script>

<svelte:head>
  <title>Run Results - {runId}</title>
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
        <button class="btn btn-ghost btn-sm" on:click={copyLink}>
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          Copy Link
        </button>
        
        {#if run.results}
          <button class="btn btn-primary btn-sm" on:click={downloadResults}>
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-4-4m4 4l4-4m-6 6h8"></path>
            </svg>
            Download Results
          </button>
        {/if}
        
        {#if pipeline}
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
          <h3 class="card-title">Execution Logs</h3>
          <div class="bg-base-300 rounded p-4 max-h-64 overflow-y-auto">
            {#each run.logs as log}
              <div class="text-sm font-mono py-1">{log}</div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Performance Charts -->
    <div class="card bg-base-100 shadow-lg">
      <div class="card-body">
        <h3 class="card-title">Performance Charts</h3>
        {#if run?.results}
          <PerformanceChart 
            equityCurve={run.results.equityCurve || []} 
            trades={run.results.trades || []}
            title="Portfolio Performance"
            height="400px"
          />
        {:else}
          <div class="flex items-center justify-center h-64 bg-base-200 rounded">
            <div class="text-center">
              <svg class="w-16 h-16 mx-auto text-base-content/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              <h4 class="text-lg font-semibold mb-2">No Chart Data</h4>
              <p class="text-base-content/70">No performance data available for this run.</p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>