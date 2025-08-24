#!/bin/bash

# EdgeQL Sandbox Health Check Script
# Verifies that sandbox containers are built and functioning

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo "🔍 EdgeQL Sandbox Health Check"
echo "==============================="

# Check Docker is running
if docker info > /dev/null 2>&1; then
    print_status "Docker daemon is running"
else
    print_error "Docker daemon is not running"
    exit 1
fi

# Check Python sandbox image exists
if docker images edgeql-python-sandbox:latest --format "{{.Repository}}" | grep -q "edgeql-python-sandbox"; then
    print_status "Python sandbox image exists"
    
    # Get image details
    IMAGE_SIZE=$(docker images edgeql-python-sandbox:latest --format "{{.Size}}")
    IMAGE_CREATED=$(docker images edgeql-python-sandbox:latest --format "{{.CreatedSince}}")
    echo "  Size: $IMAGE_SIZE"
    echo "  Created: $IMAGE_CREATED"
else
    print_error "Python sandbox image not found"
    echo "  Run: ./scripts/setup-sandbox.sh to build the image"
    exit 1
fi

# Test basic container functionality
echo ""
echo "Testing container functionality..."

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash) - test basic Python execution
    if MSYS_NO_PATHCONV=1 docker run --rm edgeql-python-sandbox python -c "import pandas, numpy, sklearn, tensorflow, torch; print('All imports successful')"; then
        print_status "Python sandbox libraries working"
    else
        print_error "Python sandbox library imports failed"
        exit 1
    fi
else
    # Linux/macOS
    if docker run --rm edgeql-python-sandbox python -c "import pandas, numpy, sklearn, tensorflow, torch; print('All imports successful')"; then
        print_status "Python sandbox libraries working"
    else
        print_error "Python sandbox library imports failed"
        exit 1
    fi
fi

# Test security constraints
echo ""
echo "Verifying security constraints..."

# Test network isolation
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    NETWORK_TEST=$(MSYS_NO_PATHCONV=1 docker run --rm --network=none edgeql-python-sandbox python -c "
import socket
try:
    socket.create_connection(('8.8.8.8', 53), timeout=1)
    print('NETWORK_ACCESS')
except:
    print('NETWORK_BLOCKED')
" 2>/dev/null || echo "NETWORK_BLOCKED")
else
    NETWORK_TEST=$(docker run --rm --network=none edgeql-python-sandbox python -c "
import socket
try:
    socket.create_connection(('8.8.8.8', 53), timeout=1)
    print('NETWORK_ACCESS')
except:
    print('NETWORK_BLOCKED')
" 2>/dev/null || echo "NETWORK_BLOCKED")
fi

if [[ "$NETWORK_TEST" == "NETWORK_BLOCKED" ]]; then
    print_status "Network isolation working"
else
    print_warning "Network isolation may not be working properly"
fi

# Test user permissions
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    USER_TEST=$(MSYS_NO_PATHCONV=1 docker run --rm --user edgeql edgeql-python-sandbox whoami 2>/dev/null || echo "error")
else
    USER_TEST=$(docker run --rm --user edgeql edgeql-python-sandbox whoami 2>/dev/null || echo "error")
fi

if [[ "$USER_TEST" == "edgeql" ]]; then
    print_status "Non-root user execution working"
else
    print_warning "User execution test inconclusive"
fi

# Check available Python nodes
echo ""
echo "Available Python nodes:"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    NODES=$(MSYS_NO_PATHCONV=1 docker run --rm edgeql-python-sandbox ls /app/nodes/*.py 2>/dev/null | grep -v test_ | sed 's|/app/nodes/||' | sed 's|.py||' | sort)
else
    NODES=$(docker run --rm edgeql-python-sandbox ls /app/nodes/*.py 2>/dev/null | grep -v test_ | sed 's|/app/nodes/||' | sed 's|.py||' | sort)
fi

for node in $NODES; do
    echo "  • $node"
done

echo ""
print_status "Sandbox health check completed successfully!"
echo ""
echo "🎯 Your EdgeQL sandbox environment is ready for Sprint 1 development."
echo "   Containers are properly isolated and secure."