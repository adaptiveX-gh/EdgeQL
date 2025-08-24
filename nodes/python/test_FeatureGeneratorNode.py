#!/usr/bin/env python3
"""
Tests for FeatureGeneratorNode

This test suite covers the feature generation functionality including:
- Technical indicator calculations
- Input validation
- Error handling
- Feature metadata
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

from FeatureGeneratorNode import FeatureGeneratorNode, FeatureGeneratorParams


class TestFeatureGeneratorNode(unittest.TestCase):

    def setUp(self):
        """Set up test fixtures"""
        self.sample_ohlcv_data = pd.DataFrame(
            {
                "timestamp": pd.date_range("2024-01-01", periods=100, freq="1H"),
                "open": np.random.uniform(100, 110, 100),
                "high": np.random.uniform(110, 120, 100),
                "low": np.random.uniform(90, 100, 100),
                "close": np.random.uniform(95, 115, 100),
                "volume": np.random.uniform(1000, 5000, 100),
            }
        )

        # Make sure high >= low and close is within range
        for i in range(len(self.sample_ohlcv_data)):
            high = max(
                self.sample_ohlcv_data.iloc[i]["open"],
                self.sample_ohlcv_data.iloc[i]["close"],
            ) + np.random.uniform(0, 5)
            low = min(
                self.sample_ohlcv_data.iloc[i]["open"],
                self.sample_ohlcv_data.iloc[i]["close"],
            ) - np.random.uniform(0, 5)
            self.sample_ohlcv_data.at[i, "high"] = high
            self.sample_ohlcv_data.at[i, "low"] = low

    def test_init_valid_params(self):
        """Test initialization with valid parameters"""
        params = {
            "features": [{"type": "sma", "period": 20}, {"type": "ema", "period": 12}],
            "lookback_period": 50,
            "fill_na_method": "forward",
        }

        node = FeatureGeneratorNode(params)
        self.assertEqual(len(node.params.features), 2)
        self.assertEqual(node.params.lookback_period, 50)
        self.assertEqual(node.params.fill_na_method, "forward")

    def test_init_invalid_params(self):
        """Test initialization with invalid parameters"""
        with self.assertRaises(ValueError):
            FeatureGeneratorNode(
                {"features": [{"invalid": "feature"}]}  # Missing 'type' key
            )

    def test_is_ohlcv_data(self):
        """Test OHLCV data validation"""
        node = FeatureGeneratorNode({"features": [{"type": "sma", "period": 20}]})

        # Valid OHLCV data
        self.assertTrue(node._is_ohlcv_data(self.sample_ohlcv_data))

        # Invalid data (missing columns)
        invalid_data = pd.DataFrame({"price": [100, 101, 102]})
        self.assertFalse(node._is_ohlcv_data(invalid_data))

    def test_sma_generation(self):
        """Test Simple Moving Average generation"""
        params = {
            "features": [
                {"type": "sma", "period": 10, "column": "close", "name": "sma_10"}
            ]
        }
        node = FeatureGeneratorNode(params)

        result_df = node._add_sma(self.sample_ohlcv_data.copy(), params["features"][0])

        self.assertIn("sma_10", result_df.columns)
        self.assertEqual(len(result_df), len(self.sample_ohlcv_data))

        # Check that SMA calculation is correct for a few points
        manual_sma = self.sample_ohlcv_data["close"].iloc[0:10].mean()
        self.assertAlmostEqual(result_df["sma_10"].iloc[9], manual_sma, places=6)

    def test_ema_generation(self):
        """Test Exponential Moving Average generation"""
        params = {
            "features": [
                {"type": "ema", "period": 12, "column": "close", "name": "ema_12"}
            ]
        }
        node = FeatureGeneratorNode(params)

        result_df = node._add_ema(self.sample_ohlcv_data.copy(), params["features"][0])

        self.assertIn("ema_12", result_df.columns)
        self.assertEqual(len(result_df), len(self.sample_ohlcv_data))

        # EMA should start from the first value
        self.assertEqual(
            result_df["ema_12"].iloc[0], self.sample_ohlcv_data["close"].iloc[0]
        )

    def test_rsi_generation(self):
        """Test RSI indicator generation"""
        params = {
            "features": [
                {"type": "rsi", "period": 14, "column": "close", "name": "rsi_14"}
            ]
        }
        node = FeatureGeneratorNode(params)

        result_df = node._add_rsi(self.sample_ohlcv_data.copy(), params["features"][0])

        self.assertIn("rsi_14", result_df.columns)

        # RSI should be between 0 and 100
        rsi_values = result_df["rsi_14"].dropna()
        self.assertTrue(all(rsi_values >= 0))
        self.assertTrue(all(rsi_values <= 100))

    def test_macd_generation(self):
        """Test MACD indicator generation"""
        params = {
            "features": [
                {
                    "type": "macd",
                    "fast_period": 12,
                    "slow_period": 26,
                    "signal_period": 9,
                    "column": "close",
                }
            ]
        }
        node = FeatureGeneratorNode(params)

        result_df = node._add_macd(self.sample_ohlcv_data.copy(), params["features"][0])

        expected_columns = ["macd_line", "macd_signal", "macd_histogram"]
        for col in expected_columns:
            self.assertIn(col, result_df.columns)

        # MACD histogram should be the difference between line and signal
        calculated_histogram = result_df["macd_line"] - result_df["macd_signal"]
        pd.testing.assert_series_equal(
            result_df["macd_histogram"], calculated_histogram, check_names=False
        )

    def test_bollinger_bands_generation(self):
        """Test Bollinger Bands generation"""
        params = {
            "features": [
                {
                    "type": "bollinger_bands",
                    "period": 20,
                    "std_dev": 2,
                    "column": "close",
                }
            ]
        }
        node = FeatureGeneratorNode(params)

        result_df = node._add_bollinger_bands(
            self.sample_ohlcv_data.copy(), params["features"][0]
        )

        expected_columns = [
            "bb_upper",
            "bb_lower",
            "bb_middle",
            "bb_width",
            "bb_position",
        ]
        for col in expected_columns:
            self.assertIn(col, result_df.columns)

        # Upper band should be greater than lower band
        self.assertTrue(all(result_df["bb_upper"] >= result_df["bb_lower"]))

        # BB position should be between 0 and 1 for most values
        bb_position = result_df["bb_position"].dropna()
        # Allow some values outside 0-1 for extreme cases
        self.assertTrue(bb_position.quantile(0.05) >= -0.5)
        self.assertTrue(bb_position.quantile(0.95) <= 1.5)

    def test_atr_generation(self):
        """Test Average True Range generation"""
        params = {"features": [{"type": "atr", "period": 14}]}
        node = FeatureGeneratorNode(params)

        result_df = node._add_atr(self.sample_ohlcv_data.copy(), params["features"][0])

        self.assertIn("atr", result_df.columns)

        # ATR should be positive
        atr_values = result_df["atr"].dropna()
        self.assertTrue(all(atr_values >= 0))

    def test_stochastic_generation(self):
        """Test Stochastic Oscillator generation"""
        params = {"features": [{"type": "stochastic", "k_period": 14, "d_period": 3}]}
        node = FeatureGeneratorNode(params)

        result_df = node._add_stochastic(
            self.sample_ohlcv_data.copy(), params["features"][0]
        )

        expected_columns = ["stoch_k", "stoch_d"]
        for col in expected_columns:
            self.assertIn(col, result_df.columns)

        # Stochastic values should be between 0 and 100
        stoch_k = result_df["stoch_k"].dropna()
        stoch_d = result_df["stoch_d"].dropna()

        self.assertTrue(all(stoch_k >= 0))
        self.assertTrue(all(stoch_k <= 100))
        self.assertTrue(all(stoch_d >= 0))
        self.assertTrue(all(stoch_d <= 100))

    def test_multiple_features(self):
        """Test generation of multiple features"""
        params = {
            "features": [
                {"type": "sma", "period": 10},
                {"type": "ema", "period": 20},
                {"type": "rsi", "period": 14},
                {"type": "atr", "period": 14},
            ]
        }
        node = FeatureGeneratorNode(params)

        inputs = {
            "price_data": {
                "type": "dataframe",
                "data": self.sample_ohlcv_data.to_dict("records"),
            }
        }

        result = node.run(inputs)

        self.assertTrue(result["type"] == "dataframe")
        self.assertGreater(result["metadata"]["features_added"], 0)
        self.assertEqual(result["metadata"]["rows"], len(self.sample_ohlcv_data))

        result_df = pd.DataFrame(result["data"])

        expected_features = ["sma_10", "ema_20", "rsi_14", "atr"]
        for feature in expected_features:
            self.assertIn(feature, result_df.columns)

    def test_nan_handling(self):
        """Test NaN value handling"""
        # Create data with NaN values
        data_with_nan = self.sample_ohlcv_data.copy()
        data_with_nan.iloc[10:15, data_with_nan.columns.get_loc("close")] = np.nan

        params = {
            "features": [{"type": "sma", "period": 5}],
            "fill_na_method": "forward",
        }
        node = FeatureGeneratorNode(params)

        result_df = node._generate_all_features(data_with_nan)
        final_df = node._handle_nan_values(result_df)

        # Should have no NaN values after handling
        self.assertEqual(final_df.isna().sum().sum(), 0)

    def test_run_with_invalid_input(self):
        """Test run method with invalid input"""
        node = FeatureGeneratorNode({"features": [{"type": "sma", "period": 20}]})

        # No inputs
        with self.assertRaises(ValueError):
            node.run()

        # Invalid input format
        with self.assertRaises(ValueError):
            node.run({"invalid": "data"})

    def test_run_success(self):
        """Test successful run with complete flow"""
        params = {
            "features": [{"type": "sma", "period": 10}, {"type": "rsi", "period": 14}]
        }
        node = FeatureGeneratorNode(params)

        inputs = {
            "ohlcv_data": {
                "type": "dataframe",
                "data": self.sample_ohlcv_data.to_dict("records"),
            }
        }

        result = node.run(inputs)

        self.assertTrue(result["type"] == "dataframe")
        self.assertIn("metadata", result)
        self.assertGreater(result["metadata"]["features_added"], 0)
        self.assertIn("feature_names", result["metadata"])

        # Verify result data structure
        result_data = pd.DataFrame(result["data"])
        self.assertEqual(len(result_data), len(self.sample_ohlcv_data))
        self.assertIn("sma_10", result_data.columns)
        self.assertIn("rsi_14", result_data.columns)

    def test_unknown_feature_type(self):
        """Test handling of unknown feature types"""
        params = {"features": [{"type": "unknown_indicator", "period": 10}]}
        node = FeatureGeneratorNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": self.sample_ohlcv_data.to_dict("records"),
            }
        }

        # Should not raise an exception, just log a warning
        result = node.run(inputs)
        self.assertTrue(result["type"] == "dataframe")


class TestFeatureGeneratorMainFunction(unittest.TestCase):
    """Test the main function that handles JSON input/output"""

    def test_main_success(self):
        """Test main function with successful execution"""
        input_data = {
            "params": {"features": [{"type": "sma", "period": 20}]},
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

        output_data = {"type": "dataframe", "data": []}

        with patch(
            "sys.argv", ["FeatureGeneratorNode.py", "input.json", "output.json"]
        ):
            with patch("builtins.open", mock_open()) as mock_file:
                with patch("json.load", return_value=input_data):
                    with patch("json.dump") as mock_dump:
                        # Mock the node execution to avoid complex setup
                        with patch.object(
                            FeatureGeneratorNode, "run", return_value=output_data
                        ):
                            from FeatureGeneratorNode import main

                            main()

                            # Verify JSON dump was called with success result
                            mock_dump.assert_called()

    def test_main_error_handling(self):
        """Test main function error handling"""
        with patch(
            "sys.argv", ["FeatureGeneratorNode.py", "input.json", "output.json"]
        ):
            with patch("builtins.open", mock_open()):
                with patch("json.load", side_effect=Exception("Test error")):
                    with patch("json.dump") as mock_dump:
                        with patch("sys.exit") as mock_exit:
                            from FeatureGeneratorNode import main

                            main()

                            # Verify error was written and exit was called
                            mock_dump.assert_called()
                            mock_exit.assert_called_with(1)


if __name__ == "__main__":
    unittest.main()
