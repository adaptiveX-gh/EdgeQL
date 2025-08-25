#!/usr/bin/env python3
"""
DataLoaderNode - Loads OHLCV data from various sources

This node serves as the entry point for market data in trading pipelines.
It can load data from CSV files, databases, or external APIs.
"""

import json
import os
import sys
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from pydantic import BaseModel

# Import our logging utility
from node_logger import NodeLoggerContext


class DataLoaderParams(BaseModel):
    """Parameters for the DataLoader node"""

    symbol: str
    timeframe: str
    dataset: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class DataLoaderNode:
    """
    Loads OHLCV (Open, High, Low, Close, Volume) data for backtesting

    Supports multiple data sources:
    - CSV files (for uploaded datasets)
    - External APIs (future implementation)
    - Database connections (future implementation)
    """

    def __init__(self, params: Dict[str, Any]):
        self.params = DataLoaderParams(**params)

    def run(self) -> Dict[str, Any]:
        """
        Main execution method

        Returns:
            Dict containing the loaded data in a standard format
        """
        try:
            if self.params.dataset.endswith(".csv"):
                df = self._load_from_csv()
            else:
                raise ValueError(f"Unsupported dataset format: {self.params.dataset}")

            # Validate and standardize the data format
            df = self._standardize_dataframe(df)

            # Apply date filtering if specified
            if self.params.start_date or self.params.end_date:
                df = self._filter_by_date(df)

            return {
                "type": "dataframe",
                "data": df.to_dict("records"),
                "metadata": {
                    "symbol": self.params.symbol,
                    "timeframe": self.params.timeframe,
                    "rows": len(df),
                    "columns": list(df.columns),
                    "date_range": {
                        "start": (
                            str(df["timestamp"].min())
                            if "timestamp" in df.columns
                            else None
                        ),
                        "end": (
                            str(df["timestamp"].max())
                            if "timestamp" in df.columns
                            else None
                        ),
                    },
                },
            }

        except Exception as e:
            raise RuntimeError(f"DataLoader failed: {str(e)}")

    def _load_from_csv(self) -> pd.DataFrame:
        """Load data from CSV file"""
        # In a sandboxed environment, the dataset path would be mounted
        dataset_path = f"/datasets/{self.params.dataset}"

        if not os.path.exists(dataset_path):
            # Fallback for development - use relative path
            dataset_path = f"../../datasets/{self.params.dataset}"

        if not os.path.exists(dataset_path):
            raise FileNotFoundError(f"Dataset not found: {self.params.dataset}")

        print(f"Loading data from: {dataset_path}")

        try:
            df = pd.read_csv(dataset_path)
            print(f"Loaded {len(df)} rows with columns: {list(df.columns)}")
            return df
        except Exception as e:
            raise RuntimeError(f"Failed to read CSV file: {str(e)}")

    def _standardize_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Standardize the dataframe to expected format"""
        # Column mapping for different CSV formats
        column_mappings = {
            "ts": "timestamp",
            "time": "timestamp",
            "datetime": "timestamp",
            "date": "timestamp",
            "o": "open",
            "h": "high",
            "l": "low",
            "c": "close",
            "v": "volume",
            "vol": "volume",
        }

        # Apply column mappings
        df = df.rename(columns=column_mappings)

        # Ensure required columns exist
        required_columns = ["timestamp", "open", "high", "low", "close", "volume"]
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")

        # Convert timestamp column
        if df["timestamp"].dtype == "int64":
            # Assume Unix timestamp in milliseconds
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
        else:
            df["timestamp"] = pd.to_datetime(df["timestamp"])

        # Ensure numeric columns are float
        numeric_columns = ["open", "high", "low", "close", "volume"]
        for col in numeric_columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        # Sort by timestamp
        df = df.sort_values("timestamp").reset_index(drop=True)

        # Remove any rows with NaN values in critical columns
        df = df.dropna(subset=["open", "high", "low", "close"])

        print(f"Standardized dataframe: {len(df)} rows, {len(df.columns)} columns")

        return df[required_columns]  # Return only standardized columns

    def _filter_by_date(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter dataframe by date range"""
        if self.params.start_date:
            start_date = pd.to_datetime(self.params.start_date)
            df = df[df["timestamp"] >= start_date]

        if self.params.end_date:
            end_date = pd.to_datetime(self.params.end_date)
            df = df[df["timestamp"] <= end_date]

        print(f"Date filtered: {len(df)} rows remaining")
        return df


def main():
    """Entry point when run as standalone script"""
    if len(sys.argv) not in [3, 4]:
        print("Usage: python DataLoaderNode.py <input_json> <output_json> [logs_json]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    logs_file = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        # Read parameters from input JSON
        with open(input_file, "r") as f:
            config = json.load(f)

        # Use the logger context manager to capture logs
        with NodeLoggerContext(config) as logger:
            print("Starting DataLoaderNode execution")
            logger.info("DataLoaderNode initialized")

            # Create and run the node
            node = DataLoaderNode(config.get("params", {}))
            result = node.run()

            logger.info("DataLoaderNode processing completed")
            print("DataLoaderNode completed successfully")

            # Save structured logs if logs file is provided
            if logs_file:
                logger.save_logs_to_file(logs_file)

        # Write result to output JSON
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2, default=str)

    except Exception as e:
        error_result = {"error": str(e), "type": "execution_error"}

        with open(output_file, "w") as f:
            json.dump(error_result, f, indent=2)

        print(f"DataLoaderNode failed: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
