/**
 * P2P Sync Manager
 * メモ・ハイライト・描画のP2P同期を管理
 */

import { P2PClient } from './p2p-client';
import { StorageManager } from './storage';
import { Memo, Highlight, Drawing, SharedMemo, SharedHighlight, SharedDrawing, Settings } from './types';
import { normalizeUrl } from './utils';

// P2Pメッセージの型定義
interface P2PMessage {
  type: 'sync:initial' | 'memo:create' | 'memo:update' | 'memo:delete' |
        'highlight:create' | 'highlight:delete' | 'drawing:create' | 'drawing:delete';
  data: any;
}

export class P2PSyncManager {
  private p2pClient: P2PClient;
  private settings: Settings | null = null;
  private userId: string;
  private currentUrl: string;
  private pendingInitialSyncPeers: Set<string> = new Set(); // 設定ロード前に接続したピア

  constructor(userId: string) {
    this.userId = userId;
    this.p2pClient = new P2PClient(userId);
    this.currentUrl = window.location.href;
  }

  /**
   * 初期化
   */
  async initialize(signalingServerUrl: string): Promise<void> {
    try {
      // P2P接続を確立
      await this.p2pClient.initialize(signalingServerUrl);

      // データ受信リスナーを先にセットアップ（設定取得前に登録してデータ消失を防ぐ）
      this.setupDataListeners();

      // 設定を取得（非同期処理で時間がかかる可能性がある）
      this.settings = await StorageManager.getSettings();

      // 設定ロード前に接続したピアに初期同期を送信
      if (this.pendingInitialSyncPeers.size > 0) {
        console.log(`🔄 Sending pending initial syncs to ${this.pendingInitialSyncPeers.size} peer(s)...`);
        for (const peerId of this.pendingInitialSyncPeers) {
          await this.sendInitialSync(peerId);
        }
        this.pendingInitialSyncPeers.clear();
      }

      console.log('✅ P2P sync manager initialized');
    } catch (error) {
      console.error('Failed to initialize P2P sync manager:', error);
      throw error;
    }
  }

  /**
   * 共有相手に接続
   */
  async connectToPeer(peerId: string): Promise<void> {
    try {
      await this.p2pClient.connect(peerId);
      console.log(`✅ Connected to peer: ${peerId}`);

      // 接続後、現在のURLの全データを送信（初期同期）
      await this.sendInitialSync(peerId);
    } catch (error) {
      console.error(`Failed to connect to peer ${peerId}:`, error);
      throw error;
    }
  }

  /**
   * 初期同期データを送信
   */
  private async sendInitialSync(peerId: string): Promise<void> {
    if (!this.settings) {
      console.warn(`⚠️ Settings not loaded, buffering initial sync for ${peerId}`);
      this.pendingInitialSyncPeers.add(peerId);
      return;
    }

    try {
      console.log(`📦 Preparing initial sync for ${peerId}...`);
      const memos = await StorageManager.getMemosForUrl(this.currentUrl, this.settings);
      const highlights = await StorageManager.getHighlightsForUrl(this.currentUrl, this.settings);
      const drawings = await StorageManager.getDrawingsForUrl(this.currentUrl, this.settings);

      console.log(`📊 Initial sync data: ${memos.length} memos, ${highlights.length} highlights, ${drawings.length} drawings`);

      const message: P2PMessage = {
        type: 'sync:initial',
        data: {
          url: this.currentUrl,
          memos: memos.map(m => ({ ...m, ownerId: this.userId })),
          highlights: highlights.map(h => ({ ...h, ownerId: this.userId })),
          drawings: drawings.map(d => ({ ...d, ownerId: this.userId }))
        }
      };

      this.p2pClient.sendTo(peerId, message);
      console.log(`📤 Sent initial sync to ${peerId} (URL: ${this.currentUrl})`);
    } catch (error) {
      console.error('Failed to send initial sync:', error);
    }
  }

  /**
   * データ受信リスナー
   */
  private setupDataListeners(): void {
    this.p2pClient.onData((data: P2PMessage, peerId) => {
      console.log(`📨 Received message from ${peerId}:`, data);

      try {
        switch (data.type) {
          case 'sync:initial':
            this.handleInitialSync(data.data);
            break;

          case 'memo:create':
            this.handleMemoCreate(data.data, peerId);
            break;

          case 'memo:update':
            this.handleMemoUpdate(data.data, peerId);
            break;

          case 'memo:delete':
            this.handleMemoDelete(data.data);
            break;

          case 'highlight:create':
            this.handleHighlightCreate(data.data, peerId);
            break;

          case 'highlight:delete':
            this.handleHighlightDelete(data.data);
            break;

          case 'drawing:create':
            this.handleDrawingCreate(data.data, peerId);
            break;

          case 'drawing:delete':
            this.handleDrawingDelete(data.data);
            break;

          default:
            console.warn('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error handling P2P message:', error);
      }
    });

    // 接続イベント
    this.p2pClient.onConnection((peerId) => {
      console.log(`🔗 Peer connected: ${peerId}`);
      // 新しいピアが接続したら初期同期を送信
      this.sendInitialSync(peerId);
    });

    // 切断イベント
    this.p2pClient.onDisconnection((peerId) => {
      console.log(`🔌 Peer disconnected: ${peerId}`);
    });
  }

  /**
   * 初期同期データを処理
   */
  private handleInitialSync(data: any): void {
    const { url, memos, highlights, drawings } = data;

    console.log('🎯 Handling initial sync');
    console.log('📍 Sync URL:', url);
    console.log('📍 Current URL:', this.currentUrl);

    // URL正規化して比較（removeQueryParams設定を考慮）
    let urlsMatch = false;
    if (this.settings) {
      const removeQuery = this.settings.removeQueryParams;
      const normalizedSyncUrl = normalizeUrl(url, removeQuery);
      const normalizedCurrentUrl = normalizeUrl(this.currentUrl, removeQuery);
      urlsMatch = normalizedSyncUrl === normalizedCurrentUrl;
      console.log('📍 Using settings removeQueryParams:', removeQuery);
      console.log('📍 Normalized Sync URL:', normalizedSyncUrl);
      console.log('📍 Normalized Current URL:', normalizedCurrentUrl);
    } else {
      // 設定未ロード時は両方のパターンを試行
      const matchWithQuery = normalizeUrl(url, false) === normalizeUrl(this.currentUrl, false);
      const matchWithoutQuery = normalizeUrl(url, true) === normalizeUrl(this.currentUrl, true);
      urlsMatch = matchWithQuery || matchWithoutQuery;
      console.log('⚠️ Settings not yet loaded, trying both URL patterns');
      console.log('📍 Match with query:', matchWithQuery);
      console.log('📍 Match without query:', matchWithoutQuery);
    }

    console.log('📍 URLs match:', urlsMatch);
    console.log('📊 Data:', memos.length, 'memos,', highlights.length, 'highlights,', drawings.length, 'drawings');

    // 現在のURLと一致する場合のみ表示
    if (urlsMatch) {
      console.log('📢 Dispatching p2p:initial-sync event');
      window.dispatchEvent(new CustomEvent('p2p:initial-sync', {
        detail: { memos, highlights, drawings }
      }));
    } else {
      console.log('⏭️ Skipping initial sync (URL mismatch)');
    }
  }

  /**
   * メモ作成を処理
   */
  private handleMemoCreate(memo: Memo, peerId: string): void {
    console.log('🎯 Handling memo create from', peerId);
    console.log('📍 Memo URL:', memo.url);
    console.log('📍 Current URL:', this.currentUrl);

    // URL正規化して比較（removeQueryParams設定を考慮）
    let urlsMatch = false;
    if (this.settings) {
      const removeQuery = this.settings.removeQueryParams;
      const normalizedMemoUrl = normalizeUrl(memo.url, removeQuery);
      const normalizedCurrentUrl = normalizeUrl(this.currentUrl, removeQuery);
      urlsMatch = normalizedMemoUrl === normalizedCurrentUrl;
      console.log('📍 Using settings removeQueryParams:', removeQuery);
      console.log('📍 Normalized Memo URL:', normalizedMemoUrl);
      console.log('📍 Normalized Current URL:', normalizedCurrentUrl);
    } else {
      // 設定未ロード時は両方のパターンを試行
      const matchWithQuery = normalizeUrl(memo.url, false) === normalizeUrl(this.currentUrl, false);
      const matchWithoutQuery = normalizeUrl(memo.url, true) === normalizeUrl(this.currentUrl, true);
      urlsMatch = matchWithQuery || matchWithoutQuery;
      console.log('⚠️ Settings not yet loaded, trying both URL patterns');
      console.log('📍 Match with query:', matchWithQuery);
      console.log('📍 Match without query:', matchWithoutQuery);
    }

    console.log('📍 URLs match:', urlsMatch);

    // 現在のURLと一致する場合のみ表示
    if (urlsMatch) {
      const sharedMemo: SharedMemo = { ...memo, ownerId: peerId };
      console.log('📢 Dispatching p2p:memo-created event', sharedMemo);
      window.dispatchEvent(new CustomEvent('p2p:memo-created', {
        detail: sharedMemo
      }));
    } else {
      console.log('⏭️ Skipping memo (URL mismatch)');
    }
  }

  /**
   * メモ更新を処理
   */
  private handleMemoUpdate(memo: Memo, peerId: string): void {
    console.log('🎯 Handling memo update from', peerId);
    console.log('📍 Memo URL:', memo.url);
    console.log('📍 Current URL:', this.currentUrl);

    // URL正規化して比較（removeQueryParams設定を考慮）
    let urlsMatch = false;
    if (this.settings) {
      const removeQuery = this.settings.removeQueryParams;
      const normalizedMemoUrl = normalizeUrl(memo.url, removeQuery);
      const normalizedCurrentUrl = normalizeUrl(this.currentUrl, removeQuery);
      urlsMatch = normalizedMemoUrl === normalizedCurrentUrl;
      console.log('📍 Using settings removeQueryParams:', removeQuery);
      console.log('📍 Normalized Memo URL:', normalizedMemoUrl);
      console.log('📍 Normalized Current URL:', normalizedCurrentUrl);
    } else {
      // 設定未ロード時は両方のパターンを試行
      const matchWithQuery = normalizeUrl(memo.url, false) === normalizeUrl(this.currentUrl, false);
      const matchWithoutQuery = normalizeUrl(memo.url, true) === normalizeUrl(this.currentUrl, true);
      urlsMatch = matchWithQuery || matchWithoutQuery;
      console.log('⚠️ Settings not yet loaded, trying both URL patterns');
      console.log('📍 Match with query:', matchWithQuery);
      console.log('📍 Match without query:', matchWithoutQuery);
    }

    console.log('📍 URLs match:', urlsMatch);

    // 現在のURLと一致する場合のみ表示
    if (urlsMatch) {
      const sharedMemo: SharedMemo = { ...memo, ownerId: peerId };
      console.log('📢 Dispatching p2p:memo-updated event', sharedMemo);
      window.dispatchEvent(new CustomEvent('p2p:memo-updated', {
        detail: sharedMemo
      }));
    } else {
      console.log('⏭️ Skipping memo update (URL mismatch)');
    }
  }

  /**
   * メモ削除を処理
   */
  private handleMemoDelete(data: { memoId: string, url: string }): void {
    window.dispatchEvent(new CustomEvent('p2p:memo-deleted', {
      detail: data
    }));
  }

  /**
   * ハイライト作成を処理
   */
  private handleHighlightCreate(highlight: Highlight, peerId: string): void {
    const sharedHighlight: SharedHighlight = { ...highlight, ownerId: peerId };
    window.dispatchEvent(new CustomEvent('p2p:highlight-created', {
      detail: sharedHighlight
    }));
  }

  /**
   * ハイライト削除を処理
   */
  private handleHighlightDelete(data: { highlightId: string, url: string }): void {
    window.dispatchEvent(new CustomEvent('p2p:highlight-deleted', {
      detail: data
    }));
  }

  /**
   * 描画作成を処理
   */
  private handleDrawingCreate(drawing: Drawing, peerId: string): void {
    const sharedDrawing: SharedDrawing = { ...drawing, ownerId: peerId };
    window.dispatchEvent(new CustomEvent('p2p:drawing-created', {
      detail: sharedDrawing
    }));
  }

  /**
   * 描画削除を処理
   */
  private handleDrawingDelete(data: { drawingId: string, url: string }): void {
    window.dispatchEvent(new CustomEvent('p2p:drawing-deleted', {
      detail: data
    }));
  }

  /**
   * メモ作成をブロードキャスト
   */
  async broadcastMemoCreate(memo: Memo): Promise<void> {
    if (!this.settings) return;

    try {
      // ローカルに保存
      await StorageManager.saveMemo(memo, this.settings);

      // 全ピアに送信
      const message: P2PMessage = {
        type: 'memo:create',
        data: memo
      };
      this.p2pClient.broadcast(message);
      console.log('📤 Broadcasted memo:create');
    } catch (error) {
      console.error('Failed to broadcast memo create:', error);
      throw error;
    }
  }

  /**
   * メモ更新をブロードキャスト
   */
  async broadcastMemoUpdate(memo: Memo): Promise<void> {
    if (!this.settings) return;

    try {
      await StorageManager.saveMemo(memo, this.settings);

      const message: P2PMessage = {
        type: 'memo:update',
        data: memo
      };
      this.p2pClient.broadcast(message);
      console.log('📤 Broadcasted memo:update');
    } catch (error) {
      console.error('Failed to broadcast memo update:', error);
      throw error;
    }
  }

  /**
   * メモ削除をブロードキャスト
   */
  async broadcastMemoDelete(memoId: string, url: string): Promise<void> {
    if (!this.settings) return;

    try {
      await StorageManager.deleteMemo(memoId, url, this.settings);

      const message: P2PMessage = {
        type: 'memo:delete',
        data: { memoId, url }
      };
      this.p2pClient.broadcast(message);
      console.log('📤 Broadcasted memo:delete');
    } catch (error) {
      console.error('Failed to broadcast memo delete:', error);
      throw error;
    }
  }

  /**
   * ハイライト作成をブロードキャスト
   */
  async broadcastHighlightCreate(highlight: Highlight): Promise<void> {
    if (!this.settings) return;

    try {
      await StorageManager.saveHighlight(highlight, this.settings);

      const message: P2PMessage = {
        type: 'highlight:create',
        data: highlight
      };
      this.p2pClient.broadcast(message);
      console.log('📤 Broadcasted highlight:create');
    } catch (error) {
      console.error('Failed to broadcast highlight create:', error);
      throw error;
    }
  }

  /**
   * ハイライト削除をブロードキャスト
   */
  async broadcastHighlightDelete(highlightId: string, url: string): Promise<void> {
    if (!this.settings) return;

    try {
      await StorageManager.deleteHighlight(highlightId, url, this.settings);

      const message: P2PMessage = {
        type: 'highlight:delete',
        data: { highlightId, url }
      };
      this.p2pClient.broadcast(message);
      console.log('📤 Broadcasted highlight:delete');
    } catch (error) {
      console.error('Failed to broadcast highlight delete:', error);
      throw error;
    }
  }

  /**
   * 描画作成をブロードキャスト
   */
  async broadcastDrawingCreate(drawing: Drawing): Promise<void> {
    if (!this.settings) return;

    try {
      await StorageManager.saveDrawing(drawing, this.settings);

      const message: P2PMessage = {
        type: 'drawing:create',
        data: drawing
      };
      this.p2pClient.broadcast(message);
      console.log('📤 Broadcasted drawing:create');
    } catch (error) {
      console.error('Failed to broadcast drawing create:', error);
      throw error;
    }
  }

  /**
   * 描画削除をブロードキャスト
   */
  async broadcastDrawingDelete(drawingId: string, url: string): Promise<void> {
    if (!this.settings) return;

    try {
      await StorageManager.deleteDrawing(drawingId, url, this.settings);

      const message: P2PMessage = {
        type: 'drawing:delete',
        data: { drawingId, url }
      };
      this.p2pClient.broadcast(message);
      console.log('📤 Broadcasted drawing:delete');
    } catch (error) {
      console.error('Failed to broadcast drawing delete:', error);
      throw error;
    }
  }

  /**
   * 接続中のピア一覧を取得
   */
  getConnectedPeers(): string[] {
    return this.p2pClient.getConnectedPeers();
  }

  /**
   * 自分のピアIDを取得
   */
  getMyPeerId(): string | null {
    return this.p2pClient.getMyPeerId();
  }

  /**
   * 接続状態を確認
   */
  isConnected(): boolean {
    return this.p2pClient.isConnected();
  }

  /**
   * 切断
   */
  disconnect(): void {
    this.p2pClient.disconnect();
    console.log('✅ P2P sync manager disconnected');
  }
}
