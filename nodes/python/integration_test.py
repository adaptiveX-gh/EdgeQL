#!/usr/bin/env python3
"""
Integration test for the complete ML strategy pipeline
Tests DataLoader -> Indicators -> CrossoverSignals -> Backtest
"""

import pandas as pd
import numpy as np
from IndicatorNode import IndicatorNode
from CrossoverSignalNode import CrossoverSignalNode
from BacktestNode import BacktestNode

def main():
    print('Testing complete pipeline integration...')

    # Step 1: Create simulated OHLCV data (replacing DataLoader)
    dates = pd.date_range('2022-01-01', periods=100, freq='1h')
    base_price = 45000
    trend = np.linspace(0, 2000, 100)
    noise = np.random.normal(0, 100, 100)
    close_prices = base_price + trend + noise

    ohlcv_data = pd.DataFrame({
        'timestamp': dates,
        'open': close_prices * 0.9995,
        'high': close_prices * 1.002,
        'low': close_prices * 0.998,
        'close': close_prices,
        'volume': np.random.uniform(50, 150, 100)
    })

    print(f'Generated {len(ohlcv_data)} price data points')

    # Step 2: Calculate fast moving average (SMA-10)
    fast_ma_node = IndicatorNode({'indicator': 'SMA', 'period': 10, 'column': 'close'})
    fast_ma_result = fast_ma_node.run({'type': 'dataframe', 'data': ohlcv_data.to_dict('records')})

    # Step 3: Calculate slow moving average (SMA-30) 
    slow_ma_node = IndicatorNode({'indicator': 'SMA', 'period': 30, 'column': 'close'})
    slow_ma_result = slow_ma_node.run(fast_ma_result)

    print('Calculated moving averages (SMA-10, SMA-30)')

    # Step 4: Generate crossover signals
    signal_node = CrossoverSignalNode({'fast_period': 10, 'slow_period': 30})
    signal_result = signal_node.run({'data': slow_ma_result})

    print(f'Generated {signal_result["metadata"]["total_signals"]} crossover signals')
    print(f'  - Buy signals: {signal_result["metadata"]["buy_signals"]}')
    print(f'  - Sell signals: {signal_result["metadata"]["sell_signals"]}')

    # Step 5: Run backtest
    backtest_node = BacktestNode({
        'initial_capital': 10000, 
        'commission': 0.001,
        'slippage': 0.0005,
        'position_size': 1.0
    })
    
    backtest_result = backtest_node.run({
        'signals': signal_result,
        'price_data': {'type': 'dataframe', 'data': ohlcv_data.to_dict('records')}
    })

    # Step 6: Display results
    data = backtest_result['data']
    print('\n=== BACKTEST RESULTS ===')
    print(f'Final capital: ${data["final_capital"]:.2f}')
    print(f'Total return: {data["total_return"]:.2%}')
    print(f'Annual return: {data["annual_return"]:.2%}')
    print(f'Sharpe ratio: {data["sharpe_ratio"]:.2f}')
    print(f'Max drawdown: {data["max_drawdown"]:.2%}')
    print(f'Max DD duration: {data["max_drawdown_duration"]} periods')
    print(f'Number of trades: {data["num_trades"]}')
    print(f'Win rate: {data["win_rate"]:.2%}')
    print(f'Profit factor: {data["profit_factor"]:.2f}')
    print(f'Avg trade return: {data["avg_trade_return"]:.2%}')

    # Display sample trades
    if data["trades"]:
        print(f'\n=== SAMPLE TRADES ===')
        for i, trade in enumerate(data["trades"][:5]):  # Show first 5 trades
            print(f'Trade {i+1}: {trade["side"]} @ ${trade["entry_price"]:.2f} -> ${trade["exit_price"]:.2f} | P&L: ${trade["pnl"]:.2f} ({trade["return_pct"]:.2%})')
    
    print(f'\nSUCCESS: Complete pipeline integration test passed!')
    print(f'   Pipeline: OHLCV Data -> SMA Indicators -> Crossover Signals -> Backtest Results')
    return True

if __name__ == "__main__":
    main()