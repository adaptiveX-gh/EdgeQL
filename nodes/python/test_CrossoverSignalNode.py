#!/usr/bin/env python3
"""
Comprehensive test suite for CrossoverSignalNode following TDD principles
Tests crossover signal generation and various edge cases
"""

import json
import os
import tempfile
import unittest
from unittest.mock import Mock, patch

import numpy as np
import pandas as pd

from CrossoverSignalNode import CrossoverSignalNode, CrossoverSignalParams


class TestCrossoverSignalNode(unittest.TestCase):
    """Test cases for CrossoverSignalNode"""

    def setUp(self):
        """Set up test fixtures"""
        # Create sample data with moving averages
        dates = pd.date_range("2022-01-01", periods=100, freq="1h")
        
        # Create base price data with trend
        base_price = 45000
        price_trend = np.linspace(0, 5000, 100)  # Upward trend
        noise = np.random.normal(0, 200, 100)    # Add some noise
        close_prices = base_price + price_trend + noise

        self.sample_data_with_mas = pd.DataFrame({
            "timestamp": dates,
            "open": close_prices * 0.999,
            "high": close_prices * 1.002,
            "low": close_prices * 0.997,
            "close": close_prices,
            "volume": np.random.uniform(10, 50, 100),
            "SMA_20": self._calculate_sma(close_prices, 20),
            "SMA_50": self._calculate_sma(close_prices, 50),
        })

        # Create sample data with explicit MA columns for testing
        self.crossover_data = pd.DataFrame({
            "timestamp": dates[:50],
            "close": np.random.uniform(45000, 46000, 50),
            "fast_ma": [45000] * 25 + [45100] * 25,  # Fast MA crosses above
            "slow_ma": [45050] * 50,                  # Slow MA stays constant
        })
        
        # Ensure crossover happens at index 25
        self.crossover_data.loc[24, "fast_ma"] = 45040  # Below slow MA
        self.crossover_data.loc[25, "fast_ma"] = 45060  # Above slow MA (crossover)

    def _calculate_sma(self, prices: np.ndarray, period: int) -> np.ndarray:
        """Helper to calculate simple moving average"""
        sma = np.full_like(prices, np.nan)
        for i in range(period - 1, len(prices)):
            sma[i] = np.mean(prices[i - period + 1:i + 1])
        return sma

    def test_valid_parameters(self):
        """Test CrossoverSignalParams validation with valid parameters"""
        params = {
            "fast_period": 20,
            "slow_period": 50,
            "signal_column": "signal"
        }

        signal_params = CrossoverSignalParams(**params)
        self.assertEqual(signal_params.fast_period, 20)
        self.assertEqual(signal_params.slow_period, 50)
        self.assertEqual(signal_params.signal_column, "signal")

    def test_invalid_period_relationship(self):
        """Test validation fails when fast period >= slow period"""
        params = {
            "fast_period": 50,
            "slow_period": 20  # Fast should be less than slow
        }

        with self.assertRaises(Exception) as context:
            CrossoverSignalParams(**params)

        self.assertIn("Fast period must be less than slow period", str(context.exception))

    def test_invalid_negative_period(self):
        """Test validation fails with negative periods"""
        params = {
            "fast_period": -10,
            "slow_period": 20
        }

        with self.assertRaises(Exception) as context:
            CrossoverSignalParams(**params)

        self.assertIn("Periods must be positive", str(context.exception))

    def test_auto_detection_of_ma_columns(self):
        """Test automatic detection of moving average columns"""
        params = {"fast_period": 20, "slow_period": 50}

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": self.sample_data_with_mas.to_dict("records")
            }
        }

        result = node.run(inputs)

        self.assertEqual(result["type"], "signals")
        self.assertIn("data", result)
        self.assertIn("metadata", result)

        # Check that MA columns were detected
        metadata = result["metadata"]
        self.assertIn("fast_ma_column", metadata)
        self.assertIn("slow_ma_column", metadata)
        self.assertIn("SMA", metadata["fast_ma_column"])
        self.assertIn("SMA", metadata["slow_ma_column"])

    def test_explicit_ma_column_specification(self):
        """Test explicit specification of MA columns"""
        params = {
            "fast_period": 20,
            "slow_period": 50,
            "fast_ma_column": "fast_ma",
            "slow_ma_column": "slow_ma"
        }

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": self.crossover_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        self.assertEqual(result["type"], "signals")

        # Check that specified columns were used
        metadata = result["metadata"]
        self.assertEqual(metadata["fast_ma_column"], "fast_ma")
        self.assertEqual(metadata["slow_ma_column"], "slow_ma")

    def test_crossover_signal_generation(self):
        """Test generation of crossover signals"""
        params = {
            "fast_ma_column": "fast_ma",
            "slow_ma_column": "slow_ma"
        }

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": self.crossover_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        signals_data = pd.DataFrame(result["data"])

        # Should have generated at least one signal
        signal_count = len(signals_data[signals_data["signal"] != 0])
        self.assertGreater(signal_count, 0)

        # Check for golden cross signal at index 25
        golden_cross_signals = signals_data[signals_data["signal"] > 0]
        self.assertGreater(len(golden_cross_signals), 0)

    def test_golden_cross_detection(self):
        """Test detection of golden cross (fast MA crosses above slow MA)"""
        # Create explicit golden cross scenario
        golden_cross_data = pd.DataFrame({
            "timestamp": pd.date_range("2022-01-01", periods=10, freq="1h"),
            "close": [45000] * 10,
            "fast_ma": [44950, 44960, 44970, 44980, 44990, 45010, 45020, 45030, 45040, 45050],
            "slow_ma": [45000] * 10,  # Constant slow MA
        })

        params = {
            "fast_ma_column": "fast_ma",
            "slow_ma_column": "slow_ma"
        }

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": golden_cross_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        signals_data = pd.DataFrame(result["data"])

        # Should detect golden cross around index 5 (fast crosses above slow)
        buy_signals = signals_data[signals_data["signal"] > 0]
        self.assertGreater(len(buy_signals), 0)

        # Verify the crossover happened at the expected point
        first_buy_signal_idx = buy_signals.index[0]
        self.assertGreaterEqual(first_buy_signal_idx, 4)  # Should be around index 5

    def test_death_cross_detection(self):
        """Test detection of death cross (fast MA crosses below slow MA)"""
        # Create explicit death cross scenario
        death_cross_data = pd.DataFrame({
            "timestamp": pd.date_range("2022-01-01", periods=10, freq="1h"),
            "close": [45000] * 10,
            "fast_ma": [45050, 45040, 45030, 45020, 45010, 44990, 44980, 44970, 44960, 44950],
            "slow_ma": [45000] * 10,  # Constant slow MA
        })

        params = {
            "fast_ma_column": "fast_ma",
            "slow_ma_column": "slow_ma"
        }

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": death_cross_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        signals_data = pd.DataFrame(result["data"])

        # Should detect death cross around index 5 (fast crosses below slow)
        sell_signals = signals_data[signals_data["signal"] < 0]
        self.assertGreater(len(sell_signals), 0)

        # Verify the crossover happened at the expected point
        first_sell_signal_idx = sell_signals.index[0]
        self.assertGreaterEqual(first_sell_signal_idx, 4)  # Should be around index 5

    def test_multiple_inputs_handling(self):
        """Test handling of multiple dataframe inputs"""
        # Create separate dataframes for fast and slow MA
        fast_ma_data = pd.DataFrame({
            "timestamp": pd.date_range("2022-01-01", periods=50, freq="1h"),
            "close": np.random.uniform(45000, 46000, 50),
            "SMA_20": np.random.uniform(44900, 45100, 50),
        })

        slow_ma_data = pd.DataFrame({
            "timestamp": pd.date_range("2022-01-01", periods=50, freq="1h"),
            "SMA_50": np.random.uniform(44950, 45050, 50),
        })

        params = {"fast_period": 20, "slow_period": 50}

        node = CrossoverSignalNode(params)

        inputs = {
            "fast_ma": {
                "type": "dataframe",
                "data": fast_ma_data.to_dict("records")
            },
            "slow_ma": {
                "type": "dataframe",
                "data": slow_ma_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        self.assertEqual(result["type"], "signals")
        self.assertIn("data", result)

        # Should have merged the inputs properly
        signals_data = pd.DataFrame(result["data"])
        self.assertEqual(len(signals_data), 50)

    def test_signal_threshold_filtering(self):
        """Test filtering signals based on threshold values"""
        params = {
            "fast_ma_column": "fast_ma",
            "slow_ma_column": "slow_ma",
            "buy_threshold": 0.1,    # Require 0.1% crossover strength
            "sell_threshold": 0.1
        }

        # Create data with weak crossover (below threshold)
        weak_crossover_data = pd.DataFrame({
            "timestamp": pd.date_range("2022-01-01", periods=10, freq="1h"),
            "close": [45000] * 10,
            "fast_ma": [44999.5, 45000.5, 45001, 45001.5, 45002, 45002.5, 45003, 45003.5, 45004, 45004.5],
            "slow_ma": [45000] * 10,
        })

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": weak_crossover_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        signals_data = pd.DataFrame(result["data"])

        # With high threshold, weak crossovers should be filtered out
        signal_count = len(signals_data[signals_data["signal"] != 0])
        self.assertEqual(signal_count, 0)  # No signals due to threshold

    def test_signal_confirmation(self):
        """Test signal confirmation over multiple periods"""
        params = {
            "fast_ma_column": "fast_ma",
            "slow_ma_column": "slow_ma",
            "confirmation_periods": 3  # Require 3 periods of confirmation
        }

        # Create data with sustained crossover
        sustained_crossover_data = pd.DataFrame({
            "timestamp": pd.date_range("2022-01-01", periods=10, freq="1h"),
            "close": [45000] * 10,
            "fast_ma": [44990, 44995, 45010, 45020, 45030, 45040, 45050, 45060, 45070, 45080],
            "slow_ma": [45000] * 10,
        })

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": sustained_crossover_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        signals_data = pd.DataFrame(result["data"])

        # Should generate confirmed signals
        buy_signals = signals_data[signals_data["signal"] > 0]
        self.assertGreater(len(buy_signals), 0)

    def test_no_crossover_scenario(self):
        """Test scenario with no crossovers"""
        # Create data where fast MA is always above slow MA
        no_crossover_data = pd.DataFrame({
            "timestamp": pd.date_range("2022-01-01", periods=50, freq="1h"),
            "close": np.random.uniform(45000, 46000, 50),
            "fast_ma": np.random.uniform(45100, 45200, 50),  # Always above slow
            "slow_ma": np.random.uniform(45000, 45050, 50),  # Always below fast
        })

        params = {
            "fast_ma_column": "fast_ma",
            "slow_ma_column": "slow_ma"
        }

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": no_crossover_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        signals_data = pd.DataFrame(result["data"])

        # Should have no signals
        signal_count = len(signals_data[signals_data["signal"] != 0])
        self.assertEqual(signal_count, 0)

    def test_missing_ma_columns_error(self):
        """Test error handling when MA columns are missing"""
        params = {
            "fast_ma_column": "nonexistent_fast",
            "slow_ma_column": "nonexistent_slow"
        }

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": self.sample_data_with_mas.to_dict("records")
            }
        }

        with self.assertRaises(RuntimeError) as context:
            node.run(inputs)

        self.assertIn("CrossoverSignalNode failed", str(context.exception))

    def test_insufficient_data_handling(self):
        """Test handling of insufficient data"""
        # Create minimal data
        minimal_data = pd.DataFrame({
            "timestamp": pd.date_range("2022-01-01", periods=2, freq="1h"),
            "close": [45000, 45100],
            "SMA_20": [45000, 45050],
            "SMA_50": [45025, 45025],
        })

        params = {"fast_period": 20, "slow_period": 50}

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": minimal_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        # Should complete without error
        self.assertEqual(result["type"], "signals")
        self.assertEqual(len(result["data"]), 2)

    def test_invalid_input_data_type(self):
        """Test handling of invalid input data type"""
        params = {"fast_period": 20, "slow_period": 50}

        node = CrossoverSignalNode(params)

        inputs = {
            "invalid_data": {
                "type": "unknown",
                "data": {"invalid": "format"}
            }
        }

        with self.assertRaises(RuntimeError) as context:
            node.run(inputs)

        self.assertIn("CrossoverSignalNode failed", str(context.exception))

    def test_metadata_generation(self):
        """Test that metadata is properly generated"""
        params = {
            "fast_period": 10,
            "slow_period": 30,
            "signal_column": "my_signal",
            "confirmation_periods": 2
        }

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": self.sample_data_with_mas.to_dict("records")
            }
        }

        result = node.run(inputs)

        metadata = result["metadata"]

        # Check that all expected metadata is present
        self.assertEqual(metadata["signal_column"], "my_signal")
        self.assertEqual(metadata["fast_period"], 10)
        self.assertEqual(metadata["slow_period"], 30)
        self.assertEqual(metadata["confirmation_periods"], 2)

        self.assertIn("fast_ma_column", metadata)
        self.assertIn("slow_ma_column", metadata)
        self.assertIn("total_signals", metadata)
        self.assertIn("buy_signals", metadata)
        self.assertIn("sell_signals", metadata)

    def test_custom_signal_column_name(self):
        """Test using custom signal column name"""
        params = {
            "fast_ma_column": "fast_ma",
            "slow_ma_column": "slow_ma",
            "signal_column": "custom_signal"
        }

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": self.crossover_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        signals_data = pd.DataFrame(result["data"])

        # Should use custom signal column name
        self.assertIn("custom_signal", signals_data.columns)
        self.assertEqual(result["metadata"]["signal_column"], "custom_signal")

    def test_diagnostic_columns_generation(self):
        """Test that diagnostic columns are generated"""
        params = {
            "fast_ma_column": "fast_ma",
            "slow_ma_column": "slow_ma"
        }

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": self.crossover_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        signals_data = pd.DataFrame(result["data"])

        # Should include diagnostic columns
        expected_columns = ["fast_ma", "slow_ma", "ma_diff_pct", "crossover_strength"]
        for col in expected_columns:
            self.assertIn(col, signals_data.columns)

    def test_large_dataset_performance(self):
        """Test performance with larger dataset"""
        # Create larger dataset
        large_dates = pd.date_range("2020-01-01", periods=1000, freq="1h")
        large_data = pd.DataFrame({
            "timestamp": large_dates,
            "close": np.random.uniform(40000, 50000, 1000),
            "SMA_20": np.random.uniform(39000, 51000, 1000),
            "SMA_50": np.random.uniform(38000, 52000, 1000),
        })

        params = {"fast_period": 20, "slow_period": 50}

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe", 
                "data": large_data.to_dict("records")
            }
        }

        import time
        start_time = time.time()

        result = node.run(inputs)

        execution_time = time.time() - start_time

        # Should complete within reasonable time (less than 5 seconds)
        self.assertLess(execution_time, 5.0)
        self.assertEqual(result["type"], "signals")
        self.assertEqual(len(result["data"]), 1000)

    def test_edge_case_equal_mas(self):
        """Test behavior when fast and slow MAs are equal"""
        equal_ma_data = pd.DataFrame({
            "timestamp": pd.date_range("2022-01-01", periods=10, freq="1h"),
            "close": [45000] * 10,
            "fast_ma": [45000] * 10,  # Equal to slow MA
            "slow_ma": [45000] * 10,  # Equal to fast MA
        })

        params = {
            "fast_ma_column": "fast_ma",
            "slow_ma_column": "slow_ma"
        }

        node = CrossoverSignalNode(params)

        inputs = {
            "data": {
                "type": "dataframe",
                "data": equal_ma_data.to_dict("records")
            }
        }

        result = node.run(inputs)

        signals_data = pd.DataFrame(result["data"])

        # Should generate no signals when MAs are equal
        signal_count = len(signals_data[signals_data["signal"] != 0])
        self.assertEqual(signal_count, 0)


if __name__ == "__main__":
    # Run tests with verbose output
    unittest.main(verbosity=2)