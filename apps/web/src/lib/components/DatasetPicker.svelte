<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { datasetApi, ApiError } from '../api/client.js';
  import type { Dataset } from '../api/types.js';

  const dispatch = createEventDispatcher<{
    select: { dataset: Dataset; insertText: string };
  }>();

  export let selectedDatasetId: string = '';
  export let placeholder = 'Select a dataset...';
  export let disabled = false;

  let datasets: Dataset[] = [];
  let loading = true;
  let error = '';
  let showDropdown = false;
  let searchTerm = '';

  onMount(async () => {
    await loadDatasets();
  });

  const loadDatasets = async () => {
    loading = true;
    error = '';
    
    try {
      datasets = await datasetApi.list();
    } catch (err) {
      console.error('Failed to load datasets:', err);
      if (err instanceof ApiError) {
        error = err.message;
      } else {
        error = 'Failed to load datasets';
      }
    } finally {
      loading = false;
    }
  };

  const selectDataset = (dataset: Dataset) => {
    selectedDatasetId = dataset.id;
    showDropdown = false;
    searchTerm = '';

    // Generate DSL text for insertion
    const insertText = `dataset: "${dataset.filename}"`;
    
    dispatch('select', {
      dataset,
      insertText
    });
  };

  const toggleDropdown = () => {
    if (!disabled) {
      showDropdown = !showDropdown;
      if (showDropdown) {
        loadDatasets(); // Refresh on open
      }
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      showDropdown = false;
    }
  };

  // Filter datasets based on search term
  $: filteredDatasets = datasets.filter(dataset => 
    dataset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dataset.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get selected dataset info
  $: selectedDataset = datasets.find(d => d.id === selectedDatasetId);
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="dataset-picker relative" class:disabled>
  <!-- Main Button -->
  <button
    type="button"
    class="picker-button"
    class:active={showDropdown}
    class:has-selection={selectedDataset}
    {disabled}
    on:click={toggleDropdown}
  >
    <div class="flex items-center flex-1 min-w-0">
      <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
      </svg>
      
      <div class="flex-1 min-w-0 text-left">
        {#if selectedDataset}
          <div class="font-medium text-sm truncate">{selectedDataset.name}</div>
          <div class="text-xs text-base-content/60 truncate">{selectedDataset.filename}</div>
        {:else}
          <div class="text-base-content/60 text-sm">{placeholder}</div>
        {/if}
      </div>
    </div>

    <svg 
      class="w-4 h-4 ml-2 transform transition-transform flex-shrink-0" 
      class:rotate-180={showDropdown}
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"></path>
    </svg>
  </button>

  <!-- Dropdown -->
  {#if showDropdown}
    <div class="dropdown-content">
      <!-- Search Input -->
      <div class="p-3 border-b border-base-300">
        <input
          type="text"
          placeholder="Search datasets..."
          class="input input-sm w-full input-bordered"
          bind:value={searchTerm}
          on:click|stopPropagation
        />
      </div>

      <!-- Loading State -->
      {#if loading}
        <div class="p-4 text-center">
          <span class="loading loading-spinner loading-sm"></span>
          <div class="text-sm text-base-content/60 mt-2">Loading datasets...</div>
        </div>
      
      <!-- Error State -->
      {:else if error}
        <div class="p-4 text-center">
          <div class="text-error text-sm mb-2">{error}</div>
          <button class="btn btn-xs btn-outline" on:click={loadDatasets}>
            Retry
          </button>
        </div>
      
      <!-- Empty State -->
      {:else if filteredDatasets.length === 0}
        <div class="p-4 text-center">
          {#if searchTerm}
            <div class="text-sm text-base-content/60">No datasets match "{searchTerm}"</div>
          {:else}
            <div class="text-sm text-base-content/60 mb-2">No datasets available</div>
            <div class="text-xs text-base-content/40">Upload a CSV file to get started</div>
          {/if}
        </div>
      
      <!-- Dataset List -->
      {:else}
        <div class="max-h-64 overflow-y-auto">
          {#each filteredDatasets as dataset (dataset.id)}
            <button
              type="button"
              class="dataset-option"
              class:selected={dataset.id === selectedDatasetId}
              on:click={() => selectDataset(dataset)}
            >
              <div class="flex items-center flex-1 min-w-0">
                <div class="w-2 h-2 bg-success rounded-full mr-3 flex-shrink-0"></div>
                
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm truncate">{dataset.name}</div>
                  <div class="flex items-center gap-2 text-xs text-base-content/60 mt-1">
                    <span>{dataset.filename}</span>
                    <span>•</span>
                    <span>{dataset.rowCount.toLocaleString()} rows</span>
                    <span>•</span>
                    <span>{dataset.columns.length} cols</span>
                  </div>
                </div>
              </div>

              {#if dataset.id === selectedDatasetId}
                <svg class="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              {/if}
            </button>
          {/each}
        </div>

        <!-- Footer with dataset count -->
        <div class="p-2 border-t border-base-300 bg-base-200/50">
          <div class="text-xs text-base-content/60 text-center">
            {filteredDatasets.length} dataset{filteredDatasets.length !== 1 ? 's' : ''} available
          </div>
        </div>
      {/if}
    </div>

    <!-- Dropdown Backdrop -->
    <div 
      class="dropdown-backdrop" 
      on:click={() => showDropdown = false}
      role="button"
      tabindex="-1"
      aria-label="Close dropdown"
    ></div>
  {/if}
</div>

<style>
  .dataset-picker {
    @apply w-full;
  }
  
  .dataset-picker.disabled {
    @apply opacity-60 cursor-not-allowed;
  }

  .picker-button {
    @apply w-full min-h-[2.5rem] px-3 py-2 
           bg-base-100 border border-base-300 rounded-lg
           flex items-center cursor-pointer
           hover:border-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
           transition-colors duration-200;
  }

  .picker-button:disabled {
    @apply cursor-not-allowed hover:border-base-300 focus:border-base-300 focus:ring-0;
  }

  .picker-button.active {
    @apply border-primary ring-1 ring-primary;
  }

  .picker-button.has-selection {
    @apply bg-primary/5;
  }

  .dropdown-content {
    @apply absolute top-full left-0 right-0 mt-1 
           bg-base-100 border border-base-300 rounded-lg shadow-lg
           z-50;
  }

  .dropdown-backdrop {
    @apply fixed inset-0 z-40;
  }

  .dataset-option {
    @apply w-full p-3 text-left flex items-center
           hover:bg-base-200 focus:bg-base-200 focus:outline-none
           transition-colors duration-150;
  }

  .dataset-option:first-child {
    @apply rounded-t-lg;
  }

  .dataset-option:last-child {
    @apply rounded-b-lg;
  }

  .dataset-option.selected {
    @apply bg-primary/10 text-primary;
  }
</style>