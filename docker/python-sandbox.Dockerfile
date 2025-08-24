# Python Sandbox Environment for EdgeQL ML Nodes
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for ML libraries
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libc6-dev \
    libhdf5-dev \
    libopenblas-dev \
    liblapack-dev \
    gfortran \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for ML libraries
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=utf-8
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV TORCH_HOME=/tmp/torch

# Copy requirements and install Python packages
COPY nodes/python/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# Create non-root user for security
RUN id -u edgeql >/dev/null 2>&1 || useradd --create-home --shell /bin/bash --uid 1001 edgeql

# Create necessary directories with proper ownership
RUN mkdir -p /app/nodes /tmp/input /tmp/output /tmp/torch \
    && chown -R edgeql:edgeql /app /tmp/input /tmp/output /tmp/torch

# Copy node implementations
COPY --chown=edgeql:edgeql nodes/python/ ./nodes/

# Switch to non-root user
USER edgeql

# Security: Prevent privilege escalation
RUN mkdir -p /home/edgeql/.local

# Health check to ensure container is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import pandas, numpy, sklearn, tensorflow, torch; print('All imports successful')" || exit 1

# Default command (will be overridden by executor)
CMD ["python", "--version"]