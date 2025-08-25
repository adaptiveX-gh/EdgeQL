import App from './App.svelte';
import './app.css';

// Configure Monaco Editor to disable web workers cleanly
// This prevents all worker-related warnings and errors
self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    // Return a data URL that creates a minimal worker
    // This satisfies Monaco's worker requirement without actual worker files
    return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`
      self.addEventListener('message', function(e) {
        // Minimal worker that responds to all messages with empty results
        const response = { id: e.data.id, result: null };
        
        switch(e.data.method || e.data._method || '') {
          case 'getSemanticDiagnostics':
          case 'getSyntacticDiagnostics': 
          case 'getSuggestionDiagnostics':
            response.result = [];
            break;
          case 'getCompletionItems':
            response.result = { suggestions: [], incomplete: false };
            break;
          default:
            response.result = null;
        }
        
        self.postMessage(response);
      });
    `);
  }
};

const app = new App({
  target: document.getElementById('app'),
});

export default app;