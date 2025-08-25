import { NodeRunner, ExecutionContext, ExecutionResult } from '../types.js';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
// Import from the compiler package's public registry export
import { getCustomNodeRegistry } from '@edgeql/compiler/registry/CustomNodeRegistry';

export class CustomNodeRunner implements NodeRunner {
  // Track running containers by runId for cancellation
  private runningContainers = new Map<string, string>();
  
  canHandle(nodeType: string): boolean {
    try {
      const registry = getCustomNodeRegistry();
      if (!registry) {
        console.warn(`Custom node registry is undefined for canHandle(${nodeType})`);
        return false;
      }
      return registry.isCustomNode(nodeType);
    } catch (error) {
      console.warn(`Failed to check if ${nodeType} can be handled by CustomNodeRunner:`, error);
      return false;
    }
  }
  
  async cancel(runId: string): Promise<void> {
    const containerName = this.runningContainers.get(runId);
    if (containerName) {
      try {
        // Kill the container
        const killProcess = spawn('docker', ['kill', containerName], { stdio: 'pipe' });
        await new Promise((resolve) => {
          killProcess.on('close', resolve);
          killProcess.on('error', resolve);
          // Force resolve after 5 seconds
          setTimeout(resolve, 5000);
        });
        
        // Remove from tracking
        this.runningContainers.delete(runId);
      } catch (error) {
        console.warn(`Failed to kill container ${containerName}:`, error);
      }
    }
  }
  
  async execute(
    nodeId: string,
    nodeType: string,
    parameters: Record<string, any>,
    inputs: Map<string, any>,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const executionId = uuidv4();
    
    try {
      logs.push(`Executing custom Node.js node: ${nodeType} (${nodeId})`);
      
      // Check if execution is already cancelled
      if (context.cancelled) {
        return {
          success: false,
          nodeId,
          error: 'Execution was cancelled',
          logs: [...logs, 'Execution cancelled before starting'],
          executionTime: Date.now() - startTime
        };
      }
      
      // Get custom node definition
      let registry;
      try {
        registry = getCustomNodeRegistry();
      } catch (error) {
        return {
          success: false,
          nodeId,
          error: `Failed to get custom node registry: ${error instanceof Error ? error.message : 'Unknown error'}`,
          logs: [...logs, `Failed to initialize custom node registry`],
          executionTime: Date.now() - startTime
        };
      }
      
      // Ensure registry is defined before using it
      if (!registry) {
        return {
          success: false,
          nodeId,
          error: 'Custom node registry is undefined after initialization',
          logs: [...logs, 'Registry undefined after getCustomNodeRegistry()'],
          executionTime: Date.now() - startTime
        };
      }
      
      const customNodeDef = registry.getNode(nodeType);
      
      if (!customNodeDef) {
        return {
          success: false,
          nodeId,
          error: `Custom node definition not found: ${nodeType}`,
          logs: [...logs, `Custom node ${nodeType} not registered`],
          executionTime: Date.now() - startTime
        };
      }
      
      // Validate that entry point exists
      if (!existsSync(customNodeDef.entryPoint)) {
        return {
          success: false,
          nodeId,
          error: `Custom node entry point not found: ${customNodeDef.entryPoint}`,
          logs: [...logs, `Entry point missing: ${customNodeDef.entryPoint}`],
          executionTime: Date.now() - startTime
        };
      }
      
      // Create temporary directories for this execution
      const tempDir = path.join(tmpdir(), 'edgeql-custom-execution', executionId);
      const inputDir = path.join(tempDir, 'input');
      const outputDir = path.join(tempDir, 'output');
      const nodeDir = path.join(tempDir, 'node');
      
      // Ensure directories exist
      mkdirSync(inputDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });
      mkdirSync(nodeDir, { recursive: true });
      
      // Copy custom node code to execution directory
      const nodeEntryPoint = path.join(nodeDir, 'node.js');
      const originalCode = readFileSync(customNodeDef.entryPoint, 'utf-8');
      writeFileSync(nodeEntryPoint, originalCode);
      
      logs.push(`Custom node code copied to: ${nodeEntryPoint}`);
      
      // Prepare input data with custom node metadata
      const inputData = {
        nodeType,
        nodeDefinition: {
          id: customNodeDef.id,
          name: customNodeDef.name,
          version: customNodeDef.version,
          inputSchema: customNodeDef.inputSchema,
          outputSchema: customNodeDef.outputSchema,
          requiredParams: customNodeDef.requiredParams,
          optionalParams: customNodeDef.optionalParams
        },
        params: parameters,
        inputs: this.serializeInputs(inputs),
        context: {
          runId: context.runId,
          pipelineId: context.pipelineId,
          nodeId,
          datasets: Object.fromEntries(context.datasets)
        }
      };
      
      const inputFile = path.join(inputDir, 'input.json');
      const outputFile = path.join(outputDir, 'output.json');
      
      writeFileSync(inputFile, JSON.stringify(inputData, null, 2));
      logs.push(`Input data written to: ${inputFile}`);
      
      // Execute custom node in Docker container
      const result = await this.runCustomNodeInContainer(
        nodeEntryPoint,
        inputFile,
        outputFile,
        tempDir,
        logs,
        context.runId,
        context
      );
      
      if (!result.success) {
        return {
          success: false,
          nodeId,
          error: result.error || 'Unknown execution error',
          logs,
          executionTime: Date.now() - startTime
        };
      }
      
      // Read output
      if (!existsSync(outputFile)) {
        throw new Error('Custom node did not produce output file');
      }
      
      const outputContent = readFileSync(outputFile, 'utf-8');
      const output = JSON.parse(outputContent);
      
      if (output.error) {
        throw new Error(`Custom node error: ${output.error}`);
      }
      
      // Validate output against expected schema (basic validation)
      if (!this.validateOutput(output, customNodeDef.outputSchema)) {
        logs.push('Warning: Custom node output does not match expected schema');
      }
      
      logs.push(`Custom node completed successfully`);
      
      return {
        success: true,
        nodeId,
        output: output.result || output,
        logs,
        executionTime: Date.now() - startTime,
        ...(result.memoryUsage !== undefined && { memoryUsage: result.memoryUsage })
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logs.push(`Custom node failed: ${errorMessage}`);
      
      return {
        success: false,
        nodeId,
        error: errorMessage,
        logs,
        executionTime
      };
    }
  }
  
  private serializeInputs(inputs: Map<string, any>): Record<string, any> {
    const serialized: Record<string, any> = {};
    for (const [key, value] of inputs) {
      serialized[key] = value;
    }
    return serialized;
  }
  
  private async runCustomNodeInContainer(
    nodeEntryPoint: string,
    inputFile: string,
    outputFile: string,
    tempDir: string,
    logs: string[],
    runId: string,
    context: ExecutionContext
  ): Promise<{ success: boolean; error?: string; memoryUsage?: number }> {
    return new Promise((resolve) => {
      const containerName = `edgeql-custom-node-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      // Track this container for potential cancellation
      this.runningContainers.set(runId, containerName);
      
      // Convert Windows paths to Docker-compatible format
      const dockerTempDir = this.convertToDockerPath(tempDir);
      // Find the project root directory (where datasets/ is located)
      const projectRoot = this.findProjectRoot();
      const dockerDatasetsDir = this.convertToDockerPath(path.join(projectRoot, 'datasets'));
      
      // Docker run command with resource constraints and security settings
      const dockerArgs = [
        'run',
        '--rm',
        '--name', containerName,
        '--memory=512m',                    // Memory limit for custom nodes
        '--cpus=1.0',                       // CPU limit
        '--network=none',                   // No network access
        '--read-only',                      // Read-only filesystem
        '--tmpfs', '/tmp:rw,noexec,nosuid,size=100m', // Temporary filesystem
        '-v', `${dockerTempDir}:/workspace:rw`,   // Mount workspace
        '-v', `${dockerDatasetsDir}:/datasets:ro`, // Mount datasets read-only
        '--user', 'edgeql',                 // Non-root user
        '--security-opt', 'no-new-privileges', // Security constraint
        'edgeql-nodejs-sandbox',            // Image name
        '/workspace/input/input.json',      // Arguments to SandboxRunner.js
        '/workspace/output/output.json'
      ];
      
      logs.push(`Starting Docker container for custom node: ${containerName}`);
      logs.push(`Docker command: docker ${dockerArgs.join(' ')}`);
      
      // Set environment variables for Docker process
      const dockerEnv = { ...process.env };
      
      // On Windows, disable MSYS path conversion
      if (process.platform === 'win32') {
        dockerEnv.MSYS_NO_PATHCONV = '1';
      }
      
      const dockerProcess = spawn('docker', dockerArgs, {
        stdio: 'pipe',
        timeout: 60000, // 60 second timeout for custom nodes
        env: dockerEnv
      });
      
      let stdout = '';
      let stderr = '';
      
      dockerProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      dockerProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      dockerProcess.on('close', (code) => {
        // Clean up container tracking
        this.runningContainers.delete(runId);
        
        logs.push(`Docker container exited with code: ${code}`);
        
        if (stdout) {
          logs.push(`Container stdout: ${stdout.trim()}`);
        }
        
        if (stderr) {
          logs.push(`Container stderr: ${stderr.trim()}`);
        }
        
        // Check if the run was cancelled during execution
        if (context.cancelled) {
          resolve({ 
            success: false, 
            error: 'Execution was cancelled' 
          });
          return;
        }
        
        if (code === 0) {
          const memUsage = this.parseMemoryUsage(stderr);
          resolve({ 
            success: true,
            ...(memUsage !== undefined && { memoryUsage: memUsage })
          });
        } else if (code === 137) {
          // Exit code 137 typically means SIGKILL (likely from cancellation)
          resolve({ 
            success: false, 
            error: 'Container was killed (likely cancelled)' 
          });
        } else {
          resolve({ 
            success: false, 
            error: `Container exited with code ${code}: ${stderr || 'No error details'}` 
          });
        }
      });
      
      dockerProcess.on('error', (error) => {
        // Clean up container tracking
        this.runningContainers.delete(runId);
        
        logs.push(`Docker execution error: ${error.message}`);
        resolve({ 
          success: false, 
          error: `Docker execution failed: ${error.message}` 
        });
      });
      
      // Handle timeout
      const timeoutId = setTimeout(() => {
        if (this.runningContainers.has(runId)) {
          logs.push(`Custom node execution timeout - killing ${containerName}`);
          spawn('docker', ['kill', containerName]);
          this.runningContainers.delete(runId);
          resolve({ 
            success: false, 
            error: 'Custom node execution timeout (60 seconds)' 
          });
        }
      }, 60000);
      
      // Clear timeout if process completes normally
      dockerProcess.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }
  
  private validateOutput(output: any, expectedSchema: any): boolean {
    // Basic validation - could be enhanced with proper schema validation
    if (!output || typeof output !== 'object') {
      return false;
    }
    
    // Check if output has result field or is the result itself
    const result = output.result || output;
    
    // Basic type checking against schema
    if (expectedSchema && expectedSchema.type) {
      // This is a simplified validation - in production you'd want more robust schema validation
      return true; // Placeholder for now
    }
    
    return true;
  }
  
  private parseMemoryUsage(stderr: string): number | undefined {
    // Try to extract memory usage from Docker output if available
    const memoryMatch = stderr.match(/memory usage: (\d+)/i);
    return memoryMatch?.[1] ? parseInt(memoryMatch[1], 10) : undefined;
  }
  
  private findProjectRoot(): string {
    // Start from current working directory and walk up to find project root
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      // Look for the root project characteristics
      const datasetsPath = path.join(currentDir, 'datasets');
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      if (existsSync(datasetsPath) && existsSync(packageJsonPath)) {
        try {
          // Check if this is the root project by looking for workspaces in package.json
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.workspaces) {
            return currentDir;
          }
        } catch (e) {
          // If we can't parse package.json, continue looking
        }
      }
      
      // Move up one directory
      currentDir = path.dirname(currentDir);
    }
    
    // Fallback to current working directory if project root not found
    return process.cwd();
  }
  
  private convertToDockerPath(windowsPath: string): string {
    // Convert Windows paths to Docker Desktop compatible format
    if (process.platform === 'win32') {
      // Convert C:\path\to\file to /c/path/to/file format for Docker Desktop
      const normalized = path.resolve(windowsPath).replace(/\\/g, '/');
      
      // Handle drive letters: C: -> /c
      if (normalized.match(/^[A-Za-z]:/)) {
        return '/' + normalized.charAt(0).toLowerCase() + normalized.slice(2);
      }
      
      return normalized;
    }
    
    // On non-Windows platforms, return as-is
    return windowsPath;
  }
}