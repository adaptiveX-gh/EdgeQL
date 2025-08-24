-- EdgeQL Database Initialization Script
-- This will be used in future sprints when we implement persistent storage

-- Pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dsl TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'ready',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255)
);

-- Pipeline runs table  
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id VARCHAR(255) PRIMARY KEY,
    pipeline_id VARCHAR(255) REFERENCES pipelines(id),
    status VARCHAR(50) DEFAULT 'pending',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    results JSONB,
    logs TEXT[],
    error TEXT
);

-- Custom nodes table
CREATE TABLE IF NOT EXISTS custom_nodes (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    language VARCHAR(50) NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    input_schema JSONB,
    output_schema JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255)
);

-- Datasets table
CREATE TABLE IF NOT EXISTS datasets (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    size BIGINT,
    columns TEXT[],
    row_count INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255)
);

-- Users table (for future auth implementation)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'developer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_pipeline_id ON pipeline_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_nodes_user_id ON custom_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);