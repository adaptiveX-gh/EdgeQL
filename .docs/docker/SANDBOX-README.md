# EdgeQL Sandbox Environment

This document describes the Docker sandbox environment for secure execution of ML nodes in Sprint 1.

## Quick Start

### Setup (First Time)
```bash
# Build and test sandbox containers
./scripts/setup-sandbox.sh        # Linux/macOS/Git Bash
# or
scripts\setup-sandbox.bat         # Windows Command Prompt
```

### Health Check
```bash
# Verify sandbox is ready
./scripts/check-sandbox-health.sh
```

## Architecture

### Python Sandbox (`edgeql-python-sandbox:latest`)
- **Base**: Python 3.11 slim
- **ML Libraries**: TensorFlow, PyTorch, scikit-learn, pandas, ta-lib
- **User**: Non-root user `edgeql` (UID 1001)
- **Security**: Network isolation, read-only filesystem, resource limits

### Security Constraints
- **Network**: `--network=none` (no internet access)
- **Filesystem**: `--read-only` with controlled tmp mounts
- **Resources**: 512MB memory, 1.0 CPU core limits
- **User**: `--user edgeql` (non-root execution)
- **Privileges**: `--security-opt no-new-privileges`
- **Timeout**: 60-second execution limit

## Available Python Nodes

- **DataLoaderNode**: Loads OHLCV data from CSV files
- **IndicatorNode**: Calculates technical indicators
- **FeatureGeneratorNode**: Creates ML features from price data
- **LabelingNode**: Creates trading labels for ML training

## Usage Examples

### Manual Container Execution
```bash
# Execute DataLoaderNode manually
docker run --rm \
  --memory=512m --cpus=1.0 \
  --network=none --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \
  -v "/path/to/workspace:/workspace" \
  -v "./datasets:/datasets:ro" \
  --user edgeql \
  --security-opt no-new-privileges \
  edgeql-python-sandbox \
  python /app/nodes/DataLoaderNode.py \
  /workspace/input.json /workspace/output.json
```

### Through Executor Service
The executor service automatically handles container creation with proper security constraints:

```typescript
import { PythonSandboxRunner } from './runners/pythonSandboxRunner.js';

const runner = new PythonSandboxRunner();
const result = await runner.execute(
  'node-1',
  'DataLoaderNode',
  { symbol: 'BTC', timeframe: '1m', dataset: 'data.csv' },
  new Map(),
  { runId: 'run-123', pipelineId: 'pipeline-456', datasets: new Map() }
);
```

## Input/Output Format

### Input JSON
```json
{
  "nodeType": "DataLoaderNode",
  "params": {
    "symbol": "BTC",
    "timeframe": "1m",
    "dataset": "BTC_1m_hyperliquid_perpetualx.csv"
  },
  "inputs": {},
  "context": {
    "runId": "run-123",
    "pipelineId": "pipeline-456",
    "datasets": {}
  }
}
```

### Output JSON
```json
{
  "type": "dataframe",
  "data": [
    {
      "timestamp": "2025-08-08 19:43:00",
      "open": 116503.0,
      "high": 116508.0,
      "low": 116486.2,
      "close": 116486.21,
      "volume": 1.19355
    }
  ],
  "metadata": {
    "symbol": "BTC",
    "timeframe": "1m",
    "rows": 19180,
    "columns": ["timestamp", "open", "high", "low", "close", "volume"]
  }
}
```

## Volume Mounts

### Standard Mounts (Executor Service)
- `/datasets` - Read-only access to dataset files
- `/workspace` - Read/write workspace for input/output
- `/tmp` - Temporary filesystem (100MB limit)

### Development Mounts (Manual Testing)
- `./datasets:/datasets:ro` - Dataset files
- `./artifacts:/artifacts` - Persistent artifacts
- `/tmp/edgeql-runs:/tmp/runs` - Run artifacts

## Troubleshooting

### Build Issues
```bash
# Clean build
docker system prune -f
docker build --no-cache -f docker/python-sandbox.Dockerfile -t edgeql-python-sandbox:latest .
```

### Path Issues (Windows)
Use `MSYS_NO_PATHCONV=1` prefix for Docker commands in Git Bash:
```bash
MSYS_NO_PATHCONV=1 docker run --rm edgeql-python-sandbox python --version
```

### Permission Issues
Verify the container user:
```bash
docker run --rm --user edgeql edgeql-python-sandbox whoami
# Should output: edgeql
```

### Network Isolation Test
```bash
docker run --rm --network=none edgeql-python-sandbox python -c "
import socket
try:
    socket.create_connection(('8.8.8.8', 53), timeout=1)
    print('ERROR: Network access detected')
except:
    print('SUCCESS: Network isolated')
"
```

## Development

### Adding New Python Nodes
1. Create the node in `nodes/python/NodeName.py`
2. Add tests in `nodes/python/test_NodeName.py`
3. Update `requirements.txt` if needed
4. Rebuild image: `docker build -f docker/python-sandbox.Dockerfile -t edgeql-python-sandbox:latest .`
5. Add node type to executor's `pythonNodes` array

### Updating Dependencies
1. Modify `nodes/python/requirements.txt`
2. Rebuild image
3. Test with health check script

## Sprint 1 Status

✅ **Complete**
- Python sandbox container built and tested
- Security constraints implemented and verified
- DataLoaderNode execution working
- Startup and health check scripts created
- Documentation complete

🎯 **Ready for Sprint 1 development!**

The sandbox environment provides secure, isolated execution of Python ML nodes with comprehensive resource limits and security constraints.