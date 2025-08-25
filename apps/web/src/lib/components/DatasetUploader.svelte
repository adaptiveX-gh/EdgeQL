<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { datasetApi, ApiError } from '../api/client.js';
  import type { Dataset } from '../api/types.js';
  
  const dispatch = createEventDispatcher<{
    uploaded: Dataset;
    error: string;
  }>();

  export let disabled = false;
  
  let dragActive = false;
  let uploading = false;
  let uploadProgress = 0;
  let errorMessage = '';
  let validationErrors: string[] = [];
  let validationWarnings: string[] = [];
  
  let fileInputElement: HTMLInputElement;
  
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) {
      dragActive = true;
    }
  };
  
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragActive = false;
  };
  
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragActive = false;
    
    if (disabled || uploading) return;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        uploadFile(file);
      }
    }
  };
  
  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    
    if (files && files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        uploadFile(file);
      }
    }
  };
  
  const validateFile = (file: File): boolean => {
    errorMessage = '';
    validationErrors = [];
    validationWarnings = [];
    
    // Check file type
    if (!file.type.includes('csv') && !file.name.toLowerCase().endsWith('.csv')) {
      errorMessage = 'Please select a CSV file.';
      return false;
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      errorMessage = 'File size must be less than 10MB.';
      return false;
    }
    
    return true;
  };
  
  const uploadFile = async (file: File) => {
    if (uploading) return;
    
    uploading = true;
    uploadProgress = 0;
    errorMessage = '';
    validationErrors = [];
    validationWarnings = [];
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        if (uploadProgress < 90) {
          uploadProgress += Math.random() * 20;
        }
      }, 100);
      
      const dataset = await datasetApi.upload(file);
      
      clearInterval(progressInterval);
      uploadProgress = 100;
      
      // Brief delay to show completion
      setTimeout(() => {
        uploading = false;
        uploadProgress = 0;
        dispatch('uploaded', dataset);
      }, 500);
      
    } catch (error) {
      clearInterval(progressInterval!);
      uploading = false;
      uploadProgress = 0;
      
      if (error instanceof ApiError) {
        errorMessage = error.message;
        
        // Extract validation details if available
        if (error.response && error.response.details) {
          validationErrors = error.response.details.errors || [];
          validationWarnings = error.response.details.warnings || [];
        }
        
        dispatch('error', error.message);
      } else {
        errorMessage = 'Upload failed. Please try again.';
        dispatch('error', 'Upload failed');
      }
    }
  };
  
  const clickFileInput = () => {
    if (!disabled && !uploading) {
      fileInputElement.click();
    }
  };
  
  const clearErrors = () => {
    errorMessage = '';
    validationErrors = [];
    validationWarnings = [];
  };
</script>

<div class="dataset-uploader">
  <!-- Hidden file input -->
  <input 
    bind:this={fileInputElement}
    type="file" 
    accept=".csv,text/csv" 
    class="hidden" 
    on:change={handleFileSelect}
  />
  
  <!-- Upload Area -->
  <div 
    class="upload-zone"
    class:drag-active={dragActive}
    class:uploading
    class:disabled
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
    on:click={clickFileInput}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && clickFileInput()}
  >
    {#if uploading}
      <div class="upload-progress">
        <div class="loading loading-spinner loading-lg text-primary mb-4"></div>
        <h3 class="text-lg font-semibold mb-2">Uploading Dataset</h3>
        <div class="progress w-full max-w-xs">
          <progress class="progress progress-primary" value={uploadProgress} max="100"></progress>
        </div>
        <p class="text-sm text-base-content/70 mt-2">{Math.round(uploadProgress)}% complete</p>
      </div>
    {:else}
      <div class="upload-content">
        <svg class="w-12 h-12 mx-auto mb-4 text-base-content/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
        
        <h3 class="text-lg font-semibold mb-2">
          {dragActive ? 'Drop your CSV file here' : 'Upload OHLCV Dataset'}
        </h3>
        
        <p class="text-sm text-base-content/70 mb-4">
          Drag and drop or click to select a CSV file with OHLCV market data
        </p>
        
        <button 
          class="btn btn-primary btn-sm" 
          disabled={disabled || uploading}
          type="button"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Choose File
        </button>
        
        <div class="text-xs text-base-content/50 mt-2">
          Supported format: CSV • Max size: 10MB
        </div>
      </div>
    {/if}
  </div>
  
  <!-- Error Messages -->
  {#if errorMessage}
    <div class="alert alert-error mt-4">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
      </svg>
      <div>
        <h4 class="font-bold">Upload Failed</h4>
        <div class="text-sm">{errorMessage}</div>
      </div>
      <button class="btn btn-sm btn-outline" on:click={clearErrors}>
        Dismiss
      </button>
    </div>
    
    {#if validationErrors.length > 0}
      <div class="alert alert-warning mt-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <div>
          <h4 class="font-bold text-sm">Validation Issues:</h4>
          <ul class="text-xs mt-1">
            {#each validationErrors as error}
              <li>• {error}</li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
    
    {#if validationWarnings.length > 0}
      <div class="alert alert-warning mt-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <div>
          <h4 class="font-bold text-sm">Warnings:</h4>
          <ul class="text-xs mt-1">
            {#each validationWarnings as warning}
              <li>• {warning}</li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
  {/if}
  
  <!-- Requirements Info -->
  <div class="bg-base-200 rounded-lg p-4 mt-4">
    <h4 class="font-semibold text-sm mb-2">CSV Requirements:</h4>
    <div class="text-xs text-base-content/70 space-y-1">
      <div>• <strong>Required columns:</strong> timestamp/date, open, high, low, close</div>
      <div>• <strong>Optional:</strong> volume/vol/v (recommended for trading strategies)</div>
      <div>• <strong>Format:</strong> Standard CSV with comma separators</div>
      <div>• <strong>Timestamp:</strong> ISO date string or Unix timestamp (milliseconds)</div>
    </div>
  </div>
</div>

<style>
  .dataset-uploader {
    @apply w-full;
  }
  
  .upload-zone {
    @apply border-2 border-dashed border-base-300 rounded-lg p-8 text-center cursor-pointer transition-all duration-200;
  }
  
  .upload-zone:hover:not(.disabled):not(.uploading) {
    @apply border-primary bg-primary/5;
  }
  
  .upload-zone.drag-active {
    @apply border-primary bg-primary/10 scale-105;
  }
  
  .upload-zone.uploading {
    @apply border-info bg-info/5 cursor-default;
  }
  
  .upload-zone.disabled {
    @apply border-base-200 bg-base-200/50 cursor-not-allowed opacity-60;
  }
  
  .upload-content, .upload-progress {
    @apply flex flex-col items-center;
  }
  
  .progress {
    @apply h-2;
  }
</style>