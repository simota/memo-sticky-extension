/**
 * 付箋UIコンポーネント
 */

import { Memo, PRESET_COLORS } from '../shared/types';
import { CSS_CLASSES, Z_INDEX, MEMO_SIZE } from '../shared/constants';
import { clamp } from '../shared/utils';

export class MemoComponent {
  private element: HTMLElement;
  private memo: Memo;
  private onUpdate: (memo: Memo) => void;
  private onDelete: (memoId: string) => void;
  private isDragging: boolean = false;
  private isResizing: boolean = false;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };

  constructor(
    memo: Memo,
    onUpdate: (memo: Memo) => void,
    onDelete: (memoId: string) => void
  ) {
    this.memo = memo;
    this.onUpdate = onUpdate;
    this.onDelete = onDelete;
    this.element = this.createElement();
    this.attachEventListeners();
  }

  /**
   * DOM要素を作成
   */
  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = CSS_CLASSES.MEMO_CONTAINER;
    container.style.cssText = `
      position: fixed;
      left: ${this.memo.position.x}px;
      top: ${this.memo.position.y}px;
      width: ${this.memo.style.width}px;
      height: ${this.memo.style.height}px;
      z-index: ${this.memo.style.zIndex};
      background-color: ${this.memo.style.color};
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    container.dataset.memoId = this.memo.id;

    // ヘッダー
    const header = document.createElement('div');
    header.className = CSS_CLASSES.MEMO_HEADER;
    header.style.cssText = `
      padding: 4px 6px;
      background-color: rgba(0, 0, 0, 0.05);
      cursor: move;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      min-height: 24px;
    `;

    // 左側のボタングループ
    const leftButtons = document.createElement('div');
    leftButtons.style.cssText = `
      display: flex;
      gap: 4px;
    `;

    // カラーボタン
    const colorBtn = document.createElement('button');
    colorBtn.className = CSS_CLASSES.MEMO_COLOR_BTN;
    colorBtn.innerHTML = '🎨';
    colorBtn.style.cssText = `
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 13px;
      padding: 2px;
      line-height: 1;
    `;
    colorBtn.title = '色を変更';

    leftButtons.appendChild(colorBtn);

    // 右側のボタングループ
    const rightButtons = document.createElement('div');
    rightButtons.style.cssText = `
      display: flex;
      gap: 2px;
      align-items: center;
    `;

    // 最小化ボタン
    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'memo-sticky-minimize-btn';
    minimizeBtn.innerHTML = '−';
    minimizeBtn.style.cssText = `
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0;
      width: 16px;
      height: 16px;
    `;
    minimizeBtn.title = '最小化';

    // 削除ボタン
    const deleteBtn = document.createElement('button');
    deleteBtn.className = CSS_CLASSES.MEMO_DELETE_BTN;
    deleteBtn.innerHTML = '×';
    deleteBtn.style.cssText = `
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0;
      width: 16px;
      height: 16px;
    `;
    deleteBtn.title = '削除';

    rightButtons.appendChild(minimizeBtn);
    rightButtons.appendChild(deleteBtn);

    header.appendChild(leftButtons);
    header.appendChild(rightButtons);

    // コンテンツエリア
    const content = document.createElement('div');
    content.className = CSS_CLASSES.MEMO_CONTENT;
    content.contentEditable = 'true';
    content.style.cssText = `
      flex: 1;
      padding: 8px;
      overflow-y: auto;
      font-size: ${this.memo.style.fontSize}px;
      line-height: 1.5;
      outline: none;
      word-wrap: break-word;
      color: #000;
    `;
    content.textContent = this.memo.content;

    // フッター（リサイズハンドル）
    const footer = document.createElement('div');
    footer.className = CSS_CLASSES.MEMO_FOOTER;
    footer.style.cssText = `
      position: relative;
      height: 16px;
      background-color: rgba(0, 0, 0, 0.02);
    `;

    const resizeHandle = document.createElement('div');
    resizeHandle.className = CSS_CLASSES.MEMO_RESIZE_HANDLE;
    resizeHandle.style.cssText = `
      position: absolute;
      right: 0;
      bottom: 0;
      width: 14px;
      height: 14px;
      cursor: nwse-resize;
      font-size: 12px;
    `;
    resizeHandle.innerHTML = '⋰';

    footer.appendChild(resizeHandle);

    // 組み立て
    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(footer);

    // 最小化状態を適用
    if (this.memo.isMinimized) {
      content.style.display = 'none';
      footer.style.display = 'none';
      container.style.height = 'auto';
      minimizeBtn.innerHTML = '+';
      minimizeBtn.title = '展開';
    }

    return container;
  }

  /**
   * イベントリスナーを設定
   */
  private attachEventListeners(): void {
    const header = this.element.querySelector(`.${CSS_CLASSES.MEMO_HEADER}`) as HTMLElement;
    const content = this.element.querySelector(`.${CSS_CLASSES.MEMO_CONTENT}`) as HTMLElement;
    const deleteBtn = this.element.querySelector(`.${CSS_CLASSES.MEMO_DELETE_BTN}`) as HTMLElement;
    const colorBtn = this.element.querySelector(`.${CSS_CLASSES.MEMO_COLOR_BTN}`) as HTMLElement;
    const minimizeBtn = this.element.querySelector('.memo-sticky-minimize-btn') as HTMLElement;
    const resizeHandle = this.element.querySelector(`.${CSS_CLASSES.MEMO_RESIZE_HANDLE}`) as HTMLElement;

    // ドラッグ開始
    header.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      this.startDrag(e);
    });

    // コンテンツ編集
    content.addEventListener('input', () => {
      this.memo.content = content.textContent || '';
      this.memo.updatedAt = Date.now();
      this.onUpdate(this.memo);
    });

    // 削除
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onDelete(this.memo.id);
    });

    // 色変更
    colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showColorPicker();
    });

    // 最小化トグル
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });

    // リサイズ
    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.startResize(e);
    });

    // グローバルイベント
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  /**
   * ドラッグ開始
   */
  private startDrag = (e: MouseEvent): void => {
    this.isDragging = true;
    const rect = this.element.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    this.element.style.cursor = 'grabbing';
  };

  /**
   * リサイズ開始
   */
  private startResize = (_e: MouseEvent): void => {
    this.isResizing = true;
  };

  /**
   * マウス移動ハンドラー
   */
  private handleMouseMove = (e: MouseEvent): void => {
    if (this.isDragging) {
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;

      this.element.style.left = `${x}px`;
      this.element.style.top = `${y}px`;

      this.memo.position.x = x;
      this.memo.position.y = y;
    } else if (this.isResizing) {
      const rect = this.element.getBoundingClientRect();
      const width = clamp(
        e.clientX - rect.left,
        MEMO_SIZE.MIN_WIDTH,
        MEMO_SIZE.MAX_WIDTH
      );
      const height = clamp(
        e.clientY - rect.top,
        MEMO_SIZE.MIN_HEIGHT,
        MEMO_SIZE.MAX_HEIGHT
      );

      this.element.style.width = `${width}px`;
      this.element.style.height = `${height}px`;

      this.memo.style.width = width;
      this.memo.style.height = height;
    }
  };

  /**
   * マウスアップハンドラー
   */
  private handleMouseUp = (): void => {
    if (this.isDragging || this.isResizing) {
      this.memo.updatedAt = Date.now();
      this.onUpdate(this.memo);
    }

    this.isDragging = false;
    this.isResizing = false;
    this.element.style.cursor = '';
  };

  /**
   * カラーピッカーを表示
   */
  private showColorPicker(): void {
    const picker = document.createElement('div');
    picker.style.cssText = `
      position: absolute;
      top: 40px;
      left: 8px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 8px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      z-index: ${Z_INDEX.MAX};
    `;

    PRESET_COLORS.forEach(color => {
      const colorOption = document.createElement('div');
      colorOption.style.cssText = `
        width: 30px;
        height: 30px;
        background-color: ${color};
        border: 2px solid ${this.memo.style.color === color ? '#000' : '#ccc'};
        border-radius: 4px;
        cursor: pointer;
      `;

      colorOption.addEventListener('click', () => {
        this.memo.style.color = color;
        this.element.style.backgroundColor = color;
        this.memo.updatedAt = Date.now();
        this.onUpdate(this.memo);
        picker.remove();
      });

      picker.appendChild(colorOption);
    });

    // 外側クリックで閉じる
    const closePickerOnClickOutside = (e: MouseEvent) => {
      if (!picker.contains(e.target as Node)) {
        picker.remove();
        document.removeEventListener('click', closePickerOnClickOutside);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', closePickerOnClickOutside);
    }, 0);

    this.element.appendChild(picker);
  }

  /**
   * 最小化をトグル
   */
  private toggleMinimize(): void {
    const content = this.element.querySelector(`.${CSS_CLASSES.MEMO_CONTENT}`) as HTMLElement;
    const footer = this.element.querySelector(`.${CSS_CLASSES.MEMO_FOOTER}`) as HTMLElement;
    const minimizeBtn = this.element.querySelector('.memo-sticky-minimize-btn') as HTMLElement;

    this.memo.isMinimized = !this.memo.isMinimized;

    if (this.memo.isMinimized) {
      // 最小化：コンテンツとフッターを非表示
      content.style.display = 'none';
      footer.style.display = 'none';
      this.element.style.height = 'auto';
      this.element.style.width = `${Math.max(this.memo.style.width, 150)}px`;
      minimizeBtn.innerHTML = '+';
      minimizeBtn.title = '展開';
    } else {
      // 展開：コンテンツとフッターを表示
      content.style.display = 'block';
      footer.style.display = 'block';
      this.element.style.height = `${this.memo.style.height}px`;
      this.element.style.width = `${this.memo.style.width}px`;
      minimizeBtn.innerHTML = '−';
      minimizeBtn.title = '最小化';
    }

    this.memo.updatedAt = Date.now();
    this.onUpdate(this.memo);
  }

  /**
   * DOM要素を取得
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * メモデータを取得
   */
  getMemo(): Memo {
    return this.memo;
  }

  /**
   * メモを更新
   */
  updateMemo(memo: Memo): void {
    this.memo = memo;
    this.element.style.left = `${memo.position.x}px`;
    this.element.style.top = `${memo.position.y}px`;
    this.element.style.backgroundColor = memo.style.color;
    this.element.style.zIndex = String(memo.style.zIndex);

    const content = this.element.querySelector(`.${CSS_CLASSES.MEMO_CONTENT}`) as HTMLElement;
    const footer = this.element.querySelector(`.${CSS_CLASSES.MEMO_FOOTER}`) as HTMLElement;
    const minimizeBtn = this.element.querySelector('.memo-sticky-minimize-btn') as HTMLElement;

    // 最小化状態に応じてサイズを設定
    if (memo.isMinimized) {
      this.element.style.height = 'auto';
      this.element.style.width = `${Math.max(memo.style.width, 150)}px`;
      content.style.display = 'none';
      footer.style.display = 'none';
      minimizeBtn.innerHTML = '+';
      minimizeBtn.title = '展開';
    } else {
      this.element.style.width = `${memo.style.width}px`;
      this.element.style.height = `${memo.style.height}px`;
      content.style.display = 'block';
      footer.style.display = 'block';
      minimizeBtn.innerHTML = '−';
      minimizeBtn.title = '最小化';
    }

    if (content && content.textContent !== memo.content) {
      content.textContent = memo.content;
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    this.element.remove();
  }
}
