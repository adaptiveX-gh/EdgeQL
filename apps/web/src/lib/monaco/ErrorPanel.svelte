<script lang="ts">
  export let errors: Array<{
    type: 'syntax' | 'semantic' | 'schema';
    message: string;
    node?: string;
    field?: string;
    line?: number;
    column?: number;
  }> = [];
  export let warnings: string[] = [];
  
  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'syntax':
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'semantic':
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z';
      case 'schema':
        return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  };

  const getErrorTypeColor = (type: string) => {
    switch (type) {
      case 'syntax':
        return 'text-error';
      case 'semantic':
        return 'text-warning';
      case 'schema':
        return 'text-info';
      default:
        return 'text-error';
    }
  };

  const getErrorTypeLabel = (type: string) => {
    switch (type) {
      case 'syntax':
        return 'Syntax Error';
      case 'semantic':
        return 'Semantic Error';
      case 'schema':
        return 'Schema Error';
      default:
        return 'Error';
    }
  };

  const formatLocation = (line?: number, column?: number) => {
    if (line !== undefined && column !== undefined) {
      return `Line ${line}, Column ${column}`;
    } else if (line !== undefined) {
      return `Line ${line}`;
    }
    return '';
  };

  const handleErrorClick = (error: any) => {
    if (error.line !== undefined) {
      // Emit an event to jump to the error location in the editor
      dispatchEvent(new CustomEvent('jumpToLine', {
        detail: { line: error.line, column: error.column }
      }));
    }
  };

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    jumpToLine: { line: number; column?: number };
  }>();

  const handleErrorClickDispatch = (error: any) => {
    if (error.line !== undefined) {
      dispatch('jumpToLine', { line: error.line, column: error.column });
    }
  };
</script>

<div class="error-panel bg-base-100 border border-base-300 rounded-lg">
  <div class="bg-base-200 px-4 py-2 border-b border-base-300 rounded-t-lg">
    <h3 class="font-semibold text-sm flex items-center gap-2">
      {#if errors.length > 0}
        <svg class="w-4 h-4 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        Problems ({errors.length + warnings.length})
      {:else if warnings.length > 0}
        <svg class="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        Problems ({warnings.length})
      {:else}
        <svg class="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        No Problems
      {/if}
    </h3>
  </div>
  
  <div class="max-h-48 overflow-y-auto">
    {#if errors.length === 0 && warnings.length === 0}
      <div class="p-4 text-center text-base-content/60">
        <svg class="w-8 h-8 mx-auto mb-2 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p class="text-sm">DSL syntax is valid</p>
      </div>
    {:else}
      <!-- Errors -->
      {#each errors as error, index}
        <div 
          class="error-item border-b border-base-300 p-3 hover:bg-base-50 cursor-pointer transition-colors"
          class:border-b-0={index === errors.length - 1 && warnings.length === 0}
          on:click={() => handleErrorClickDispatch(error)}
          on:keydown={(e) => e.key === 'Enter' && handleErrorClickDispatch(error)}
          role="button"
          tabindex="0"
        >
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 mt-0.5 flex-shrink-0 {getErrorTypeColor(error.type)}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{getErrorIcon(error.type)}"></path>
            </svg>
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium {getErrorTypeColor(error.type)}">
                  {getErrorTypeLabel(error.type)}
                </span>
                {#if error.node}
                  <span class="badge badge-sm badge-outline">
                    {error.node}
                  </span>
                {/if}
              </div>
              
              <p class="text-sm text-base-content/80 mb-1">
                {error.message}
              </p>
              
              <div class="flex items-center gap-4 text-xs text-base-content/60">
                {#if error.line !== undefined || error.column !== undefined}
                  <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    {formatLocation(error.line, error.column)}
                  </span>
                {/if}
                {#if error.field}
                  <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                    </svg>
                    Field: {error.field}
                  </span>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
      
      <!-- Warnings -->
      {#each warnings as warning, index}
        <div 
          class="warning-item border-b border-base-300 p-3"
          class:border-b-0={index === warnings.length - 1}
        >
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 mt-0.5 flex-shrink-0 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-warning">
                  Warning
                </span>
              </div>
              
              <p class="text-sm text-base-content/80">
                {warning}
              </p>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .error-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .error-panel {
    border-radius: 8px;
  }
</style>