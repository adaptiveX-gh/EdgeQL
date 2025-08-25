import { v4 as uuidv4 } from 'uuid';
import { PipelineCompiler, CompiledPipeline } from '@edgeql/compiler';
import { BuiltinNodeRunner } from './runners/BuiltinRunner.js';
import { PythonSandboxRunner } from './runners/pythonSandboxRunner.js';
import { NodejsSandboxRunner } from './runners/nodejsSandboxRunner.js';
import { CustomNodeRunner } from './runners/CustomNodeRunner.js';
import { 
  NodeRunner, 
  ExecutionContext, 
  ExecutionResult, 
  PipelineExecutionResult 
} from './types.js';

export class PipelineExecutor {
  private runners: NodeRunner[];
  private activeRuns = new Map<string, boolean>(); // Track active runs for cancellation
  
  constructor() {
    this.runners = [
      new CustomNodeRunner(),       // Priority for custom JavaScript nodes
      new PythonSandboxRunner(),    // Priority for Python nodes
      new NodejsSandboxRunner(),    // Priority for Node.js nodes  
      new BuiltinNodeRunner()       // Fallback for simple built-in nodes
    ];
  }
  
  // Cancel a running pipeline
  async cancelPipeline(runId: string): Promise<boolean> {
    // Mark the run as cancelled
    this.activeRuns.set(runId, true);
    
    // Cancel any running containers
    const cancelPromises = this.runners
      .filter(runner => runner.cancel)
      .map(runner => runner.cancel!(runId));
    
    try {
      await Promise.all(cancelPromises);
      return true;
    } catch (error) {
      console.warn(`Warning during pipeline cancellation for run ${runId}:`, error);
      return true; // Still consider it cancelled even if cleanup had issues
    }
  }
  
  async executePipeline(
    pipelineId: string,
    dslContent: string
  ): Promise<PipelineExecutionResult> {
    const runId = uuidv4();
    const startTime = Date.now();
    
    // Track this run as active
    this.activeRuns.set(runId, false);
    
    try {
      // Compile the pipeline
      const compiler = new PipelineCompiler();
      const compilationResult = compiler.compile(dslContent);
      
      if (!compilationResult.success || !compilationResult.pipeline) {
        return {
          success: false,
          runId,
          results: new Map(),
          totalExecutionTime: Date.now() - startTime,
          finalOutputs: new Map(),
          error: `Compilation failed: ${compilationResult.errors?.map(e => e.message).join(', ')}`
        };
      }
      
      const pipeline = compilationResult.pipeline;
      
      // Create execution context
      const context: ExecutionContext = {
        runId,
        pipelineId,
        workingDir: `/tmp/runs/${runId}`,
        artifacts: new Map(),
        datasets: new Map([['sample_ohlcv.csv', '/datasets/BTC_1m_hyperliquid_perpetualx.csv']]),
        cancelled: false
      };
      
      // Execute nodes in order
      const results = new Map<string, ExecutionResult>();
      const outputs = new Map<string, any>();
      
      for (const nodeId of pipeline.executionOrder) {
        // Check for cancellation before executing each node
        const isCancelled = this.activeRuns.get(runId);
        if (isCancelled) {
          context.cancelled = true;
          this.activeRuns.delete(runId);
          return {
            success: false,
            runId,
            results,
            totalExecutionTime: Date.now() - startTime,
            finalOutputs: outputs,
            error: 'Pipeline execution was cancelled',
            cancelled: true
          };
        }
        
        const node = pipeline.nodes.find(n => n.id === nodeId);
        if (!node) {
          throw new Error(`Node not found in compiled pipeline: ${nodeId}`);
        }
        
        // Get inputs from previous nodes
        const inputs = new Map<string, any>();
        for (const depId of node.dependencies) {
          const depOutput = outputs.get(depId);
          if (depOutput) {
            inputs.set(depId, depOutput);
          }
        }
        
        // Find appropriate runner
        const runner = this.runners.find(r => r.canHandle(node.type));
        if (!runner) {
          throw new Error(`No runner found for node type: ${node.type}`);
        }
        
        // Execute the node
        const result = await runner.execute(
          node.id,
          node.type,
          node.parameters,
          inputs,
          context
        );
        
        results.set(nodeId, result);
        
        if (!result.success) {
          return {
            success: false,
            runId,
            results,
            totalExecutionTime: Date.now() - startTime,
            finalOutputs: outputs,
            error: `Node ${nodeId} failed: ${result.error}`
          };
        }
        
        // Store output for next nodes
        if (result.output) {
          outputs.set(nodeId, result.output);
        }
      }
      
      // Clean up active runs tracking
      this.activeRuns.delete(runId);
      
      return {
        success: true,
        runId,
        results,
        totalExecutionTime: Date.now() - startTime,
        finalOutputs: outputs
      };
      
    } catch (error) {
      // Clean up active runs tracking
      this.activeRuns.delete(runId);
      
      return {
        success: false,
        runId,
        results: new Map(),
        totalExecutionTime: Date.now() - startTime,
        finalOutputs: new Map(),
        error: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }
}

// Export types and classes
export * from './types.js';
export { BuiltinNodeRunner } from './runners/BuiltinRunner.js';
export { PythonSandboxRunner } from './runners/pythonSandboxRunner.js';
export { NodejsSandboxRunner } from './runners/nodejsSandboxRunner.js';
export { CustomNodeRunner } from './runners/CustomNodeRunner.js';