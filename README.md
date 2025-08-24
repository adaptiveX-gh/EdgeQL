# EdgeQL ML Strategy & Backtesting System

A browser-based application for designing, testing, and deploying ML-driven trading strategies using a node-based pipeline approach.

## Overview

This system allows quantitative strategy developers to:
- Create trading strategies using a Domain Specific Language (DSL)
- Build custom nodes in multiple languages (Python, JavaScript, WebAssembly)
- Execute pipelines in secure Docker sandboxes
- Train ML models as part of backtesting workflows
- Analyze results with comprehensive reporting

## Architecture

```
apps/web/                # Svelte frontend (DSL editor, results UI)
services/api/            # REST API endpoints
services/compiler/       # DSL → executable plan compiler
services/executor/       # DAG runner with sandbox orchestration
nodes/python/            # Python node implementations
nodes/js/                # JavaScript nodes (Sprint 3)
nodes/wasm/              # WebAssembly modules (Sprint 3)
docker/                  # Sandbox container configurations
datasets/                # Sample OHLCV data
artifacts/               # Model outputs, reports, logs
```

## Tech Stack

- **Frontend**: Svelte + TailwindCSS + DaisyUI + Monaco Editor
- **Backend**: Node.js + Express + TypeScript
- **Sandboxes**: Docker containers (Python, Node.js, WASM)
- **ML Libraries**: PyTorch/TensorFlow (in Python sandboxes)
- **Development**: pnpm workspaces, Vitest, ESLint, Prettier

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker and Docker Compose
- Python 3.11+ (for local development)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd EdgeQL
```

2. Install dependencies:
```bash
pnpm install
```

3. Build Docker sandbox images:
```bash
pnpm run docker:build
```

4. Start development services:
```bash
# Start all services in development mode
pnpm dev

# Or start individual services:
pnpm run web:dev     # Frontend (http://localhost:5173)
pnpm run api:dev     # API server (http://localhost:3001)
```

### Development Commands

```bash
# Frontend development
pnpm run web:dev                # Start Svelte dev server
pnpm run web:build              # Build for production
pnpm run web:test               # Run frontend tests

# Backend services
pnpm run api:dev                # Start API in watch mode
pnpm run compiler:test          # Test DSL compiler
pnpm run executor:test          # Test pipeline executor

# Docker operations
pnpm run docker:up              # Start sandbox containers
pnpm run docker:down            # Stop containers
pnpm run docker:build           # Build container images

# Code quality
pnpm run lint                   # Lint all projects
pnpm run test                   # Run all tests
```

## Sprint 1 - MVP Features

### ✅ Completed
- Basic project structure with pnpm workspaces
- Svelte frontend with Monaco DSL editor
- REST API with pipeline management
- DSL compiler with YAML parsing and validation
- Pipeline executor with builtin node support
- Docker sandbox configuration
- Sample Python node implementations
- Comprehensive test suite following TDD principles

### Current Capabilities
1. **Pipeline Editor**: Edit strategies using YAML-based DSL with syntax highlighting
2. **Sample Pipeline**: Pre-loaded Moving Average Crossover strategy for demonstration
3. **Pipeline Execution**: Run strategies with simulated results
4. **Basic Results**: View backtest metrics (return, Sharpe ratio, trades, etc.)
5. **Built-in Nodes**: DataLoader, IndicatorNode, CrossoverSignal, BacktestNode

## Example Pipeline DSL

```yaml
pipeline:
  - id: data_loader
    type: DataLoaderNode
    params:
      symbol: "BTC/USD"
      timeframe: "1h"
      dataset: "sample_ohlcv.csv"
      
  - id: sma_fast
    type: IndicatorNode
    depends_on: [data_loader]
    params:
      indicator: "SMA"
      period: 10
      column: "close"
      
  - id: sma_slow
    type: IndicatorNode
    depends_on: [data_loader]
    params:
      indicator: "SMA"
      period: 20
      column: "close"
      
  - id: signals
    type: CrossoverSignalNode
    depends_on: [sma_fast, sma_slow]
    params:
      buy_condition: "fast > slow"
      sell_condition: "fast < slow"
      
  - id: backtest
    type: BacktestNode
    depends_on: [signals, data_loader]
    params:
      initial_capital: 100000
      commission: 0.001
```

## Testing

The project follows Test-Driven Development (TDD) principles:

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm run compiler:test          # DSL compiler tests
pnpm run api:test              # API endpoint tests
python nodes/python/test_DataLoaderNode.py  # Python node tests
```

## Upcoming Sprints

### Sprint 2 - Enhanced Validation & Results
- DSL syntax errors with inline feedback
- Semantic validation for node compatibility
- Interactive equity curve charts
- Pipeline run history
- CSV dataset upload functionality
- Run cancellation capability

### Sprint 3 - Custom JavaScript Nodes
- Monaco-based custom node editor
- JavaScript sandbox execution
- Memory/CPU/timeout limits enforcement
- Pipeline versioning system
- Read-only sharing for observers
- Artifact export functionality

## Security & Sandboxing

All custom code execution occurs in isolated Docker containers with:
- Resource limits (CPU, memory, execution time)
- No network access by default
- Non-root user execution
- Filesystem access restrictions
- Comprehensive logging and monitoring

## Contributing

1. Follow TDD principles - write failing tests first
2. Use conventional commit messages
3. Ensure all linting and tests pass before committing
4. Update documentation for new features

## License

This project is part of the EdgeQL ML backtesting system development.