/**
 * PeerJS Signaling Server
 *
 * Lightweight WebRTC signaling server for P2P connections.
 * This server only handles peer discovery and connection setup.
 * Actual data transfer happens directly between peers (P2P).
 */

const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
const PORT = process.env.PORT || 9000;

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Memo Chat Signaling Server',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
  console.log(`📡 PeerJS endpoint: http://localhost:${PORT}/peerjs`);
});

// Setup PeerJS signaling server
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/',
  allow_discovery: true, // Allow peer discovery
  // Security options
  corsOptions: {
    origin: '*', // Allow Chrome extension origins
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// PeerJS event handlers
peerServer.on('connection', (client) => {
  console.log(`✅ Peer connected: ${client.id}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`❌ Peer disconnected: ${client.id}`);
});

// Mount PeerJS server
app.use('/peerjs', peerServer);

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('✨ Server initialized successfully');
