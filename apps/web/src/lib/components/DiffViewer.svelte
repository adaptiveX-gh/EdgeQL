<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { PipelineVersion } from '../api/types.js';

  export let versionA: PipelineVersion;
  export let versionB: PipelineVersion;
  
  const dispatch = createEventDispatcher<{
    close: void;
    restore: { version: PipelineVersion };
  }>();

  interface DiffLine {
    type: 'added' | 'removed' | 'unchanged' | 'context';
    content: string;
    lineNumber?: number;
    otherLineNumber?: number;
  }

  let diffLines: DiffLine[] = [];
  let showSideBySide = true;

  onMount(() => {
    generateDiff();
  });

  const generateDiff = () => {
    const linesA = versionA.dsl.split('\n');
    const linesB = versionB.dsl.split('\n');
    
    // Simple line-by-line diff algorithm
    const diff = computeLineDiff(linesA, linesB);
    diffLines = diff;
  };

  const computeLineDiff = (linesA: string[], linesB: string[]): DiffLine[] => {
    const result: DiffLine[] = [];
    let i = 0, j = 0;

    while (i < linesA.length || j < linesB.length) {
      if (i >= linesA.length) {
        // Only lines from B remain (additions)
        result.push({
          type: 'added',
          content: linesB[j],
          otherLineNumber: j + 1
        });
        j++;
      } else if (j >= linesB.length) {
        // Only lines from A remain (deletions)
        result.push({
          type: 'removed',
          content: linesA[i],
          lineNumber: i + 1
        });
        i++;
      } else if (linesA[i] === linesB[j]) {
        // Lines are identical
        result.push({
          type: 'unchanged',
          content: linesA[i],
          lineNumber: i + 1,
          otherLineNumber: j + 1
        });
        i++;
        j++;
      } else {
        // Lines differ - look ahead to find the best match
        const nextMatchA = findNextMatch(linesA, i, linesB[j]);
        const nextMatchB = findNextMatch(linesB, j, linesA[i]);
        
        if (nextMatchA !== -1 && (nextMatchB === -1 || nextMatchA - i <= nextMatchB - j)) {
          // Insert deletions until we reach the matching line
          while (i < nextMatchA) {
            result.push({
              type: 'removed',
              content: linesA[i],
              lineNumber: i + 1
            });
            i++;
          }
        } else if (nextMatchB !== -1) {
          // Insert additions until we reach the matching line
          while (j < nextMatchB) {
            result.push({
              type: 'added',
              content: linesB[j],
              otherLineNumber: j + 1
            });
            j++;
          }
        } else {
          // No clear match - treat as substitution
          result.push({
            type: 'removed',
            content: linesA[i],
            lineNumber: i + 1
          });
          result.push({
            type: 'added',
            content: linesB[j],
            otherLineNumber: j + 1
          });
          i++;
          j++;
        }
      }
    }

    return result;
  };

  const findNextMatch = (lines: string[], startIndex: number, target: string): number => {
    for (let i = startIndex; i < Math.min(lines.length, startIndex + 10); i++) {
      if (lines[i] === target) {
        return i;
      }
    }
    return -1;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLineClass = (type: string): string => {
    switch (type) {
      case 'added': return 'bg-success/20 text-success-content';
      case 'removed': return 'bg-error/20 text-error-content';
      case 'unchanged': return '';
      default: return '';
    }
  };

  const getLinePrefix = (type: string): string => {
    switch (type) {
      case 'added': return '+';
      case 'removed': return '-';
      case 'unchanged': return ' ';
      default: return ' ';
    }
  };

  const getDiffStats = () => {
    const added = diffLines.filter(line => line.type === 'added').length;
    const removed = diffLines.filter(line => line.type === 'removed').length;
    return { added, removed };
  };

  $: stats = getDiffStats();
</script>

<div class="modal modal-open">
  <div class="modal-box w-11/12 max-w-6xl max-h-screen">
    <!-- Header -->
    <div class="flex justify-between items-center mb-4">
      <div>
        <h3 class="font-bold text-lg">Compare Versions</h3>
        <div class="text-sm text-base-content/70 mt-1">
          <span class="badge badge-error badge-outline">-{stats.removed}</span>
          <span class="badge badge-success badge-outline ml-1">+{stats.added}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="form-control">
          <label class="label cursor-pointer">
            <span class="label-text mr-2">Side-by-side</span>
            <input 
              type="checkbox" 
              class="toggle toggle-sm" 
              bind:checked={showSideBySide}
            />
          </label>
        </div>
        <button 
          class="btn btn-sm btn-circle btn-ghost" 
          on:click={() => dispatch('close')}
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Version info -->
    <div class="grid grid-cols-2 gap-4 mb-4 p-4 bg-base-200 rounded-lg">
      <div>
        <div class="font-semibold text-error">Version {versionA.version} (Old)</div>
        <div class="text-sm text-base-content/70">{formatDate(versionA.createdAt)}</div>
        <div class="text-sm">{versionA.commitMessage}</div>
      </div>
      <div>
        <div class="font-semibold text-success">Version {versionB.version} (New)</div>
        <div class="text-sm text-base-content/70">{formatDate(versionB.createdAt)}</div>
        <div class="text-sm">{versionB.commitMessage}</div>
      </div>
    </div>

    <!-- Diff content -->
    <div class="bg-base-300 rounded-lg overflow-hidden">
      {#if showSideBySide}
        <!-- Side-by-side view -->
        <div class="grid grid-cols-2 divide-x divide-base-content/20">
          <!-- Left side (Version A) -->
          <div class="p-4">
            <div class="text-sm font-medium mb-2 text-error">
              Version {versionA.version}
            </div>
            <div class="font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
              {#each versionA.dsl.split('\n') as line, i}
                <div class="flex">
                  <span class="text-base-content/50 w-8 text-right mr-2">{i + 1}</span>
                  <span class="flex-1">{line || ' '}</span>
                </div>
              {/each}
            </div>
          </div>
          
          <!-- Right side (Version B) -->
          <div class="p-4">
            <div class="text-sm font-medium mb-2 text-success">
              Version {versionB.version}
            </div>
            <div class="font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
              {#each versionB.dsl.split('\n') as line, i}
                <div class="flex">
                  <span class="text-base-content/50 w-8 text-right mr-2">{i + 1}</span>
                  <span class="flex-1">{line || ' '}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else}
        <!-- Unified diff view -->
        <div class="p-4">
          <div class="font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
            {#each diffLines as line}
              <div class="flex {getLineClass(line.type)} px-2 py-1 rounded">
                <span class="text-base-content/50 w-4 mr-2">{getLinePrefix(line.type)}</span>
                <span class="w-8 text-right mr-2 text-base-content/50">
                  {line.lineNumber || line.otherLineNumber || ''}
                </span>
                <span class="flex-1">{line.content || ' '}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Actions -->
    <div class="modal-action">
      <button 
        class="btn btn-outline btn-error" 
        on:click={() => dispatch('restore', { version: versionA })}
        title="Restore to version {versionA.version}"
      >
        Restore v{versionA.version}
      </button>
      <button 
        class="btn btn-outline btn-success" 
        on:click={() => dispatch('restore', { version: versionB })}
        title="Restore to version {versionB.version}"
      >
        Restore v{versionB.version}
      </button>
      <button class="btn" on:click={() => dispatch('close')}>
        Close
      </button>
    </div>
  </div>
</div>

<style>
  /* Custom scrollbar for better visibility in diff viewer */
  .max-h-96::-webkit-scrollbar {
    width: 8px;
  }
  
  .max-h-96::-webkit-scrollbar-track {
    background: hsl(var(--b2));
    border-radius: 4px;
  }
  
  .max-h-96::-webkit-scrollbar-thumb {
    background: hsl(var(--bc) / 0.3);
    border-radius: 4px;
  }
  
  .max-h-96::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--bc) / 0.5);
  }
</style>