<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import MonacoEditor from '../../../lib/monaco/MonacoEditor.svelte';
  import ErrorPanel from '../../../lib/monaco/ErrorPanel.svelte';
  import DatasetPicker from '../../../lib/components/DatasetPicker.svelte';
  import VersionHistory from '../../../lib/components/VersionHistory.svelte';
  import DiffViewer from '../../../lib/components/DiffViewer.svelte';
  import { pipelineApi, runApi, RunPoller, ApiError } from '../../../lib/api/client.js';
  import { AutoSave, isSignificantChange, defaultAutoSaveOptions } from '../../../lib/utils/autosave.js';
  import type { Pipeline, PipelineRun, PipelineVersion, PipelineIR, Dataset } from '../../../lib/api/types.js';
  
  export let pipelineId;
  
  // Validate pipelineId prop
  if (!pipelineId) {
    console.error('Pipeline component: pipelineId prop is required');
  }
  
  let pipeline: Pipeline | null = null;
  let dslContent = '';
  let loading = true;
  let error: string | null = null;

  let runStatus = '';
  let currentRun: PipelineRun | null = null;
  let isRunning = false;
  let runPoller: RunPoller | null = null;
  let monacoEditor: any = null;
  let showDatasetHelper = false;

  // Validation state
  let validationErrors: any[] = [];
  let validationWarnings: string[] = [];
  let isValidDSL = true;
  
  // Tab state and compiled IR
  let activeTab = 'editor';
  let compiledIR: PipelineIR | null = null;
  let compilationError: string | null = null;
  let isCompiling = false;

  // Version management state
  let showVersionHistory = false;
  let showDiffViewer = false;
  let versions: PipelineVersion[] = [];
  let versionsLoading = false;
  let diffVersionA: PipelineVersion | null = null;
  let diffVersionB: PipelineVersion | null = null;
  let autoSave: AutoSave | null = null;
  let lastSavedContent = '';
  let hasUnsavedChanges = false;
  let saveStatus = '';
  let manualSaving = false;
  
  onMount(async () => {
    // Skip loading if pipelineId is missing
    if (!pipelineId) {
      error = 'Invalid pipeline ID';
      loading = false;
      return;
    }
    
    try {
      pipeline = await pipelineApi.get(pipelineId);
      dslContent = pipeline.dsl;
      lastSavedContent = pipeline.dsl;
      
      // Initialize auto-save
      autoSave = new AutoSave(pipelineId, {
        ...defaultAutoSaveOptions,
        onSave: (version) => {
          console.log('Auto-saved version:', version.version);
          saveStatus = `Auto-saved v${version.version}`;
          setTimeout(() => {
            if (saveStatus.startsWith('Auto-saved')) {
              saveStatus = '';
            }
          }, 3000);
        },
        onError: (error) => {
          console.error('Auto-save error:', error);
          saveStatus = `Auto-save failed: ${error.message}`;
        }
      });
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
    if (autoSave) {
      autoSave.destroy();
    }
  });

  const handleDslChange = (event: CustomEvent<{ value: string }>) => {
    const newContent = event.detail.value;
    dslContent = newContent;
    
    // Check if content has changed
    hasUnsavedChanges = newContent !== lastSavedContent;
    
    // Schedule auto-save if enabled
    if (autoSave && hasUnsavedChanges) {
      const isSignificant = isSignificantChange(lastSavedContent, newContent);
      autoSave.schedule(newContent, isSignificant);
    }
  };

  const handleMonacoReady = (event: CustomEvent<{ editor: any }>) => {
    monacoEditor = event.detail.editor;
  };

  const handleDatasetSelect = (event: CustomEvent<{ dataset: Dataset; insertText: string }>) => {
    if (monacoEditor) {
      const selection = monacoEditor.getSelection();
      const range = selection || {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1
      };

      monacoEditor.executeEdits('dataset-picker', [{
        range: range,
        text: event.detail.insertText
      }]);

      // Focus back to editor
      monacoEditor.focus();
    }
    
    showDatasetHelper = false;
  };

  const handleValidation = (event: CustomEvent<{ errors: any[]; warnings: string[]; isValid: boolean }>) => {
    validationErrors = event.detail.errors;
    validationWarnings = event.detail.warnings;
    isValidDSL = event.detail.isValid;
  };

  const handleJumpToLine = (event: CustomEvent<{ line: number; column?: number }>) => {
    if (monacoEditor) {
      monacoEditor.jumpToLine(event.detail.line, event.detail.column);
    }
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
    // Debug logging
    if (run.status === 'completed' && run.results) {
      console.log('Run completed with results:', run.results);
      console.log('numTrades:', run.results.numTrades);
      console.log('totalReturn:', run.results.totalReturn);
    }
    
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

  // Helper function to safely format numeric values
  const safeFormatNumber = (value: number | undefined | null, decimals: number = 2, defaultValue: number = 0): string => {
    const numValue = value ?? defaultValue;
    if (typeof numValue !== 'number' || isNaN(numValue)) {
      return defaultValue.toFixed(decimals);
    }
    return numValue.toFixed(decimals);
  };

  const safeFormatPercent = (value: number | undefined | null, decimals: number = 1): string => {
    const numValue = (value ?? 0) * 100;
    return safeFormatNumber(numValue, decimals, 0);
  };

  const switchTab = (tab: string) => {
    activeTab = tab;
    if (tab === 'compiled') {
      compileToIR();
    }
  };

  const compileToIR = async () => {
    if (!pipeline) return;
    
    isCompiling = true;
    compilationError = null;
    
    try {
      compiledIR = await pipelineApi.compile(pipelineId, dslContent);
    } catch (err) {
      console.error('Failed to compile pipeline:', err);
      compilationError = err instanceof ApiError ? err.message : 'Failed to compile pipeline to JSON IR';
      compiledIR = null;
    } finally {
      isCompiling = false;
    }
  };

  // Version management functions
  const loadVersionHistory = async () => {
    if (!pipeline) return;
    
    versionsLoading = true;
    try {
      versions = await pipelineApi.getVersions(pipelineId);
    } catch (err) {
      console.error('Failed to load version history:', err);
      versions = [];
    } finally {
      versionsLoading = false;
    }
  };

  const handleShowVersionHistory = async () => {
    await loadVersionHistory();
    showVersionHistory = true;
  };

  const handleVersionRestore = async (event: CustomEvent<{ version: PipelineVersion }>) => {
    const { version } = event.detail;
    
    try {
      manualSaving = true;
      const result = await pipelineApi.restoreVersion(pipelineId, version.id, {
        createBackup: true,
        commitMessage: `Restored from v${version.version}`
      });
      
      // Update the editor content
      dslContent = version.dsl;
      lastSavedContent = version.dsl;
      hasUnsavedChanges = false;
      
      // Update pipeline state
      if (pipeline) {
        pipeline.dsl = version.dsl;
        pipeline.currentVersion = result.restoredVersion.version;
        pipeline.updatedAt = result.restoredVersion.createdAt;
      }
      
      saveStatus = `Restored to v${version.version}`;
      setTimeout(() => saveStatus = '', 3000);
      
      // Refresh version history
      await loadVersionHistory();
      
    } catch (err) {
      console.error('Failed to restore version:', err);
      saveStatus = `Restore failed: ${err instanceof ApiError ? err.message : 'Unknown error'}`;
    } finally {
      manualSaving = false;
    }
  };

  const handleVersionCompare = (event: CustomEvent<{ versionA: PipelineVersion; versionB: PipelineVersion }>) => {
    diffVersionA = event.detail.versionA;
    diffVersionB = event.detail.versionB;
    showDiffViewer = true;
    showVersionHistory = false;
  };

  const handleVersionDelete = async (event: CustomEvent<{ version: PipelineVersion }>) => {
    const { version } = event.detail;
    
    try {
      await pipelineApi.deleteVersion(pipelineId, version.id);
      
      // Refresh version history
      await loadVersionHistory();
      
      saveStatus = `Deleted v${version.version}`;
      setTimeout(() => saveStatus = '', 3000);
      
    } catch (err) {
      console.error('Failed to delete version:', err);
      saveStatus = `Delete failed: ${err instanceof ApiError ? err.message : 'Unknown error'}`;
    }
  };

  const handleSaveVersion = async (commitMessage?: string) => {
    if (!pipeline || !hasUnsavedChanges) return;
    
    try {
      manualSaving = true;
      
      const version = await pipelineApi.createVersion(pipelineId, {
        dsl: dslContent,
        commitMessage: commitMessage || `Manual save v${(pipeline.currentVersion || 0) + 1}`,
        isAutoSave: false
      });
      
      lastSavedContent = dslContent;
      hasUnsavedChanges = false;
      
      if (pipeline) {
        pipeline.currentVersion = version.version;
        pipeline.updatedAt = version.createdAt;
      }
      
      saveStatus = `Saved as v${version.version}`;
      setTimeout(() => saveStatus = '', 3000);
      
    } catch (err) {
      console.error('Failed to save version:', err);
      saveStatus = `Save failed: ${err instanceof ApiError ? err.message : 'Unknown error'}`;
    } finally {
      manualSaving = false;
    }
  };

  const handleDiffRestore = async (event: CustomEvent<{ version: PipelineVersion }>) => {
    showDiffViewer = false;
    await handleVersionRestore(event);
  };
</script>

<svelte:head>
  <title>Pipeline Editor{pipelineId ? ` - ${pipelineId}` : ''}</title>
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
      
      <div class="flex gap-3 items-center">
        <!-- Save status -->
        {#if saveStatus}
          <div class="badge badge-info badge-sm">{saveStatus}</div>
        {/if}
        
        <!-- Version history button -->
        <button 
          class="btn btn-ghost btn-sm"
          on:click={handleShowVersionHistory}
          title="View version history"
        >
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          History
        </button>
        
        <!-- Save button -->
        <button 
          class="btn btn-secondary" 
          class:loading={manualSaving}
          disabled={!hasUnsavedChanges || manualSaving}
          on:click={() => handleSaveVersion()}
          title={hasUnsavedChanges ? 'Save current changes as new version' : 'No changes to save'}
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          {manualSaving ? 'Saving...' : hasUnsavedChanges ? 'Save *' : 'Saved'}
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
          disabled={isRunning || !pipeline || !isValidDSL} 
          on:click={runPipeline}
          title={!isValidDSL ? 'Fix DSL validation errors before running' : ''}
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
      <!-- Tabbed Editor -->
      <div class="lg:col-span-2">
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body p-0">
            <!-- Tab Headers -->
            <div role="tablist" class="tabs tabs-bordered bg-base-200 flex justify-between items-center px-4">
              <div class="flex">
                <button 
                  class="tab {activeTab === 'editor' ? 'tab-active' : ''}" 
                  on:click={() => switchTab('editor')}
                >
                  DSL Editor
                </button>
                <button 
                  class="tab {activeTab === 'compiled' ? 'tab-active' : ''}" 
                  on:click={() => switchTab('compiled')}
                >
                  Compiled JSON
                  {#if isCompiling}
                    <span class="loading loading-spinner loading-xs ml-2"></span>
                  {/if}
                </button>
              </div>
              
              {#if activeTab === 'editor'}
                <button 
                  class="btn btn-ghost btn-xs"
                  class:btn-active={showDatasetHelper}
                  on:click={() => showDatasetHelper = !showDatasetHelper}
                  title="Insert Dataset Reference"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
                  </svg>
                  Datasets
                </button>
              {/if}
            </div>
            
            <!-- Tab Content -->
            <div class="p-4">
              {#if activeTab === 'editor'}
                <MonacoEditor
                  bind:this={monacoEditor}
                  bind:value={dslContent}
                  language="dsl"
                  theme="vs-dark"
                  height="400px"
                  enableValidation={true}
                  validationDelay={1500}
                  on:change={handleDslChange}
                  on:ready={handleMonacoReady}
                  on:validation={handleValidation}
                  options={{
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    fontSize: 14
                  }}
                />

                <!-- Dataset Helper -->
                {#if showDatasetHelper}
                  <div class="mt-4 p-4 bg-base-200 rounded-lg">
                    <div class="flex items-center justify-between mb-3">
                      <h4 class="font-semibold text-sm">Insert Dataset Reference</h4>
                      <button 
                        class="btn btn-ghost btn-xs" 
                        on:click={() => showDatasetHelper = false}
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    </div>
                    
                    <div class="max-w-md">
                      <DatasetPicker 
                        placeholder="Choose a dataset to insert..."
                        on:select={handleDatasetSelect}
                      />
                    </div>
                    
                    <div class="text-xs text-base-content/60 mt-2">
                      Select a dataset above and it will be inserted at your cursor position in the DSL editor.
                    </div>
                  </div>
                {/if}
                
                <!-- Error Panel -->
                <div class="mt-4">
                  <ErrorPanel
                    errors={validationErrors}
                    warnings={validationWarnings}
                    on:jumpToLine={handleJumpToLine}
                  />
                </div>
              {:else if activeTab === 'compiled'}
                {#if isCompiling}
                  <div class="flex items-center justify-center h-96">
                    <div class="text-center">
                      <span class="loading loading-spinner loading-lg"></span>
                      <p class="text-sm text-base-content/70 mt-2">Compiling pipeline to JSON IR...</p>
                    </div>
                  </div>
                {:else if compilationError}
                  <div class="alert alert-error">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <div>
                      <h3 class="font-bold">Compilation Error</h3>
                      <div class="text-xs">{compilationError}</div>
                    </div>
                    <button class="btn btn-sm" on:click={compileToIR}>Retry</button>
                  </div>
                {:else if compiledIR}
                  <MonacoEditor
                    value={JSON.stringify(compiledIR, null, 2)}
                    language="json"
                    theme="vs-dark"
                    height="400px"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      lineNumbers: 'on',
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      fontSize: 14
                    }}
                  />
                {:else}
                  <div class="flex items-center justify-center h-96">
                    <div class="text-center">
                      <p class="text-base-content/70">No compiled IR available</p>
                      <button class="btn btn-primary btn-sm mt-2" on:click={compileToIR}>
                        Compile Now
                      </button>
                    </div>
                  </div>
                {/if}
              {/if}
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
        {#if currentRun?.status === 'completed' && currentRun.results && typeof currentRun.results === 'object'}
          <div class="card bg-base-100 shadow-lg">
            <div class="card-body">
              <h3 class="card-title text-lg">Backtest Results</h3>
              
              <div class="stats stats-vertical shadow">
                <div class="stat">
                  <div class="stat-title">Total Return</div>
                  <div class="stat-value text-sm" class:text-success={(currentRun.results.totalReturn ?? 0) > 0} class:text-error={(currentRun.results.totalReturn ?? 0) < 0}>
                    {(currentRun.results.totalReturn ?? 0) > 0 ? '+' : ''}{safeFormatNumber(currentRun.results.totalReturn)}%
                  </div>
                </div>
                
                <div class="stat">
                  <div class="stat-title">Sharpe Ratio</div>
                  <div class="stat-value text-sm">{safeFormatNumber(currentRun.results.sharpeRatio)}</div>
                </div>
                
                <div class="stat">
                  <div class="stat-title">Max Drawdown</div>
                  <div class="stat-value text-sm text-error">{safeFormatNumber(currentRun.results.maxDrawdown)}%</div>
                </div>
                
                <div class="stat">
                  <div class="stat-title">Trades</div>
                  <div class="stat-value text-sm">{currentRun.results.numTrades ?? 0}</div>
                </div>
                
                <div class="stat">
                  <div class="stat-title">Win Rate</div>
                  <div class="stat-value text-sm">{safeFormatPercent(currentRun.results.winRate)}%</div>
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
                  Final Capital: ${Math.round(currentRun.results.finalCapital ?? 0).toLocaleString()}
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

<!-- Version History Modal -->
{#if showVersionHistory}
  <VersionHistory
    {pipelineId}
    {versions}
    loading={versionsLoading}
    currentVersion={pipeline?.currentVersion}
    on:restore={handleVersionRestore}
    on:compare={handleVersionCompare}
    on:delete={handleVersionDelete}
    on:close={() => showVersionHistory = false}
  />
{/if}

<!-- Diff Viewer Modal -->
{#if showDiffViewer && diffVersionA && diffVersionB}
  <DiffViewer
    versionA={diffVersionA}
    versionB={diffVersionB}
    on:restore={handleDiffRestore}
    on:close={() => {
      showDiffViewer = false;
      diffVersionA = null;
      diffVersionB = null;
    }}
  />
{/if}