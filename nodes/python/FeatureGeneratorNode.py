#!/usr/bin/env python3
"""
FeatureGeneratorNode - Generates technical analysis features/indicators

This node calculates various technical indicators from OHLCV data to be used
as features for machine learning models or trading strategies.

Supports:
- Moving Averages (SMA, EMA, WMA)
- Momentum Indicators (RSI, MACD, Stochastic)
- Volatility Indicators (Bollinger Bands, ATR)
- Volume Indicators (Volume SMA, VWAP)
- Price Patterns (Support/Resistance levels)
"""

import json
import os
import sys
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from pydantic import BaseModel, validator


class FeatureGeneratorParams(BaseModel):
    """Parameters for the FeatureGenerator node"""

    features: List[Dict[str, Any]]
    lookback_period: int = 100
    fill_na_method: str = "forward"

    @validator("features")
    def validate_features(cls, v):
        """Validate feature configurations"""
        required_keys = {"type"}
        for feature in v:
            if not isinstance(feature, dict):
                raise ValueError("Each feature must be a dictionary")
            if not required_keys.issubset(feature.keys()):
                raise ValueError(f"Feature missing required keys: {required_keys}")
        return v


class FeatureGeneratorNode:
    """
    Generates technical analysis features from OHLCV data

    This node takes price data and generates various technical indicators
    that can be used for machine learning models or trading strategies.
    """

    def __init__(self, params: Dict[str, Any]):
        self.params = FeatureGeneratorParams(**params)

    def run(self, inputs: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Main execution method

        Args:
            inputs: Dictionary containing input data from previous nodes

        Returns:
            Dict containing the enhanced data with generated features
        """
        try:
            # Get input data
            if not inputs:
                raise ValueError("FeatureGeneratorNode requires input data")

            # Find the OHLCV data input
            price_data = None
            for input_name, input_data in inputs.items():
                if (
                    isinstance(input_data, dict)
                    and input_data.get("type") == "dataframe"
                ):
                    df = pd.DataFrame(input_data["data"])
                    if self._is_ohlcv_data(df):
                        price_data = df
                        break

            if price_data is None:
                raise ValueError("No valid OHLCV data found in inputs")

            print(f"Generating features from {len(price_data)} data points")

            # Generate features
            enhanced_data = self._generate_all_features(price_data)

            # Handle NaN values
            enhanced_data = self._handle_nan_values(enhanced_data)

            feature_count = len(enhanced_data.columns) - len(price_data.columns)
            print(f"Generated {feature_count} new features")

            return {
                "type": "dataframe",
                "data": enhanced_data.to_dict("records"),
                "metadata": {
                    "original_columns": len(price_data.columns),
                    "total_columns": len(enhanced_data.columns),
                    "features_added": feature_count,
                    "rows": len(enhanced_data),
                    "feature_names": [
                        col
                        for col in enhanced_data.columns
                        if col not in price_data.columns
                    ],
                    "date_range": {
                        "start": (
                            str(enhanced_data["timestamp"].min())
                            if "timestamp" in enhanced_data.columns
                            else None
                        ),
                        "end": (
                            str(enhanced_data["timestamp"].max())
                            if "timestamp" in enhanced_data.columns
                            else None
                        ),
                    },
                },
            }

        except Exception as e:
            raise RuntimeError(f"FeatureGenerator failed: {str(e)}")

    def _is_ohlcv_data(self, df: pd.DataFrame) -> bool:
        """Check if dataframe contains OHLCV data"""
        required_columns = {"open", "high", "low", "close", "volume"}
        return required_columns.issubset(set(df.columns.str.lower()))

    def _generate_all_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate all requested features"""
        result_df = df.copy()

        for feature_config in self.params.features:
            feature_type = feature_config["type"]

            print(f"Generating feature: {feature_type}")

            if feature_type == "sma":
                result_df = self._add_sma(result_df, feature_config)
            elif feature_type == "ema":
                result_df = self._add_ema(result_df, feature_config)
            elif feature_type == "rsi":
                result_df = self._add_rsi(result_df, feature_config)
            elif feature_type == "macd":
                result_df = self._add_macd(result_df, feature_config)
            elif feature_type == "bollinger_bands":
                result_df = self._add_bollinger_bands(result_df, feature_config)
            elif feature_type == "atr":
                result_df = self._add_atr(result_df, feature_config)
            elif feature_type == "stochastic":
                result_df = self._add_stochastic(result_df, feature_config)
            elif feature_type == "volume_sma":
                result_df = self._add_volume_sma(result_df, feature_config)
            elif feature_type == "price_change":
                result_df = self._add_price_change(result_df, feature_config)
            elif feature_type == "volatility":
                result_df = self._add_volatility(result_df, feature_config)
            else:
                print(f"Warning: Unknown feature type: {feature_type}")

        return result_df

    def _add_sma(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Add Simple Moving Average"""
        period = config.get("period", 20)
        column = config.get("column", "close")
        name = config.get("name", f"sma_{period}")

        df[name] = df[column].rolling(window=period).mean()
        return df

    def _add_ema(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Add Exponential Moving Average"""
        period = config.get("period", 20)
        column = config.get("column", "close")
        name = config.get("name", f"ema_{period}")

        df[name] = df[column].ewm(span=period).mean()
        return df

    def _add_rsi(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Add Relative Strength Index"""
        period = config.get("period", 14)
        column = config.get("column", "close")
        name = config.get("name", f"rsi_{period}")

        delta = df[column].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()

        rs = gain / loss
        df[name] = 100 - (100 / (1 + rs))
        return df

    def _add_macd(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Add MACD indicator"""
        fast_period = config.get("fast_period", 12)
        slow_period = config.get("slow_period", 26)
        signal_period = config.get("signal_period", 9)
        column = config.get("column", "close")

        ema_fast = df[column].ewm(span=fast_period).mean()
        ema_slow = df[column].ewm(span=slow_period).mean()

        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal_period).mean()
        histogram = macd_line - signal_line

        df["macd_line"] = macd_line
        df["macd_signal"] = signal_line
        df["macd_histogram"] = histogram

        return df

    def _add_bollinger_bands(
        self, df: pd.DataFrame, config: Dict[str, Any]
    ) -> pd.DataFrame:
        """Add Bollinger Bands"""
        period = config.get("period", 20)
        std_dev = config.get("std_dev", 2)
        column = config.get("column", "close")

        sma = df[column].rolling(window=period).mean()
        std = df[column].rolling(window=period).std()

        df["bb_upper"] = sma + (std * std_dev)
        df["bb_lower"] = sma - (std * std_dev)
        df["bb_middle"] = sma
        df["bb_width"] = df["bb_upper"] - df["bb_lower"]
        df["bb_position"] = (df[column] - df["bb_lower"]) / df["bb_width"]

        return df

    def _add_atr(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Add Average True Range"""
        period = config.get("period", 14)

        high_low = df["high"] - df["low"]
        high_close = np.abs(df["high"] - df["close"].shift())
        low_close = np.abs(df["low"] - df["close"].shift())

        true_range = np.maximum(high_low, np.maximum(high_close, low_close))
        df["atr"] = true_range.rolling(window=period).mean()

        return df

    def _add_stochastic(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Add Stochastic Oscillator"""
        k_period = config.get("k_period", 14)
        d_period = config.get("d_period", 3)

        lowest_low = df["low"].rolling(window=k_period).min()
        highest_high = df["high"].rolling(window=k_period).max()

        k_percent = 100 * ((df["close"] - lowest_low) / (highest_high - lowest_low))
        d_percent = k_percent.rolling(window=d_period).mean()

        df["stoch_k"] = k_percent
        df["stoch_d"] = d_percent

        return df

    def _add_volume_sma(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Add Volume Simple Moving Average"""
        period = config.get("period", 20)
        name = config.get("name", f"volume_sma_{period}")

        df[name] = df["volume"].rolling(window=period).mean()
        df["volume_ratio"] = df["volume"] / df[name]

        return df

    def _add_price_change(
        self, df: pd.DataFrame, config: Dict[str, Any]
    ) -> pd.DataFrame:
        """Add Price Change features"""
        periods = config.get("periods", [1, 5, 10])
        column = config.get("column", "close")

        for period in periods:
            # Absolute change
            df[f"price_change_{period}"] = df[column].diff(period)
            # Percentage change
            df[f"price_change_pct_{period}"] = df[column].pct_change(period) * 100

        return df

    def _add_volatility(self, df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
        """Add Volatility features"""
        period = config.get("period", 20)
        column = config.get("column", "close")

        # Rolling standard deviation of returns
        returns = df[column].pct_change()
        df[f"volatility_{period}"] = returns.rolling(window=period).std() * 100

        # High-Low volatility
        df["hl_volatility"] = (df["high"] - df["low"]) / df["close"] * 100

        return df

    def _handle_nan_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle NaN values in the dataframe"""
        if self.params.fill_na_method == "forward":
            df = df.fillna(method="ffill")
        elif self.params.fill_na_method == "backward":
            df = df.fillna(method="bfill")
        elif self.params.fill_na_method == "zero":
            df = df.fillna(0)
        elif self.params.fill_na_method == "drop":
            df = df.dropna()

        # Fill any remaining NaN values with 0
        df = df.fillna(0)

        return df


def main():
    """Entry point when run as standalone script"""
    if len(sys.argv) != 3:
        print("Usage: python FeatureGeneratorNode.py <input_json> <output_json>")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    try:
        # Read parameters and inputs from input JSON
        with open(input_file, "r") as f:
            config = json.load(f)

        # Create and run the node
        node = FeatureGeneratorNode(config.get("params", {}))
        result = node.run(config.get("inputs", {}))

        # Write result to output JSON
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2, default=str)

        print(f"FeatureGeneratorNode completed successfully")

    except Exception as e:
        error_result = {"error": str(e), "type": "execution_error"}

        with open(output_file, "w") as f:
            json.dump(error_result, f, indent=2)

        print(f"FeatureGeneratorNode failed: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
