/**
 * WebSocket Client - サーバー経由ブロードキャスト
 * WebSocketを使用してサーバー経由で全クライアントにメッセージを送信
 */

export class P2PClient {
  private ws: WebSocket | null = null;
  private userId: string;
  private serverUrl: string = '';
  private onDataCallback: ((data: any, peerId: string) => void) | null = null;
  private onConnectionCallback: ((peerId: string) => void) | null = null;
  private reconnectTimer: number | null = null;
  private isIntentionalClose: boolean = false;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * WebSocketサーバーに接続
   */
  initialize(signalingServerUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(signalingServerUrl);
        // HTTPSの場合はWSS、HTTPの場合はWS
        const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        this.serverUrl = `${protocol}//${url.host}`;

        console.log('🔧 Initializing WebSocket Client...');
        console.log('🔍 User ID:', this.userId);
        console.log('🔍 Server:', this.serverUrl);

        this.connectToServer(resolve, reject);
      } catch (error) {
        console.error('Failed to initialize WebSocket client:', error);
        reject(error);
      }
    });
  }

  /**
   * WebSocket接続を確立
   */
  private connectToServer(resolve?: () => void, reject?: (error: Error) => void): void {
    this.ws = new WebSocket(this.serverUrl);

    this.ws.onopen = () => {
      console.log('✅ [WS OPEN] WebSocket connected to server');

      // サーバーに登録
      this.ws!.send(JSON.stringify({
        type: 'register',
        userId: this.userId
      }));

      if (resolve) resolve();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // 登録確認
        if (data.type === 'registered') {
          console.log('✅ [REGISTERED] Registered with server as:', data.userId);
          // 接続完了コールバックを呼び出し（初期同期のため）
          if (this.onConnectionCallback) {
            console.log('🔔 Calling onConnection callback for initial sync');
            this.onConnectionCallback(data.userId);
          }
          return;
        }

        // メッセージ受信
        console.log('📨 [MESSAGE] Received from server:', data.type);
        if (this.onDataCallback) {
          // peerIdとして送信者のuserIdを渡す（互換性のため）
          this.onDataCallback(data, data.senderId || 'server');
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ [WS ERROR] WebSocket error:', error);
      if (reject) reject(new Error('WebSocket connection failed'));
    };

    this.ws.onclose = () => {
      console.warn('⚠️ [WS CLOSED] WebSocket connection closed');

      // 意図的なクローズでなければ再接続
      if (!this.isIntentionalClose) {
        console.log('🔄 [RECONNECTING] Attempting to reconnect in 3 seconds...');
        this.reconnectTimer = window.setTimeout(() => {
          this.connectToServer();
        }, 3000);
      }
    };
  }

  /**
   * 他のピアに接続（WebSocket版では何もしない - サーバー経由のため不要）
   */
  connect(_peerId: string): Promise<void> {
    console.log('🔍 [INFO] Server-relay mode: peer connections not needed');
    return Promise.resolve();
  }

  /**
   * データを全ピアに送信（ブロードキャスト）
   */
  broadcast(data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket not connected');
      return;
    }

    try {
      // senderIdを追加してサーバーに送信
      const message = {
        ...data,
        senderId: this.userId
      };

      this.ws.send(JSON.stringify(message));
      console.log('📤 [BROADCAST] Sent to server:', data.type);
    } catch (error) {
      console.error('❌ Failed to broadcast:', error);
    }
  }

  /**
   * 特定のピアにデータを送信（WebSocket版ではbroadcastと同じ）
   */
  sendTo(_peerId: string, data: any): boolean {
    this.broadcast(data);
    return true;
  }

  /**
   * データ受信時のコールバックを登録
   */
  onData(callback: (data: any, peerId: string) => void): void {
    this.onDataCallback = callback;
  }

  /**
   * サーバー接続完了時のコールバックを登録
   */
  onConnection(callback: (peerId: string) => void): void {
    this.onConnectionCallback = callback;
  }

  /**
   * ピア切断時のコールバックを登録（互換性のため残す - WebSocket版では使用しない）
   */
  onDisconnection(_callback: (peerId: string) => void): void {
    // WebSocket版では不要
  }

  /**
   * 接続中のピアIDリストを取得（WebSocket版では常に空配列）
   */
  getConnectedPeers(): string[] {
    return [];
  }

  /**
   * 全接続を切断
   */
  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    this.isIntentionalClose = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    console.log('✅ WebSocket disconnected');
  }

  /**
   * 接続状態を確認
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 自分のピアIDを取得
   */
  getMyPeerId(): string | null {
    return this.userId;
  }
}
