/**
 * Simple test script to verify Monaco Editor worker functionality
 * This can be used to check if workers are loading without CORS issues
 */

export function testMonacoWorkers() {
  if (typeof window === 'undefined') {
    console.log('Not in browser environment');
    return false;
  }

  const testResults = {
    environment: false,
    workerCreation: false,
    workerUrls: {},
    errors: []
  };

  try {
    // Check if MonacoEnvironment is configured
    if (window.MonacoEnvironment && window.MonacoEnvironment.getWorkerUrl) {
      testResults.environment = true;
      console.log('✓ MonacoEnvironment configured');

      // Test worker URL generation
      const workerTypes = ['json', 'css', 'html', 'typescript', 'default'];
      
      workerTypes.forEach(type => {
        try {
          const url = window.MonacoEnvironment.getWorkerUrl('test', type);
          testResults.workerUrls[type] = url;
          console.log(`✓ Worker URL for ${type}:`, url);
        } catch (error) {
          testResults.errors.push(`Failed to get worker URL for ${type}: ${error.message}`);
          console.error(`✗ Worker URL for ${type}:`, error);
        }
      });

      // Test worker creation if getWorker is available
      if (window.MonacoEnvironment.getWorker) {
        try {
          const testWorker = window.MonacoEnvironment.getWorker('test', 'json');
          if (testWorker) {
            testResults.workerCreation = true;
            console.log('✓ Worker creation successful');
            testWorker.terminate(); // Clean up
          } else {
            console.log('~ Worker creation returned null (fallback to main thread)');
          }
        } catch (error) {
          testResults.errors.push(`Worker creation failed: ${error.message}`);
          console.error('✗ Worker creation failed:', error);
        }
      }

    } else {
      testResults.errors.push('MonacoEnvironment not configured');
      console.error('✗ MonacoEnvironment not configured');
    }

  } catch (error) {
    testResults.errors.push(`General error: ${error.message}`);
    console.error('✗ General error:', error);
  }

  // Summary
  console.log('\n--- Monaco Worker Test Results ---');
  console.log('Environment configured:', testResults.environment);
  console.log('Worker creation:', testResults.workerCreation);
  console.log('Worker URLs:', testResults.workerUrls);
  if (testResults.errors.length > 0) {
    console.log('Errors:', testResults.errors);
  }
  console.log('--- End Test Results ---\n');

  return testResults;
}

// Auto-run test if this script is loaded directly
if (typeof window !== 'undefined' && window.document) {
  // Run test after a short delay to ensure Monaco environment is set up
  setTimeout(() => {
    console.log('Running Monaco Worker Test...');
    testMonacoWorkers();
  }, 1000);
}