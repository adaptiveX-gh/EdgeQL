# Node.js Sandbox Environment for EdgeQL JS Nodes
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install system dependencies for compilation if needed
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN id -u edgeql >/dev/null 2>&1 || useradd --create-home --shell /bin/bash --uid 1001 edgeql

# Install minimal packages for JS execution
RUN npm install -g typescript tsx \
    && npm cache clean --force

# Create necessary directories with proper ownership
RUN mkdir -p /app/nodes /tmp/input /tmp/output \
    && chown -R edgeql:edgeql /app /tmp/input /tmp/output

# Copy node implementations
COPY --chown=edgeql:edgeql nodes/js/ ./nodes/

# Switch to non-root user
USER edgeql

# Set environment variables and resource limits
ENV NODE_ENV=sandbox
ENV NODE_OPTIONS="--max-old-space-size=128"

# Health check to ensure container is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Node.js runtime ready')" || exit 1

# Default command
CMD ["node", "--version"]