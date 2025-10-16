/**
 * P2P Client - PeerJSラッパー
 * WebRTC Data Channelを使用したピア間直接通信
 */

import Peer, { DataConnection } from 'peerjs';

export class P2PClient {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private userId: string;
  private onDataCallback: ((data: any, peerId: string) => void) | null = null;
  private onConnectionCallback: ((peerId: string) => void) | null = null;
  private onDisconnectionCallback: ((peerId: string) => void) | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * PeerJS初期化（シグナリングサーバーに接続）
   */
  initialize(signalingServerUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(signalingServerUrl);
        const isSecure = url.protocol === 'wss:' || url.protocol === 'https:';
        const port = url.port || (isSecure ? 443 : 80);

        console.log('🔧 Initializing PeerJS...');
        console.log('🔍 User ID:', this.userId);
        console.log('🔍 Server:', url.hostname, ':', parseInt(port.toString()));
        console.log('🔍 Secure:', isSecure);

        this.peer = new Peer(this.userId, {
          host: url.hostname,
          port: parseInt(port.toString()),
          path: '/peerjs',
          secure: isSecure,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' }, // Google Public STUN
              { urls: 'stun:stun1.l.google.com:19302' }
              // 必要に応じてTURNサーバーを追加
            ]
          },
          debug: 2 // デバッグレベル（0-3）
        });

        this.peer.on('open', (id) => {
          console.log('✅ PeerJS connected with ID:', id);
          this.setupListeners();
          resolve();
        });

        this.peer.on('error', (error) => {
          console.error('❌ PeerJS error:', error);
          reject(error);
        });

        this.peer.on('disconnected', () => {
          console.warn('⚠️ PeerJS disconnected from server');
          // 自動再接続を試みる
          setTimeout(() => {
            if (this.peer && !this.peer.destroyed) {
              console.log('🔄 Attempting to reconnect...');
              this.peer.reconnect();
            }
          }, 3000);
        });
      } catch (error) {
        console.error('Failed to initialize P2P client:', error);
        reject(error);
      }
    });
  }

  /**
   * リスナーをセットアップ
   */
  private setupListeners(): void {
    if (!this.peer) return;

    console.log('👂 Setting up peer listeners for incoming connections');

    // 他のピアからの接続要求を受信
    this.peer.on('connection', (conn) => {
      console.log('📞 Incoming connection from:', conn.peer);
      console.log('🔍 Connection metadata:', conn.metadata);
      this.setupConnection(conn);
    });
  }

  /**
   * 他のピアに接続
   */
  connect(peerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        reject(new Error('Peer not initialized'));
        return;
      }

      // 既に接続済みか確認
      if (this.connections.has(peerId)) {
        console.log('Already connected to:', peerId);
        resolve();
        return;
      }

      console.log('🔌 Connecting to peer:', peerId);
      console.log('🔍 My peer ID:', this.userId);
      console.log('🔍 Peer server:', this.peer?.options.host, this.peer?.options.port);

      const conn = this.peer.connect(peerId, {
        reliable: true, // データの順序保証・再送
        serialization: 'json'
      });

      console.log('⏳ Waiting for connection to open...');

      // タイムアウト処理（30秒）
      const timeout = setTimeout(() => {
        console.error('⏱️ Connection timeout with:', peerId);
        reject(new Error(`Connection timeout: ${peerId}`));
      }, 30000);

      // 接続成功時のハンドラー（一度だけ実行）
      const onOpen = () => {
        clearTimeout(timeout);
        console.log('✅ Connection established with:', peerId);
        resolve();
      };

      // エラーハンドラー
      const onError = (error: Error) => {
        clearTimeout(timeout);
        console.error('❌ Connection error with', peerId, ':', error);
        reject(error);
      };

      conn.on('open', onOpen);
      conn.on('error', onError);

      // 共通のコネクション設定（データ受信など）
      this.setupConnection(conn);
    });
  }

  /**
   * コネクションのイベントハンドラーを設定
   */
  private setupConnection(conn: DataConnection): void {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      console.log(`🔗 Connection opened with: ${conn.peer}`);

      if (this.onConnectionCallback) {
        this.onConnectionCallback(conn.peer);
      }
    });

    conn.on('data', (data) => {
      console.log('📨 Received data from', conn.peer, ':', data);
      if (this.onDataCallback) {
        this.onDataCallback(data, conn.peer);
      }
    });

    conn.on('close', () => {
      console.log('🔌 Connection closed with:', conn.peer);
      this.connections.delete(conn.peer);

      if (this.onDisconnectionCallback) {
        this.onDisconnectionCallback(conn.peer);
      }
    });

    conn.on('error', (error) => {
      console.error('❌ Connection error with', conn.peer, ':', error);
      this.connections.delete(conn.peer);
    });
  }

  /**
   * データを全ピアに送信（ブロードキャスト）
   */
  broadcast(data: any): void {
    console.log('📡 Broadcasting to', this.connections.size, 'connections...');
    console.log('🔍 Connection map:', Array.from(this.connections.keys()));

    let successCount = 0;
    let failCount = 0;

    this.connections.forEach((conn, peerId) => {
      console.log('🔍 Checking connection to', peerId, '- open:', conn.open);
      if (conn.open) {
        try {
          conn.send(data);
          successCount++;
          console.log('📤 Sent data to', peerId);
        } catch (error) {
          console.error('Failed to send to', peerId, ':', error);
          failCount++;
        }
      } else {
        console.warn('⚠️ Connection not open:', peerId);
        failCount++;
      }
    });

    console.log(`📡 Broadcast: ${successCount} success, ${failCount} failed`);

    if (this.connections.size === 0) {
      console.error('❌ No connections available for broadcast!');
      console.log('💡 Make sure both peers have each other\'s IDs in settings');
    }
  }

  /**
   * 特定のピアにデータを送信
   */
  sendTo(peerId: string, data: any): boolean {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      try {
        conn.send(data);
        console.log('📤 Sent data to', peerId);
        return true;
      } catch (error) {
        console.error('Failed to send to', peerId, ':', error);
        return false;
      }
    } else {
      console.warn('Connection not found or not open:', peerId);
      return false;
    }
  }

  /**
   * データ受信時のコールバックを登録
   */
  onData(callback: (data: any, peerId: string) => void): void {
    this.onDataCallback = callback;
  }

  /**
   * ピア接続時のコールバックを登録
   */
  onConnection(callback: (peerId: string) => void): void {
    this.onConnectionCallback = callback;
  }

  /**
   * ピア切断時のコールバックを登録
   */
  onDisconnection(callback: (peerId: string) => void): void {
    this.onDisconnectionCallback = callback;
  }

  /**
   * 接続中のピアIDリストを取得
   */
  getConnectedPeers(): string[] {
    return Array.from(this.connections.keys()).filter((peerId) => {
      const conn = this.connections.get(peerId);
      return conn && conn.open;
    });
  }

  /**
   * 特定のピアとの接続を切断
   */
  disconnectFrom(peerId: string): void {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.close();
      this.connections.delete(peerId);
      console.log('🔌 Disconnected from:', peerId);
    }
  }

  /**
   * 全接続を切断
   */
  disconnect(): void {
    console.log('🔌 Disconnecting all connections...');
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
    console.log('✅ All connections closed');
  }

  /**
   * 接続状態を確認
   */
  isConnected(): boolean {
    return this.peer !== null && !this.peer.destroyed && this.peer.open;
  }

  /**
   * 自分のピアIDを取得
   */
  getMyPeerId(): string | null {
    return this.peer?.id || null;
  }
}
