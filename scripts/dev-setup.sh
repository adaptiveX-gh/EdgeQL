#!/bin/bash

# EdgeQL Development Setup Script
# This script sets up the development environment for the EdgeQL ML Backtesting System

set -e

echo "🚀 EdgeQL ML Backtesting System - Development Setup"
echo "=================================================="

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

echo "✅ pnpm $(pnpm --version) found"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker from https://docker.com/"
    exit 1
fi

echo "✅ Docker $(docker --version | cut -d' ' -f3 | sed 's/,//') found"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please ensure Docker Compose is installed."
    exit 1
fi

echo "✅ Docker Compose available"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Build Docker images
echo ""
echo "🐳 Building Docker sandbox images..."
docker compose build python-sandbox node-sandbox

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p artifacts logs

# Set up Git hooks (if in git repo)
if [ -d ".git" ]; then
    echo ""
    echo "🔧 Setting up Git hooks..."
    # Add pre-commit hook for linting
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit checks..."
pnpm run lint --fix
pnpm run test --run
EOF
    chmod +x .git/hooks/pre-commit
    echo "✅ Git pre-commit hooks installed"
fi

# Run initial tests
echo ""
echo "🧪 Running initial tests..."
if pnpm test --run; then
    echo "✅ All tests passed"
else
    echo "⚠️ Some tests failed - this is normal for initial setup"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Quick Start:"
echo "  pnpm dev                 # Start all services"
echo "  pnpm run web:dev        # Start frontend only (http://localhost:5173)"
echo "  pnpm run api:dev        # Start API only (http://localhost:3001)"
echo "  pnpm test               # Run all tests"
echo ""
echo "Docker commands:"
echo "  pnpm run docker:up      # Start sandbox containers"
echo "  pnpm run docker:down    # Stop containers"
echo ""
echo "Next steps:"
echo "1. Review the README.md for detailed information"
echo "2. Check out the sample pipeline at http://localhost:5173"
echo "3. Explore the DSL syntax in the pipeline editor"
echo ""
echo "Happy coding! 🚀"