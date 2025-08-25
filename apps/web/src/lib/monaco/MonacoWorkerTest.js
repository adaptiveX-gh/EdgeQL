/**
 * Test for Monaco Editor worker configuration
 * Validates that our MonacoEnvironment setup prevents worker warnings
 */

export class MonacoWorkerTest {
  constructor() {
    this.results = [];
    this.originalConsole = {};
  }

  /**
   * Captures console output during Monaco initialization
   */
  captureConsole() {
    this.originalConsole.log = console.log;
    this.originalConsole.warn = console.warn;
    this.originalConsole.error = console.error;

    console.log = (...args) => {
      this.results.push({ type: 'log', message: args.join(' '), timestamp: Date.now() });
      this.originalConsole.log(...args);
    };

    console.warn = (...args) => {
      this.results.push({ type: 'warn', message: args.join(' '), timestamp: Date.now() });
      this.originalConsole.warn(...args);
    };

    console.error = (...args) => {
      this.results.push({ type: 'error', message: args.join(' '), timestamp: Date.now() });
      this.originalConsole.error(...args);
    };
  }

  /**
   * Restores original console methods
   */
  restoreConsole() {
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }

  /**
   * Tests Monaco Editor worker configuration
   */
  async testWorkerConfiguration() {
    this.captureConsole();
    
    try {
      // Test if MonacoEnvironment is properly configured
      if (!self.MonacoEnvironment || !self.MonacoEnvironment.getWorkerUrl) {
        throw new Error('MonacoEnvironment.getWorkerUrl is not configured');
      }

      // Test worker URL generation
      const workerUrl = self.MonacoEnvironment.getWorkerUrl('test', 'typescript');
      if (!workerUrl || !workerUrl.startsWith('data:text/javascript')) {
        throw new Error('getWorkerUrl did not return expected data URL');
      }

      // Test that worker URL creates valid JavaScript
      const workerCode = decodeURIComponent(workerUrl.split(',')[1]);
      if (!workerCode.includes('addEventListener') || !workerCode.includes('postMessage')) {
        throw new Error('Worker code does not contain expected methods');
      }

      return {
        success: true,
        workerUrl: workerUrl.length > 100 ? workerUrl.substring(0, 100) + '...' : workerUrl,
        message: 'MonacoEnvironment configured correctly'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'MonacoEnvironment configuration failed'
      };
    } finally {
      this.restoreConsole();
    }
  }

  /**
   * Tests actual Monaco Editor initialization
   */
  async testMonacoEditorInitialization() {
    this.captureConsole();
    
    try {
      // Import Monaco Editor
      const monaco = await import('monaco-editor');
      
      // Create a temporary container
      const container = document.createElement('div');
      container.style.width = '100px';
      container.style.height = '100px';
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      // Create Monaco Editor instance
      const editor = monaco.editor.create(container, {
        value: '// Test content',
        language: 'javascript',
        theme: 'vs-dark'
      });

      // Wait a moment for any async initialization
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clean up
      editor.dispose();
      document.body.removeChild(container);

      // Check for worker-related warnings
      const workerWarnings = this.results.filter(r => 
        r.message.includes('Could not create web worker') || 
        r.message.includes('Falling back to loading web worker code in main thread') ||
        r.message.includes('Cannot read properties of undefined')
      );

      if (workerWarnings.length > 0) {
        return {
          success: false,
          warnings: workerWarnings,
          message: 'Monaco Editor initialization produced worker warnings'
        };
      }

      return {
        success: true,
        message: 'Monaco Editor initialized without worker warnings',
        consoleMessages: this.results.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Monaco Editor initialization failed'
      };
    } finally {
      this.restoreConsole();
    }
  }

  /**
   * Runs all tests and returns comprehensive results
   */
  async runAllTests() {
    const configTest = await this.testWorkerConfiguration();
    const initTest = await this.testMonacoEditorInitialization();

    return {
      workerConfiguration: configTest,
      editorInitialization: initTest,
      overallSuccess: configTest.success && initTest.success,
      summary: {
        configurationWorking: configTest.success,
        noWorkerWarnings: initTest.success,
        readyForProduction: configTest.success && initTest.success
      }
    };
  }
}

// Export singleton for easy testing
export const monacoWorkerTest = new MonacoWorkerTest();