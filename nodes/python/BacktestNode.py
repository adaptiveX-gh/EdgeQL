#!/usr/bin/env python3
"""
BacktestNode - Core backtesting engine for trading strategies

This node processes buy/sell signals and OHLCV data to simulate trading
performance, calculating key metrics like returns, Sharpe ratio, and
maximum drawdown.

Features:
- Position tracking with proper entry/exit logic
- Commission and slippage modeling
- Comprehensive performance metrics
- Detailed trade log generation
- Equity curve calculation
"""

import json
import sys
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

import numpy as np
import pandas as pd
from pydantic import BaseModel, field_validator


class BacktestParams(BaseModel):
    """Parameters for the Backtest node"""

    initial_capital: float = 10000.0
    commission: float = 0.001  # 0.1% per trade
    slippage: float = 0.0005   # 0.05% slippage
    position_size: float = 1.0  # Fixed position size (% of capital)
    max_positions: int = 1      # Maximum concurrent positions
    
    @field_validator("initial_capital")
    @classmethod
    def validate_initial_capital(cls, v):
        if v <= 0:
            raise ValueError("Initial capital must be positive")
        return v
    
    @field_validator("commission", "slippage")
    @classmethod
    def validate_fees(cls, v):
        if v < 0:
            raise ValueError("Commission and slippage must be non-negative")
        return v
    
    @field_validator("position_size")
    @classmethod
    def validate_position_size(cls, v):
        if v <= 0 or v > 1:
            raise ValueError("Position size must be between 0 and 1")
        return v


class Trade(BaseModel):
    """Individual trade record"""
    entry_time: str
    exit_time: Optional[str] = None
    entry_price: float
    exit_price: Optional[float] = None
    quantity: float
    side: str  # 'long' or 'short'
    pnl: Optional[float] = None
    return_pct: Optional[float] = None
    commission_paid: float = 0.0
    slippage_cost: float = 0.0
    status: str = "open"  # 'open' or 'closed'


class BacktestResults(BaseModel):
    """Complete backtest results"""
    total_return: float
    annual_return: float
    sharpe_ratio: float
    max_drawdown: float
    max_drawdown_duration: int
    num_trades: int
    win_rate: float
    profit_factor: float
    avg_trade_return: float
    trades: List[Trade]
    equity_curve: List[Dict[str, Any]]
    final_capital: float


class BacktestNode:
    """
    Backtesting Engine
    
    Processes trading signals and OHLCV data to simulate strategy performance.
    Calculates comprehensive metrics and provides detailed trade analysis.
    """

    def __init__(self, params: Dict[str, Any]):
        self.params = BacktestParams(**params)
        self.current_position: Optional[Trade] = None
        self.trades: List[Trade] = []
        self.equity_curve: List[Dict[str, Any]] = []
        self.capital = self.params.initial_capital

    def run(self, inputs: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Main execution method
        
        Args:
            inputs: Dictionary containing signals and price data
            
        Returns:
            Dict containing backtest results and performance metrics
        """
        try:
            if not inputs:
                raise ValueError("BacktestNode requires input data")

            # Extract signals and price data from inputs
            signals_data, price_data = self._extract_input_data(inputs)
            
            print(f"Starting backtest with {len(price_data)} data points")
            print(f"Found {len(signals_data[signals_data['signal'] != 0])} signals")
            
            # Merge signals with price data
            combined_data = self._merge_signals_and_prices(signals_data, price_data)
            
            # Run the backtest simulation
            self._run_backtest_simulation(combined_data)
            
            # Calculate performance metrics
            results = self._calculate_performance_metrics(combined_data)
            
            print(f"Backtest completed. Final capital: ${results.final_capital:.2f}")
            print(f"Total return: {results.total_return:.2%}")
            print(f"Number of trades: {results.num_trades}")
            
            return {
                "type": "backtest_results",
                "data": {
                    "total_return": results.total_return,
                    "annual_return": results.annual_return,
                    "sharpe_ratio": results.sharpe_ratio,
                    "max_drawdown": results.max_drawdown,
                    "max_drawdown_duration": results.max_drawdown_duration,
                    "num_trades": results.num_trades,
                    "win_rate": results.win_rate,
                    "profit_factor": results.profit_factor,
                    "avg_trade_return": results.avg_trade_return,
                    "final_capital": results.final_capital,
                    "trades": [trade.model_dump() for trade in results.trades],
                    "equity_curve": results.equity_curve
                },
                "metadata": {
                    "initial_capital": self.params.initial_capital,
                    "commission": self.params.commission,
                    "slippage": self.params.slippage,
                    "position_size": self.params.position_size,
                    "backtest_period": {
                        "start": str(combined_data["timestamp"].min()),
                        "end": str(combined_data["timestamp"].max())
                    },
                    "total_periods": len(combined_data)
                }
            }

        except Exception as e:
            raise RuntimeError(f"BacktestNode failed: {str(e)}")

    def _extract_input_data(self, inputs: Dict[str, Any]) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Extract signals and price data from inputs"""
        combined_data = None
        
        # Look for dataframe inputs that contain both signals and OHLCV data
        for input_name, input_data in inputs.items():
            if isinstance(input_data, dict) and input_data.get("type") == "dataframe":
                df = pd.DataFrame(input_data["data"])
                
                # Check if this dataframe has both OHLCV data and signals
                if self._is_ohlcv_data(df) and "signal" in df.columns:
                    combined_data = df
                    break
                # Fallback: if it has OHLCV data without signals, assume signals are 0
                elif self._is_ohlcv_data(df):
                    df["signal"] = 0
                    combined_data = df
                    print("Warning: Found OHLCV data without signals, assuming no signals")
        
        if combined_data is None:
            raise ValueError("No signals data found in inputs. Expected dataframe with OHLCV data and 'signal' column")
            
        # Ensure timestamp columns are datetime
        if "timestamp" in combined_data.columns:
            combined_data["timestamp"] = pd.to_datetime(combined_data["timestamp"])
        
        # For compatibility with existing methods, return the same data twice
        # The merge method will handle this correctly
        return combined_data, combined_data

    def _is_ohlcv_data(self, df: pd.DataFrame) -> bool:
        """Check if dataframe contains OHLCV data"""
        required_columns = {"open", "high", "low", "close", "volume"}
        return required_columns.issubset(set(df.columns.str.lower()))

    def _merge_signals_and_prices(self, signals_data: pd.DataFrame, price_data: pd.DataFrame) -> pd.DataFrame:
        """Merge signals with price data on timestamp"""
        # If signals_data and price_data are the same (combined data from CrossoverSignalNode)
        if signals_data is price_data or signals_data.equals(price_data):
            combined_data = signals_data.copy()
        else:
            # Ensure both have timestamp columns
            if "timestamp" not in signals_data.columns:
                raise ValueError("Signals data must have timestamp column")
            if "timestamp" not in price_data.columns:
                raise ValueError("Price data must have timestamp column")
                
            # Merge on timestamp
            combined_data = pd.merge(
                price_data, 
                signals_data[["timestamp", "signal"]], 
                on="timestamp", 
                how="left"
            )
        
        # Fill missing signals with 0 (no signal)
        if "signal" not in combined_data.columns:
            combined_data["signal"] = 0
        else:
            combined_data["signal"] = combined_data["signal"].fillna(0)
        
        # Sort by timestamp
        combined_data = combined_data.sort_values("timestamp").reset_index(drop=True)
        
        return combined_data

    def _run_backtest_simulation(self, data: pd.DataFrame) -> None:
        """Run the main backtest simulation"""
        self.capital = self.params.initial_capital
        self.current_position = None
        self.trades = []
        self.equity_curve = []
        
        for idx, row in data.iterrows():
            timestamp = row["timestamp"]
            open_price = row["open"]
            high_price = row["high"]
            low_price = row["low"]
            close_price = row["close"]
            signal = row["signal"]
            
            # Process any existing position
            current_equity = self._calculate_current_equity(row)
            
            # Record equity curve point
            self.equity_curve.append({
                "timestamp": str(timestamp),
                "equity": current_equity,
                "drawdown": self._calculate_current_drawdown(current_equity),
                "position": "long" if self.current_position else "flat"
            })
            
            # Process signals
            if signal != 0:
                self._process_signal(signal, row)
                
        # Close any remaining open position
        if self.current_position:
            last_row = data.iloc[-1]
            self._close_position(last_row, "end_of_period")

    def _calculate_current_equity(self, row: pd.Series) -> float:
        """Calculate current equity including unrealized P&L"""
        if self.current_position is None:
            return self.capital
            
        # Calculate unrealized P&L
        current_price = row["close"]
        unrealized_pnl = (current_price - self.current_position.entry_price) * self.current_position.quantity
        
        if self.current_position.side == "short":
            unrealized_pnl = -unrealized_pnl
            
        return self.capital + unrealized_pnl

    def _calculate_current_drawdown(self, current_equity: float) -> float:
        """Calculate current drawdown from peak equity"""
        if not self.equity_curve:
            return 0.0
            
        peak_equity = max([point["equity"] for point in self.equity_curve] + [current_equity])
        return (peak_equity - current_equity) / peak_equity

    def _process_signal(self, signal: float, row: pd.Series) -> None:
        """Process buy/sell signals"""
        timestamp = row["timestamp"]
        price = row["close"]  # Use close price for signal execution
        
        # Apply slippage to execution price
        if signal > 0:  # Buy signal
            execution_price = price * (1 + self.params.slippage)
            if self.current_position is None:
                self._enter_long_position(timestamp, execution_price)
            elif self.current_position.side == "short":
                self._close_position(row, "signal_reversal")
                self._enter_long_position(timestamp, execution_price)
        
        elif signal < 0:  # Sell signal
            execution_price = price * (1 - self.params.slippage)
            if self.current_position and self.current_position.side == "long":
                self._close_position(row, "signal_exit")

    def _enter_long_position(self, timestamp: datetime, price: float) -> None:
        """Enter a long position"""
        position_value = self.capital * self.params.position_size
        commission_cost = position_value * self.params.commission
        quantity = (position_value - commission_cost) / price
        
        self.current_position = Trade(
            entry_time=str(timestamp),
            entry_price=price,
            quantity=quantity,
            side="long",
            commission_paid=commission_cost,
            slippage_cost=position_value * self.params.slippage
        )
        
        # Reduce available capital by commission
        self.capital -= commission_cost
        
        print(f"Entered long position: {quantity:.4f} @ ${price:.2f}")

    def _close_position(self, row: pd.Series, reason: str) -> None:
        """Close the current position"""
        if self.current_position is None:
            return
            
        timestamp = row["timestamp"]
        price = row["close"]
        
        # Apply slippage
        if self.current_position.side == "long":
            exit_price = price * (1 - self.params.slippage)
        else:
            exit_price = price * (1 + self.params.slippage)
            
        # Calculate P&L
        pnl = (exit_price - self.current_position.entry_price) * self.current_position.quantity
        if self.current_position.side == "short":
            pnl = -pnl
            
        # Calculate commission on exit
        exit_value = exit_price * self.current_position.quantity
        exit_commission = exit_value * self.params.commission
        
        # Net P&L after commissions
        net_pnl = pnl - exit_commission
        return_pct = net_pnl / (self.current_position.entry_price * self.current_position.quantity)
        
        # Update position details
        self.current_position.exit_time = str(timestamp)
        self.current_position.exit_price = exit_price
        self.current_position.pnl = net_pnl
        self.current_position.return_pct = return_pct
        self.current_position.commission_paid += exit_commission
        self.current_position.status = "closed"
        
        # Update capital
        self.capital += net_pnl
        
        # Add to trades list
        self.trades.append(self.current_position)
        self.current_position = None
        
        print(f"Closed position: P&L ${net_pnl:.2f} ({return_pct:.2%}) - {reason}")

    def _calculate_performance_metrics(self, data: pd.DataFrame) -> BacktestResults:
        """Calculate comprehensive performance metrics"""
        if not self.equity_curve:
            raise ValueError("No equity curve data available")
            
        # Basic returns
        final_capital = self.equity_curve[-1]["equity"]
        total_return = (final_capital - self.params.initial_capital) / self.params.initial_capital
        
        # Annualized return (assuming daily data)
        days = len(data)
        annual_return = (1 + total_return) ** (365 / days) - 1 if days > 0 else 0
        
        # Calculate equity series for advanced metrics
        equity_series = pd.Series([point["equity"] for point in self.equity_curve])
        returns_series = equity_series.pct_change().dropna()
        
        # Sharpe ratio (assuming risk-free rate of 0)
        sharpe_ratio = returns_series.mean() / returns_series.std() * np.sqrt(252) if returns_series.std() > 0 else 0
        
        # Maximum drawdown
        running_max = equity_series.expanding().max()
        drawdown_series = (equity_series - running_max) / running_max
        max_drawdown = abs(drawdown_series.min())
        
        # Max drawdown duration
        drawdown_duration = self._calculate_max_drawdown_duration(equity_series)
        
        # Trade statistics
        if self.trades:
            winning_trades = [t for t in self.trades if t.pnl > 0]
            losing_trades = [t for t in self.trades if t.pnl <= 0]
            
            win_rate = len(winning_trades) / len(self.trades)
            
            total_wins = sum(t.pnl for t in winning_trades) if winning_trades else 0
            total_losses = abs(sum(t.pnl for t in losing_trades)) if losing_trades else 1
            profit_factor = total_wins / total_losses if total_losses > 0 else 0
            
            avg_trade_return = np.mean([t.return_pct for t in self.trades])
        else:
            win_rate = 0.0
            profit_factor = 0.0
            avg_trade_return = 0.0
            
        return BacktestResults(
            total_return=total_return,
            annual_return=annual_return,
            sharpe_ratio=sharpe_ratio,
            max_drawdown=max_drawdown,
            max_drawdown_duration=drawdown_duration,
            num_trades=len(self.trades),
            win_rate=win_rate,
            profit_factor=profit_factor,
            avg_trade_return=avg_trade_return,
            trades=self.trades,
            equity_curve=self.equity_curve,
            final_capital=final_capital
        )

    def _calculate_max_drawdown_duration(self, equity_series: pd.Series) -> int:
        """Calculate maximum drawdown duration in periods"""
        running_max = equity_series.expanding().max()
        is_drawdown = equity_series < running_max
        
        max_duration = 0
        current_duration = 0
        
        for in_drawdown in is_drawdown:
            if in_drawdown:
                current_duration += 1
                max_duration = max(max_duration, current_duration)
            else:
                current_duration = 0
                
        return max_duration


def main():
    """Entry point when run as standalone script"""
    if len(sys.argv) not in [3, 4]:
        print("Usage: python BacktestNode.py <input_json> <output_json> [logs_json]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    logs_file = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        # Read parameters and inputs from input JSON
        with open(input_file, "r") as f:
            config = json.load(f)

        # Create and run the node
        node = BacktestNode(config.get("params", {}))
        result = node.run(config.get("inputs", {}))

        # Write result to output JSON
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2, default=str)

        print(f"BacktestNode completed successfully")

    except Exception as e:
        error_result = {"error": str(e), "type": "execution_error"}

        with open(output_file, "w") as f:
            json.dump(error_result, f, indent=2)

        print(f"BacktestNode failed: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()