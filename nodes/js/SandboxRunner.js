#!/usr/bin/env node
/**
 * Enhanced JavaScript Sandbox Runner with Resource Limits and Security
 * 
 * This wrapper provides secure execution of custom JavaScript nodes with:
 * - Memory limits and monitoring
 * - CPU time limits 
 * - Network isolation
 * - File system restrictions
 * - API access controls
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

// Sandbox configuration with defaults
const SANDBOX_CONFIG = {
  memoryLimit: parseInt(process.env.SANDBOX_MEMORY_MB) || 512, // MB
  timeLimit: parseInt(process.env.SANDBOX_TIME_SECONDS) || 30, // seconds
  enableNetworking: process.env.SANDBOX_ENABLE_NET === 'true',
  enableFileSystem: process.env.SANDBOX_ENABLE_FS === 'true',
  allowedModules: (process.env.SANDBOX_ALLOWED_MODULES || '').split(',').filter(Boolean)
};

class SandboxViolationError extends Error {
  constructor(type, message, details = {}) {
    super(`Sandbox Violation [${type}]: ${message}`);
    this.name = 'SandboxViolationError';
    this.violationType = type;
    this.details = details;
  }
}

class ResourceMonitor {
  constructor(limits) {
    this.limits = limits;
    this.startTime = performance.now();
    this.startMemory = process.memoryUsage().heapUsed;
    this.peakMemory = this.startMemory;
    this.checkInterval = null;
  }

  start() {
    // Monitor memory and time every 100ms
    this.checkInterval = setInterval(() => {
      this.checkLimits();
    }, 100);

    // Set absolute timeout
    setTimeout(() => {
      this.cleanup();
      throw new SandboxViolationError('TIMEOUT', 
        `Execution exceeded time limit of ${this.limits.timeLimit} seconds`);
    }, this.limits.timeLimit * 1000);
  }

  checkLimits() {
    const currentTime = performance.now();
    const elapsedSeconds = (currentTime - this.startTime) / 1000;
    const memoryUsage = process.memoryUsage();
    
    // Track peak memory usage
    this.peakMemory = Math.max(this.peakMemory, memoryUsage.heapUsed);

    // Check memory limit
    const memoryMB = memoryUsage.heapUsed / (1024 * 1024);
    if (memoryMB > this.limits.memoryLimit) {
      this.cleanup();
      throw new SandboxViolationError('MEMORY_LIMIT', 
        `Memory usage (${memoryMB.toFixed(2)}MB) exceeded limit of ${this.limits.memoryLimit}MB`,
        { 
          currentMemory: memoryMB, 
          limit: this.limits.memoryLimit,
          peakMemory: this.peakMemory / (1024 * 1024)
        });
    }

    // Check time limit
    if (elapsedSeconds > this.limits.timeLimit) {
      this.cleanup();
      throw new SandboxViolationError('TIMEOUT', 
        `Execution time (${elapsedSeconds.toFixed(2)}s) exceeded limit of ${this.limits.timeLimit}s`,
        { currentTime: elapsedSeconds, limit: this.limits.timeLimit });
    }
  }

  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  getStats() {
    const currentTime = performance.now();
    const memoryUsage = process.memoryUsage();
    
    return {
      executionTime: (currentTime - this.startTime) / 1000,
      memoryUsed: memoryUsage.heapUsed / (1024 * 1024),
      peakMemory: this.peakMemory / (1024 * 1024),
      rss: memoryUsage.rss / (1024 * 1024)
    };
  }
}

class SecurityProxy {
  constructor(config) {
    this.config = config;
    this.originalRequire = null;
    this.blockedModules = new Set([
      'child_process',
      'cluster', 
      'dgram',
      'dns',
      'fs',
      'http',
      'https',
      'net',
      'os',
      'process',
      'repl',
      'tls',
      'worker_threads',
      'v8',
      'vm'
    ]);
    
    // Add filesystem modules to blocked list if not enabled
    if (!config.enableFileSystem) {
      this.blockedModules.add('fs');
      this.blockedModules.add('fs/promises');
    }

    // Add network modules if not enabled
    if (!config.enableNetworking) {
      this.blockedModules.add('http');
      this.blockedModules.add('https');
      this.blockedModules.add('net');
      this.blockedModules.add('dgram');
      this.blockedModules.add('dns');
    }
  }

  installSecurityHooks() {
    // Hook require() to restrict dangerous modules
    this.originalRequire = global.require;
    global.require = this.createSecureRequire();

    // Restrict access to dangerous globals
    this.restrictGlobals();

    // Hook eval and Function constructor
    this.restrictDynamicCode();
  }

  createSecureRequire() {
    return (moduleId) => {
      // Check if module is blocked
      if (this.blockedModules.has(moduleId)) {
        throw new SandboxViolationError('RESTRICTED_MODULE',
          `Access to module '${moduleId}' is not allowed in sandbox`,
          { module: moduleId });
      }

      // Check if module is in allowlist (if specified)
      if (this.config.allowedModules.length > 0 && 
          !this.config.allowedModules.includes(moduleId) && 
          !moduleId.startsWith('./') && !moduleId.startsWith('../')) {
        throw new SandboxViolationError('UNAUTHORIZED_MODULE',
          `Module '${moduleId}' is not in the allowed modules list`,
          { module: moduleId, allowedModules: this.config.allowedModules });
      }

      // Use original require for allowed modules
      return this.originalRequire(moduleId);
    };
  }

  restrictGlobals() {
    // Remove dangerous globals
    const dangerousGlobals = ['process', 'global', 'GLOBAL', 'root'];
    
    dangerousGlobals.forEach(prop => {
      try {
        // Can't fully delete process, but we can restrict access
        if (prop === 'process') {
          // Override dangerous process methods
          if (global.process) {
            global.process.exit = () => {
              throw new SandboxViolationError('RESTRICTED_API', 
                'process.exit() is not allowed in sandbox');
            };
            global.process.kill = () => {
              throw new SandboxViolationError('RESTRICTED_API', 
                'process.kill() is not allowed in sandbox');
            };
          }
        } else {
          delete global[prop];
        }
      } catch (e) {
        // Some globals can't be deleted, that's ok
      }
    });
  }

  restrictDynamicCode() {
    // Override eval
    global.eval = () => {
      throw new SandboxViolationError('DYNAMIC_CODE', 
        'Dynamic code execution via eval() is not allowed in sandbox');
    };

    // Override Function constructor
    const OriginalFunction = Function;
    global.Function = function() {
      throw new SandboxViolationError('DYNAMIC_CODE', 
        'Dynamic code execution via Function constructor is not allowed in sandbox');
    };
  }

  restore() {
    if (this.originalRequire) {
      global.require = this.originalRequire;
    }
  }
}

async function executeInSandbox(userCode, inputs, params) {
  const monitor = new ResourceMonitor(SANDBOX_CONFIG);
  const security = new SecurityProxy(SANDBOX_CONFIG);
  
  let result = null;
  let error = null;

  try {
    // Start monitoring
    monitor.start();
    
    // Install security restrictions
    security.installSecurityHooks();

    // Create a safe execution context
    const sandboxContext = {
      inputs,
      params,
      console: {
        log: (...args) => console.log('[SANDBOX]', ...args),
        error: (...args) => console.error('[SANDBOX ERROR]', ...args),
        warn: (...args) => console.warn('[SANDBOX WARN]', ...args)
      },
      setTimeout: (fn, delay) => {
        if (delay > 5000) {
          throw new SandboxViolationError('TIMEOUT_VIOLATION',
            'setTimeout with delay > 5s not allowed');
        }
        return setTimeout(fn, delay);
      },
      setInterval: () => {
        throw new SandboxViolationError('RESTRICTED_API',
          'setInterval is not allowed in sandbox');
      }
    };

    // Create the user function in restricted context
    const userFunction = new Function('context', 'require', `
      const { inputs, params, console, setTimeout } = context;
      ${userCode}
    `);

    // Execute user code
    result = await Promise.race([
      Promise.resolve(userFunction(sandboxContext, global.require)),
      new Promise((_, reject) => {
        setTimeout(() => reject(new SandboxViolationError('TIMEOUT', 'Promise timeout')), 
          SANDBOX_CONFIG.timeLimit * 1000);
      })
    ]);

  } catch (err) {
    error = err;
  } finally {
    // Cleanup
    monitor.cleanup();
    security.restore();
  }

  // Return execution results
  const stats = monitor.getStats();
  
  if (error) {
    return {
      success: false,
      error: error.message,
      violationType: error.violationType || 'RUNTIME_ERROR',
      details: error.details || {},
      stats
    };
  }

  return {
    success: true,
    result,
    stats
  };
}

// Worker thread execution
if (!isMainThread) {
  const { code, inputs, params } = workerData;
  
  executeInSandbox(code, inputs, params)
    .then(result => {
      parentPort.postMessage(result);
    })
    .catch(error => {
      parentPort.postMessage({
        success: false,
        error: error.message,
        violationType: error.violationType || 'WORKER_ERROR',
        details: error.details || {}
      });
    });
}

// Main execution for direct usage
if (isMainThread && require.main === module) {
  const [inputFile, outputFile] = process.argv.slice(2);
  
  if (!inputFile || !outputFile) {
    console.error('Usage: node SandboxRunner.js <input.json> <output.json>');
    process.exit(1);
  }

  async function main() {
    try {
      // Read input
      const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
      const { nodeType, params = {}, inputs = {}, userCode } = inputData;

      if (!userCode) {
        throw new Error('No user code provided in input data');
      }

      // Execute in worker thread for additional isolation
      const worker = new Worker(__filename, {
        workerData: {
          code: userCode,
          inputs,
          params
        }
      });

      const result = await new Promise((resolve, reject) => {
        worker.on('message', resolve);
        worker.on('error', reject);
        
        // Worker timeout
        setTimeout(() => {
          worker.terminate();
          reject(new Error('Worker thread timeout'));
        }, (SANDBOX_CONFIG.timeLimit + 5) * 1000);
      });

      // Write output
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

      if (result.success) {
        console.log(`Sandbox execution completed successfully`);
        console.log(`Memory peak: ${result.stats.peakMemory.toFixed(2)}MB`);
        console.log(`Execution time: ${result.stats.executionTime.toFixed(3)}s`);
        process.exit(0);
      } else {
        console.error(`Sandbox execution failed: ${result.error}`);
        if (result.violationType) {
          console.error(`Violation type: ${result.violationType}`);
        }
        process.exit(1);
      }

    } catch (error) {
      const errorResult = {
        success: false,
        error: error.message,
        violationType: 'STARTUP_ERROR'
      };
      
      try {
        fs.writeFileSync(outputFile, JSON.stringify(errorResult, null, 2));
      } catch (writeError) {
        console.error('Failed to write error output:', writeError.message);
      }
      
      console.error('Sandbox startup error:', error.message);
      process.exit(1);
    }
  }

  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { executeInSandbox, SandboxViolationError, ResourceMonitor, SecurityProxy };