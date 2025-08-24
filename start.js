#!/usr/bin/env node

// Startup script for Render deployment
const { spawn } = require('child_process');
const logger = require('./src/utils/logger');

// Set default port if not provided
if (!process.env.PORT) {
  process.env.PORT = 3000;
}

logger.info(`🚀 Starting Student Helper Bot on port ${process.env.PORT}`);
logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

// Start the main application
const child = spawn('node', ['src/index.js'], {
  stdio: 'inherit',
  env: process.env
});

child.on('error', (error) => {
  logger.error('❌ Failed to start application:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  logger.info(`📤 Application exited with code ${code}`);
  process.exit(code);
});

// Handle process signals
process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down...');
  child.kill('SIGTERM');
});
