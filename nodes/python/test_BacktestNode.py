#!/usr/bin/env python3
"""
Comprehensive test suite for BacktestNode following TDD principles
Tests backtesting logic, performance metrics, and edge cases
"""

import json
import os
import tempfile
import unittest
from unittest.mock import Mock, patch
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from BacktestNode import BacktestNode, BacktestParams, Trade, BacktestResults


class TestBacktestNode(unittest.TestCase):
    """Test cases for BacktestNode"""

    def setUp(self):
        """Set up test fixtures"""
        # Create sample OHLCV data
        dates = pd.date_range("2022-01-01", periods=100, freq="1h")
        self.sample_price_data = pd.DataFrame({
            "timestamp": dates,
            "open": np.random.uniform(45000, 46000, 100),
            "high": np.random.uniform(46000, 47000, 100),
            "low": np.random.uniform(44000, 45000, 100),
            "close": np.random.uniform(45000, 46000, 100),
            "volume": np.random.uniform(10, 50, 100),
        })

        # Ensure price consistency (high >= close >= low, etc.)
        for i in range(len(self.sample_price_data)):
            row = self.sample_price_data.iloc[i]
            high = max(row["open"], row["close"], row["high"])
            low = min(row["open"], row["close"], row["low"])
            self.sample_price_data.at[i, "high"] = high
            self.sample_price_data.at[i, "low"] = low

        # Create sample signals data
        self.sample_signals_data = pd.DataFrame({
            "timestamp": dates,
            "signal": np.zeros(100)  # Initialize with no signals
        })

        # Add some test signals
        self.sample_signals_data.loc[10, "signal"] = 1.0   # Buy signal
        self.sample_signals_data.loc[20, "signal"] = -1.0  # Sell signal
        self.sample_signals_data.loc[30, "signal"] = 1.0   # Buy signal
        self.sample_signals_data.loc[40, "signal"] = -1.0  # Sell signal

    def test_valid_parameters(self):
        """Test BacktestParams validation with valid parameters"""
        params = {
            "initial_capital": 10000,
            "commission": 0.001,
            "slippage": 0.0005,
            "position_size": 1.0
        }

        backtest_params = BacktestParams(**params)
        self.assertEqual(backtest_params.initial_capital, 10000)
        self.assertEqual(backtest_params.commission, 0.001)
        self.assertEqual(backtest_params.slippage, 0.0005)
        self.assertEqual(backtest_params.position_size, 1.0)

    def test_invalid_initial_capital(self):
        """Test BacktestParams validation fails with invalid initial capital"""
        params = {"initial_capital": -1000}

        with self.assertRaises(Exception) as context:
            BacktestParams(**params)

        self.assertIn("Initial capital must be positive", str(context.exception))

    def test_invalid_commission(self):
        """Test BacktestParams validation fails with negative commission"""
        params = {"initial_capital": 10000, "commission": -0.01}

        with self.assertRaises(Exception) as context:
            BacktestParams(**params)

        self.assertIn("Commission and slippage must be non-negative", str(context.exception))

    def test_invalid_position_size(self):
        """Test BacktestParams validation fails with invalid position size"""
        params = {"initial_capital": 10000, "position_size": 1.5}

        with self.assertRaises(Exception) as context:
            BacktestParams(**params)

        self.assertIn("Position size must be between 0 and 1", str(context.exception))

    def test_basic_backtest_execution(self):
        """Test basic backtest execution with sample data"""
        params = {
            "initial_capital": 10000,
            "commission": 0.001,
            "slippage": 0.0005,
            "position_size": 1.0
        }

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": self.sample_signals_data.to_dict("records")
            },
            "price_data": {
                "type": "dataframe", 
                "data": self.sample_price_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        self.assertEqual(result["type"], "backtest_results")
        self.assertIn("data", result)
        self.assertIn("metadata", result)

        # Check result structure
        data = result["data"]
        self.assertIn("total_return", data)
        self.assertIn("sharpe_ratio", data)
        self.assertIn("max_drawdown", data)
        self.assertIn("num_trades", data)
        self.assertIn("win_rate", data)
        self.assertIn("trades", data)
        self.assertIn("equity_curve", data)

    def test_no_signals_backtest(self):
        """Test backtest with no signals generates no trades"""
        params = {"initial_capital": 10000}

        # Create data with no signals
        no_signals_data = self.sample_signals_data.copy()
        no_signals_data["signal"] = 0.0

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": no_signals_data.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": self.sample_price_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        # Should have no trades and zero return
        data = result["data"]
        self.assertEqual(data["num_trades"], 0)
        self.assertEqual(data["total_return"], 0.0)
        self.assertEqual(len(data["trades"]), 0)

    def test_single_trade_execution(self):
        """Test execution of a single complete trade"""
        params = {"initial_capital": 10000, "commission": 0.001}

        # Create simple signals: buy then sell
        simple_signals = self.sample_signals_data.copy()
        simple_signals["signal"] = 0.0
        simple_signals.loc[10, "signal"] = 1.0   # Buy
        simple_signals.loc[20, "signal"] = -1.0  # Sell

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": simple_signals.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": self.sample_price_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        # Should have exactly 1 trade
        data = result["data"]
        self.assertEqual(data["num_trades"], 1)
        self.assertEqual(len(data["trades"]), 1)

        # Check trade details
        trade = data["trades"][0]
        self.assertEqual(trade["side"], "long")
        self.assertEqual(trade["status"], "closed")
        self.assertIsNotNone(trade["entry_price"])
        self.assertIsNotNone(trade["exit_price"])
        self.assertIsNotNone(trade["pnl"])

    def test_commission_calculation(self):
        """Test that commission is properly calculated and applied"""
        params = {
            "initial_capital": 10000,
            "commission": 0.01,  # 1% commission
            "slippage": 0.0
        }

        # Create simple buy/sell signals
        simple_signals = self.sample_signals_data.copy()
        simple_signals["signal"] = 0.0
        simple_signals.loc[10, "signal"] = 1.0   # Buy
        simple_signals.loc[20, "signal"] = -1.0  # Sell

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": simple_signals.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": self.sample_price_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        # Check that commission was applied
        trade = result["data"]["trades"][0]
        self.assertGreater(trade["commission_paid"], 0)
        
        # Commission should be approximately 2% of trade value (1% entry + 1% exit)
        expected_commission = 0.02 * trade["entry_price"] * trade["quantity"]
        self.assertAlmostEqual(trade["commission_paid"], expected_commission, places=2)

    def test_equity_curve_generation(self):
        """Test that equity curve is properly generated"""
        params = {"initial_capital": 10000}

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": self.sample_signals_data.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": self.sample_price_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        equity_curve = result["data"]["equity_curve"]
        
        # Should have one point per data period
        self.assertEqual(len(equity_curve), len(self.sample_price_data))
        
        # Each point should have required fields
        for point in equity_curve:
            self.assertIn("timestamp", point)
            self.assertIn("equity", point)
            self.assertIn("drawdown", point)
            self.assertIn("position", point)

        # First equity point should equal initial capital
        self.assertEqual(equity_curve[0]["equity"], 10000)

    def test_performance_metrics_calculation(self):
        """Test calculation of performance metrics"""
        params = {"initial_capital": 10000}

        # Create profitable scenario
        profitable_price_data = self.sample_price_data.copy()
        profitable_price_data["close"] = np.linspace(45000, 50000, 100)  # Uptrend

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": self.sample_signals_data.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": profitable_price_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        data = result["data"]

        # All metrics should be calculated
        self.assertIsInstance(data["total_return"], float)
        self.assertIsInstance(data["sharpe_ratio"], float)
        self.assertIsInstance(data["max_drawdown"], float)
        self.assertIsInstance(data["win_rate"], float)
        self.assertIsInstance(data["profit_factor"], float)

        # Drawdown should be non-negative
        self.assertGreaterEqual(data["max_drawdown"], 0)

        # Win rate should be between 0 and 1
        self.assertGreaterEqual(data["win_rate"], 0)
        self.assertLessEqual(data["win_rate"], 1)

    def test_insufficient_data_handling(self):
        """Test handling of insufficient data"""
        params = {"initial_capital": 10000}

        # Create minimal data
        minimal_data = self.sample_price_data.head(2)
        minimal_signals = self.sample_signals_data.head(2)

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": minimal_signals.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": minimal_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        # Should complete without error
        self.assertEqual(result["type"], "backtest_results")
        self.assertIn("data", result)

    def test_missing_signals_data(self):
        """Test handling of missing signals data"""
        params = {"initial_capital": 10000}

        node = BacktestNode(params)

        inputs = {
            "price_data": {
                "type": "dataframe",
                "data": self.sample_price_data.to_dict("records")
            }
        }

        with self.assertRaises(RuntimeError) as context:
            node.run(inputs)

        self.assertIn("No signals data found", str(context.exception))

    def test_missing_price_data(self):
        """Test handling of missing price data"""
        params = {"initial_capital": 10000}

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": self.sample_signals_data.to_dict("records")
            }
        }

        with self.assertRaises(RuntimeError) as context:
            node.run(inputs)

        self.assertIn("No price data", str(context.exception))

    def test_invalid_input_data(self):
        """Test handling of invalid input data types"""
        params = {"initial_capital": 10000}

        node = BacktestNode(params)

        inputs = {
            "invalid_data": {
                "type": "unknown",
                "data": {"invalid": "format"}
            }
        }

        with self.assertRaises(RuntimeError) as context:
            node.run(inputs)

        self.assertIn("BacktestNode failed", str(context.exception))

    def test_position_sizing(self):
        """Test different position sizing configurations"""
        # Test 50% position size
        params = {
            "initial_capital": 10000,
            "position_size": 0.5,
            "commission": 0.001
        }

        simple_signals = self.sample_signals_data.copy()
        simple_signals["signal"] = 0.0
        simple_signals.loc[10, "signal"] = 1.0   # Buy

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": simple_signals.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": self.sample_price_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        # Should use only 50% of capital for position
        if result["data"]["trades"]:
            trade = result["data"]["trades"][0]
            position_value = trade["entry_price"] * trade["quantity"]
            # Should be approximately 50% of capital (minus commission)
            expected_value = 10000 * 0.5
            self.assertLess(abs(position_value - expected_value), expected_value * 0.1)

    def test_multiple_consecutive_signals(self):
        """Test handling of multiple consecutive buy/sell signals"""
        params = {"initial_capital": 10000}

        # Create consecutive buy signals
        consecutive_signals = self.sample_signals_data.copy()
        consecutive_signals["signal"] = 0.0
        consecutive_signals.loc[10, "signal"] = 1.0   # Buy
        consecutive_signals.loc[11, "signal"] = 1.0   # Buy again (should be ignored)
        consecutive_signals.loc[12, "signal"] = 1.0   # Buy again (should be ignored)
        consecutive_signals.loc[20, "signal"] = -1.0  # Sell

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": consecutive_signals.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": self.sample_price_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        # Should only execute one trade (ignore consecutive signals)
        self.assertEqual(result["data"]["num_trades"], 1)

    def test_signal_reversal_handling(self):
        """Test handling of signal reversals (buy while short, etc.)"""
        params = {"initial_capital": 10000}

        # This is a basic implementation that doesn't support short selling
        # So sell signals without long positions should be ignored
        reversal_signals = self.sample_signals_data.copy()
        reversal_signals["signal"] = 0.0
        reversal_signals.loc[10, "signal"] = -1.0  # Sell first (should be ignored)
        reversal_signals.loc[15, "signal"] = 1.0   # Buy
        reversal_signals.loc[20, "signal"] = -1.0  # Sell

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": reversal_signals.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": self.sample_price_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        # Should only have 1 trade (buy->sell), initial sell should be ignored
        self.assertEqual(result["data"]["num_trades"], 1)

    def test_metadata_preservation(self):
        """Test that metadata is properly generated"""
        params = {
            "initial_capital": 5000,
            "commission": 0.002,
            "slippage": 0.001
        }

        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": self.sample_signals_data.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": self.sample_price_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        metadata = result["metadata"]

        # Check that parameters are preserved
        self.assertEqual(metadata["initial_capital"], 5000)
        self.assertEqual(metadata["commission"], 0.002)
        self.assertEqual(metadata["slippage"], 0.001)

        # Check that backtest period is recorded
        self.assertIn("backtest_period", metadata)
        self.assertIn("start", metadata["backtest_period"])
        self.assertIn("end", metadata["backtest_period"])

        # Check total periods
        self.assertEqual(metadata["total_periods"], len(self.sample_price_data))

    def test_trade_model_validation(self):
        """Test Trade model validation"""
        # Valid trade
        trade = Trade(
            entry_time="2022-01-01T00:00:00",
            entry_price=45000.0,
            quantity=0.1,
            side="long"
        )

        self.assertEqual(trade.side, "long")
        self.assertEqual(trade.status, "open")

        # Test with exit data
        trade.exit_time = "2022-01-01T01:00:00"
        trade.exit_price = 46000.0
        trade.pnl = 100.0
        trade.status = "closed"

        self.assertEqual(trade.status, "closed")
        self.assertEqual(trade.pnl, 100.0)

    def test_large_dataset_performance(self):
        """Test performance with larger dataset"""
        # Create larger dataset
        large_dates = pd.date_range("2020-01-01", periods=1000, freq="1h")
        large_price_data = pd.DataFrame({
            "timestamp": large_dates,
            "open": np.random.uniform(40000, 50000, 1000),
            "high": np.random.uniform(45000, 55000, 1000), 
            "low": np.random.uniform(35000, 45000, 1000),
            "close": np.random.uniform(40000, 50000, 1000),
            "volume": np.random.uniform(10, 50, 1000),
        })

        large_signals = pd.DataFrame({
            "timestamp": large_dates,
            "signal": np.random.choice([0, 0, 0, 0, 1, -1], 1000)  # Sparse signals
        })

        params = {"initial_capital": 10000}
        node = BacktestNode(params)

        inputs = {
            "signals": {
                "type": "signals",
                "data": large_signals.to_dict("records")
            },
            "price_data": {
                "type": "dataframe",
                "data": large_price_data.to_dict("records")
            }
        }

        import time
        start_time = time.time()

        result = node.run(inputs)

        execution_time = time.time() - start_time

        # Should complete within reasonable time (less than 10 seconds)
        self.assertLess(execution_time, 10.0)
        self.assertEqual(result["type"], "backtest_results")


if __name__ == "__main__":
    # Run tests with verbose output
    unittest.main(verbosity=2)