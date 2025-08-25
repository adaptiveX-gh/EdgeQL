# Enhanced Node.js Sandbox Environment for EdgeQL JS Nodes
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install minimal system dependencies and remove caches
RUN apk add --no-cache \
    make \
    g++ \
    python3 \
    && npm cache clean --force

# Create non-root user for enhanced security
RUN adduser -D -s /bin/sh -u 1001 edgeql

# Create necessary directories with minimal permissions
RUN mkdir -p /app/nodes /workspace/input /workspace/output \
    && chown -R edgeql:edgeql /app /workspace \
    && chmod 755 /app/nodes \
    && chmod 700 /workspace

# Copy sandbox runner and node implementations
COPY --chown=edgeql:edgeql nodes/js/ ./nodes/

# Switch to non-root user early
USER edgeql

# Set strict environment variables and resource limits
ENV NODE_ENV=sandbox
ENV NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=64"
ENV SANDBOX_MEMORY_MB=512
ENV SANDBOX_TIME_SECONDS=30
ENV SANDBOX_ENABLE_NET=false
ENV SANDBOX_ENABLE_FS=false

# Disable dangerous Node.js features
ENV UV_THREADPOOL_SIZE=1
ENV NODE_DISABLE_COLORS=1

# Health check with restricted permissions
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=2 \
  CMD node -e "console.log('Sandbox ready')" || exit 1

# Entry point uses the enhanced sandbox runner
ENTRYPOINT ["node", "/app/nodes/SandboxRunner.js"]