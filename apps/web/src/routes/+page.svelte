<script lang="ts">
  import { onMount } from 'svelte';
  import { pipelineApi, ApiError } from '$lib/api/client.js';
  import type { Pipeline } from '$lib/api/types.js';
  
  let pipelines: Pipeline[] = [];
  let loading = true;
  let error: string | null = null;
  
  onMount(async () => {
    try {
      pipelines = await pipelineApi.list();
    } catch (err) {
      console.error('Failed to load pipelines:', err);
      if (err instanceof ApiError) {
        error = err.message;
      } else {
        error = 'Failed to connect to API. Please ensure the backend server is running.';
      }
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Pipelines - EdgeQL ML</title>
</svelte:head>

<div class="max-w-6xl mx-auto">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-3xl font-bold text-base-content">Strategy Pipelines</h1>
      <p class="text-base-content/70 mt-1">Design, test, and deploy ML-driven trading strategies</p>
    </div>
    
    <button class="btn btn-primary" disabled>
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
      </svg>
      New Pipeline
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
        <div class="card bg-base-100 shadow-lg">
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
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each pipelines as pipeline}
        <div class="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div class="card-body">
            <div class="flex items-start justify-between">
              <h2 class="card-title text-lg">{pipeline.name}</h2>
              <div class="badge badge-success badge-sm">Ready</div>
            </div>
            
            <p class="text-base-content/70 text-sm mt-2">{pipeline.description}</p>
            
            <div class="text-xs text-base-content/50 mt-4">
              Modified: {new Date(pipeline.updatedAt).toLocaleDateString()}
            </div>
            
            <div class="card-actions justify-end mt-4">
              <a href="/pipeline/{pipeline.id}" class="btn btn-primary btn-sm">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                </svg>
                Edit
              </a>
              <button class="btn btn-ghost btn-sm" disabled>
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                Copy
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if !loading && pipelines.length === 0}
    <div class="text-center py-12">
      <div class="mb-4">
        <svg class="w-16 h-16 mx-auto text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-base-content mb-2">No pipelines yet</h3>
      <p class="text-base-content/70 mb-4">Create your first ML trading strategy pipeline to get started.</p>
      <button class="btn btn-primary" disabled>Create New Pipeline</button>
    </div>
  {/if}
</div>