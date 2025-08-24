#!/usr/bin/env python3
"""
Test suite for DataLoaderNode following TDD principles
"""

import json
import os
import tempfile
import unittest

import pandas as pd

from DataLoaderNode import DataLoaderNode, DataLoaderParams


class TestDataLoaderNode(unittest.TestCase):
    """Test cases for DataLoaderNode"""

    def setUp(self):
        """Set up test fixtures"""
        # Create a temporary CSV file for testing
        self.test_data = pd.DataFrame(
            {
                "ts": [1640995200000, 1640995260000, 1640995320000],  # Unix timestamps
                "open": [100.0, 101.0, 102.0],
                "high": [105.0, 106.0, 107.0],
                "low": [99.0, 100.0, 101.0],
                "close": [101.0, 102.0, 103.0],
                "volume": [1000, 1100, 1200],
            }
        )

        self.temp_file = tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False
        )
        self.test_data.to_csv(self.temp_file.name, index=False)
        self.temp_file.close()

    def tearDown(self):
        """Clean up test fixtures"""
        os.unlink(self.temp_file.name)

    def test_valid_parameters(self):
        """Test DataLoaderParams validation with valid inputs"""
        params = {"symbol": "BTC/USD", "timeframe": "1h", "dataset": "test.csv"}

        loader_params = DataLoaderParams(**params)
        self.assertEqual(loader_params.symbol, "BTC/USD")
        self.assertEqual(loader_params.timeframe, "1h")
        self.assertEqual(loader_params.dataset, "test.csv")

    def test_missing_required_parameters(self):
        """Test DataLoaderParams validation fails with missing required params"""
        params = {
            "symbol": "BTC/USD"
            # missing timeframe and dataset
        }

        with self.assertRaises(Exception):
            DataLoaderParams(**params)

    def test_csv_loading_success(self):
        """Test successful CSV loading and data standardization"""
        params = {
            "symbol": "BTC/USD",
            "timeframe": "1h",
            "dataset": os.path.basename(self.temp_file.name),
        }

        # Mock the dataset path resolution
        node = DataLoaderNode(params)
        # Override the path resolution for testing
        original_method = node._load_from_csv

        def mock_load_from_csv():
            return pd.read_csv(self.temp_file.name)

        node._load_from_csv = mock_load_from_csv

        result = node.run()

        self.assertEqual(result["type"], "dataframe")
        self.assertIsInstance(result["data"], list)
        self.assertGreater(len(result["data"]), 0)
        self.assertIn("metadata", result)

        # Check data structure
        first_row = result["data"][0]
        required_columns = ["timestamp", "open", "high", "low", "close", "volume"]
        for col in required_columns:
            self.assertIn(col, first_row)

    def test_file_not_found(self):
        """Test handling of missing dataset file"""
        params = {
            "symbol": "BTC/USD",
            "timeframe": "1h",
            "dataset": "non_existent_file.csv",
        }

        node = DataLoaderNode(params)

        with self.assertRaises(RuntimeError) as context:
            node.run()

        self.assertIn("DataLoader failed", str(context.exception))

    def test_data_standardization(self):
        """Test data standardization with different column formats"""
        # Create test data with alternative column names
        alt_data = pd.DataFrame(
            {
                "time": ["2022-01-01 00:00:00", "2022-01-01 01:00:00"],
                "o": [100.0, 101.0],
                "h": [105.0, 106.0],
                "l": [99.0, 100.0],
                "c": [101.0, 102.0],
                "v": [1000, 1100],
            }
        )

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            alt_data.to_csv(f.name, index=False)

            params = {
                "symbol": "BTC/USD",
                "timeframe": "1h",
                "dataset": os.path.basename(f.name),
            }

            node = DataLoaderNode(params)

            # Mock path resolution
            def mock_load_from_csv():
                return pd.read_csv(f.name)

            node._load_from_csv = mock_load_from_csv

            result = node.run()

            # Check that columns were properly mapped
            first_row = result["data"][0]
            self.assertIn("timestamp", first_row)
            self.assertIn("open", first_row)
            self.assertIn("high", first_row)
            self.assertIn("low", first_row)
            self.assertIn("close", first_row)
            self.assertIn("volume", first_row)

        os.unlink(f.name)

    def test_date_filtering(self):
        """Test date range filtering functionality"""
        # Create extended test data
        extended_data = pd.DataFrame(
            {
                "timestamp": pd.date_range("2022-01-01", periods=10, freq="1H"),
                "open": range(100, 110),
                "high": range(105, 115),
                "low": range(99, 109),
                "close": range(101, 111),
                "volume": range(1000, 1100, 10),
            }
        )

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            extended_data.to_csv(f.name, index=False)

            params = {
                "symbol": "BTC/USD",
                "timeframe": "1h",
                "dataset": os.path.basename(f.name),
                "start_date": "2022-01-01 05:00:00",
                "end_date": "2022-01-01 08:00:00",
            }

            node = DataLoaderNode(params)

            def mock_load_from_csv():
                return pd.read_csv(f.name, parse_dates=["timestamp"])

            node._load_from_csv = mock_load_from_csv

            result = node.run()

            # Should have filtered data (4 hours inclusive)
            self.assertLessEqual(len(result["data"]), 4)
            self.assertGreater(len(result["data"]), 0)

        os.unlink(f.name)


if __name__ == "__main__":
    # Run tests with verbose output
    unittest.main(verbosity=2)
