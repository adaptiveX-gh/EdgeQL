<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import MonacoEditor from '../monaco/MonacoEditor.svelte';
  import type { CustomNode } from '../api/types.js';

  export let node: CustomNode | null = null;
  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher<{
    save: CustomNode;
    cancel: void;
  }>();

  // Form state
  let name = '';
  let description = '';
  let code = '';
  
  // Loading state
  let isSaving = false;
  let error = '';

  // JavaScript template for new nodes
  const jsTemplate = `// Node: [Node Name]
// Description: [Description]

async function run(input) {
  // Your custom logic here
  // input contains data from connected nodes
  // Return output data for downstream nodes
  
  // Example: Simple data transformation
  try {
    // Process the input data
    const result = {
      ...input,
      processed: true,
      timestamp: new Date().toISOString()
    };
    
    return result;
  } catch (error) {
    throw new Error(\`Node execution failed: \${error.message}\`);
  }
}

module.exports = { run };`;

  // Reset form when dialog opens/closes or node changes
  $: if (isOpen) {
    if (node) {
      // Editing existing node
      name = node.name;
      description = node.description || '';
      code = node.code;
    } else {
      // Creating new node
      name = '';
      description = '';
      code = jsTemplate;
    }
    error = '';
  }

  function handleSave() {
    // Basic validation
    if (!name.trim()) {
      error = 'Node name is required';
      return;
    }

    if (!code.trim()) {
      error = 'Node code is required';
      return;
    }

    // Validate code structure
    if (!code.includes('function run(input)')) {
      error = 'Node code must contain a run(input) function';
      return;
    }

    const nodeData: CustomNode = {
      id: node?.id || '',
      name: name.trim(),
      description: description.trim(),
      code: code.trim(),
      type: 'custom',
      language: 'javascript',
      inputSchema: {},
      outputSchema: {},
      createdAt: node?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dispatch('save', nodeData);
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleCodeChange(event: { detail: { value: string } }) {
    code = event.detail.value;
  }
</script>

<!-- Modal -->
{#if isOpen}
  <div class="modal modal-open">
    <div class="modal-box w-11/12 max-w-6xl h-5/6 max-h-screen">
      <h3 class="font-bold text-lg mb-4">
        {node ? 'Edit Custom Node' : 'Create New JavaScript Node'}
      </h3>
      
      <!-- Error Message -->
      {#if error}
        <div class="alert alert-error mb-4">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.98-.833-2.75 0L3.982 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <span>{error}</span>
        </div>
      {/if}

      <!-- Node Details Form -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div class="form-control">
          <label class="label" for="node-name">
            <span class="label-text font-medium">Node Name *</span>
          </label>
          <input 
            id="node-name"
            type="text" 
            placeholder="Enter node name" 
            class="input input-bordered"
            bind:value={name}
            disabled={isSaving}
          />
        </div>
        
        <div class="form-control">
          <label class="label" for="node-description">
            <span class="label-text font-medium">Description</span>
          </label>
          <input 
            id="node-description"
            type="text" 
            placeholder="Brief description of what this node does" 
            class="input input-bordered"
            bind:value={description}
            disabled={isSaving}
          />
        </div>
      </div>

      <!-- Code Editor -->
      <div class="form-control flex-1 mb-4">
        <label class="label">
          <span class="label-text font-medium">JavaScript Code *</span>
          <span class="label-text-alt text-xs">Must contain a run(input) function</span>
        </label>
        <div class="flex-1 min-h-0">
          <MonacoEditor
            bind:value={code}
            language="javascript"
            theme="vs-dark"
            height="400px"
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineHeight: 18,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              readOnly: isSaving
            }}
            on:change={handleCodeChange}
          />
        </div>
      </div>

      <!-- Info Panel -->
      <div class="alert alert-info mb-4">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="text-xs">
          <h4 class="font-bold">JavaScript Node Requirements:</h4>
          <ul class="list-disc list-inside mt-1 space-y-1">
            <li>Must export a <code class="bg-base-200 px-1 rounded">run(input)</code> function</li>
            <li>Function can be async or sync</li>
            <li>Input parameter contains data from connected nodes</li>
            <li>Must return output data for downstream nodes</li>
            <li>Use <code class="bg-base-200 px-1 rounded">module.exports = &#123; run &#125;</code> to export</li>
          </ul>
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-action">
        <button 
          class="btn btn-ghost" 
          on:click={handleCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button 
          class="btn btn-primary" 
          on:click={handleSave}
          disabled={isSaving || !name.trim() || !code.trim()}
        >
          {#if isSaving}
            <span class="loading loading-spinner loading-sm"></span>
            Saving...
          {:else}
            {node ? 'Update Node' : 'Create Node'}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Ensure modal content is properly sized */
  :global(.modal-box) {
    display: flex;
    flex-direction: column;
  }
  
  :global(.modal-box .form-control.flex-1) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  
  :global(.modal-box .form-control.flex-1 > div) {
    flex: 1;
    min-height: 0;
  }
</style>