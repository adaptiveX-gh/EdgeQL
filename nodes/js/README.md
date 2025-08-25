# Enhanced JavaScript Sandbox Implementation

This implementation provides secure, resource-limited execution of custom JavaScript nodes with comprehensive protection against malicious code and resource abuse.

## Architecture Overview

The sandbox system consists of three main components:

1. **SandboxRunner.js** - Enhanced sandbox wrapper with resource monitoring
2. **Enhanced Docker Container** - Isolated execution environment with strict security
3. **NodejsSandboxRunner.ts** - Orchestrator with configurable limits

## Security Features

### 1. Resource Limits (Configurable)
- **Memory Limit**: Default 512MB, configurable per node
- **Time Limit**: Default 30 seconds, configurable per node
- **CPU Limit**: Dynamically scaled based on time limit
- **Process Limit**: Maximum 50 processes per container
- **File Descriptor Limit**: 100 soft, 200 hard

### 2. API Access Restrictions
- **Blocked Modules**: fs, http, https, net, child_process, cluster, etc.
- **Dynamic Code**: eval(), Function constructor blocked
- **Process Control**: process.exit(), process.kill() blocked
- **Module Whitelist**: Optional allowedModules configuration

### 3. Network & Filesystem Isolation
- **Network**: Disabled by default, configurable per node
- **Filesystem**: Read-only with tmpfs for temporary operations
- **Datasets**: Read-only access to datasets directory
- **No System Access**: Cannot access host filesystem or network

### 4. Docker Security
- **Non-root User**: Runs as 'edgeql' user (UID 1001)
- **No Capabilities**: All Linux capabilities dropped
- **Seccomp Profile**: Default seccomp filtering
- **No New Privileges**: Prevents privilege escalation
- **Memory Swap**: Disabled to prevent swap abuse

## Configuration Options

Custom nodes can be configured with the following parameters:

```javascript
{
  code: "return { result: inputs.data.length };", // User JavaScript code
  memoryLimit: 256,        // Memory limit in MB (default: 512)
  timeLimit: 15,           // Time limit in seconds (default: 30)
  enableNetworking: false, // Allow network access (default: false)
  enableFileSystem: false, // Allow filesystem access (default: false)
  allowedModules: [        // Whitelist of allowed modules
    "lodash",
    "moment"
  ]
}
```

## Sandbox Violations

The system detects and reports various violation types:

### Memory Violations
```
MEMORY_LIMIT: Memory usage (600.00MB) exceeded limit of 512MB
Details: { currentMemory: 600, limit: 512, peakMemory: 650 }
```

### Time Violations
```
TIMEOUT: Execution time (35.50s) exceeded limit of 30s
Details: { currentTime: 35.5, limit: 30 }
```

### Security Violations
```
RESTRICTED_MODULE: Access to module 'fs' is not allowed in sandbox
DYNAMIC_CODE: Dynamic code execution via eval() is not allowed
UNAUTHORIZED_MODULE: Module 'crypto' not in allowed modules list
```

## Usage Examples

### Safe Data Transformation
```javascript
// Safe transformation within sandbox limits
function transform(inputs, params) {
  const { data } = inputs;
  const { operation = 'normalize' } = params;

  return data.map(item => ({
    ...item,
    value: item.value / Math.max(...data.map(d => d.value))
  }));
}

return transform(inputs, params);
```

### Memory-Intensive Operation
```javascript
// This would trigger a memory violation
const bigArray = new Array(1000000).fill(new Array(1000).fill('x'));
return bigArray; // MEMORY_LIMIT violation
```

### Blocked Network Access
```javascript
// This would trigger a security violation
const http = require('http'); // RESTRICTED_MODULE violation
```

## Monitoring and Statistics

The sandbox provides detailed execution statistics:

```javascript
{
  success: true,
  result: { /* processed data */ },
  stats: {
    memoryUsed: 128.5,    // Memory used in MB
    peakMemory: 150.2,    // Peak memory usage in MB
    executionTime: 5.75,  // Execution time in seconds
    rss: 200.1           // Resident set size in MB
  }
}
```

## Implementation Files

### Core Components
- `nodes/js/SandboxRunner.js` - Main sandbox wrapper with security controls
- `nodes/js/CustomJSNode.js` - Template for custom JavaScript nodes
- `services/executor/src/runners/nodejsSandboxRunner.ts` - Orchestrator
- `docker/node-sandbox.Dockerfile` - Secure container image

### Example Nodes
- `nodes/js/examples/SafeDataTransform.js` - Safe transformation example
- `nodes/js/examples/DangerousCode.js` - Security violation examples

### Tests
- `services/executor/src/tests/sandboxSecurity.test.ts` - Comprehensive security tests

## Deployment

### Building the Sandbox Image
```bash
docker build -f docker/node-sandbox.Dockerfile -t edgeql-nodejs-sandbox .
```

### Running Tests
```bash
cd services/executor
pnpm test sandboxSecurity.test.ts
```

## Security Considerations

1. **Container Escape**: Uses multiple layers of Docker security features
2. **Resource Exhaustion**: Active monitoring and enforcement of limits
3. **Data Exfiltration**: Network disabled, filesystem read-only
4. **Code Injection**: eval() and Function constructor blocked
5. **Process Abuse**: Process limits and non-root execution

## Performance Impact

- **Startup Overhead**: ~2-3 seconds per container (Docker)
- **Memory Overhead**: ~50MB base container footprint
- **Monitoring Overhead**: ~5% CPU for resource monitoring
- **Isolation Benefit**: Complete process and filesystem isolation

## Error Handling

All sandbox violations are caught and reported with:
- **Error Type**: Classification of the violation
- **Error Message**: Human-readable description
- **Details**: Technical information for debugging
- **Cleanup**: Automatic container termination and cleanup

The system ensures that no malicious code can:
- Consume excessive resources
- Access the host system
- Communicate over the network (unless explicitly allowed)
- Execute arbitrary system commands
- Escalate privileges

This provides a robust foundation for executing user-provided JavaScript code safely within the EdgeQL pipeline system.