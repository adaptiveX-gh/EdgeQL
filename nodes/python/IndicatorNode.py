#!/usr/bin/env python3
"""
IndicatorNode - Calculates technical indicators on OHLCV data

This node implements various technical analysis indicators commonly used
in trading strategies. It follows the pattern established in the requirements
document for feature generation nodes.
"""

import json
import sys
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from pydantic import BaseModel


class IndicatorParams(BaseModel):
    """Parameters for the Indicator node"""

    indicator: str  # SMA, EMA, RSI, MACD, BB
    period: int
    column: str = "close"
    # Additional parameters for specific indicators
    fast_period: Optional[int] = None  # For MACD
    slow_period: Optional[int] = None  # For MACD
    signal_period: Optional[int] = None  # For MACD
    std_dev: Optional[float] = 2.0  # For Bollinger Bands


class IndicatorNode:
    """
    Technical Indicator Calculator

    Supports common indicators:
    - SMA (Simple Moving Average)
    - EMA (Exponential Moving Average)
    - RSI (Relative Strength Index)
    - MACD (Moving Average Convergence Divergence)
    - BB (Bollinger Bands)
    """

    def __init__(self, params: Dict[str, Any]):
        self.params = IndicatorParams(**params)

    def run(self, inputs: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Main execution method

        Args:
            inputs: Dictionary containing inputs from dependent nodes

        Returns:
            Dict containing the original data with added indicator columns
        """
        try:
            if not inputs:
                raise ValueError("IndicatorNode requires inputs from dependent nodes")
            
            # Get input from first dependency (typically DataLoaderNode)
            input_data = next(iter(inputs.values())) if inputs else {}
            
            if input_data.get("type") != "dataframe":
                raise ValueError("IndicatorNode requires dataframe input")

            # Convert data back to DataFrame
            df = pd.DataFrame(input_data["data"])

            # Ensure timestamp is datetime
            if "timestamp" in df.columns:
                df["timestamp"] = pd.to_datetime(df["timestamp"])

            # Calculate the requested indicator
            df = self._calculate_indicator(df)

            # Convert to dictionary and handle NaN values for JSON serialization
            data_dict = df.to_dict("records")
            
            # Replace NaN values with None (null in JSON)
            import math
            for row in data_dict:
                for key, value in row.items():
                    if isinstance(value, float) and math.isnan(value):
                        row[key] = None
            
            return {
                "type": "dataframe",
                "data": data_dict,
                "metadata": {
                    "indicator": self.params.indicator,
                    "period": self.params.period,
                    "rows": len(df),
                    "columns": list(df.columns),
                },
            }

        except Exception as e:
            raise RuntimeError(f"IndicatorNode failed: {str(e)}")

    def _calculate_indicator(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate the specified technical indicator"""
        indicator = self.params.indicator.upper()

        if indicator == "SMA":
            return self._calculate_sma(df)
        elif indicator == "EMA":
            return self._calculate_ema(df)
        elif indicator == "RSI":
            return self._calculate_rsi(df)
        elif indicator == "MACD":
            return self._calculate_macd(df)
        elif indicator == "BB":
            return self._calculate_bollinger_bands(df)
        else:
            raise ValueError(f"Unsupported indicator: {indicator}")

    def _calculate_sma(self, df: pd.DataFrame) -> pd.DataFrame:
        """Simple Moving Average"""
        column = self.params.column
        period = self.params.period

        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in data")

        sma_column = f"SMA_{period}"
        df[sma_column] = df[column].rolling(window=period, min_periods=period).mean()

        print(
            f"Calculated {sma_column} with {df[sma_column].notna().sum()} valid values"
        )
        return df

    def _calculate_ema(self, df: pd.DataFrame) -> pd.DataFrame:
        """Exponential Moving Average"""
        column = self.params.column
        period = self.params.period

        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in data")

        ema_column = f"EMA_{period}"
        df[ema_column] = df[column].ewm(span=period, adjust=False).mean()

        print(
            f"Calculated {ema_column} with {df[ema_column].notna().sum()} valid values"
        )
        return df

    def _calculate_rsi(self, df: pd.DataFrame) -> pd.DataFrame:
        """Relative Strength Index"""
        column = self.params.column
        period = self.params.period

        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in data")

        # Calculate price changes
        delta = df[column].diff()

        # Separate gains and losses
        gains = delta.where(delta > 0, 0)
        losses = -delta.where(delta < 0, 0)

        # Calculate average gains and losses
        avg_gains = gains.rolling(window=period, min_periods=period).mean()
        avg_losses = losses.rolling(window=period, min_periods=period).mean()

        # Calculate RSI
        rs = avg_gains / avg_losses
        rsi = 100 - (100 / (1 + rs))

        rsi_column = f"RSI_{period}"
        df[rsi_column] = rsi

        print(
            f"Calculated {rsi_column} with {df[rsi_column].notna().sum()} valid values"
        )
        return df

    def _calculate_macd(self, df: pd.DataFrame) -> pd.DataFrame:
        """Moving Average Convergence Divergence"""
        column = self.params.column
        fast_period = self.params.fast_period or 12
        slow_period = self.params.slow_period or 26
        signal_period = self.params.signal_period or 9

        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in data")

        # Calculate EMAs
        ema_fast = df[column].ewm(span=fast_period).mean()
        ema_slow = df[column].ewm(span=slow_period).mean()

        # MACD line
        macd = ema_fast - ema_slow
        df["MACD"] = macd

        # Signal line
        df["MACD_Signal"] = macd.ewm(span=signal_period).mean()

        # Histogram
        df["MACD_Histogram"] = macd - df["MACD_Signal"]

        valid_count = df["MACD"].notna().sum()
        print(f"Calculated MACD indicators with {valid_count} valid values")
        return df

    def _calculate_bollinger_bands(self, df: pd.DataFrame) -> pd.DataFrame:
        """Bollinger Bands"""
        column = self.params.column
        period = self.params.period
        std_dev = self.params.std_dev

        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in data")

        # Calculate middle band (SMA)
        sma = df[column].rolling(window=period, min_periods=period).mean()
        df[f"BB_Middle_{period}"] = sma

        # Calculate standard deviation
        rolling_std = df[column].rolling(window=period, min_periods=period).std()

        # Calculate upper and lower bands
        df[f"BB_Upper_{period}"] = sma + (rolling_std * std_dev)
        df[f"BB_Lower_{period}"] = sma - (rolling_std * std_dev)

        # Calculate %B (position within bands)
        df[f"BB_Percent_{period}"] = (df[column] - df[f"BB_Lower_{period}"]) / (
            df[f"BB_Upper_{period}"] - df[f"BB_Lower_{period}"]
        )

        valid_count = df[f"BB_Middle_{period}"].notna().sum()
        print(f"Calculated Bollinger Bands with {valid_count} valid values")
        return df


def main():
    """Entry point when run as standalone script in Docker sandbox"""
    if len(sys.argv) not in [3, 4]:
        print("Usage: python IndicatorNode.py <input_json> <output_json> [logs_json]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    logs_file = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        # Read input data and parameters
        with open(input_file, "r") as f:
            config = json.load(f)

        params = config.get("params", {})

        # Create and run the node
        node = IndicatorNode(params)
        result = node.run(config.get("inputs", {}))

        # Write result to output
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2, default=str)

        print(f"IndicatorNode completed successfully")

    except Exception as e:
        error_result = {"error": str(e), "type": "execution_error"}

        with open(output_file, "w") as f:
            json.dump(error_result, f, indent=2)

        print(f"IndicatorNode failed: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
