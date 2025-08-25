#!/usr/bin/env python3
"""
Node Logger - Structured logging utility for EdgeQL Python nodes

This module provides a logger that captures console output and formats it
for structured logging with node identification and timestamps.
"""

import json
import sys
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import os


class NodeLogger:
    """
    Structured logger for EdgeQL nodes that captures console output
    and formats it with node metadata for debugging purposes.
    """
    
    def __init__(self, node_id: str, node_type: str):
        self.node_id = node_id
        self.node_type = node_type
        self.logs = []
        
        # Capture original stdout/stderr for restoration
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        
        # Replace stdout/stderr to capture all print statements
        sys.stdout = self._create_logger_stream('info')
        sys.stderr = self._create_logger_stream('error')
    
    def _create_logger_stream(self, level: str):
        """Create a custom stream that captures output and logs it"""
        class LoggerStream:
            def __init__(self, logger, level, original_stream):
                self.logger = logger
                self.level = level
                self.original_stream = original_stream
                self.buffer = ""
            
            def write(self, text):
                # Write to original stream for immediate visibility
                self.original_stream.write(text)
                
                # Buffer the text until we get a complete line
                self.buffer += text
                if '\n' in self.buffer:
                    lines = self.buffer.split('\n')
                    # Process all complete lines
                    for line in lines[:-1]:
                        if line.strip():  # Only log non-empty lines
                            self.logger._add_log_entry(level, line.strip())
                    # Keep the last incomplete line in buffer
                    self.buffer = lines[-1]
            
            def flush(self):
                self.original_stream.flush()
                # Log any remaining buffer content
                if self.buffer.strip():
                    self.logger._add_log_entry(self.level, self.buffer.strip())
                    self.buffer = ""
        
        return LoggerStream(self, level, 
                          self.original_stdout if level == 'info' else self.original_stderr)
    
    def _add_log_entry(self, level: str, message: str):
        """Add a structured log entry"""
        log_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'nodeId': self.node_id,
            'nodeType': self.node_type,
            'level': level,
            'message': message,
            'source': 'node'
        }
        self.logs.append(log_entry)
    
    def info(self, message: str):
        """Log an info message"""
        self._add_log_entry('info', message)
    
    def warn(self, message: str):
        """Log a warning message"""
        self._add_log_entry('warn', message)
    
    def error(self, message: str):
        """Log an error message"""
        self._add_log_entry('error', message)
    
    def debug(self, message: str):
        """Log a debug message"""
        self._add_log_entry('debug', message)
    
    def get_logs(self) -> list:
        """Get all captured log entries"""
        return self.logs
    
    def restore_streams(self):
        """Restore original stdout/stderr"""
        # Flush any remaining buffer content
        sys.stdout.flush()
        sys.stderr.flush()
        
        # Restore original streams
        sys.stdout = self.original_stdout
        sys.stderr = self.original_stderr
    
    def save_logs_to_file(self, log_file_path: str):
        """Save captured logs to a JSON file"""
        try:
            with open(log_file_path, 'w') as f:
                json.dump(self.logs, f, indent=2)
        except Exception as e:
            # Use original stderr to report this error
            self.original_stderr.write(f"Failed to save logs: {str(e)}\n")


def create_node_logger(config: Dict[str, Any]) -> NodeLogger:
    """
    Create a node logger from node configuration
    
    Args:
        config: Node configuration containing nodeType and context
        
    Returns:
        NodeLogger instance
    """
    node_type = config.get('nodeType', 'UnknownNode')
    context = config.get('context', {})
    node_id = context.get('nodeId', f"{node_type}_{os.getpid()}")
    
    return NodeLogger(node_id, node_type)


# Context manager for easy usage
class NodeLoggerContext:
    """Context manager for node logger to ensure cleanup"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = None
    
    def __enter__(self) -> NodeLogger:
        self.logger = create_node_logger(self.config)
        return self.logger
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.logger:
            self.logger.restore_streams()