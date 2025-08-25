#!/usr/bin/env python3
"""
CrossoverSignalNode - Moving Average Crossover Signal Generator

This node generates buy/sell signals based on moving average crossovers.
Supports various crossover conditions and can work with multiple indicator inputs.

Features:
- Fast/Slow moving average crossover detection
- Golden cross and death cross signals
- Configurable signal thresholds and conditions
- Multiple input handling for complex strategies
- Signal filtering and confirmation
"""

import json
import sys
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from pydantic import BaseModel, validator


class CrossoverSignalParams(BaseModel):
    """Parameters for the CrossoverSignal node"""

    fast_period: int = 20
    slow_period: int = 50
    signal_column: str = "signal"
    fast_ma_column: Optional[str] = None  # Auto-detected if None
    slow_ma_column: Optional[str] = None  # Auto-detected if None
    buy_threshold: float = 0.0  # Minimum crossover threshold for buy signal
    sell_threshold: float = 0.0  # Minimum crossover threshold for sell signal
    confirmation_periods: int = 1  # Number of periods to confirm crossover
    
    @validator("fast_period", "slow_period")
    def validate_periods(cls, v):
        if v <= 0:
            raise ValueError("Periods must be positive")
        return v
    
    @validator("slow_period")
    def validate_period_relationship(cls, v, values):
        if "fast_period" in values and values["fast_period"] >= v:
            raise ValueError("Fast period must be less than slow period")
        return v
    
    @validator("confirmation_periods")
    def validate_confirmation_periods(cls, v):
        if v < 1:
            raise ValueError("Confirmation periods must be at least 1")
        return v


class CrossoverSignalNode:
    """
    Moving Average Crossover Signal Generator
    
    Generates trading signals based on the crossover of two moving averages:
    - Buy signal when fast MA crosses above slow MA
    - Sell signal when fast MA crosses below slow MA
    
    Can work with single dataframe input (with both MAs) or multiple inputs.
    """

    def __init__(self, params: Dict[str, Any]):
        self.params = CrossoverSignalParams(**params)

    def run(self, inputs: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Main execution method
        
        Args:
            inputs: Dictionary containing dataframe(s) with moving average data
            
        Returns:
            Dict containing timestamp and signal columns
        """
        try:
            if not inputs:
                raise ValueError("CrossoverSignalNode requires input data")

            # Extract and process input data
            combined_data = self._process_inputs(inputs)
            
            # Detect moving average columns
            fast_ma_col, slow_ma_col = self._detect_ma_columns(combined_data)
            
            print(f"Detected MA columns: Fast={fast_ma_col}, Slow={slow_ma_col}")
            print(f"Processing {len(combined_data)} data points for crossover signals")
            
            # Generate crossover signals
            signals_data = self._generate_crossover_signals(combined_data, fast_ma_col, slow_ma_col)
            
            # Apply confirmation and filtering
            signals_data = self._apply_signal_confirmation(signals_data)
            
            signal_count = len(signals_data[signals_data[self.params.signal_column] != 0])
            print(f"Generated {signal_count} crossover signals")
            
            return {
                "type": "signals",
                "data": signals_data.to_dict("records"),
                "metadata": {
                    "signal_column": self.params.signal_column,
                    "fast_period": self.params.fast_period,
                    "slow_period": self.params.slow_period,
                    "fast_ma_column": fast_ma_col,
                    "slow_ma_column": slow_ma_col,
                    "total_signals": signal_count,
                    "buy_signals": len(signals_data[signals_data[self.params.signal_column] > 0]),
                    "sell_signals": len(signals_data[signals_data[self.params.signal_column] < 0]),
                    "confirmation_periods": self.params.confirmation_periods,
                    "date_range": {
                        "start": str(signals_data["timestamp"].min()) if "timestamp" in signals_data.columns else None,
                        "end": str(signals_data["timestamp"].max()) if "timestamp" in signals_data.columns else None
                    }
                }
            }

        except Exception as e:
            raise RuntimeError(f"CrossoverSignalNode failed: {str(e)}")

    def _process_inputs(self, inputs: Dict[str, Any]) -> pd.DataFrame:
        """Process single or multiple input dataframes"""
        dataframes = []
        
        # Collect all dataframe inputs
        for input_name, input_data in inputs.items():
            if isinstance(input_data, dict) and input_data.get("type") == "dataframe":
                df = pd.DataFrame(input_data["data"])
                
                # Ensure timestamp is datetime
                if "timestamp" in df.columns:
                    df["timestamp"] = pd.to_datetime(df["timestamp"])
                    
                dataframes.append(df)
        
        if not dataframes:
            raise ValueError("No dataframe inputs found")
        
        if len(dataframes) == 1:
            # Single input case - should contain both moving averages
            return dataframes[0].copy()
        else:
            # Multiple inputs case - merge on timestamp
            return self._merge_multiple_inputs(dataframes)

    def _merge_multiple_inputs(self, dataframes: List[pd.DataFrame]) -> pd.DataFrame:
        """Merge multiple dataframes on timestamp"""
        if len(dataframes) < 2:
            raise ValueError("Need at least 2 dataframes for crossover analysis")
            
        # Start with the first dataframe
        result = dataframes[0].copy()
        
        # Merge with subsequent dataframes
        for df in dataframes[1:]:
            if "timestamp" not in df.columns:
                raise ValueError("All input dataframes must have timestamp column")
                
            # Merge on timestamp, keeping all columns
            result = pd.merge(result, df, on="timestamp", how="inner", suffixes=("", "_merge"))
            
            # Handle duplicate columns by keeping the original
            for col in result.columns:
                if col.endswith("_merge"):
                    original_col = col.replace("_merge", "")
                    if original_col not in result.columns:
                        result[original_col] = result[col]
                    result.drop(columns=[col], inplace=True)
        
        return result.sort_values("timestamp").reset_index(drop=True)

    def _detect_ma_columns(self, data: pd.DataFrame) -> tuple[str, str]:
        """Detect fast and slow moving average columns"""
        # If explicitly specified, use those
        if self.params.fast_ma_column and self.params.slow_ma_column:
            if self.params.fast_ma_column not in data.columns:
                raise ValueError(f"Fast MA column '{self.params.fast_ma_column}' not found")
            if self.params.slow_ma_column not in data.columns:
                raise ValueError(f"Slow MA column '{self.params.slow_ma_column}' not found")
            return self.params.fast_ma_column, self.params.slow_ma_column
        
        # Auto-detect based on naming patterns and periods
        ma_columns = []
        
        # Look for SMA/EMA columns with periods
        for col in data.columns:
            col_lower = col.lower()
            if any(indicator in col_lower for indicator in ["sma", "ema", "ma"]):
                ma_columns.append(col)
        
        if len(ma_columns) >= 2:
            # Try to match by period numbers
            fast_col = None
            slow_col = None
            
            for col in ma_columns:
                if str(self.params.fast_period) in col:
                    fast_col = col
                elif str(self.params.slow_period) in col:
                    slow_col = col
            
            if fast_col and slow_col:
                return fast_col, slow_col
            
            # If period matching fails, use first two MA columns
            print(f"Warning: Could not match MA columns by period, using first two: {ma_columns[:2]}")
            return ma_columns[0], ma_columns[1]
        
        # Fallback: look for any numeric columns that could be moving averages
        numeric_cols = data.select_dtypes(include=[np.number]).columns.tolist()
        
        # Remove OHLCV columns
        ohlcv_cols = ["open", "high", "low", "close", "volume"]
        potential_ma_cols = [col for col in numeric_cols if col.lower() not in ohlcv_cols]
        
        if len(potential_ma_cols) >= 2:
            print(f"Warning: Using potential MA columns: {potential_ma_cols[:2]}")
            return potential_ma_cols[0], potential_ma_cols[1]
        
        raise ValueError(
            f"Could not detect moving average columns. "
            f"Available columns: {list(data.columns)}. "
            f"Please specify fast_ma_column and slow_ma_column parameters."
        )

    def _generate_crossover_signals(self, data: pd.DataFrame, fast_ma_col: str, slow_ma_col: str) -> pd.DataFrame:
        """Generate crossover signals based on moving average crossovers"""
        result = data[["timestamp"]].copy() if "timestamp" in data.columns else pd.DataFrame()
        
        # Extract MA series
        fast_ma = data[fast_ma_col]
        slow_ma = data[slow_ma_col]
        
        # Calculate crossover conditions (handle NaN values)
        fast_above_slow = (fast_ma > slow_ma).fillna(False)
        fast_above_slow_prev = fast_above_slow.shift(1).fillna(False)
        
        # Detect crossovers
        golden_cross = fast_above_slow & (~fast_above_slow_prev)  # Fast crosses above slow
        death_cross = (~fast_above_slow) & fast_above_slow_prev   # Fast crosses below slow
        
        # Calculate crossover strength (percentage difference)
        ma_diff_pct = (fast_ma - slow_ma) / slow_ma * 100
        
        # Initialize signal column
        signals = np.zeros(len(data))
        
        # Apply buy signals (golden cross)
        buy_mask = golden_cross & (ma_diff_pct.abs() >= self.params.buy_threshold)
        signals[buy_mask] = 1.0
        
        # Apply sell signals (death cross)
        sell_mask = death_cross & (ma_diff_pct.abs() >= self.params.sell_threshold)
        signals[sell_mask] = -1.0
        
        # Add signals to result
        result[self.params.signal_column] = signals
        
        # Add additional diagnostic columns
        result["fast_ma"] = fast_ma
        result["slow_ma"] = slow_ma
        result["ma_diff_pct"] = ma_diff_pct
        result["crossover_strength"] = ma_diff_pct.abs()
        
        return result

    def _apply_signal_confirmation(self, signals_data: pd.DataFrame) -> pd.DataFrame:
        """Apply signal confirmation over multiple periods"""
        if self.params.confirmation_periods <= 1:
            return signals_data
        
        confirmed_signals = signals_data[self.params.signal_column].copy()
        
        # For each signal, check if it's confirmed over confirmation_periods
        for i in range(len(signals_data)):
            if signals_data[self.params.signal_column].iloc[i] != 0:
                signal_value = signals_data[self.params.signal_column].iloc[i]
                
                # Check confirmation in following periods
                confirmation_count = 0
                for j in range(1, min(self.params.confirmation_periods, len(signals_data) - i)):
                    future_idx = i + j
                    
                    # Check if the crossover condition persists
                    if signal_value > 0:  # Buy signal confirmation
                        if signals_data["fast_ma"].iloc[future_idx] > signals_data["slow_ma"].iloc[future_idx]:
                            confirmation_count += 1
                    else:  # Sell signal confirmation
                        if signals_data["fast_ma"].iloc[future_idx] < signals_data["slow_ma"].iloc[future_idx]:
                            confirmation_count += 1
                
                # Only keep signal if sufficiently confirmed
                required_confirmations = self.params.confirmation_periods - 1
                if confirmation_count < required_confirmations:
                    confirmed_signals.iloc[i] = 0.0
        
        # Update signals
        signals_data[self.params.signal_column] = confirmed_signals
        
        return signals_data


def main():
    """Entry point when run as standalone script"""
    if len(sys.argv) not in [3, 4]:
        print("Usage: python CrossoverSignalNode.py <input_json> <output_json> [logs_json]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    logs_file = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        # Read parameters and inputs from input JSON
        with open(input_file, "r") as f:
            config = json.load(f)

        # Create and run the node
        node = CrossoverSignalNode(config.get("params", {}))
        result = node.run(config.get("inputs", {}))

        # Write result to output JSON
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2, default=str)

        print(f"CrossoverSignalNode completed successfully")

    except Exception as e:
        error_result = {"error": str(e), "type": "execution_error"}

        with open(output_file, "w") as f:
            json.dump(error_result, f, indent=2)

        print(f"CrossoverSignalNode failed: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()