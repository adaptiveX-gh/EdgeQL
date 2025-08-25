/**
 * Node Logger - Structured logging utility for EdgeQL JavaScript nodes
 * 
 * This module provides a logger that captures console output and formats it
 * for structured logging with node identification and timestamps.
 */

const fs = require('fs');

class NodeLogger {
    /**
     * Structured logger for EdgeQL nodes that captures console output
     * and formats it with node metadata for debugging purposes.
     */
    constructor(nodeId, nodeType) {
        this.nodeId = nodeId;
        this.nodeType = nodeType;
        this.logs = [];
        
        // Capture original console methods for restoration
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            debug: console.debug,
            info: console.info
        };
        
        // Replace console methods to capture all console output
        console.log = (...args) => {
            this.originalConsole.log(...args);
            this._addLogEntry('info', args.join(' '));
        };
        
        console.info = (...args) => {
            this.originalConsole.info(...args);
            this._addLogEntry('info', args.join(' '));
        };
        
        console.warn = (...args) => {
            this.originalConsole.warn(...args);
            this._addLogEntry('warn', args.join(' '));
        };
        
        console.error = (...args) => {
            this.originalConsole.error(...args);
            this._addLogEntry('error', args.join(' '));
        };
        
        console.debug = (...args) => {
            this.originalConsole.debug(...args);
            this._addLogEntry('debug', args.join(' '));
        };
    }
    
    /**
     * Add a structured log entry
     * @param {string} level - Log level (info, warn, error, debug)
     * @param {string} message - Log message
     */
    _addLogEntry(level, message) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            nodeId: this.nodeId,
            nodeType: this.nodeType,
            level: level,
            message: message.toString(),
            source: 'node'
        };
        this.logs.push(logEntry);
    }
    
    /**
     * Log an info message
     * @param {string} message - Message to log
     */
    info(message) {
        this._addLogEntry('info', message);
    }
    
    /**
     * Log a warning message
     * @param {string} message - Message to log
     */
    warn(message) {
        this._addLogEntry('warn', message);
    }
    
    /**
     * Log an error message
     * @param {string} message - Message to log
     */
    error(message) {
        this._addLogEntry('error', message);
    }
    
    /**
     * Log a debug message
     * @param {string} message - Message to log
     */
    debug(message) {
        this._addLogEntry('debug', message);
    }
    
    /**
     * Get all captured log entries
     * @returns {Array} Array of log entries
     */
    getLogs() {
        return this.logs;
    }
    
    /**
     * Restore original console methods
     */
    restoreConsole() {
        console.log = this.originalConsole.log;
        console.info = this.originalConsole.info;
        console.warn = this.originalConsole.warn;
        console.error = this.originalConsole.error;
        console.debug = this.originalConsole.debug;
    }
    
    /**
     * Save captured logs to a JSON file
     * @param {string} logFilePath - Path to save the logs
     */
    saveLogsToFile(logFilePath) {
        try {
            fs.writeFileSync(logFilePath, JSON.stringify(this.logs, null, 2));
        } catch (error) {
            // Use original console.error to report this error
            this.originalConsole.error(`Failed to save logs: ${error.message}`);
        }
    }
}

/**
 * Create a node logger from node configuration
 * @param {Object} config - Node configuration containing nodeType and context
 * @returns {NodeLogger} NodeLogger instance
 */
function createNodeLogger(config) {
    const nodeType = config.nodeType || 'UnknownNode';
    const context = config.context || {};
    const nodeId = context.nodeId || `${nodeType}_${process.pid}`;
    
    return new NodeLogger(nodeId, nodeType);
}

/**
 * Utility function to wrap node execution with logging
 * @param {Object} config - Node configuration
 * @param {Function} nodeFunction - Function to execute with logging
 * @param {string} [logsFile] - Optional path to save logs
 * @returns {Promise} Result of node function execution
 */
async function withNodeLogger(config, nodeFunction, logsFile) {
    const logger = createNodeLogger(config);
    
    try {
        console.log('Starting node execution with structured logging');
        logger.info(`${config.nodeType} initialized`);
        
        const result = await nodeFunction(logger);
        
        logger.info(`${config.nodeType} processing completed`);
        console.log('Node execution completed successfully');
        
        // Save structured logs if logs file is provided
        if (logsFile) {
            logger.saveLogsToFile(logsFile);
        }
        
        return result;
    } catch (error) {
        logger.error(`Node execution failed: ${error.message}`);
        console.error(`Node execution failed: ${error.message}`);
        
        // Still save logs even on error
        if (logsFile) {
            logger.saveLogsToFile(logsFile);
        }
        
        throw error;
    } finally {
        logger.restoreConsole();
    }
}

module.exports = {
    NodeLogger,
    createNodeLogger,
    withNodeLogger
};