#!/usr/bin/env python3
"""
Tests for LabelingNode

This test suite covers the signal generation and labeling functionality including:
- Various labeling methods
- Technical indicator signals
- Multi-class labeling
- Risk management signals
"""

import json
import os
import sys
import unittest
from unittest.mock import mock_open, patch

import numpy as np
import pandas as pd

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(__file__))

from LabelingNode import LabelingNode, LabelingParams


class TestLabelingNode(unittest.TestCase):

    def setUp(self):
        """Set up test fixtures"""
        # Create sample OHLCV data with features
        np.random.seed(42)  # For reproducible tests
        self.sample_data = pd.DataFrame(
            {
                "timestamp": pd.date_range("2024-01-01", periods=100, freq="1H"),
                "open": 100 + np.random.randn(100) * 2,
                "high": 102 + np.random.randn(100) * 2,
                "low": 98 + np.random.randn(100) * 2,
                "close": 100 + np.random.randn(100) * 2,
                "volume": 1000 + np.random.randn(100) * 100,
            }
        )

        # Add some technical indicators for testing
        self.sample_data["sma_10"] = self.sample_data["close"].rolling(10).mean()
        self.sample_data["sma_20"] = self.sample_data["close"].rolling(20).mean()
        self.sample_data["ema_12"] = self.sample_data["close"].ewm(span=12).mean()
        self.sample_data["ema_26"] = self.sample_data["close"].ewm(span=26).mean()

        # Calculate RSI
        delta = self.sample_data["close"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        self.sample_data["rsi_14"] = 100 - (100 / (1 + rs))

        # Calculate MACD
        self.sample_data["macd_line"] = (
            self.sample_data["ema_12"] - self.sample_data["ema_26"]
        )
        self.sample_data["macd_signal"] = (
            self.sample_data["macd_line"].ewm(span=9).mean()
        )
        self.sample_data["macd_histogram"] = (
            self.sample_data["macd_line"] - self.sample_data["macd_signal"]
        )

        # Calculate Bollinger Bands
        sma_20 = self.sample_data["close"].rolling(20).mean()
        std_20 = self.sample_data["close"].rolling(20).std()
        self.sample_data["bb_upper"] = sma_20 + (std_20 * 2)
        self.sample_data["bb_lower"] = sma_20 - (std_20 * 2)
        self.sample_data["bb_middle"] = sma_20
        self.sample_data["bb_width"] = (
            self.sample_data["bb_upper"] - self.sample_data["bb_lower"]
        )
        self.sample_data["bb_position"] = (
            self.sample_data["close"] - self.sample_data["bb_lower"]
        ) / self.sample_data["bb_width"]

    def test_init_valid_params(self):
        """Test initialization with valid parameters"""
        params = {
            "method": "future_returns",
            "forward_periods": 5,
            "return_threshold": 0.05,
        }

        node = LabelingNode(params)
        self.assertEqual(node.params.method, "future_returns")
        self.assertEqual(node.params.forward_periods, 5)
        self.assertEqual(node.params.return_threshold, 0.05)

    def test_init_invalid_method(self):
        """Test initialization with invalid method"""
        with self.assertRaises(ValueError):
            LabelingNode({"method": "invalid_method"})

    def test_future_returns_labeling(self):
        """Test future returns labeling method"""
        params = {
            "method": "future_returns",
            "forward_periods": 5,
            "return_threshold": 0.02,
        }
        node = LabelingNode(params)

        result_df = node._generate_future_returns_labels(self.sample_data.copy())

        # Check that signal columns were created
        self.assertIn("signal", result_df.columns)
        self.assertIn("signal_5p", result_df.columns)
        self.assertIn("future_return_5p", result_df.columns)

        # Check signal values are valid (-1, 0, 1)
        unique_signals = result_df["signal"].dropna().unique()
        self.assertTrue(all(s in [-1, 0, 1] for s in unique_signals))

    def test_future_returns_multiple_periods(self):
        """Test future returns with multiple periods"""
        params = {
            "method": "future_returns",
            "forward_periods": [3, 5, 10],
            "return_threshold": 0.02,
        }
        node = LabelingNode(params)

        result_df = node._generate_future_returns_labels(self.sample_data.copy())

        # Check that all period signals were created
        for period in [3, 5, 10]:
            self.assertIn(f"signal_{period}p", result_df.columns)
            self.assertIn(f"future_return_{period}p", result_df.columns)

        # Main signal should use first period
        self.assertTrue(result_df["signal"].equals(result_df["signal_3p"]))

    def test_crossover_labeling(self):
        """Test crossover labeling method"""
        params = {
            "method": "crossover",
            "fast_column": "sma_10",
            "slow_column": "sma_20",
        }
        node = LabelingNode(params)

        result_df = node._generate_crossover_labels(self.sample_data.copy())

        self.assertIn("signal", result_df.columns)
        self.assertIn("fast_above_slow", result_df.columns)
        self.assertIn("crossover_strength", result_df.columns)

        # Check signal values
        unique_signals = result_df["signal"].unique()
        self.assertTrue(all(s in [-1, 0, 1] for s in unique_signals))

    def test_crossover_missing_columns(self):
        """Test crossover with missing columns"""
        params = {
            "method": "crossover",
            "fast_column": "nonexistent_fast",
            "slow_column": "nonexistent_slow",
        }
        node = LabelingNode(params)

        with self.assertRaises(ValueError):
            node._generate_crossover_labels(self.sample_data.copy())

    def test_rsi_signals(self):
        """Test RSI-based signal generation"""
        params = {"method": "rsi_signals"}
        node = LabelingNode(params)

        result_df = node._generate_rsi_signals(self.sample_data.copy())

        self.assertIn("signal", result_df.columns)
        self.assertIn("rsi_oversold", result_df.columns)
        self.assertIn("rsi_overbought", result_df.columns)
        self.assertIn("rsi_extreme", result_df.columns)

        # Check that oversold/overbought are binary
        self.assertTrue(all(result_df["rsi_oversold"].isin([0, 1])))
        self.assertTrue(all(result_df["rsi_overbought"].isin([0, 1])))

    def test_rsi_signals_missing_column(self):
        """Test RSI signals with missing RSI column"""
        data_no_rsi = self.sample_data.drop(columns=["rsi_14"])
        params = {"method": "rsi_signals"}
        node = LabelingNode(params)

        with self.assertRaises(ValueError):
            node._generate_rsi_signals(data_no_rsi)

    def test_bollinger_signals(self):
        """Test Bollinger Bands signal generation"""
        params = {"method": "bollinger_signals"}
        node = LabelingNode(params)

        result_df = node._generate_bollinger_signals(self.sample_data.copy())

        self.assertIn("signal", result_df.columns)
        self.assertIn("bb_squeeze", result_df.columns)
        self.assertIn("bb_breakout", result_df.columns)

        # Check signal values
        unique_signals = result_df["signal"].unique()
        self.assertTrue(all(s in [-1, 0, 1] for s in unique_signals))

    def test_macd_signals(self):
        """Test MACD signal generation"""
        params = {"method": "macd_signals"}
        node = LabelingNode(params)

        result_df = node._generate_macd_signals(self.sample_data.copy())

        self.assertIn("signal", result_df.columns)
        self.assertIn("macd_above_signal", result_df.columns)
        self.assertIn("macd_histogram_increasing", result_df.columns)

        # Check binary features
        self.assertTrue(all(result_df["macd_above_signal"].isin([0, 1])))
        self.assertTrue(all(result_df["macd_histogram_increasing"].isin([0, 1])))

    def test_multiclass_labeling(self):
        """Test multi-class labeling"""
        params = {"method": "multi_class", "forward_periods": 5, "num_classes": 3}
        node = LabelingNode(params)

        result_df = node._generate_multiclass_labels(self.sample_data.copy())

        self.assertIn("label", result_df.columns)
        self.assertIn("signal", result_df.columns)
        self.assertIn("future_return_multiclass", result_df.columns)

        # Check class values (0, 1, 2 for 3-class)
        unique_labels = result_df["label"].dropna().unique()
        self.assertTrue(all(l in [0, 1, 2] for l in unique_labels))

        # Check signal conversion (-1, 0, 1)
        unique_signals = result_df["signal"].dropna().unique()
        self.assertTrue(all(s in [-1, 0, 1] for s in unique_signals))

    def test_multiclass_5_classes(self):
        """Test 5-class labeling"""
        params = {"method": "multi_class", "forward_periods": 5, "num_classes": 5}
        node = LabelingNode(params)

        result_df = node._generate_multiclass_labels(self.sample_data.copy())

        # Check 5-class labels (0, 1, 2, 3, 4)
        unique_labels = result_df["label"].dropna().unique()
        self.assertTrue(all(l in [0, 1, 2, 3, 4] for l in unique_labels))

        # Check signal conversion (-2, -1, 0, 1, 2)
        unique_signals = result_df["signal"].dropna().unique()
        self.assertTrue(all(s in [-2, -1, 0, 1, 2] for s in unique_signals))

    def test_risk_management(self):
        """Test risk management signal addition"""
        params = {"method": "threshold", "stop_loss_pct": 5.0, "take_profit_pct": 10.0}
        node = LabelingNode(params)

        # First generate basic signals
        result_df = node._generate_threshold_labels(self.sample_data.copy())
        # Then add risk management
        result_df = node._add_risk_management(result_df)

        self.assertIn("stop_loss_signal", result_df.columns)
        self.assertIn("take_profit_signal", result_df.columns)

        # Check binary values
        self.assertTrue(all(result_df["stop_loss_signal"].isin([0, 1])))
        self.assertTrue(all(result_df["take_profit_signal"].isin([0, 1])))

    def test_signal_statistics(self):
        """Test signal statistics calculation"""
        # Create data with known signals
        test_data = self.sample_data.copy()
        test_data["signal"] = [1, -1, 0, 1, 0, -1, 0, 0, 1, -1] * 10
        test_data["label"] = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0] * 10

        params = {"method": "future_returns"}
        node = LabelingNode(params)

        stats = node._calculate_signal_stats(test_data)

        self.assertEqual(stats["total_signals"], 60)  # 6 non-zero signals per 10, * 10
        self.assertEqual(stats["buy_signals"], 30)  # 3 buy signals per 10, * 10
        self.assertEqual(stats["sell_signals"], 30)  # 3 sell signals per 10, * 10
        self.assertEqual(stats["hold_periods"], 40)  # 4 hold signals per 10, * 10
        self.assertEqual(stats["signal_frequency"], 0.6)  # 60/100
        self.assertEqual(stats["buy_sell_ratio"], 1.0)  # 30/30
        self.assertIn("class_distribution", stats)

    def test_run_success(self):
        """Test successful run with complete flow"""
        params = {
            "method": "future_returns",
            "forward_periods": 3,
            "return_threshold": 0.02,
        }
        node = LabelingNode(params)

        inputs = {
            "feature_data": {
                "type": "dataframe",
                "data": self.sample_data.to_dict("records"),
            }
        }

        result = node.run(inputs)

        self.assertEqual(result["type"], "dataframe")
        self.assertIn("metadata", result)
        self.assertEqual(result["metadata"]["method"], "future_returns")
        self.assertIn("signal_stats", result["metadata"])

        # Verify result data structure
        result_data = pd.DataFrame(result["data"])
        self.assertEqual(len(result_data), len(self.sample_data))
        self.assertIn("signal", result_data.columns)

    def test_run_with_invalid_input(self):
        """Test run method with invalid input"""
        node = LabelingNode({"method": "future_returns"})

        # No inputs
        with self.assertRaises(ValueError):
            node.run()

        # Invalid input format
        with self.assertRaises(ValueError):
            node.run({"invalid": "data"})

    def test_threshold_labeling(self):
        """Test threshold-based labeling"""
        params = {"method": "threshold", "return_threshold": 0.05}
        node = LabelingNode(params)

        result_df = node._generate_threshold_labels(self.sample_data.copy())

        self.assertIn("signal", result_df.columns)
        self.assertIn("price_change", result_df.columns)

        # Check signal values
        unique_signals = result_df["signal"].unique()
        self.assertTrue(all(s in [-1, 0, 1] for s in unique_signals))

    def test_unknown_method_error(self):
        """Test error handling for unknown labeling method"""
        params = {"method": "unknown_method"}
        node = LabelingNode(params)

        with self.assertRaises(ValueError):
            node._generate_labels(self.sample_data.copy())


class TestLabelingNodeMainFunction(unittest.TestCase):
    """Test the main function that handles JSON input/output"""

    def test_main_success(self):
        """Test main function with successful execution"""
        input_data = {
            "params": {
                "method": "future_returns",
                "forward_periods": 3,
                "return_threshold": 0.02,
            },
            "inputs": {
                "data": {
                    "type": "dataframe",
                    "data": [
                        {
                            "timestamp": "2024-01-01",
                            "open": 100,
                            "high": 105,
                            "low": 98,
                            "close": 103,
                            "volume": 1000,
                        },
                        {
                            "timestamp": "2024-01-02",
                            "open": 103,
                            "high": 108,
                            "low": 101,
                            "close": 106,
                            "volume": 1200,
                        },
                    ],
                }
            },
        }

        output_data = {"type": "dataframe", "data": [], "metadata": {}}

        with patch("sys.argv", ["LabelingNode.py", "input.json", "output.json"]):
            with patch("builtins.open", mock_open()) as mock_file:
                with patch("json.load", return_value=input_data):
                    with patch("json.dump") as mock_dump:
                        # Mock the node execution to avoid complex setup
                        with patch.object(
                            LabelingNode, "run", return_value=output_data
                        ):
                            from LabelingNode import main

                            main()

                            # Verify JSON dump was called with success result
                            mock_dump.assert_called()

    def test_main_error_handling(self):
        """Test main function error handling"""
        with patch("sys.argv", ["LabelingNode.py", "input.json", "output.json"]):
            with patch("builtins.open", mock_open()):
                with patch("json.load", side_effect=Exception("Test error")):
                    with patch("json.dump") as mock_dump:
                        with patch("sys.exit") as mock_exit:
                            from LabelingNode import main

                            main()

                            # Verify error was written and exit was called
                            mock_dump.assert_called()
                            mock_exit.assert_called_with(1)


if __name__ == "__main__":
    unittest.main()
