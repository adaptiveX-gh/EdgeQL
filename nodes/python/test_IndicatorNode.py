#!/usr/bin/env python3
"""
Comprehensive test suite for IndicatorNode following TDD principles
Tests technical indicator calculations and edge cases
"""

import json
import os
import tempfile
import unittest
from unittest.mock import Mock, patch

import numpy as np
import pandas as pd

from IndicatorNode import IndicatorNode, IndicatorParams


class TestIndicatorNode(unittest.TestCase):
    """Test cases for IndicatorNode"""

    def setUp(self):
        """Set up test fixtures"""
        # Create sample OHLCV data
        self.sample_data = pd.DataFrame(
            {
                "timestamp": pd.date_range("2022-01-01", periods=100, freq="1H"),
                "open": np.random.uniform(45000, 46000, 100),
                "high": np.random.uniform(46000, 47000, 100),
                "low": np.random.uniform(44000, 45000, 100),
                "close": np.random.uniform(45000, 46000, 100),
                "volume": np.random.uniform(10, 50, 100),
            }
        )

        # Ensure high >= close >= low and high >= open >= low
        for i in range(len(self.sample_data)):
            row = self.sample_data.iloc[i]
            high = max(row["open"], row["close"], row["high"])
            low = min(row["open"], row["close"], row["low"])
            self.sample_data.at[i, "high"] = high
            self.sample_data.at[i, "low"] = low

    def test_valid_parameters_sma(self):
        """Test IndicatorParams validation with valid SMA parameters"""
        params = {"indicator": "SMA", "period": 20, "column": "close"}

        indicator_params = IndicatorParams(**params)
        self.assertEqual(indicator_params.indicator, "SMA")
        self.assertEqual(indicator_params.period, 20)
        self.assertEqual(indicator_params.column, "close")

    def test_valid_parameters_ema(self):
        """Test IndicatorParams validation with valid EMA parameters"""
        params = {"indicator": "EMA", "period": 12, "column": "close"}

        indicator_params = IndicatorParams(**params)
        self.assertEqual(indicator_params.indicator, "EMA")
        self.assertEqual(indicator_params.period, 12)

    def test_valid_parameters_rsi(self):
        """Test IndicatorParams validation with valid RSI parameters"""
        params = {"indicator": "RSI", "period": 14, "column": "close"}

        indicator_params = IndicatorParams(**params)
        self.assertEqual(indicator_params.indicator, "RSI")
        self.assertEqual(indicator_params.period, 14)

    def test_invalid_indicator_type(self):
        """Test IndicatorParams validation fails with invalid indicator"""
        params = {"indicator": "INVALID_INDICATOR", "period": 14, "column": "close"}

        with self.assertRaises(Exception):
            IndicatorParams(**params)

    def test_invalid_period_negative(self):
        """Test IndicatorParams validation fails with negative period"""
        params = {"indicator": "SMA", "period": -5, "column": "close"}

        with self.assertRaises(Exception):
            IndicatorParams(**params)

    def test_invalid_period_zero(self):
        """Test IndicatorParams validation fails with zero period"""
        params = {"indicator": "SMA", "period": 0, "column": "close"}

        with self.assertRaises(Exception):
            IndicatorParams(**params)

    def test_missing_required_parameters(self):
        """Test IndicatorParams validation fails with missing required params"""
        params = {
            "indicator": "SMA"
            # Missing period
        }

        with self.assertRaises(Exception):
            IndicatorParams(**params)

    def test_sma_calculation(self):
        """Test Simple Moving Average calculation"""
        params = {"indicator": "SMA", "period": 10, "column": "close"}

        node = IndicatorNode(params)

        # Mock input data
        input_data = {
            "type": "dataframe",
            "data": self.sample_data.to_dict("records"),
            "metadata": {"symbol": "BTC/USD"},
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            result = node.run()

        self.assertEqual(result["type"], "dataframe")
        self.assertIsInstance(result["data"], list)
        self.assertIn("metadata", result)

        # Check that SMA column was added
        first_valid_row = None
        for row in result["data"]:
            if (
                f"sma_{params['period']}" in row
                and row[f"sma_{params['period']}"] is not None
            ):
                first_valid_row = row
                break

        self.assertIsNotNone(first_valid_row)
        self.assertIn(f"sma_{params['period']}", first_valid_row)
        self.assertIsNotNone(first_valid_row[f"sma_{params['period']}"])

    def test_ema_calculation(self):
        """Test Exponential Moving Average calculation"""
        params = {"indicator": "EMA", "period": 12, "column": "close"}

        node = IndicatorNode(params)

        input_data = {
            "type": "dataframe",
            "data": self.sample_data.to_dict("records"),
            "metadata": {"symbol": "ETH/USD"},
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            result = node.run()

        self.assertEqual(result["type"], "dataframe")

        # Check that EMA column was added
        data_with_ema = [
            row
            for row in result["data"]
            if f"ema_{params['period']}" in row
            and row[f"ema_{params['period']}"] is not None
        ]

        self.assertGreater(len(data_with_ema), 0)

        # EMA values should be different from SMA values
        first_ema_row = data_with_ema[0]
        self.assertIsNotNone(first_ema_row[f"ema_{params['period']}"])

    def test_rsi_calculation(self):
        """Test Relative Strength Index calculation"""
        params = {"indicator": "RSI", "period": 14, "column": "close"}

        node = IndicatorNode(params)

        input_data = {
            "type": "dataframe",
            "data": self.sample_data.to_dict("records"),
            "metadata": {"symbol": "BTC/USD"},
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            result = node.run()

        self.assertEqual(result["type"], "dataframe")

        # Check that RSI column was added
        data_with_rsi = [
            row
            for row in result["data"]
            if f"rsi_{params['period']}" in row
            and row[f"rsi_{params['period']}"] is not None
        ]

        self.assertGreater(len(data_with_rsi), 0)

        # RSI values should be between 0 and 100
        for row in data_with_rsi:
            rsi_value = row[f"rsi_{params['period']}"]
            if rsi_value is not None:
                self.assertGreaterEqual(rsi_value, 0)
                self.assertLessEqual(rsi_value, 100)

    def test_macd_calculation(self):
        """Test MACD indicator calculation"""
        params = {
            "indicator": "MACD",
            "period": 26,  # Slow period for MACD
            "column": "close",
        }

        node = IndicatorNode(params)

        input_data = {
            "type": "dataframe",
            "data": self.sample_data.to_dict("records"),
            "metadata": {"symbol": "BTC/USD"},
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            result = node.run()

        self.assertEqual(result["type"], "dataframe")

        # MACD should add multiple columns
        macd_columns = ["macd", "macd_signal", "macd_histogram"]

        data_with_macd = [
            row for row in result["data"] if any(col in row for col in macd_columns)
        ]

        self.assertGreater(len(data_with_macd), 0)

    def test_bollinger_bands_calculation(self):
        """Test Bollinger Bands indicator calculation"""
        params = {"indicator": "BB", "period": 20, "column": "close"}

        node = IndicatorNode(params)

        input_data = {
            "type": "dataframe",
            "data": self.sample_data.to_dict("records"),
            "metadata": {"symbol": "BTC/USD"},
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            result = node.run()

        self.assertEqual(result["type"], "dataframe")

        # BB should add upper, middle, and lower bands
        bb_columns = ["bb_upper", "bb_middle", "bb_lower"]

        data_with_bb = [
            row
            for row in result["data"]
            if any(col in row and row[col] is not None for col in bb_columns)
        ]

        self.assertGreater(len(data_with_bb), 0)

        # Verify band relationships: upper > middle > lower
        for row in data_with_bb:
            if all(col in row and row[col] is not None for col in bb_columns):
                self.assertGreater(row["bb_upper"], row["bb_middle"])
                self.assertGreater(row["bb_middle"], row["bb_lower"])

    def test_insufficient_data_handling(self):
        """Test handling of insufficient data for indicator calculation"""
        # Create data with only 5 periods
        small_data = self.sample_data.head(5).to_dict("records")

        params = {
            "indicator": "SMA",
            "period": 20,  # Requires more data than available
            "column": "close",
        }

        node = IndicatorNode(params)

        input_data = {
            "type": "dataframe",
            "data": small_data,
            "metadata": {"symbol": "BTC/USD"},
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            result = node.run()

        # Should still return data, but with NaN/None values for insufficient periods
        self.assertEqual(result["type"], "dataframe")
        self.assertEqual(len(result["data"]), 5)

    def test_missing_column_handling(self):
        """Test handling of missing column in input data"""
        params = {"indicator": "SMA", "period": 10, "column": "non_existent_column"}

        node = IndicatorNode(params)

        input_data = {
            "type": "dataframe",
            "data": self.sample_data.to_dict("records"),
            "metadata": {"symbol": "BTC/USD"},
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            with self.assertRaises(RuntimeError) as context:
                node.run()

            self.assertIn("IndicatorNode failed", str(context.exception))

    def test_invalid_input_data_type(self):
        """Test handling of invalid input data type"""
        params = {"indicator": "SMA", "period": 10, "column": "close"}

        node = IndicatorNode(params)

        # Invalid input data (not a dataframe)
        input_data = {
            "type": "json",
            "data": {"invalid": "data"},
            "metadata": {"symbol": "BTC/USD"},
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            with self.assertRaises(RuntimeError) as context:
                node.run()

            self.assertIn("IndicatorNode failed", str(context.exception))

    def test_metadata_preservation(self):
        """Test that metadata is properly preserved and enhanced"""
        params = {"indicator": "SMA", "period": 20, "column": "close"}

        node = IndicatorNode(params)

        input_metadata = {"symbol": "BTC/USD", "timeframe": "1h", "rows": 100}

        input_data = {
            "type": "dataframe",
            "data": self.sample_data.to_dict("records"),
            "metadata": input_metadata,
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            result = node.run()

        self.assertIn("metadata", result)
        result_metadata = result["metadata"]

        # Original metadata should be preserved
        self.assertEqual(result_metadata["symbol"], "BTC/USD")
        self.assertEqual(result_metadata["timeframe"], "1h")

        # New metadata should be added
        self.assertEqual(result_metadata["indicator"], "SMA")
        self.assertEqual(result_metadata["period"], 20)
        self.assertEqual(result_metadata["column"], "close")

    def test_large_dataset_performance(self):
        """Test performance with large dataset"""
        # Create large dataset
        large_data = pd.DataFrame(
            {
                "timestamp": pd.date_range("2020-01-01", periods=10000, freq="1H"),
                "close": np.random.uniform(40000, 50000, 10000),
            }
        )

        params = {"indicator": "SMA", "period": 50, "column": "close"}

        node = IndicatorNode(params)

        input_data = {
            "type": "dataframe",
            "data": large_data.to_dict("records"),
            "metadata": {"symbol": "BTC/USD"},
        }

        import time

        start_time = time.time()

        with patch.object(node, "_get_input_data", return_value=input_data):
            result = node.run()

        execution_time = time.time() - start_time

        # Should complete within reasonable time (less than 5 seconds)
        self.assertLess(execution_time, 5.0)
        self.assertEqual(len(result["data"]), 10000)

    def test_multiple_column_indicators(self):
        """Test indicators that use multiple columns"""
        # Test with indicators that might use OHLC data
        params = {
            "indicator": "SMA",  # Start with SMA on different columns
            "period": 10,
            "column": "high",
        }

        node = IndicatorNode(params)

        input_data = {
            "type": "dataframe",
            "data": self.sample_data.to_dict("records"),
            "metadata": {"symbol": "BTC/USD"},
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            result = node.run()

        self.assertEqual(result["type"], "dataframe")

        # Check that SMA was calculated on 'high' column
        data_with_sma = [
            row
            for row in result["data"]
            if f"sma_{params['period']}" in row
            and row[f"sma_{params['period']}"] is not None
        ]

        self.assertGreater(len(data_with_sma), 0)

    def test_edge_case_single_data_point(self):
        """Test behavior with single data point"""
        single_point_data = self.sample_data.head(1).to_dict("records")

        params = {"indicator": "SMA", "period": 1, "column": "close"}  # Minimum period

        node = IndicatorNode(params)

        input_data = {
            "type": "dataframe",
            "data": single_point_data,
            "metadata": {"symbol": "BTC/USD"},
        }

        with patch.object(node, "_get_input_data", return_value=input_data):
            result = node.run()

        self.assertEqual(result["type"], "dataframe")
        self.assertEqual(len(result["data"]), 1)

        # SMA with period 1 should equal the close price
        row = result["data"][0]
        if f"sma_{params['period']}" in row:
            self.assertEqual(row[f"sma_{params['period']}"], row["close"])

    def test_concurrent_indicator_calculations(self):
        """Test thread safety and concurrent calculations"""
        import threading
        import time

        params = {"indicator": "SMA", "period": 10, "column": "close"}

        results = []
        errors = []

        def calculate_indicator():
            try:
                node = IndicatorNode(params)
                input_data = {
                    "type": "dataframe",
                    "data": self.sample_data.to_dict("records"),
                    "metadata": {"symbol": "BTC/USD"},
                }

                with patch.object(node, "_get_input_data", return_value=input_data):
                    result = node.run()
                    results.append(result)
            except Exception as e:
                errors.append(e)

        # Create multiple threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=calculate_indicator)
            threads.append(thread)
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # All calculations should succeed
        self.assertEqual(len(errors), 0)
        self.assertEqual(len(results), 5)

        # Results should be consistent
        for result in results:
            self.assertEqual(result["type"], "dataframe")
            self.assertEqual(len(result["data"]), len(self.sample_data))


if __name__ == "__main__":
    # Run tests with verbose output
    unittest.main(verbosity=2)
