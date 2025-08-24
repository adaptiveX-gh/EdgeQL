# DSL Compiler Service

A comprehensive compiler service for the EdgeQL trading strategy DSL. This service parses YAML-based strategy definitions, validates them, and compiles them into executable pipeline plans.

## Features

- **YAML-based DSL Parsing**: Converts human-readable strategy definitions into structured data
- **Comprehensive Validation**: Multi-layer validation including syntax, semantics, and data flow
- **Type Safety**: Full TypeScript support with Zod schemas for runtime validation
- **Dependency Resolution**: Topological sorting with circular dependency detection
- **Node I/O Contracts**: Validates data flow compatibility between pipeline nodes
- **Extensible Architecture**: Easy to add new node types and validation rules

## Architecture

```
src/
├── schemas/              # Zod schemas for validation
│   ├── dslSchema.ts     # Main DSL structure and parameter schemas
│   └── nodeSchemas.ts   # Node input/output contracts
├── parsers/             # DSL parsing logic
│   └── yamlParser.ts    # YAML to structured data conversion
├── validators/          # Validation logic
│   └── pipelineValidator.ts  # Pipeline and node validation
├── tests/               # Comprehensive test suite
│   ├── fixtures/        # Sample DSL files for testing
│   ├── integration.test.ts    # End-to-end compilation tests
│   ├── schemaValidation.test.ts  # Schema validation tests
│   ├── yamlParser.test.ts     # Parser tests
│   └── pipelineValidator.test.ts  # Validator tests
├── types.ts            # TypeScript type definitions
└── index.ts            # Main compiler class
```

## DSL Grammar

The DSL supports the following structure:

```yaml
pipeline:
  - id: node_identifier           # Unique node ID (alphanumeric + underscore)
    type: NodeTypeName           # One of: DataLoaderNode, IndicatorNode, CrossoverSignalNode, BacktestNode  
    depends_on: [dependency_ids] # Optional array of node IDs this node depends on
    params:                      # Node-specific parameters
      param_name: param_value
```

### Supported Node Types

#### DataLoaderNode
Loads historical price data from datasets.

**Parameters:**
- `symbol` (string): Trading pair (e.g., "BTC/USD")
- `timeframe` (enum): Time interval ["1m", "5m", "15m", "30m", "1h", "4h", "1d"]
- `dataset` (string): Dataset filename
- `start_date` (string, optional): Start date for data range
- `end_date` (string, optional): End date for data range

**Output:** Dataframe with OHLCV data

#### IndicatorNode
Calculates technical indicators.

**Parameters:**
- `indicator` (enum): Indicator type ["SMA", "EMA", "RSI", "MACD", "BB", "STOCH", "ATR"]
- `period` (positive number): Calculation period
- `column` (enum, optional): Input column ["open", "high", "low", "close", "volume"], defaults to "close"

**Input:** Dataframe with price data
**Output:** Dataframe with additional indicator column

#### CrossoverSignalNode
Generates trading signals based on crossover conditions.

**Parameters:**
- `buy_condition` (string): Condition for buy signals
- `sell_condition` (string): Condition for sell signals  
- `signal_column` (string, optional): Output signal column name, defaults to "signal"

**Input:** Dataframe(s) with indicator data
**Output:** Signals dataframe with trading signals

#### BacktestNode
Runs backtesting simulation.

**Parameters:**
- `initial_capital` (positive number): Starting capital
- `commission` (number 0-1, optional): Trading commission rate, defaults to 0.001
- `slippage` (number 0-1, optional): Slippage rate, defaults to 0.001
- `position_size` (number 0-1, optional): Position sizing, defaults to 1.0

**Input:** Signals dataframe and price dataframe
**Output:** Backtest results with performance metrics

## Validation Layers

### 1. Syntax Validation
- YAML parsing and structure validation
- Required fields presence check
- Data type validation

### 2. Schema Validation  
- Node ID format validation (must start with letter)
- Parameter type and value validation using Zod schemas
- Pipeline structure validation

### 3. Semantic Validation
- Node type existence check
- Dependency resolution (missing dependencies)
- Duplicate node ID detection
- Circular dependency detection with path reporting

### 4. Data Flow Validation
- Input/output schema compatibility
- Node I/O contract validation
- End-to-end data flow verification

## Usage

### Basic Compilation

```typescript
import { PipelineCompiler } from './index.js';

const compiler = new PipelineCompiler();
const result = compiler.compile(yamlContent);

if (result.success) {
  console.log('Compilation successful!');
  console.log('Execution order:', result.pipeline.executionOrder);
} else {
  console.log('Compilation failed:');
  result.errors.forEach(error => {
    console.log(`${error.type}: ${error.message}`);
  });
}
```

### Standalone Functions

```typescript
import { compileFromString } from './index.js';

// Direct compilation from string
const result = compileFromString(dslContent);
```

## Sample DSL Files

### Moving Average Crossover Strategy

```yaml
pipeline:
  - id: price_data
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "BTC_1m_hyperliquid_perpetualx.csv"

  - id: fast_ma
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "SMA"
      period: 20

  - id: slow_ma
    type: IndicatorNode
    depends_on: [price_data]
    params:
      indicator: "SMA"
      period: 50

  - id: ma_signals
    type: CrossoverSignalNode
    depends_on: [fast_ma, slow_ma]
    params:
      buy_condition: "fast_ma > slow_ma"
      sell_condition: "fast_ma < slow_ma"

  - id: backtest_results
    type: BacktestNode
    depends_on: [ma_signals, price_data]
    params:
      initial_capital: 10000
```

## Testing

The compiler includes comprehensive test coverage:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end compilation testing
- **Schema Tests**: Validation rule testing
- **Fixture Tests**: Sample strategy compilation

Run tests:
```bash
npm test           # All tests
npm run test:watch # Watch mode
```

## Error Handling

The compiler provides detailed error reporting with:

- **Error Type Classification**: `syntax`, `semantic`, `schema`
- **Contextual Information**: Node ID, field name, line/column numbers
- **Descriptive Messages**: Clear explanation of validation failures
- **Path Reporting**: Full dependency paths for circular dependencies

## Extension Points

### Adding New Node Types

1. Define parameter schema in `schemas/dslSchema.ts`
2. Add I/O contract in `schemas/nodeSchemas.ts`  
3. Update validator in `validators/pipelineValidator.ts`
4. Add runtime determination in `index.ts`
5. Write comprehensive tests

### Custom Validation Rules

1. Extend `PipelineValidator` class
2. Add validation logic to `validateNode` method
3. Update error reporting
4. Add test coverage

## Performance Considerations

- **Lazy Validation**: Data flow validation only runs if other validations pass
- **Efficient Algorithms**: O(V + E) topological sort and cycle detection
- **Schema Caching**: Reused validation schemas
- **Memory Efficient**: Streaming YAML parsing for large files

## Dependencies

- `yaml`: YAML parsing and generation
- `zod`: Runtime type validation and schema definition
- `ajv`: Additional JSON schema validation capabilities

All dependencies are lightweight and focused on the core compilation functionality.