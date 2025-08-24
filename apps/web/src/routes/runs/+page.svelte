<script lang="ts">
  import { onMount } from 'svelte';
  import { runApi, pipelineApi, ApiError } from '$lib/api/client.js';
  import type { PipelineRun, Pipeline } from '$lib/api/types.js';
  
  let runs: PipelineRun[] = [];
  let pipelines: Map<string, Pipeline> = new Map();
  let loading = true;
  let error: string | null = null;
  let selectedStatus = 'all';
  let limit = 25;
  let offset = 0;
  let hasMore = true;

  const statusOptions = [
    { value: 'all', label: 'All Runs' },
    { value: 'completed', label: 'Completed' },
    { value: 'running', label: 'Running' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  onMount(async () => {
    await loadRuns();
    await loadPipelines();
  });

  const loadRuns = async (append = false) => {
    try {
      const newRuns = await runApi.list(limit, append ? offset : 0);
      
      if (append) {
        runs = [...runs, ...newRuns];
      } else {
        runs = newRuns;
        offset = 0;
      }
      
      hasMore = newRuns.length >= limit;
      if (!append) {
        offset = newRuns.length;
      } else {
        offset += newRuns.length;
      }
    } catch (err) {
      console.error('Failed to load runs:', err);
      if (err instanceof ApiError) {
        error = err.message;
      } else {
        error = 'Failed to load runs';
      }
    } finally {
      loading = false;
    }
  };

  const loadPipelines = async () => {
    try {
      const pipelineList = await pipelineApi.list();
      pipelines = new Map(pipelineList.map(p => [p.id, p]));
    } catch (err) {
      console.warn('Failed to load pipelines:', err);
    }
  };

  const loadMore = () => {
    loadRuns(true);
  };

  const refresh = () => {
    loading = true;
    error = null;
    loadRuns();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'running':
      case 'pending':
        return 'badge-info';
      case 'failed':
        return 'badge-error';
      case 'cancelled':
        return 'badge-warning';
      default:
        return 'badge-ghost';
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.round(durationMs / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  };

  $: filteredRuns = selectedStatus === 'all' 
    ? runs 
    : runs.filter(run => run.status === selectedStatus);
</script>

<svelte:head>
  <title>Run History - EdgeQL ML</title>
</svelte:head>

<div class="max-w-7xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-3xl font-bold text-base-content">Run History</h1>
      <p class="text-base-content/70 mt-1">View past pipeline executions and results</p>
    </div>
    
    <div class="flex gap-3">
      <select class="select select-bordered" bind:value={selectedStatus}>
        {#each statusOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      
      <button class="btn btn-ghost" on:click={refresh} disabled={loading}>
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        Refresh
      </button>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error mb-6">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
      </svg>
      <div>
        <h3 class="font-bold">Connection Error</h3>
        <div class="text-xs">{error}</div>
      </div>
      <button class="btn btn-sm btn-outline" on:click={refresh}>
        Retry
      </button>
    </div>
  {/if}

  {#if loading && runs.length === 0}
    <div class="grid grid-cols-1 gap-4">
      {#each Array(5) as _}
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="animate-pulse">
              <div class="h-4 bg-base-300 rounded w-1/4 mb-2"></div>
              <div class="h-3 bg-base-300 rounded w-3/4 mb-2"></div>
              <div class="h-3 bg-base-300 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if filteredRuns.length === 0}
    <div class="text-center py-12">
      <div class="mb-4">
        <svg class="w-16 h-16 mx-auto text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-base-content mb-2">No runs found</h3>
      <p class="text-base-content/70 mb-4">
        {selectedStatus === 'all' ? 'No pipeline runs have been executed yet.' : `No ${selectedStatus} runs found.`}
      </p>
      <a href="/" class="btn btn-primary">View Pipelines</a>
    </div>
  {:else}
    <div class="space-y-4">
      {#each filteredRuns as run}
        <div class="card bg-base-100 shadow hover:shadow-lg transition-shadow">
          <div class="card-body">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <h3 class="card-title text-lg">
                    {pipelines.get(run.pipelineId)?.name || run.pipelineId}
                  </h3>
                  <div class="badge {getStatusBadgeClass(run.status)} badge-sm">
                    {run.status}
                  </div>
                  {#if run.status === 'running'}
                    <span class="loading loading-spinner loading-xs"></span>
                  {/if}
                </div>
                
                <div class="text-sm text-base-content/70 mb-3">
                  Run ID: {run.id}
                </div>
                
                <div class="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span class="text-base-content/70">Started:</span>
                    <span class="font-mono">{new Date(run.startTime).toLocaleString()}</span>
                  </div>
                  
                  {#if run.endTime}
                    <div>
                      <span class="text-base-content/70">Duration:</span>
                      <span class="font-mono">{formatDuration(run.startTime, run.endTime)}</span>
                    </div>
                  {:else if run.status === 'running'}
                    <div>
                      <span class="text-base-content/70">Running for:</span>
                      <span class="font-mono">{formatDuration(run.startTime)}</span>
                    </div>
                  {/if}
                  
                  {#if run.results}
                    <div>
                      <span class="text-base-content/70">Return:</span>
                      <span class="font-mono" class:text-success={run.results.totalReturn > 0} class:text-error={run.results.totalReturn < 0}>
                        {run.results.totalReturn > 0 ? '+' : ''}{run.results.totalReturn.toFixed(2)}%
                      </span>
                    </div>
                    
                    <div>
                      <span class="text-base-content/70">Trades:</span>
                      <span class="font-mono">{run.results.numTrades}</span>
                    </div>
                    
                    <div>
                      <span class="text-base-content/70">Sharpe:</span>
                      <span class="font-mono">{run.results.sharpeRatio.toFixed(2)}</span>
                    </div>
                  {/if}
                  
                  {#if run.error}
                    <div>
                      <span class="text-base-content/70">Error:</span>
                      <span class="text-error text-sm">{run.error}</span>
                    </div>
                  {/if}
                </div>
              </div>
              
              <div class="flex gap-2">
                {#if run.status === 'completed' && run.results}
                  <a href="/results/{run.id}" class="btn btn-primary btn-sm">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    View Results
                  </a>
                {:else}
                  <button class="btn btn-ghost btn-sm" disabled>
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    No Results
                  </button>
                {/if}
                
                {#if pipelines.get(run.pipelineId)}
                  <a href="/pipeline/{run.pipelineId}" class="btn btn-ghost btn-sm">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                    Edit Pipeline
                  </a>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
      
      {#if hasMore && !loading}
        <div class="text-center py-6">
          <button class="btn btn-outline" on:click={loadMore}>
            Load More
          </button>
        </div>
      {/if}
      
      {#if loading && runs.length > 0}
        <div class="text-center py-6">
          <span class="loading loading-spinner"></span>
        </div>
      {/if}
    </div>
  {/if}
</div>