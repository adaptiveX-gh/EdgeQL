<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PipelineVersion } from '../api/types.js';
  
  export let pipelineId: string; // Used by parent component for context
  export let versions: PipelineVersion[] = [];
  export let loading = false;
  export let currentVersion: number | undefined = undefined;
  
  const dispatch = createEventDispatcher<{
    restore: { version: PipelineVersion };
    compare: { versionA: PipelineVersion; versionB: PipelineVersion };
    delete: { version: PipelineVersion };
    close: void;
  }>();

  let selectedVersions: Set<string> = new Set();
  let showConfirmDelete: PipelineVersion | null = null;
  let showRestoreConfirm: PipelineVersion | null = null;

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVersionBadgeClass = (version: PipelineVersion): string => {
    if (version.version === currentVersion) return 'badge-primary';
    if (version.isAutoSave) return 'badge-ghost';
    if (version.tags?.includes('restored')) return 'badge-info';
    return 'badge-outline';
  };

  const getVersionIcon = (version: PipelineVersion): string => {
    if (version.version === currentVersion) return '🔴'; // Current
    if (version.isAutoSave) return '💾'; // Auto-save
    if (version.tags?.includes('restored')) return '↪️'; // Restored
    return '📝'; // Manual
  };

  const toggleVersionSelection = (versionId: string) => {
    if (selectedVersions.has(versionId)) {
      selectedVersions.delete(versionId);
    } else {
      // Limit to 2 selections for comparison
      if (selectedVersions.size >= 2) {
        const firstSelected = Array.from(selectedVersions)[0];
        selectedVersions.delete(firstSelected);
      }
      selectedVersions.add(versionId);
    }
    selectedVersions = new Set(selectedVersions);
  };

  const handleCompare = () => {
    if (selectedVersions.size === 2) {
      const selectedIds = Array.from(selectedVersions);
      const versionA = versions.find(v => v.id === selectedIds[0]);
      const versionB = versions.find(v => v.id === selectedIds[1]);
      
      if (versionA && versionB) {
        dispatch('compare', { versionA, versionB });
      }
    }
  };

  const handleRestore = (version: PipelineVersion) => {
    showRestoreConfirm = version;
  };

  const confirmRestore = () => {
    if (showRestoreConfirm) {
      dispatch('restore', { version: showRestoreConfirm });
      showRestoreConfirm = null;
    }
  };

  const handleDelete = (version: PipelineVersion) => {
    showConfirmDelete = version;
  };

  const confirmDelete = () => {
    if (showConfirmDelete) {
      dispatch('delete', { version: showConfirmDelete });
      showConfirmDelete = null;
    }
  };

  const canDelete = (version: PipelineVersion): boolean => {
    return version.version !== currentVersion;
  };

  const getTruncatedMessage = (message: string | undefined, maxLength = 50): string => {
    if (!message) return '';
    return message.length > maxLength ? `${message.slice(0, maxLength)}...` : message;
  };
</script>

<div class="modal modal-open">
  <div class="modal-box w-11/12 max-w-4xl">
    <div class="flex justify-between items-center mb-6">
      <h3 class="font-bold text-lg">Version History</h3>
      <button 
        class="btn btn-sm btn-circle btn-ghost" 
        on:click={() => dispatch('close')}
      >
        ✕
      </button>
    </div>

    {#if loading}
      <div class="flex items-center justify-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
        <span class="ml-3">Loading version history...</span>
      </div>
    {:else if versions.length === 0}
      <div class="text-center py-8">
        <div class="text-base-content/60">
          <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p class="text-lg">No versions found</p>
          <p class="text-sm">Start making changes to create version history</p>
        </div>
      </div>
    {:else}
      <!-- Actions bar -->
      <div class="flex justify-between items-center mb-4 pb-3 border-b border-base-300">
        <div class="text-sm text-base-content/70">
          {versions.length} version{versions.length !== 1 ? 's' : ''} found
        </div>
        
        <div class="flex gap-2">
          {#if selectedVersions.size === 2}
            <button 
              class="btn btn-sm btn-outline btn-info"
              on:click={handleCompare}
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2H13a2 2 0 00-2 2"></path>
              </svg>
              Compare Selected
            </button>
          {:else}
            <div class="text-xs text-base-content/50">
              Select 2 versions to compare
            </div>
          {/if}
        </div>
      </div>

      <!-- Version list -->
      <div class="space-y-2 max-h-96 overflow-y-auto">
        {#each versions as version (version.id)}
          <div 
            class="card bg-base-200 hover:bg-base-300 transition-colors duration-200 cursor-pointer"
            class:ring-2={selectedVersions.has(version.id)}
            class:ring-primary={selectedVersions.has(version.id)}
            on:click={() => toggleVersionSelection(version.id)}
          >
            <div class="card-body p-4">
              <div class="flex items-start justify-between">
                <div class="flex items-start space-x-3 flex-1">
                  <!-- Version info -->
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-lg">{getVersionIcon(version)}</span>
                      <span class="font-semibold">Version {version.version}</span>
                      <div class="badge {getVersionBadgeClass(version)} badge-sm">
                        {version.version === currentVersion ? 'Current' : 
                         version.isAutoSave ? 'Auto-save' : 'Manual'}
                      </div>
                      {#each (version.tags || []) as tag}
                        <div class="badge badge-outline badge-xs">{tag}</div>
                      {/each}
                    </div>
                    
                    <p class="text-sm text-base-content/80 mb-2">
                      {getTruncatedMessage(version.commitMessage)}
                    </p>
                    
                    <div class="flex items-center text-xs text-base-content/60 gap-4">
                      <span>{formatDate(version.createdAt)}</span>
                      {#if version.createdBy}
                        <span>by {version.createdBy}</span>
                      {/if}
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1">
                    {#if version.version !== currentVersion}
                      <button 
                        class="btn btn-xs btn-primary btn-outline"
                        on:click|stopPropagation={() => handleRestore(version)}
                        title="Restore this version"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                        </svg>
                        Restore
                      </button>
                    {/if}
                    
                    {#if canDelete(version)}
                      <button 
                        class="btn btn-xs btn-error btn-outline"
                        on:click|stopPropagation={() => handleDelete(version)}
                        title="Delete this version"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Actions -->
    <div class="modal-action">
      <button class="btn btn-ghost" on:click={() => dispatch('close')}>
        Close
      </button>
    </div>
  </div>
</div>

<!-- Restore Confirmation Modal -->
{#if showRestoreConfirm}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Restore Version {showRestoreConfirm.version}?</h3>
      <p class="py-4">
        This will restore your pipeline to version {showRestoreConfirm.version}. 
        Your current changes will be backed up automatically before restoring.
      </p>
      <div class="modal-action">
        <button class="btn" on:click={() => showRestoreConfirm = null}>
          Cancel
        </button>
        <button class="btn btn-primary" on:click={confirmRestore}>
          Restore
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showConfirmDelete}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Delete Version {showConfirmDelete.version}?</h3>
      <p class="py-4 text-warning">
        This action cannot be undone. The version will be permanently deleted.
      </p>
      <div class="modal-action">
        <button class="btn" on:click={() => showConfirmDelete = null}>
          Cancel
        </button>
        <button class="btn btn-error" on:click={confirmDelete}>
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}