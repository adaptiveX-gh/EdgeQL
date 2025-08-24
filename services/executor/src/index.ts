import { v4 as uuidv4 } from 'uuid';
import { PipelineCompiler, CompiledPipeline } from '@edgeql/compiler';
import { BuiltinNodeRunner } from './runners/builtinRunner.js';
import { PythonSandboxRunner } from './runners/pythonSandboxRunner.js';
import { NodejsSandboxRunner } from './runners/nodejsSandboxRunner.js';
import { 
  NodeRunner, 
  ExecutionContext, 
  ExecutionResult, 
  PipelineExecutionResult 
} from './types.js';

export class PipelineExecutor {
  private runners: NodeRunner[];
  
  constructor() {
    this.runners = [
      new PythonSandboxRunner(),    // Priority for Python nodes
      new NodejsSandboxRunner(),    // Priority for Node.js nodes  
      new BuiltinNodeRunner()       // Fallback for simple built-in nodes
    ];
  }
  
  async executePipeline(
    pipelineId: string,
    dslContent: string
  ): Promise<PipelineExecutionResult> {
    const runId = uuidv4();
    const startTime = Date.now();
    
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
        datasets: new Map([['sample_ohlcv.csv', '/datasets/BTC_1m_hyperliquid_perpetualx.csv']])
      };
      
      // Execute nodes in order
      const results = new Map<string, ExecutionResult>();
      const outputs = new Map<string, any>();
      
      for (const nodeId of pipeline.executionOrder) {
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
      
      return {
        success: true,
        runId,
        results,
        totalExecutionTime: Date.now() - startTime,
        finalOutputs: outputs
      };
      
    } catch (error) {
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
export { BuiltinNodeRunner } from './runners/builtinRunner.js';
export { PythonSandboxRunner } from './runners/pythonSandboxRunner.js';
export { NodejsSandboxRunner } from './runners/nodejsSandboxRunner.js';