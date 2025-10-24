/**
 * メモ管理ロジック
 */

import { Memo, Settings, DEFAULT_STYLE, SharedMemo } from '../shared/types';
import { StorageManager } from '../shared/storage';
import { generateId, getCurrentTimestamp, debounce, generateSelector } from '../shared/utils';
import { CSS_CLASSES, Z_INDEX, DEBOUNCE_TIME } from '../shared/constants';
import { MemoComponent } from './MemoComponent';
import { P2PSyncManager } from '../shared/p2p-sync-manager';
import { UserManager } from '../shared/user-manager';

type MemoCreationPoint = {
  pageX: number;
  pageY: number;
  clientX: number;
  clientY: number;
  target?: HTMLElement | null;
};

export class MemoManager {
  private memos: Map<string, MemoComponent> = new Map();
  private settings: Settings;
  private createMode: boolean = false;
  private currentUrl: string;
  private nextZIndex: number = Z_INDEX.MIN;
  private createModeClickHandler: ((e: MouseEvent) => void) | null = null;
  private createModeCancelHandler: ((e: KeyboardEvent) => void) | null = null;
  private lastContextMenuData: MemoCreationPoint | null = null;
  // P2P共有用
  private p2pSyncManager: P2PSyncManager | null = null;
  private sharedMemos: Map<string, MemoComponent> = new Map(); // 他ユーザーのメモ
  private reconnectionTimers: Map<string, number> = new Map(); // ピアIDごとの再接続タイマー
  private onP2PInitializedCallback: ((p2pManager: P2PSyncManager) => void) | null = null;

  constructor() {
    this.currentUrl = window.location.href;
    this.settings = {} as Settings;
    this.init();
  }

  /**
   * P2P初期化完了時のコールバックを登録
   */
  onP2PInitialized(callback: (p2pManager: P2PSyncManager) => void): void {
    this.onP2PInitializedCallback = callback;
    // 既に初期化済みの場合は即座にコールバックを呼び出し
    if (this.p2pSyncManager) {
      callback(this.p2pSyncManager);
    }
  }

  /**
   * 初期化
   */
  private async init(): Promise<void> {
    try {
      // 設定を読み込み
      this.settings = await StorageManager.getSettings();

      // 機能が無効な場合は何もしない
      if (!this.settings.enabled) {
        return;
      }

      // 保存されているメモを読み込み
      await this.loadMemos();

      // ストレージの変更を監視
      this.setupStorageListener();

      // メッセージリスナーを設定
      this.setupMessageListener();

      // 右クリック位置を保存
      this.setupContextMenuListener();

      // ページ離脱時に未保存のメモを保存
      this.setupBeforeUnloadListener();

      // ウィンドウリサイズの監視
      this.setupResizeListener();

      // P2P共有が有効な場合、初期化
      if (this.settings.sharingEnabled) {
        await this.initializeP2PSync();
      }

      // P2Pイベントリスナーをセットアップ
      this.setupP2PListeners();

      console.log('MemoManager initialized');
    } catch (error) {
      console.error('Failed to initialize MemoManager:', error);
    }
  }

  /**
   * P2P同期を初期化
   */
  private async initializeP2PSync(): Promise<void> {
    try {
      const userId = await UserManager.getUserId();
      this.p2pSyncManager = new P2PSyncManager(userId);

      await this.p2pSyncManager.initialize(this.settings.signalingServer);

      // 共有相手に接続（ID比較で片側のみが接続を試みる - 競合回避）
      const sharedPeers = this.settings.sharedPeers || [];
      console.log('🔗 Attempting to connect to', sharedPeers.length, 'peers:', sharedPeers);
      console.log('🔍 My peer ID:', userId);

      // IDが小さい方だけが接続を試みる（競合回避）
      for (const peerId of sharedPeers) {
        if (userId < peerId) {
          console.log('🔌 My ID is smaller, initiating connection to:', peerId);
          try {
            await this.p2pSyncManager.connectToPeer(peerId);
            console.log('✅ Successfully connected to:', peerId);
          } catch (error) {
            console.error('❌ Failed to connect to peer:', peerId, error);
            // 即座に定期的な再接続をスケジュール
            console.log('⏰ Scheduling periodic reconnection...');
            this.schedulePeriodicReconnection(peerId);
          }
        } else {
          console.log('⏸️ My ID is larger, waiting for incoming connection from:', peerId);
          // 待機側も一定時間後に接続されていなければ接続を試みる（フォールバック）
          setTimeout(() => {
            if (!this.p2pSyncManager) return;
            const connectedPeers = this.p2pSyncManager.getConnectedPeers();
            if (!connectedPeers.includes(peerId)) {
              console.log(`⚠️ No connection from ${peerId} after 15 seconds, initiating fallback connection...`);
              this.schedulePeriodicReconnection(peerId);
            }
          }, 15000);
        }
      }

      // デバッグ用：接続状態を確認
      const connectedPeers = this.p2pSyncManager.getConnectedPeers();
      console.log('✅ P2P sync initialized. Connected to', connectedPeers.length, 'peers:', connectedPeers);

      // グローバルにデバッグ情報を公開
      (window as any).p2pDebug = {
        getConnectedPeers: () => this.p2pSyncManager?.getConnectedPeers(),
        isConnected: () => this.p2pSyncManager?.isConnected(),
        getMyPeerId: () => this.p2pSyncManager?.getMyPeerId()
      };

      // P2P初期化完了コールバックを呼び出し
      if (this.onP2PInitializedCallback && this.p2pSyncManager) {
        console.log('🔔 Calling P2P initialized callback');
        this.onP2PInitializedCallback(this.p2pSyncManager);
      }
    } catch (error) {
      console.error('Failed to initialize P2P sync:', error);
    }
  }

  /**
   * 定期的な再接続をスケジュール（エクスポネンシャルバックオフ）
   */
  private schedulePeriodicReconnection(peerId: string, attempt: number = 1): void {
    // 既存のタイマーをクリア
    const existingTimer = this.reconnectionTimers.get(peerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // エクスポネンシャルバックオフ: 10秒, 20秒, 40秒, ... 最大60秒
    const baseDelay = 10000; // 10秒
    const maxDelay = 60000; // 60秒
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    console.log(`⏰ Scheduling reconnection to ${peerId} in ${delay / 1000} seconds (attempt ${attempt})...`);

    const timer = window.setTimeout(async () => {
      if (!this.p2pSyncManager) {
        console.log('⚠️ P2P manager no longer exists, canceling reconnection');
        return;
      }

      // 既に接続済みかチェック
      const connectedPeers = this.p2pSyncManager.getConnectedPeers();
      if (connectedPeers.includes(peerId)) {
        console.log(`✅ Already connected to ${peerId}, canceling scheduled reconnection`);
        this.reconnectionTimers.delete(peerId);
        return;
      }

      console.log(`🔌 Attempting scheduled reconnection to ${peerId} (attempt ${attempt})...`);
      try {
        await this.p2pSyncManager.connectToPeer(peerId);
        console.log(`✅ Reconnection successful: ${peerId}`);
        this.reconnectionTimers.delete(peerId);
      } catch (error) {
        console.error(`❌ Reconnection failed for ${peerId}:`, error);
        // 次の試行をスケジュール
        this.schedulePeriodicReconnection(peerId, attempt + 1);
      }
    }, delay);

    this.reconnectionTimers.set(peerId, timer);
  }

  /**
   * P2Pイベントリスナーをセットアップ
   */
  private setupP2PListeners(): void {
    console.log('🎧 Setting up P2P event listeners');

    // 初期同期データを受信
    window.addEventListener('p2p:initial-sync', ((event: CustomEvent) => {
      console.log('📥 Received p2p:initial-sync event', event.detail);
      const { memos } = event.detail;
      memos.forEach((memo: SharedMemo) => {
        this.createSharedMemoComponent(memo);
      });
    }) as EventListener);

    // メモ作成を受信
    window.addEventListener('p2p:memo-created', ((event: CustomEvent) => {
      console.log('📥 Received p2p:memo-created event', event.detail);
      const memo: SharedMemo = event.detail;
      this.createSharedMemoComponent(memo);
    }) as EventListener);

    // メモ更新を受信
    window.addEventListener('p2p:memo-updated', ((event: CustomEvent) => {
      console.log('📥 Received p2p:memo-updated event', event.detail);
      const memo: SharedMemo = event.detail;
      this.updateSharedMemoComponent(memo);
    }) as EventListener);

    // メモ削除を受信
    window.addEventListener('p2p:memo-deleted', ((event: CustomEvent) => {
      console.log('📥 Received p2p:memo-deleted event', event.detail);
      const { memoId } = event.detail;
      this.removeSharedMemoComponent(memoId);
    }) as EventListener);
  }

  /**
   * 共有メモコンポーネントを作成（他ユーザーのメモ）
   */
  private createSharedMemoComponent(memo: SharedMemo): void {
    // 既に存在する場合はスキップ
    if (this.sharedMemos.has(memo.id)) {
      return;
    }

    // 閲覧専用のメモコンポーネントを作成
    // TODO: 後でSharedMemoComponentに置き換え
    const container = this.resolveContainer(memo);
    const component = new MemoComponent(
      memo,
      () => {}, // 編集不可
      () => {}, // 削除不可
      container || undefined
    );

    // 視覚的に区別するためのスタイル追加
    const element = component.getElement();
    element.classList.add(CSS_CLASSES.SHARED_MEMO_CONTAINER);
    element.style.opacity = '0.9';
    element.style.border = '2px solid #4CAF50';

    // 所有者情報を表示
    const badge = document.createElement('div');
    badge.classList.add(CSS_CLASSES.SHARED_MEMO_BADGE);
    badge.textContent = `共有: ${memo.ownerId}`;
    badge.style.cssText = `
      position: absolute;
      top: -20px;
      left: 0;
      background: #4CAF50;
      color: white;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
    `;
    element.appendChild(badge);

    this.sharedMemos.set(memo.id, component);
    document.body.appendChild(element);

    console.log('✅ Shared memo created:', memo.id, 'by', memo.ownerId);
  }

  /**
   * 共有メモコンポーネントを更新
   */
  private updateSharedMemoComponent(memo: SharedMemo): void {
    const component = this.sharedMemos.get(memo.id);
    if (component) {
      // 既存の共有メモを更新
      console.log('🔄 Updating shared memo:', memo.id, 'by', memo.ownerId);

      // コンポーネントを削除して再作成（簡易実装）
      component.destroy();
      this.sharedMemos.delete(memo.id);

      // 新しい内容で再作成
      this.createSharedMemoComponent(memo);

      console.log('✅ Updated shared memo:', memo.id);
    } else {
      // 存在しない場合は新規作成扱い
      console.log('⚠️ Shared memo not found, creating new:', memo.id);
      this.createSharedMemoComponent(memo);
    }
  }

  /**
   * 共有メモコンポーネントを削除
   */
  private removeSharedMemoComponent(memoId: string): void {
    const component = this.sharedMemos.get(memoId);
    if (component) {
      component.destroy();
      this.sharedMemos.delete(memoId);
      console.log('Removed shared memo:', memoId);
    }
  }

  /**
   * 保存されているメモを読み込み
   */
  private async loadMemos(): Promise<void> {
    try {
      const memos = await StorageManager.getMemosForUrl(this.currentUrl, this.settings);

      memos.forEach(memo => {
        this.createMemoComponent(memo);
        if (memo.style.zIndex >= this.nextZIndex) {
          this.nextZIndex = memo.style.zIndex + 1;
        }
      });

      console.log(`Loaded ${memos.length} memos for ${this.currentUrl}`);
    } catch (error) {
      console.error('Failed to load memos:', error);
    }
  }

  /**
   * URL変更に伴いメモを再読み込み
   */
  private async handleUrlChange(newUrl: string): Promise<void> {
    if (!newUrl || newUrl === this.currentUrl) {
      return;
    }

    console.log(`MemoManager: URL changed ${this.currentUrl} -> ${newUrl}`);

    // 保留中の保存を強制実行
    this.debouncedSaveMemo.flush();

    // メモ作成モード中なら終了
    if (this.createMode) {
      this.exitCreateMode();
    }

    this.memos.forEach(component => component.destroy());
    this.memos.clear();

    this.sharedMemos.forEach(component => component.destroy());
    this.sharedMemos.clear();

    this.nextZIndex = Z_INDEX.MIN;
    this.currentUrl = newUrl;

    if (!this.settings.enabled) {
      return;
    }

    try {
      await this.loadMemos();
    } catch (error) {
      console.error('Failed to reload memos after URL change:', error);
    }

    if (this.p2pSyncManager) {
      this.p2pSyncManager.updateCurrentUrl(newUrl);
    }
  }

  /**
   * メモコンポーネントを作成
   */
  private createMemoComponent(memo: Memo, container?: HTMLElement | null): MemoComponent {
    const targetContainer = container ?? this.resolveContainer(memo);
    const component = new MemoComponent(
      memo,
      this.debouncedSaveMemo,
      this.deleteMemo,
      targetContainer || undefined
    );

    this.memos.set(memo.id, component);
    document.body.appendChild(component.getElement());
    return component;
  }

  private resolveContainer(memo: Memo): HTMLElement | null {
    if (!memo.containerSelector) {
      return null;
    }

    try {
      const element = document.querySelector<HTMLElement>(memo.containerSelector);
      if (!element || element === document.body || element === document.documentElement) {
        return null;
      }
      return element;
    } catch (error) {
      console.warn('Failed to resolve container for memo:', memo.id, error);
      return null;
    }
  }

  /**
   * 新しいメモを作成
   */
  createMemo = (point: MemoCreationPoint): void => {
    const { memo, container } = this.buildMemoFromPoint(point, '');

    this.createMemoComponent(memo, container);
    this.saveMemo(memo);

    // 作成後、すぐにフォーカス
    const component = this.memos.get(memo.id);
    if (component) {
      const contentElement = component.getElement().querySelector(
        `.${CSS_CLASSES.MEMO_CONTENT}`
      ) as HTMLElement;
      contentElement?.focus();
    }
  };

  /**
   * テキスト付きで新しいメモを作成
   */
  private createMemoWithText = (point: MemoCreationPoint, text: string): void => {
    const { memo, container } = this.buildMemoFromPoint(point, text);

    this.createMemoComponent(memo, container);
    this.saveMemo(memo);
  };

  private buildMemoFromPoint(
    point: MemoCreationPoint,
    content: string
  ): { memo: Memo; container: HTMLElement | null } {
    const target = point.target instanceof HTMLElement ? point.target : null;
    const elementAtPoint = document.elementFromPoint(point.clientX, point.clientY) as
      | HTMLElement
      | null;

    const container = this.findScrollableContainer(target ?? elementAtPoint);
    let positionX = point.pageX;
    let positionY = point.pageY;
    let containerSelector: string | undefined;
    let viewportSize = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    if (container) {
      const rect = container.getBoundingClientRect();
      const pageLeft = window.scrollX + rect.left;
      const pageTop = window.scrollY + rect.top;

      positionX = container.scrollLeft + (point.pageX - pageLeft);
      positionY = container.scrollTop + (point.pageY - pageTop);
      containerSelector = generateSelector(container);
      viewportSize = {
        width: container.clientWidth,
        height: container.clientHeight
      };
    }

    const memo: Memo = {
      id: generateId(),
      url: this.currentUrl,
      content,
      position: {
        x: positionX,
        y: positionY,
        type: 'fixed'
      },
      containerSelector,
      pagePosition: { x: point.pageX, y: point.pageY },
      style: {
        ...DEFAULT_STYLE,
        color: this.settings.defaultColor || DEFAULT_STYLE.color,
        width: this.settings.defaultSize?.width || DEFAULT_STYLE.width,
        height: this.settings.defaultSize?.height || DEFAULT_STYLE.height,
        fontSize: this.settings.defaultFontSize || DEFAULT_STYLE.fontSize,
        zIndex: this.nextZIndex++
      },
      viewportSize,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };

    return { memo, container };
  }

  private findScrollableContainer(element: HTMLElement | null): HTMLElement | null {
    let current = element;

    while (current && current !== document.body && current !== document.documentElement) {
      if (this.isScrollableContainer(current)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  private isScrollableContainer(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    const overflowValues = [style.overflow, style.overflowY, style.overflowX];
    const scrollable = overflowValues.some(value => ['auto', 'scroll', 'overlay'].includes(value));

    if (!scrollable) {
      return false;
    }

    return (
      element.scrollHeight > element.clientHeight + 1 ||
      element.scrollWidth > element.clientWidth + 1
    );
  }

  /**
   * メモを保存（デバウンス付き）
   */
  private debouncedSaveMemo = debounce(
    (memo: Memo) => this.saveMemo(memo),
    DEBOUNCE_TIME.SAVE
  );

  /**
   * メモを保存
   */
  private saveMemo = async (memo: Memo): Promise<void> => {
    try {
      // 既存メモかどうかを判定
      const isExisting = this.memos.has(memo.id);
      console.log('💾 Saving memo:', memo.id, 'Content:', memo.content);
      console.log('🔍 Is existing memo:', isExisting);
      console.log('🔍 P2P Manager:', this.p2pSyncManager ? 'exists' : 'null');
      console.log('🔍 Sharing enabled:', this.settings.sharingEnabled);

      // P2P共有が有効な場合はP2P経由で保存（ブロードキャスト）
      if (this.p2pSyncManager && this.settings.sharingEnabled) {
        if (isExisting) {
          console.log('📡 Broadcasting memo UPDATE via P2P...');
          await this.p2pSyncManager.broadcastMemoUpdate(memo);
        } else {
          console.log('📡 Broadcasting memo CREATE via P2P...');
          await this.p2pSyncManager.broadcastMemoCreate(memo);
        }
        console.log('✅ P2P broadcast complete');
      } else {
        console.log('💾 Saving locally only');
        // ローカルのみ保存
        await StorageManager.saveMemo(memo, this.settings);
      }

      console.log('✅ Memo saved successfully:', memo.id);
    } catch (error) {
      console.error('❌ Failed to save memo:', error);
    }
  };

  /**
   * メモを削除
   */
  deleteMemo = async (memoId: string): Promise<void> => {
    try {
      const component = this.memos.get(memoId);
      if (component) {
        component.destroy();
        this.memos.delete(memoId);
      }

      // P2P共有が有効な場合はP2P経由で削除（ブロードキャスト）
      if (this.p2pSyncManager && this.settings.sharingEnabled) {
        await this.p2pSyncManager.broadcastMemoDelete(memoId, this.currentUrl);
      } else {
        await StorageManager.deleteMemo(memoId, this.currentUrl, this.settings);
      }

      console.log('Memo deleted:', memoId);
    } catch (error) {
      console.error('Failed to delete memo:', error);
    }
  };

  /**
   * すべてのメモを削除
   */
  deleteAllMemos = async (): Promise<void> => {
    try {
      this.memos.forEach(component => component.destroy());
      this.memos.clear();

      await StorageManager.deleteAllMemosForUrl(this.currentUrl, this.settings);
      console.log('All memos deleted for current URL');
    } catch (error) {
      console.error('Failed to delete all memos:', error);
    }
  };

  /**
   * メモ作成モードの切り替え
   */
  toggleCreateMode = (): void => {
    this.createMode = !this.createMode;

    if (this.createMode) {
      document.body.classList.add(CSS_CLASSES.CREATE_MODE);
      document.body.style.cursor = 'crosshair';

      // クリックハンドラーを作成して保持
      this.createModeClickHandler = (e: MouseEvent) => {
        // メモ要素のクリックは無視
        if ((e.target as HTMLElement).closest(`.${CSS_CLASSES.MEMO_CONTAINER}`)) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        this.createMemo({
          pageX: e.pageX,
          pageY: e.pageY,
          clientX: e.clientX,
          clientY: e.clientY,
          target: e.target instanceof HTMLElement ? e.target : null
        });
        this.exitCreateMode();
      };

      // Escキーでキャンセルするハンドラーを作成して保持
      this.createModeCancelHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.exitCreateMode();
        }
      };

      // イベントリスナーを登録
      document.addEventListener('click', this.createModeClickHandler);
      document.addEventListener('keydown', this.createModeCancelHandler);
    } else {
      this.exitCreateMode();
    }
  };

  /**
   * メモ作成モードを終了
   */
  private exitCreateMode(): void {
    this.createMode = false;
    document.body.classList.remove(CSS_CLASSES.CREATE_MODE);
    document.body.style.cursor = '';

    // イベントリスナーを明示的に解除
    if (this.createModeClickHandler) {
      document.removeEventListener('click', this.createModeClickHandler);
      this.createModeClickHandler = null;
    }

    if (this.createModeCancelHandler) {
      document.removeEventListener('keydown', this.createModeCancelHandler);
      this.createModeCancelHandler = null;
    }
  }

  /**
   * ストレージの変更を監視
   */
  private setupStorageListener(): void {
    StorageManager.addChangeListener((changes) => {
      // 設定の変更
      if (changes.settings) {
        this.settings = {
          ...this.settings,
          ...changes.settings.newValue
        };
      }

      // メモの変更（他のタブからの更新を反映）
      if (changes.memos) {
        // TODO: 他のタブからの変更を反映する処理
      }
    });
  }

  /**
   * 右クリック位置を記録
   */
  private setupContextMenuListener(): void {
    document.addEventListener('contextmenu', (e: MouseEvent) => {
      this.lastContextMenuData = {
        pageX: e.pageX,
        pageY: e.pageY,
        clientX: e.clientX,
        clientY: e.clientY,
        target: e.target instanceof HTMLElement ? e.target : null
      };
    });
  }

  /**
   * ページ離脱時に未保存のメモを強制保存
   */
  private setupBeforeUnloadListener(): void {
    window.addEventListener('beforeunload', () => {
      console.log('Page unloading, flushing pending saves...');
      // デバウンス中の保存を即座に実行
      this.debouncedSaveMemo.flush();
    });
  }

  /**
   * ウィンドウリサイズ時にメモ位置を再計算
   */
  private setupResizeListener(): void {
    const handleResize = debounce(() => {
      console.log('📐 Window resized, recalculating memo positions...');

      // 全メモの位置を再計算
      this.memos.forEach(component => {
        const memo = component.getMemo();
        component.updateMemo(memo);
      });

      // 共有メモの位置も再計算
      this.sharedMemos.forEach(component => {
        const memo = component.getMemo();
        component.updateMemo(memo);
      });

      console.log('✅ Memo positions recalculated');
    }, 300); // 300msのデバウンス

    window.addEventListener('resize', handleResize);
  }

  /**
   * メッセージリスナーを設定
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'CREATE_MEMO':
          this.toggleCreateMode();
          sendResponse({ success: true });
          break;

        case 'CREATE_MEMO_AT_CONTEXT_POSITION':
          // 右クリック位置にメモを作成
          if (this.lastContextMenuData) {
            this.createMemo(this.lastContextMenuData);
            this.lastContextMenuData = null;
          }
          sendResponse({ success: true });
          break;

        case 'CREATE_MEMO_WITH_TEXT':
          // 選択テキスト付きでメモを作成
          if (this.lastContextMenuData) {
            this.createMemoWithText(this.lastContextMenuData, message.text || '');
            this.lastContextMenuData = null;
          }
          sendResponse({ success: true });
          break;

        case 'DELETE_ALL_MEMOS':
          this.deleteAllMemos();
          sendResponse({ success: true });
          break;

        case 'GET_MEMOS_COUNT':
          sendResponse({ count: this.memos.size });
          break;

        case 'SPA_URL_CHANGED':
          if (typeof message.url === 'string') {
            this.handleUrlChange(message.url).catch(error => {
              console.error('Failed to handle SPA URL change in MemoManager:', error);
            });
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Invalid URL' });
          }
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }

      return true;
    });
  }

  /**
   * 全メモを取得
   */
  getAllMemos(): Memo[] {
    return Array.from(this.memos.values()).map(component => component.getMemo());
  }

  /**
   * メモ数を取得
   */
  getMemosCount(): number {
    return this.memos.size;
  }

  /**
   * P2PSyncManagerを取得
   */
  getP2PSyncManager(): P2PSyncManager | null {
    return this.p2pSyncManager;
  }
}
