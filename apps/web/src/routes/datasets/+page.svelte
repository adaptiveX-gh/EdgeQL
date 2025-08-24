<script lang="ts">
  import { onMount } from 'svelte';
  import { datasetApi, ApiError } from '../../lib/api/client.js';
  import type { Dataset } from '../../lib/api/types.js';
  
  let datasets: Dataset[] = [];
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      datasets = await datasetApi.list();
    } catch (err) {
      console.error('Failed to load datasets:', err);
      if (err instanceof ApiError) {
        error = err.message;
      } else {
        error = 'Failed to connect to API. Please ensure the backend server is running.';
      }
    } finally {
      loading = false;
    }
  });

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };
</script>

<svelte:head>
  <title>Datasets - EdgeQL ML</title>
</svelte:head>

<div class="max-w-6xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-3xl font-bold text-base-content">Datasets</h1>
      <p class="text-base-content/70 mt-1">Available market data for backtesting</p>
    </div>
    
    <button class="btn btn-primary" disabled>
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
      </svg>
      Upload Dataset
    </button>
  </div>

  {#if error}
    <div class="alert alert-error">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
      </svg>
      <div>
        <h3 class="font-bold">Connection Error</h3>
        <div class="text-xs">{error}</div>
      </div>
      <button class="btn btn-sm btn-outline" on:click={() => window.location.reload()}>
        Retry
      </button>
    </div>
  {:else if loading}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each Array(3) as _}
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="animate-pulse">
              <div class="h-4 bg-base-300 rounded w-3/4 mb-2"></div>
              <div class="h-3 bg-base-300 rounded w-1/2 mb-4"></div>
              <div class="h-3 bg-base-300 rounded w-full mb-2"></div>
              <div class="h-3 bg-base-300 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if datasets.length === 0}
    <div class="text-center py-12">
      <div class="mb-4">
        <svg class="w-16 h-16 mx-auto text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-base-content mb-2">No datasets available</h3>
      <p class="text-base-content/70 mb-4">Upload market data files to start backtesting strategies.</p>
      <button class="btn btn-primary" disabled>Upload First Dataset</button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each datasets as dataset}
        <div class="card bg-base-100 shadow hover:shadow-lg transition-shadow">
          <div class="card-body">
            <div class="flex items-start justify-between mb-2">
              <h2 class="card-title text-lg">{dataset.name}</h2>
              <div class="badge badge-info badge-sm">CSV</div>
            </div>
            
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-base-content/70">Size:</span>
                <span class="font-mono">{formatFileSize(dataset.size)}</span>
              </div>
              
              <div class="flex justify-between">
                <span class="text-base-content/70">Rows:</span>
                <span class="font-mono">{dataset.rows.toLocaleString()}</span>
              </div>
              
              <div class="flex justify-between">
                <span class="text-base-content/70">Columns:</span>
                <span class="font-mono">{dataset.columns.length}</span>
              </div>
              
              <div class="flex justify-between">
                <span class="text-base-content/70">Modified:</span>
                <span class="text-xs">{new Date(dataset.lastModified).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div class="mt-4">
              <details class="collapse collapse-arrow bg-base-200">
                <summary class="collapse-title text-sm font-medium">Columns</summary>
                <div class="collapse-content">
                  <div class="flex flex-wrap gap-1 mt-2">
                    {#each dataset.columns as column}
                      <div class="badge badge-outline badge-xs">{column}</div>
                    {/each}
                  </div>
                </div>
              </details>
            </div>
            
            <div class="card-actions justify-end mt-4">
              <button class="btn btn-ghost btn-sm" disabled>
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
                Preview
              </button>
              <button class="btn btn-primary btn-sm" disabled>
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-4-4m4 4l4-4m-6 6h8"></path>
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>