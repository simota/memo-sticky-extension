/**
 * 描画管理 - SVG描画機能を提供
 */

import { Drawing, Settings, DRAWING_COLORS } from '../shared/types';
import { StorageManager } from '../shared/storage';
import { generateId, getCurrentTimestamp } from '../shared/utils';
import { CSS_CLASSES, Z_INDEX } from '../shared/constants';
import { DrawingComponent } from './DrawingComponent';

export class DrawingManager {
  private drawings: Map<string, DrawingComponent> = new Map();
  private settings: Settings;
  private currentUrl: string;
  private drawingMode: boolean = false;
  private svgCanvas: SVGSVGElement | null = null;
  private toolbar: HTMLDivElement | null = null;
  private currentPath: SVGPathElement | null = null;
  private currentPathData: string = '';
  private isDrawing: boolean = false;
  private currentColor: string = '#FF0000';
  private currentStrokeWidth: number = 3;

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
      this.settings = await StorageManager.getSettings();

      if (!this.settings.enabled) {
        return;
      }

      await this.loadDrawings();
      this.setupMessageListener();

      console.log('DrawingManager initialized');
    } catch (error) {
      console.error('Failed to initialize DrawingManager:', error);
    }
  }

  /**
   * 保存されている描画を読み込み
   */
  private async loadDrawings(): Promise<void> {
    try {
      const drawings = await StorageManager.getDrawingsForUrl(
        this.currentUrl,
        this.settings
      );

      if (drawings.length > 0 && !this.svgCanvas) {
        this.createSVGCanvas();
      }

      drawings.forEach(drawing => {
        const component = new DrawingComponent(drawing);
        if (this.svgCanvas) {
          const element = component.createSVGElement(this.svgCanvas);
          if (element) {
            this.svgCanvas.appendChild(element);
            this.drawings.set(drawing.id, component);

            // クリックで削除できるようにする
            this.setupDrawingClickHandler(element, drawing.id);
          }
        }
      });

      console.log(`Loaded ${drawings.length} drawings for ${this.currentUrl}`);
    } catch (error) {
      console.error('Failed to load drawings:', error);
    }
  }

  /**
   * SVGキャンバスを作成
   */
  private createSVGCanvas(): void {
    if (this.svgCanvas) return;

    this.svgCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgCanvas.classList.add(CSS_CLASSES.DRAWING_CANVAS);
    this.svgCanvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: ${document.documentElement.scrollHeight}px;
      pointer-events: none;
      z-index: ${Z_INDEX.MIN - 1};
    `;

    document.body.appendChild(this.svgCanvas);

    // スクロール時にサイズを更新
    window.addEventListener('scroll', () => {
      if (this.svgCanvas) {
        this.svgCanvas.style.height = `${document.documentElement.scrollHeight}px`;
      }
    });
  }

  /**
   * 描画ツールバーを作成
   */
  private createToolbar(): void {
    if (this.toolbar) return;

    this.toolbar = document.createElement('div');
    this.toolbar.classList.add(CSS_CLASSES.DRAWING_TOOLBAR);
    this.toolbar.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: white;
      border: 2px solid #333;
      border-radius: 8px;
      padding: 12px;
      z-index: ${Z_INDEX.MAX + 10};
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // 色選択セクション
    const colorSection = document.createElement('div');
    colorSection.innerHTML = '<div style="font-size: 12px; font-weight: bold; margin-bottom: 6px;">色</div>';
    const colorButtons = document.createElement('div');
    colorButtons.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';

    DRAWING_COLORS.forEach(colorInfo => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        width: 28px;
        height: 28px;
        border: 2px solid ${this.currentColor === colorInfo.color ? '#000' : '#ccc'};
        border-radius: 4px;
        background: ${colorInfo.color};
        cursor: pointer;
        transition: border-color 0.2s;
      `;
      btn.title = colorInfo.name;
      btn.addEventListener('click', () => {
        this.currentColor = colorInfo.color;
        this.updateToolbarUI();
      });
      colorButtons.appendChild(btn);
    });

    colorSection.appendChild(colorButtons);
    this.toolbar.appendChild(colorSection);

    // 太さ選択セクション
    const widthSection = document.createElement('div');
    widthSection.innerHTML = '<div style="font-size: 12px; font-weight: bold; margin-bottom: 6px;">太さ</div>';
    const widthButtons = document.createElement('div');
    widthButtons.style.cssText = 'display: flex; gap: 6px;';

    [1, 3, 5, 8].forEach(width => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        width: 32px;
        height: 32px;
        border: 2px solid ${this.currentStrokeWidth === width ? '#000' : '#ccc'};
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 11px;
        transition: border-color 0.2s;
      `;
      btn.textContent = `${width}px`;
      btn.addEventListener('click', () => {
        this.currentStrokeWidth = width;
        this.updateToolbarUI();
      });
      widthButtons.appendChild(btn);
    });

    widthSection.appendChild(widthButtons);
    this.toolbar.appendChild(widthSection);

    // 閉じるボタン
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '閉じる';
    closeBtn.style.cssText = `
      width: 100%;
      padding: 8px;
      background: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
    `;
    closeBtn.addEventListener('click', () => {
      this.toggleDrawingMode();
    });
    this.toolbar.appendChild(closeBtn);

    document.body.appendChild(this.toolbar);
  }

  /**
   * ツールバーUIを更新
   */
  private updateToolbarUI(): void {
    if (!this.toolbar) return;

    // 色ボタンの枠線を更新
    const colorButtons = this.toolbar.querySelectorAll('button[title]');
    colorButtons.forEach((btn, index) => {
      if (index < DRAWING_COLORS.length) {
        const colorInfo = DRAWING_COLORS[index];
        (btn as HTMLButtonElement).style.border =
          this.currentColor === colorInfo.color ? '2px solid #000' : '2px solid #ccc';
      }
    });

    // 太さボタンの枠線を更新
    const widthButtons = this.toolbar.querySelectorAll('button');
    const widths = [1, 3, 5, 8];
    widthButtons.forEach((btn) => {
      const text = btn.textContent;
      if (text && text.includes('px')) {
        const width = parseInt(text);
        if (widths.includes(width)) {
          btn.style.border =
            this.currentStrokeWidth === width ? '2px solid #000' : '2px solid #ccc';
        }
      }
    });
  }

  /**
   * 描画モードを切り替え
   */
  toggleDrawingMode = (): void => {
    this.drawingMode = !this.drawingMode;

    if (this.drawingMode) {
      if (!this.svgCanvas) {
        this.createSVGCanvas();
      }

      if (this.svgCanvas) {
        this.svgCanvas.style.pointerEvents = 'auto';
        this.svgCanvas.style.cursor = 'crosshair';
      }

      // ツールバーを作成・表示
      this.createToolbar();
      if (this.toolbar) {
        this.toolbar.style.display = 'flex';
      }

      document.body.classList.add(CSS_CLASSES.DRAWING_MODE);

      // イベントリスナーを追加
      this.svgCanvas?.addEventListener('pointerdown', this.handlePointerDown);
      this.svgCanvas?.addEventListener('pointermove', this.handlePointerMove);
      this.svgCanvas?.addEventListener('pointerup', this.handlePointerUp);
    } else {
      if (this.svgCanvas) {
        this.svgCanvas.style.pointerEvents = 'none';
        this.svgCanvas.style.cursor = '';
      }

      // ツールバーを非表示
      if (this.toolbar) {
        this.toolbar.style.display = 'none';
      }

      document.body.classList.remove(CSS_CLASSES.DRAWING_MODE);

      // イベントリスナーを削除
      this.svgCanvas?.removeEventListener('pointerdown', this.handlePointerDown);
      this.svgCanvas?.removeEventListener('pointermove', this.handlePointerMove);
      this.svgCanvas?.removeEventListener('pointerup', this.handlePointerUp);
    }
  };

  /**
   * ポインターダウンハンドラー
   */
  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.svgCanvas) return;

    this.isDrawing = true;
    const point = this.getPoint(e);

    // 新しいパスを開始
    this.currentPathData = `M ${point.x} ${point.y}`;
    this.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.currentPath.setAttribute('d', this.currentPathData);
    this.currentPath.setAttribute('stroke', this.currentColor);
    this.currentPath.setAttribute('stroke-width', this.currentStrokeWidth.toString());
    this.currentPath.setAttribute('fill', 'none');
    this.currentPath.setAttribute('stroke-linecap', 'round');
    this.currentPath.setAttribute('stroke-linejoin', 'round');

    this.svgCanvas.appendChild(this.currentPath);
  };

  /**
   * ポインタームーブハンドラー
   */
  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isDrawing || !this.currentPath) return;

    const point = this.getPoint(e);
    this.currentPathData += ` L ${point.x} ${point.y}`;
    this.currentPath.setAttribute('d', this.currentPathData);
  };

  /**
   * ポインターアップハンドラー
   */
  private handlePointerUp = (): void => {
    if (!this.isDrawing || !this.currentPath) return;

    this.isDrawing = false;

    // 描画を保存
    const drawing: Drawing = {
      id: generateId(),
      url: this.currentUrl,
      type: 'pen',
      pathData: this.currentPathData,
      color: this.currentColor,
      strokeWidth: this.currentStrokeWidth,
      scrollOffset: { x: window.scrollX, y: window.scrollY },
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };

    const component = new DrawingComponent(drawing);
    this.currentPath.dataset.drawingId = drawing.id;
    component['element'] = this.currentPath;
    this.drawings.set(drawing.id, component);

    // クリックで削除できるようにする
    this.setupDrawingClickHandler(this.currentPath, drawing.id);

    this.saveDrawing(drawing);

    this.currentPath = null;
    this.currentPathData = '';
  };

  /**
   * SVG座標を取得
   */
  private getPoint(e: PointerEvent): { x: number; y: number } {
    if (!this.svgCanvas) return { x: 0, y: 0 };

    // position: absolute のSVGなので、pageX/Yを使用
    return {
      x: e.pageX,
      y: e.pageY
    };
  }

  /**
   * 描画を保存
   */
  private saveDrawing = async (drawing: Drawing): Promise<void> => {
    try {
      await StorageManager.saveDrawing(drawing, this.settings);
      console.log('Drawing saved:', drawing.id);
    } catch (error) {
      console.error('Failed to save drawing:', error);
    }
  };

  /**
   * 描画要素にクリックハンドラーを設定
   */
  private setupDrawingClickHandler(element: SVGElement, drawingId: string): void {
    element.style.cursor = 'pointer';
    element.style.pointerEvents = 'auto';

    element.addEventListener('click', async (e) => {
      e.stopPropagation();

      if (confirm('この描画を削除しますか？')) {
        await this.deleteDrawing(drawingId);
      }
    });
  }

  /**
   * 描画を削除
   */
  private deleteDrawing = async (drawingId: string): Promise<void> => {
    try {
      const component = this.drawings.get(drawingId);
      if (component) {
        component.destroy();
        this.drawings.delete(drawingId);
      }

      await StorageManager.deleteDrawing(drawingId, this.currentUrl, this.settings);
      console.log('Drawing deleted:', drawingId);
    } catch (error) {
      console.error('Failed to delete drawing:', error);
    }
  };

  /**
   * すべての描画を削除
   */
  deleteAllDrawings = async (): Promise<void> => {
    try {
      this.drawings.forEach(component => component.destroy());
      this.drawings.clear();

      if (this.svgCanvas) {
        this.svgCanvas.remove();
        this.svgCanvas = null;
      }

      await StorageManager.deleteAllDrawingsForUrl(this.currentUrl, this.settings);
      console.log('All drawings deleted');
    } catch (error) {
      console.error('Failed to delete all drawings:', error);
    }
  };

  /**
   * メッセージリスナーを設定
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'TOGGLE_DRAWING_MODE':
          this.toggleDrawingMode();
          sendResponse({ success: true, enabled: this.drawingMode });
          break;

        case 'DELETE_ALL_DRAWINGS':
          this.deleteAllDrawings();
          sendResponse({ success: true });
          break;

        default:
          return false;
      }

      return true;
    });
  }
}
