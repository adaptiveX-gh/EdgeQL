import { NodeRunner, ExecutionContext, ExecutionResult, LogEntry } from '../types.js';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class PythonSandboxRunner implements NodeRunner {
  private readonly pythonNodes = [
    'DataLoaderNode',
    'IndicatorNode', 
    'FeatureGeneratorNode',
    'LabelingNode',
    'ModelTrainerNode',
    'BacktestNode'
  ];
  
  // Track running containers by runId for cancellation
  private runningContainers = new Map<string, string>();
  
  canHandle(nodeType: string): boolean {
    return this.pythonNodes.includes(nodeType);
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
    const structuredLogs: LogEntry[] = [];
    const executionId = uuidv4();
    
    try {
      logs.push(`Executing Python node: ${nodeType} (${nodeId}) in sandbox`);
      
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
          nodeId: nodeId,
          datasets: Object.fromEntries(context.datasets)
        }
      };
      
      const inputFile = path.join(inputDir, 'input.json');
      const outputFile = path.join(outputDir, 'output.json');
      const logsFile = path.join(outputDir, 'logs.json');
      
      writeFileSync(inputFile, JSON.stringify(inputData, null, 2));
      logs.push(`Input data written to: ${inputFile}`);
      
      // Execute Python node in Docker container
      const result = await this.runInDockerContainer(
        nodeType,
        inputFile,
        outputFile,
        logsFile,
        tempDir,
        logs,
        structuredLogs,
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
        throw new Error('Python node did not produce output file');
      }
      
      const outputContent = readFileSync(outputFile, 'utf-8');
      const output = JSON.parse(outputContent);
      
      if (output.error) {
        throw new Error(`Python node error: ${output.error}`);
      }
      
      // Try to read structured logs if available
      this.readStructuredLogs(logsFile, structuredLogs, nodeId, nodeType);
      
      logs.push(`Node completed successfully`);
      structuredLogs.push({
        timestamp: new Date().toISOString(),
        nodeId,
        level: 'info',
        message: `Node ${nodeType} completed successfully`,
        source: 'system'
      });
      
      return {
        success: true,
        nodeId,
        output: output.result || output,
        logs,
        structuredLogs,
        executionTime: Date.now() - startTime,
        ...(result.memoryUsage !== undefined && { memoryUsage: result.memoryUsage })
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logs.push(`Python node failed: ${errorMessage}`);
      structuredLogs.push({
        timestamp: new Date().toISOString(),
        nodeId,
        level: 'error',
        message: `Python node failed: ${errorMessage}`,
        source: 'system'
      });
      
      return {
        success: false,
        nodeId,
        error: errorMessage,
        logs,
        structuredLogs,
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
    logsFile: string,
    tempDir: string,
    logs: string[],
    structuredLogs: LogEntry[],
    runId: string,
    context: ExecutionContext
  ): Promise<{ success: boolean; error?: string; memoryUsage?: number }> {
    return new Promise((resolve) => {
      const containerName = `edgeql-python-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
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
        '--memory=512m',                    // Memory limit
        '--cpus=1.0',                       // CPU limit
        '--network=none',                   // No network access
        '--read-only',                      // Read-only filesystem
        '--tmpfs', '/tmp:rw,noexec,nosuid,size=100m', // Temporary filesystem
        '-v', `${dockerTempDir}:/workspace:rw`,   // Mount workspace
        '-v', `${dockerDatasetsDir}:/datasets:ro`, // Mount datasets read-only
        '--user', 'edgeql',                 // Non-root user
        '--security-opt', 'no-new-privileges', // Security constraint
        'edgeql-python-sandbox',            // Image name
        'python', `/app/nodes/${nodeType}.py`,
        '/workspace/input/input.json',
        '/workspace/output/output.json',
        '/workspace/output/logs.json'
      ];
      
      logs.push(`Starting Docker container: ${containerName}`);
      logs.push(`Docker command: docker ${dockerArgs.join(' ')}`);
      
      const dockerProcess = spawn('docker', dockerArgs, {
        stdio: 'pipe',
        timeout: 60000 // 60 second timeout
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
          logs.push(`Container execution timeout - killing ${containerName}`);
          spawn('docker', ['kill', containerName]);
          this.runningContainers.delete(runId);
          resolve({ 
            success: false, 
            error: 'Execution timeout (60 seconds)' 
          });
        }
      }, 60000);
      
      // Clear timeout if process completes normally
      dockerProcess.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }
  
  private readStructuredLogs(logsFile: string, structuredLogs: LogEntry[], nodeId: string, nodeType: string): void {
    try {
      if (existsSync(logsFile)) {
        const logsContent = readFileSync(logsFile, 'utf-8');
        const nodeLogs = JSON.parse(logsContent);
        
        if (Array.isArray(nodeLogs)) {
          structuredLogs.push(...nodeLogs);
        }
      }
    } catch (error) {
      // If we can't read the logs file, add a system log entry
      structuredLogs.push({
        timestamp: new Date().toISOString(),
        nodeId,
        level: 'warn',
        message: `Could not read structured logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'system'
      });
    }
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