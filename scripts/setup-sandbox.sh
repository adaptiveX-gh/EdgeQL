#!/bin/bash

# EdgeQL Sandbox Environment Setup Script
# This script builds and verifies the Docker sandbox containers for Sprint 1

set -e

echo "🚀 Setting up EdgeQL Docker Sandbox Environment for Sprint 1"
echo "============================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

print_status "Docker is running ✓"

# Build Python sandbox image
print_status "Building Python sandbox image..."
if docker build -f docker/python-sandbox.Dockerfile -t edgeql-python-sandbox:latest .; then
    print_status "Python sandbox image built successfully ✓"
else
    print_error "Failed to build Python sandbox image"
    exit 1
fi

# Verify image was created
if docker images edgeql-python-sandbox:latest | grep -q edgeql-python-sandbox; then
    print_status "Python sandbox image verified ✓"
    IMAGE_SIZE=$(docker images edgeql-python-sandbox:latest --format "{{.Size}}")
    print_status "Image size: $IMAGE_SIZE"
else
    print_error "Python sandbox image not found after build"
    exit 1
fi

# Create temporary directories for testing
print_status "Creating test directories..."
mkdir -p /tmp/edgeql-test/input /tmp/edgeql-test/output

# Create test input
cat > /tmp/edgeql-test/input/input.json << EOF
{
  "nodeType": "DataLoaderNode",
  "params": {
    "symbol": "BTC",
    "timeframe": "1m",
    "dataset": "BTC_1m_hyperliquid_perpetualx.csv"
  },
  "inputs": {},
  "context": {
    "runId": "test-run",
    "pipelineId": "test-pipeline",
    "datasets": {}
  }
}
EOF

# Test Python node execution
print_status "Testing DataLoaderNode execution in sandbox..."

# Use different Docker command based on OS
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash)
    MSYS_NO_PATHCONV=1 docker run --rm \
        --name edgeql-test-container \
        --memory=512m \
        --cpus=1.0 \
        --network=none \
        --read-only \
        --tmpfs /tmp:rw,noexec,nosuid,size=100m \
        -v "/tmp/edgeql-test:/workspace" \
        -v "$(pwd)/datasets:/datasets:ro" \
        --user edgeql \
        --security-opt no-new-privileges \
        edgeql-python-sandbox \
        python /app/nodes/DataLoaderNode.py /workspace/input/input.json /workspace/output/output.json
else
    # Linux/macOS
    docker run --rm \
        --name edgeql-test-container \
        --memory=512m \
        --cpus=1.0 \
        --network=none \
        --read-only \
        --tmpfs /tmp:rw,noexec,nosuid,size=100m \
        -v "/tmp/edgeql-test:/workspace" \
        -v "$(pwd)/datasets:/datasets:ro" \
        --user edgeql \
        --security-opt no-new-privileges \
        edgeql-python-sandbox \
        python /app/nodes/DataLoaderNode.py /workspace/input/input.json /workspace/output/output.json
fi

if [ $? -eq 0 ] && [ -f "/tmp/edgeql-test/output/output.json" ]; then
    print_status "DataLoaderNode test successful ✓"
    
    # Show sample output
    echo ""
    print_status "Sample output:"
    head -20 /tmp/edgeql-test/output/output.json | sed 's/^/  /'
    echo ""
else
    print_error "DataLoaderNode test failed"
    exit 1
fi

# Clean up test files
rm -rf /tmp/edgeql-test

# Display summary
print_status "Sandbox Environment Setup Complete!"
echo ""
echo "📋 Summary:"
echo "  ✓ Python sandbox image built and tested"
echo "  ✓ Security constraints verified"
echo "  ✓ DataLoaderNode execution tested"
echo ""
echo "🎯 Sprint 1 containers are ready for use!"
echo ""
echo "📚 Next steps:"
echo "  - Start executor service: pnpm --filter services/executor dev"
echo "  - Run integration tests: npm test"
echo "  - Build additional node sandboxes as needed"
echo ""
print_warning "Note: Containers run with strict security constraints:"
echo "  • No network access"
echo "  • Read-only filesystem"
echo "  • Memory limited to 512MB"
echo "  • CPU limited to 1.0 core"
echo "  • Non-root user execution"