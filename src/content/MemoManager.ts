/**
 * メモ管理ロジック
 */

import { Memo, Settings, DEFAULT_STYLE } from '../shared/types';
import { StorageManager } from '../shared/storage';
import { generateId, getCurrentTimestamp, debounce } from '../shared/utils';
import { CSS_CLASSES, Z_INDEX, DEBOUNCE_TIME } from '../shared/constants';
import { MemoComponent } from './MemoComponent';

export class MemoManager {
  private memos: Map<string, MemoComponent> = new Map();
  private settings: Settings;
  private createMode: boolean = false;
  private currentUrl: string;
  private nextZIndex: number = Z_INDEX.MIN;
  private createModeClickHandler: ((e: MouseEvent) => void) | null = null;
  private createModeCancelHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.currentUrl = window.location.href;
    this.settings = {} as Settings;
    this.init();
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

      console.log('MemoManager initialized');
    } catch (error) {
      console.error('Failed to initialize MemoManager:', error);
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
   * メモコンポーネントを作成
   */
  private createMemoComponent(memo: Memo): void {
    const component = new MemoComponent(
      memo,
      this.debouncedSaveMemo,
      this.deleteMemo
    );

    this.memos.set(memo.id, component);
    document.body.appendChild(component.getElement());
  }

  /**
   * 新しいメモを作成
   */
  createMemo = (x: number, y: number): void => {
    const memo: Memo = {
      id: generateId(),
      url: this.currentUrl,
      content: '',
      position: {
        x,
        y,
        type: 'fixed'
      },
      style: {
        ...DEFAULT_STYLE,
        color: this.settings.defaultColor || DEFAULT_STYLE.color,
        width: this.settings.defaultSize?.width || DEFAULT_STYLE.width,
        height: this.settings.defaultSize?.height || DEFAULT_STYLE.height,
        fontSize: this.settings.defaultFontSize || DEFAULT_STYLE.fontSize,
        zIndex: this.nextZIndex++
      },
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };

    this.createMemoComponent(memo);
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
      await StorageManager.saveMemo(memo, this.settings);
      console.log('Memo saved:', memo.id);
    } catch (error) {
      console.error('Failed to save memo:', error);
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

      await StorageManager.deleteMemo(memoId, this.currentUrl, this.settings);
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

        this.createMemo(e.clientX, e.clientY);
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
   * メッセージリスナーを設定
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'CREATE_MEMO':
          this.toggleCreateMode();
          sendResponse({ success: true });
          break;

        case 'DELETE_ALL_MEMOS':
          this.deleteAllMemos();
          sendResponse({ success: true });
          break;

        case 'GET_MEMOS_COUNT':
          sendResponse({ count: this.memos.size });
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
}
