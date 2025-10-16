/**
 * WebSocket Broadcast Server
 *
 * Server-relayed message broadcasting for memo synchronization.
 * All messages are relayed through the server to all connected clients.
 */

const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 9000;

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Memo Chat WebSocket Server',
    version: '2.0.0',
    clients: wss.clients.size
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    connectedClients: wss.clients ? wss.clients.size : 0
  });
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
});

// WebSocketサーバーのセットアップ
const wss = new WebSocketServer({ server });

// 接続中のクライアントを管理（ユーザーID -> WebSocket）
const clients = new Map();

wss.on('connection', (ws) => {
  let userId = null;

  console.log('📞 New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      // 接続登録メッセージ
      if (data.type === 'register') {
        userId = data.userId;
        clients.set(userId, ws);
        console.log(`✅ Client registered: ${userId} (Total: ${clients.size})`);

        // 登録確認を送信
        ws.send(JSON.stringify({ type: 'registered', userId }));
        return;
      }

      // 通常のメッセージ：全クライアントにブロードキャスト（送信者以外）
      if (userId) {
        console.log(`📡 Broadcasting message from ${userId} (type: ${data.type})`);

        let broadcastCount = 0;
        clients.forEach((clientWs, clientId) => {
          if (clientId !== userId && clientWs.readyState === 1) { // 1 = OPEN
            clientWs.send(JSON.stringify(data));
            broadcastCount++;
          }
        });

        console.log(`📤 Broadcasted to ${broadcastCount} client(s)`);
      }
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      console.log(`👋 Client disconnected: ${userId} (Remaining: ${clients.size})`);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('✨ Server initialized successfully');
