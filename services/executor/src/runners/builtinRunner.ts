import { NodeRunner, ExecutionContext, ExecutionResult } from '../types.js';
import { readFileSync } from 'fs';
import path from 'path';

export class BuiltinNodeRunner implements NodeRunner {
  canHandle(nodeType: string): boolean {
    const builtinNodes = [
      'DataLoaderNode',
      'IndicatorNode', 
      'CrossoverSignalNode',
      'BacktestNode'
    ];
    return builtinNodes.includes(nodeType);
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
    
    try {
      logs.push(`Executing builtin node: ${nodeType} (${nodeId})`);
      
      let output: any;
      
      switch (nodeType) {
        case 'DataLoaderNode':
          output = await this.executeDataLoader(parameters, context, logs);
          break;
          
        case 'IndicatorNode':
          output = await this.executeIndicator(parameters, inputs, logs);
          break;
          
        case 'CrossoverSignalNode':
          output = await this.executeCrossoverSignal(parameters, inputs, logs);
          break;
          
        case 'BacktestNode':
          output = await this.executeBacktest(parameters, inputs, logs);
          break;
          
        default:
          throw new Error(`Unsupported builtin node type: ${nodeType}`);
      }
      
      const executionTime = Date.now() - startTime;
      logs.push(`Node completed in ${executionTime}ms`);
      
      return {
        success: true,
        nodeId,
        output,
        logs,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logs.push(`Node failed: ${errorMessage}`);
      
      return {
        success: false,
        nodeId,
        error: errorMessage,
        logs,
        executionTime
      };
    }
  }
  
  private async executeDataLoader(
    parameters: Record<string, any>,
    context: ExecutionContext,
    logs: string[]
  ): Promise<any> {
    const { symbol, timeframe, dataset } = parameters;
    
    logs.push(`Loading data for ${symbol} (${timeframe}) from ${dataset}`);
    
    // For MVP, simulate loading from the sample CSV
    if (dataset === 'sample_ohlcv.csv') {
      // In a real implementation, this would load from the actual dataset
      const sampleData = [
        { timestamp: '2024-01-01T00:00:00Z', open: 100, high: 105, low: 98, close: 103, volume: 1000 },
        { timestamp: '2024-01-01T01:00:00Z', open: 103, high: 108, low: 101, close: 106, volume: 1200 },
        { timestamp: '2024-01-01T02:00:00Z', open: 106, high: 110, low: 104, close: 109, volume: 900 },
        { timestamp: '2024-01-01T03:00:00Z', open: 109, high: 112, low: 107, close: 111, volume: 1100 },
        { timestamp: '2024-01-01T04:00:00Z', open: 111, high: 115, low: 109, close: 113, volume: 1300 }
      ];
      
      logs.push(`Loaded ${sampleData.length} data points`);
      return { type: 'dataframe', data: sampleData };
    }
    
    throw new Error(`Dataset not found: ${dataset}`);
  }
  
  private async executeIndicator(
    parameters: Record<string, any>,
    inputs: Map<string, any>,
    logs: string[]
  ): Promise<any> {
    const { indicator, period, column = 'close' } = parameters;
    
    // Get input data
    const inputData = Array.from(inputs.values())[0];
    if (!inputData || inputData.type !== 'dataframe') {
      throw new Error('Invalid input data for indicator');
    }
    
    const data = inputData.data;
    logs.push(`Calculating ${indicator}(${period}) on ${data.length} data points`);
    
    // Simple indicator calculations for MVP
    let indicatorData: any[];
    
    switch (indicator) {
      case 'SMA':
        indicatorData = this.calculateSMA(data, period, column);
        break;
      case 'EMA':
        indicatorData = this.calculateEMA(data, period, column);
        break;
      default:
        throw new Error(`Unsupported indicator: ${indicator}`);
    }
    
    logs.push(`Generated ${indicatorData.length} indicator values`);
    
    // Merge with original data
    const result = data.map((row: any, i: number) => ({
      ...row,
      [`${indicator}_${period}`]: indicatorData[i] || null
    }));
    
    return { type: 'dataframe', data: result };
  }
  
  private calculateSMA(data: any[], period: number, column: string): number[] {
    const values: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        values.push(null as any);
      } else {
        const sum = data.slice(i - period + 1, i + 1)
          .reduce((acc, row) => acc + row[column], 0);
        values.push(sum / period);
      }
    }
    
    return values;
  }
  
  private calculateEMA(data: any[], period: number, column: string): number[] {
    const values: number[] = [];
    const multiplier = 2 / (period + 1);
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        values.push(data[i][column]);
      } else {
        const currentValue = data[i]?.[column];
        const previousValue = values[i - 1];
        if (currentValue === undefined || previousValue === undefined) {
          throw new Error(`Missing data at index ${i} for EMA calculation`);
        }
        const ema = (currentValue * multiplier) + (previousValue * (1 - multiplier));
        values.push(ema);
      }
    }
    
    return values;
  }
  
  private async executeCrossoverSignal(
    parameters: Record<string, any>,
    inputs: Map<string, any>,
    logs: string[]
  ): Promise<any> {
    const { buy_condition, sell_condition } = parameters;
    
    logs.push(`Generating crossover signals with conditions: buy=${buy_condition}, sell=${sell_condition}`);
    
    // Get input dataframes (should have indicators)
    const inputDataframes = Array.from(inputs.values()).filter(input => input.type === 'dataframe');
    if (inputDataframes.length < 2) {
      throw new Error('CrossoverSignalNode requires at least 2 dataframe inputs');
    }
    
    // For MVP, assume we have fast and slow indicators in the data
    // This is a simplified implementation
    const baseData = inputDataframes[0].data;
    const signals = baseData.map((row: any, i: number) => {
      let signal = 0;
      
      // Simple crossover logic (would be more sophisticated in real implementation)
      if (i > 0) {
        const prevRow = baseData[i - 1];
        
        // Check for SMA crossover (simplified)
        if (row.SMA_10 && row.SMA_20 && prevRow.SMA_10 && prevRow.SMA_20) {
          if (prevRow.SMA_10 <= prevRow.SMA_20 && row.SMA_10 > row.SMA_20) {
            signal = 1; // Buy signal
          } else if (prevRow.SMA_10 >= prevRow.SMA_20 && row.SMA_10 < row.SMA_20) {
            signal = -1; // Sell signal
          }
        }
      }
      
      return {
        ...row,
        signal
      };
    });
    
    const signalCount = signals.filter((row: any) => row.signal !== 0).length;
    logs.push(`Generated ${signalCount} trading signals`);
    
    return { type: 'dataframe', data: signals };
  }
  
  private async executeBacktest(
    parameters: Record<string, any>,
    inputs: Map<string, any>,
    logs: string[]
  ): Promise<any> {
    const { initial_capital, commission = 0.001 } = parameters;
    
    logs.push(`Running backtest with initial capital: $${initial_capital}, commission: ${commission}`);
    
    // Get signals and price data
    const inputValues = Array.from(inputs.values());
    const signalData = inputValues.find(input => 
      input.type === 'dataframe' && input.data[0]?.signal !== undefined
    );
    
    if (!signalData) {
      throw new Error('No signal data found for backtest');
    }
    
    const data = signalData.data;
    let capital = initial_capital;
    let position = 0;
    let trades = 0;
    let winningTrades = 0;
    const equityCurve: any[] = [];
    let maxCapital = initial_capital;
    let maxDrawdown = 0;
    
    logs.push(`Processing ${data.length} data points`);
    
    for (const row of data) {
      if (row.signal === 1 && position <= 0) {
        // Buy signal
        const cost = capital * commission;
        const shares = (capital - cost) / row.close;
        position = shares;
        capital = 0;
        trades++;
        logs.push(`BUY: ${shares.toFixed(4)} shares at $${row.close}`);
      } else if (row.signal === -1 && position > 0) {
        // Sell signal
        const proceeds = position * row.close;
        const cost = proceeds * commission;
        capital = proceeds - cost;
        
        if (capital > initial_capital) winningTrades++;
        position = 0;
        trades++;
        logs.push(`SELL: ${position.toFixed(4)} shares at $${row.close}, capital: $${capital.toFixed(2)}`);
      }
      
      // Calculate current equity
      const currentEquity = capital + (position * row.close);
      equityCurve.push({
        timestamp: row.timestamp,
        equity: currentEquity
      });
      
      // Track max drawdown
      if (currentEquity > maxCapital) {
        maxCapital = currentEquity;
      } else {
        const drawdown = (maxCapital - currentEquity) / maxCapital;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }
    
    // Final capital calculation
    if (position > 0) {
      const lastPrice = data[data.length - 1].close;
      capital = position * lastPrice;
      position = 0;
    }
    
    const totalReturn = ((capital - initial_capital) / initial_capital) * 100;
    const winRate = trades > 0 ? winningTrades / trades : 0;
    
    // Simple Sharpe ratio calculation (would need more sophisticated calculation in real implementation)
    const returns = equityCurve.map((point, i) => {
      if (i === 0) return 0;
      return (point.equity - equityCurve[i-1].equity) / equityCurve[i-1].equity;
    });
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnStdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = returnStdDev > 0 ? avgReturn / returnStdDev : 0;
    
    const results = {
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(3)),
      maxDrawdown: parseFloat((-maxDrawdown * 100).toFixed(2)),
      numTrades: trades,
      winRate: parseFloat(winRate.toFixed(3)),
      finalCapital: parseFloat(capital.toFixed(2)),
      trades: [], // Would include detailed trade log in real implementation
      equityCurve
    };
    
    logs.push(`Backtest completed: Return=${results.totalReturn}%, Trades=${results.numTrades}, Win Rate=${(results.winRate*100).toFixed(1)}%`);
    
    return { type: 'backtest_results', data: results };
  }
}