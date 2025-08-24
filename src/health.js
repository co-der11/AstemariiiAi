const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Add basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for Render
app.get('/health', async (req, res) => {
  try {
    // Check MongoDB connection with detailed status
    const dbState = mongoose.connection.readyState;
    let dbStatus, dbDetails;
    
    switch(dbState) {
      case 0: // disconnected
        dbStatus = 'disconnected';
        dbDetails = 'MongoDB is not connected';
        break;
      case 1: // connected
        dbStatus = 'connected';
        dbDetails = 'MongoDB is connected and ready';
        break;
      case 2: // connecting
        dbStatus = 'connecting';
        dbDetails = 'MongoDB is attempting to connect';
        break;
      case 3: // disconnecting
        dbStatus = 'disconnecting';
        dbDetails = 'MongoDB is disconnecting';
        break;
      default:
        dbStatus = 'unknown';
        dbDetails = 'MongoDB connection state is unknown';
    }
    
    res.json({
      status: dbState === 1 ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        details: dbDetails,
        state: dbState,
        host: mongoose.connection.host || 'unknown',
        port: mongoose.connection.port || 'unknown',
        name: mongoose.connection.name || 'unknown'
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      troubleshooting: {
        mongodb_ip_whitelist: 'Check if your current IP is whitelisted in MongoDB Atlas',
        mongodb_credentials: 'Verify your MongoDB username and password',
        network_connectivity: 'Ensure your server can reach MongoDB Atlas servers',
        mongodb_cluster: 'Verify your MongoDB Atlas cluster is running'
      }
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Student Helper Bot is running!',
    status: 'active',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Simple health check for Render
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

module.exports = { app, PORT };
