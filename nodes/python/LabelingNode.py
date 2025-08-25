#!/usr/bin/env python3
"""
LabelingNode - Generates trading signals and labels for ML training

This node creates trading signals and labels from price data and features.
It supports various labeling methods including:
- Price-based signals (future returns, thresholds)
- Technical indicator crossovers
- Pattern-based signals
- Multi-class labeling for ML models

The output can be used for:
- Backtesting strategies
- Training supervised ML models
- Generating trading signals
"""

import json
import os
import sys
from typing import Any, Dict, List, Optional, Union

import numpy as np
import pandas as pd
from pydantic import BaseModel, validator


class LabelingParams(BaseModel):
    """Parameters for the Labeling node"""

    method: str = "future_returns"

    # Future returns parameters
    forward_periods: Union[int, List[int]] = 1
    return_threshold: float = 0.02  # 2%

    # Crossover parameters
    fast_column: Optional[str] = None
    slow_column: Optional[str] = None

    # Pattern parameters
    pattern_type: Optional[str] = None

    # Multi-class labeling
    num_classes: int = 3  # Buy, Hold, Sell
    class_names: List[str] = ["sell", "hold", "buy"]

    # Risk management
    stop_loss_pct: Optional[float] = None
    take_profit_pct: Optional[float] = None

    @validator("method")
    def validate_method(cls, v):
        valid_methods = [
            "future_returns",
            "crossover",
            "threshold",
            "pattern",
            "rsi_signals",
            "bollinger_signals",
            "macd_signals",
            "multi_class",
        ]
        if v not in valid_methods:
            raise ValueError(f"Method must be one of: {valid_methods}")
        return v


class LabelingNode:
    """
    Generates trading signals and labels for ML training

    This node takes price data with features and generates labels/signals
    that can be used for backtesting or training machine learning models.
    """

    def __init__(self, params: Dict[str, Any]):
        self.params = LabelingParams(**params)

    def run(self, inputs: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Main execution method

        Args:
            inputs: Dictionary containing input data from previous nodes

        Returns:
            Dict containing the data with generated labels/signals
        """
        try:
            # Get input data
            if not inputs:
                raise ValueError("LabelingNode requires input data")

            # Find the dataframe input
            input_data = None
            for input_name, input_value in inputs.items():
                if (
                    isinstance(input_value, dict)
                    and input_value.get("type") == "dataframe"
                ):
                    input_data = pd.DataFrame(input_value["data"])
                    break

            if input_data is None:
                raise ValueError("No valid dataframe found in inputs")

            print(f"Generating labels using method: {self.params.method}")
            print(f"Input data shape: {input_data.shape}")

            # Generate labels based on the specified method
            labeled_data = self._generate_labels(input_data)

            # Add risk management signals if specified
            if self.params.stop_loss_pct or self.params.take_profit_pct:
                labeled_data = self._add_risk_management(labeled_data)

            # Calculate signal statistics
            signal_stats = self._calculate_signal_stats(labeled_data)

            print(f"Generated labels with {signal_stats['total_signals']} signals")

            return {
                "type": "dataframe",
                "data": labeled_data.to_dict("records"),
                "metadata": {
                    "method": self.params.method,
                    "rows": len(labeled_data),
                    "columns": len(labeled_data.columns),
                    "signal_stats": signal_stats,
                    "date_range": {
                        "start": (
                            str(labeled_data["timestamp"].min())
                            if "timestamp" in labeled_data.columns
                            else None
                        ),
                        "end": (
                            str(labeled_data["timestamp"].max())
                            if "timestamp" in labeled_data.columns
                            else None
                        ),
                    },
                },
            }

        except Exception as e:
            raise RuntimeError(f"LabelingNode failed: {str(e)}")

    def _generate_labels(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate labels based on the specified method"""
        result_df = df.copy()

        if self.params.method == "future_returns":
            result_df = self._generate_future_returns_labels(result_df)
        elif self.params.method == "crossover":
            result_df = self._generate_crossover_labels(result_df)
        elif self.params.method == "threshold":
            result_df = self._generate_threshold_labels(result_df)
        elif self.params.method == "rsi_signals":
            result_df = self._generate_rsi_signals(result_df)
        elif self.params.method == "bollinger_signals":
            result_df = self._generate_bollinger_signals(result_df)
        elif self.params.method == "macd_signals":
            result_df = self._generate_macd_signals(result_df)
        elif self.params.method == "multi_class":
            result_df = self._generate_multiclass_labels(result_df)
        else:
            raise ValueError(f"Unknown labeling method: {self.params.method}")

        return result_df

    def _generate_future_returns_labels(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate labels based on future returns"""
        if isinstance(self.params.forward_periods, int):
            periods = [self.params.forward_periods]
        else:
            periods = self.params.forward_periods

        for period in periods:
            # Calculate future returns
            future_price = df["close"].shift(-period)
            current_price = df["close"]
            future_return = (future_price - current_price) / current_price

            # Create binary signals based on threshold
            signal_col = f"signal_{period}p"
            df[signal_col] = 0  # Hold
            df.loc[future_return > self.params.return_threshold, signal_col] = 1  # Buy
            df.loc[future_return < -self.params.return_threshold, signal_col] = (
                -1
            )  # Sell

            # Store the actual future return for analysis
            df[f"future_return_{period}p"] = future_return

        # Create a main signal column (using first period if multiple)
        main_period = periods[0]
        df["signal"] = df[f"signal_{main_period}p"]

        return df

    def _generate_crossover_labels(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate labels based on indicator crossovers"""
        if not self.params.fast_column or not self.params.slow_column:
            raise ValueError(
                "Crossover method requires fast_column and slow_column parameters"
            )

        if self.params.fast_column not in df.columns:
            raise ValueError(
                f"Fast column '{self.params.fast_column}' not found in data"
            )
        if self.params.slow_column not in df.columns:
            raise ValueError(
                f"Slow column '{self.params.slow_column}' not found in data"
            )

        fast = df[self.params.fast_column]
        slow = df[self.params.slow_column]

        # Detect crossovers
        df["signal"] = 0

        # Golden cross (fast above slow) = Buy signal
        golden_cross = (fast > slow) & (fast.shift(1) <= slow.shift(1))
        df.loc[golden_cross, "signal"] = 1

        # Death cross (fast below slow) = Sell signal
        death_cross = (fast < slow) & (fast.shift(1) >= slow.shift(1))
        df.loc[death_cross, "signal"] = -1

        # Store crossover information
        df["fast_above_slow"] = (fast > slow).astype(int)
        df["crossover_strength"] = abs(fast - slow) / slow

        return df

    def _generate_threshold_labels(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate labels based on simple price thresholds"""
        # Price change threshold
        price_change = df["close"].pct_change()

        df["signal"] = 0  # Hold
        df.loc[price_change > self.params.return_threshold, "signal"] = 1  # Buy
        df.loc[price_change < -self.params.return_threshold, "signal"] = -1  # Sell

        df["price_change"] = price_change

        return df

    def _generate_rsi_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate signals based on RSI levels"""
        # Find RSI column
        rsi_cols = [col for col in df.columns if "rsi" in col.lower()]
        if not rsi_cols:
            raise ValueError("No RSI column found in data for RSI signals")

        rsi_col = rsi_cols[0]  # Use first RSI column
        rsi = df[rsi_col]

        df["signal"] = 0  # Hold

        # RSI oversold (< 30) = Buy signal
        df.loc[rsi < 30, "signal"] = 1

        # RSI overbought (> 70) = Sell signal
        df.loc[rsi > 70, "signal"] = -1

        # Additional RSI features
        df["rsi_oversold"] = (rsi < 30).astype(int)
        df["rsi_overbought"] = (rsi > 70).astype(int)
        df["rsi_extreme"] = ((rsi < 20) | (rsi > 80)).astype(int)

        return df

    def _generate_bollinger_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate signals based on Bollinger Bands"""
        required_cols = ["bb_upper", "bb_lower", "bb_position"]
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing Bollinger Band columns: {missing_cols}")

        df["signal"] = 0  # Hold

        # Price touches lower band = Buy signal
        df.loc[df["bb_position"] < 0.1, "signal"] = 1

        # Price touches upper band = Sell signal
        df.loc[df["bb_position"] > 0.9, "signal"] = -1

        # Additional Bollinger features
        df["bb_squeeze"] = (df["bb_width"] < df["bb_width"].rolling(20).mean()).astype(
            int
        )
        df["bb_breakout"] = (df["close"] > df["bb_upper"]).astype(int) - (
            df["close"] < df["bb_lower"]
        ).astype(int)

        return df

    def _generate_macd_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate signals based on MACD"""
        required_cols = ["macd_line", "macd_signal", "macd_histogram"]
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing MACD columns: {missing_cols}")

        df["signal"] = 0  # Hold

        # MACD bullish crossover = Buy signal
        macd_bullish = (df["macd_line"] > df["macd_signal"]) & (
            df["macd_line"].shift(1) <= df["macd_signal"].shift(1)
        )
        df.loc[macd_bullish, "signal"] = 1

        # MACD bearish crossover = Sell signal
        macd_bearish = (df["macd_line"] < df["macd_signal"]) & (
            df["macd_line"].shift(1) >= df["macd_signal"].shift(1)
        )
        df.loc[macd_bearish, "signal"] = -1

        # Additional MACD features
        df["macd_above_signal"] = (df["macd_line"] > df["macd_signal"]).astype(int)
        df["macd_histogram_increasing"] = (
            df["macd_histogram"] > df["macd_histogram"].shift(1)
        ).astype(int)

        return df

    def _generate_multiclass_labels(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate multi-class labels for ML training"""
        # Calculate future returns for classification
        future_return = df["close"].shift(-self.params.forward_periods).pct_change()

        # Create quantile-based classes
        if self.params.num_classes == 3:
            # Ternary classification: Sell, Hold, Buy
            q33 = future_return.quantile(0.33)
            q67 = future_return.quantile(0.67)

            df["label"] = 1  # Hold (middle class)
            df.loc[future_return < q33, "label"] = 0  # Sell
            df.loc[future_return > q67, "label"] = 2  # Buy

        elif self.params.num_classes == 5:
            # Quintile classification: Strong Sell, Sell, Hold, Buy, Strong Buy
            q20 = future_return.quantile(0.20)
            q40 = future_return.quantile(0.40)
            q60 = future_return.quantile(0.60)
            q80 = future_return.quantile(0.80)

            df["label"] = 2  # Hold (middle class)
            df.loc[future_return < q20, "label"] = 0  # Strong Sell
            df.loc[(future_return >= q20) & (future_return < q40), "label"] = 1  # Sell
            df.loc[(future_return >= q60) & (future_return < q80), "label"] = 3  # Buy
            df.loc[future_return >= q80, "label"] = 4  # Strong Buy

        # Convert to signal for compatibility (-1, 0, 1)
        if self.params.num_classes == 3:
            df["signal"] = df["label"] - 1  # Convert 0,1,2 to -1,0,1
        else:
            df["signal"] = df["label"] - 2  # Convert 0,1,2,3,4 to -2,-1,0,1,2

        # Store class probabilities for analysis
        df["future_return_multiclass"] = future_return

        return df

    def _add_risk_management(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add stop loss and take profit signals"""
        if "signal" not in df.columns:
            return df

        df["stop_loss_signal"] = 0
        df["take_profit_signal"] = 0

        if self.params.stop_loss_pct:
            stop_loss_threshold = self.params.stop_loss_pct / 100
            price_change = df["close"].pct_change()
            df.loc[price_change < -stop_loss_threshold, "stop_loss_signal"] = 1

        if self.params.take_profit_pct:
            take_profit_threshold = self.params.take_profit_pct / 100
            price_change = df["close"].pct_change()
            df.loc[price_change > take_profit_threshold, "take_profit_signal"] = 1

        return df

    def _calculate_signal_stats(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate statistics about the generated signals"""
        if "signal" not in df.columns:
            return {"total_signals": 0}

        signals = df["signal"]

        stats = {
            "total_signals": len(signals[signals != 0]),
            "buy_signals": len(signals[signals > 0]),
            "sell_signals": len(signals[signals < 0]),
            "hold_periods": len(signals[signals == 0]),
            "signal_frequency": (
                len(signals[signals != 0]) / len(signals) if len(signals) > 0 else 0
            ),
            "buy_sell_ratio": len(signals[signals > 0])
            / max(len(signals[signals < 0]), 1),
        }

        # Add class distribution for multi-class labeling
        if "label" in df.columns:
            label_counts = df["label"].value_counts().to_dict()
            stats["class_distribution"] = label_counts

        return stats


def main():
    """Entry point when run as standalone script"""
    if len(sys.argv) not in [3, 4]:
        print("Usage: python LabelingNode.py <input_json> <output_json> [logs_json]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    logs_file = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        # Read parameters and inputs from input JSON
        with open(input_file, "r") as f:
            config = json.load(f)

        # Create and run the node
        node = LabelingNode(config.get("params", {}))
        result = node.run(config.get("inputs", {}))

        # Write result to output JSON
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2, default=str)

        print(f"LabelingNode completed successfully")

    except Exception as e:
        error_result = {"error": str(e), "type": "execution_error"}

        with open(output_file, "w") as f:
            json.dump(error_result, f, indent=2)

        print(f"LabelingNode failed: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
