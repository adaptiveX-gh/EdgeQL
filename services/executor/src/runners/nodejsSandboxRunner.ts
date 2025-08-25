import { NodeRunner, ExecutionContext, ExecutionResult } from '../types.js';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class NodejsSandboxRunner implements NodeRunner {
  private readonly nodejsNodes = [
    'DataTransformNode',
    'FilterNode',
    'AggregationNode',
    'JoinNode',
    'ValidationNode'
  ];
  
  canHandle(nodeType: string): boolean {
    return this.nodejsNodes.includes(nodeType);
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
      logs.push(`Executing Node.js node: ${nodeType} (${nodeId}) in sandbox`);
      
      // Create temporary directories for this execution
      const tempDir = path.join(tmpdir(), 'edgeql-execution', executionId);
      const inputDir = path.join(tempDir, 'input');
      const outputDir = path.join(tempDir, 'output');
      
      // Ensure directories exist
      mkdirSync(inputDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });
      
      // Prepare input data
      const inputData = {
        nodeType,
        params: parameters,
        inputs: this.serializeInputs(inputs),
        context: {
          runId: context.runId,
          pipelineId: context.pipelineId,
          datasets: Object.fromEntries(context.datasets)
        }
      };
      
      const inputFile = path.join(inputDir, 'input.json');
      const outputFile = path.join(outputDir, 'output.json');
      
      writeFileSync(inputFile, JSON.stringify(inputData, null, 2));
      logs.push(`Input data written to: ${inputFile}`);
      
      // Execute Node.js node in Docker container
      const result = await this.runInDockerContainer(
        nodeType,
        inputFile,
        outputFile,
        tempDir,
        logs
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
        throw new Error('Node.js node did not produce output file');
      }
      
      const outputContent = readFileSync(outputFile, 'utf-8');
      const output = JSON.parse(outputContent);
      
      if (output.error) {
        throw new Error(`Node.js node error: ${output.error}`);
      }
      
      logs.push(`Node completed successfully`);
      
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
      
      logs.push(`Node.js node failed: ${errorMessage}`);
      
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
  
  private async runInDockerContainer(
    nodeType: string,
    inputFile: string,
    outputFile: string,
    tempDir: string,
    logs: string[]
  ): Promise<{ success: boolean; error?: string; memoryUsage?: number }> {
    return new Promise((resolve) => {
      const containerName = `edgeql-nodejs-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
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
        '--memory=256m',                    // Memory limit (less than Python)
        '--cpus=0.5',                       // CPU limit
        '--network=none',                   // No network access
        '--read-only',                      // Read-only filesystem
        '--tmpfs', '/tmp:rw,noexec,nosuid,size=50m', // Temporary filesystem
        '-v', `${dockerTempDir}:/workspace:rw`,   // Mount workspace
        '-v', `${dockerDatasetsDir}:/datasets:ro`, // Mount datasets read-only
        '--user', 'edgeql',                 // Non-root user
        '--security-opt', 'no-new-privileges', // Security constraint
        'edgeql-nodejs-sandbox',            // Image name
        'node', `/workspace/nodes/${nodeType}.js`,
        '/workspace/input/input.json',
        '/workspace/output/output.json'
      ];
      
      logs.push(`Starting Docker container: ${containerName}`);
      logs.push(`Docker command: docker ${dockerArgs.join(' ')}`);
      
      // Set environment variables for Docker process
      const dockerEnv = { ...process.env };
      
      // On Windows, disable MSYS path conversion to prevent Git Bash from transforming Docker volume paths
      if (process.platform === 'win32') {
        dockerEnv.MSYS_NO_PATHCONV = '1';
      }
      
      const dockerProcess = spawn('docker', dockerArgs, {
        stdio: 'pipe',
        timeout: 30000, // 30 second timeout (less than Python)
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
        logs.push(`Docker container exited with code: ${code}`);
        
        if (stdout) {
          logs.push(`Container stdout: ${stdout.trim()}`);
        }
        
        if (stderr) {
          logs.push(`Container stderr: ${stderr.trim()}`);
        }
        
        if (code === 0) {
          const memUsage = this.parseMemoryUsage(stderr);
          resolve({ 
            success: true,
            ...(memUsage !== undefined && { memoryUsage: memUsage })
          });
        } else {
          resolve({ 
            success: false, 
            error: `Container exited with code ${code}: ${stderr || 'No error details'}` 
          });
        }
      });
      
      dockerProcess.on('error', (error) => {
        logs.push(`Docker execution error: ${error.message}`);
        resolve({ 
          success: false, 
          error: `Docker execution failed: ${error.message}` 
        });
      });
      
      // Handle timeout
      setTimeout(() => {
        logs.push(`Container execution timeout - killing ${containerName}`);
        spawn('docker', ['kill', containerName]);
        resolve({ 
          success: false, 
          error: 'Execution timeout (30 seconds)' 
        });
      }, 30000);
    });
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