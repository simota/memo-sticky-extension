/**
 * 描画管理 - SVG描画機能を提供
 */

import { Drawing, Settings, DRAWING_COLORS, SharedDrawing } from '../shared/types';
import { StorageManager } from '../shared/storage';
import { generateId, getCurrentTimestamp, generateSelector } from '../shared/utils';
import { CSS_CLASSES, Z_INDEX } from '../shared/constants';
import { DrawingComponent, DrawingRenderContext } from './DrawingComponent';
import { P2PSyncManager } from '../shared/p2p-sync-manager';

interface DrawingContext {
  container: HTMLElement | null;
  containerSelector?: string;
  pageLeft: number;
  pageTop: number;
  scrollLeft: number;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
}

export class DrawingManager {
  private drawings: Map<string, DrawingComponent> = new Map();
  private sharedDrawings: Map<string, DrawingComponent> = new Map(); // 他ユーザーの描画
  private drawingContainers: Map<string, HTMLElement> = new Map();
  private sharedDrawingContainers: Map<string, HTMLElement> = new Map();
  private containerScrollListeners: Map<HTMLElement, () => void> = new Map();
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
  private p2pSyncManager: P2PSyncManager | null = null;
  private currentDrawingContext: DrawingContext | null = null;

  constructor(p2pSyncManager: P2PSyncManager | null = null) {
    this.currentUrl = window.location.href;
    this.settings = {} as Settings;
    this.p2pSyncManager = p2pSyncManager;
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
      this.setupP2PListeners();
      this.setupResizeListener();

      console.log('DrawingManager initialized');
    } catch (error) {
      console.error('Failed to initialize DrawingManager:', error);
    }
  }

  /**
   * P2PSyncManagerを設定（後から設定可能にする）
   */
  setP2PSyncManager(p2pSyncManager: P2PSyncManager | null): void {
    this.p2pSyncManager = p2pSyncManager;
    console.log('DrawingManager: P2PSyncManager set');
  }

  /**
   * P2Pイベントリスナーをセットアップ
   */
  private setupP2PListeners(): void {
    // 初期同期データを受信
    window.addEventListener('p2p:initial-sync', ((event: CustomEvent) => {
      const { drawings } = event.detail;
      if (drawings && drawings.length > 0) {
        console.log('📥 Received initial sync drawings:', drawings.length);
        drawings.forEach((drawing: SharedDrawing) => {
          this.createSharedDrawingComponent(drawing);
        });
      }
    }) as EventListener);

    // 描画作成を受信
    window.addEventListener('p2p:drawing-created', ((event: CustomEvent) => {
      console.log('📥 Received p2p:drawing-created event', event.detail);
      const drawing: SharedDrawing = event.detail;
      this.createSharedDrawingComponent(drawing);
    }) as EventListener);

    // 描画削除を受信
    window.addEventListener('p2p:drawing-deleted', ((event: CustomEvent) => {
      console.log('📥 Received p2p:drawing-deleted event', event.detail);
      const { drawingId } = event.detail;
      this.removeSharedDrawingComponent(drawingId);
    }) as EventListener);
  }

  /**
   * 共有描画コンポーネントを作成（他ユーザーの描画）
   */
  private createSharedDrawingComponent(drawing: SharedDrawing): void {
    // 既に存在する場合はスキップ
    if (this.sharedDrawings.has(drawing.id)) {
      return;
    }

    // 共有描画にviewportSizeがない場合は現在のビューポートサイズを設定
    if (!drawing.viewportSize) {
      drawing.viewportSize = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      console.log('📐 Added viewportSize to shared drawing:', drawing.id);
    }

    if (!this.svgCanvas) {
      this.createSVGCanvas();
    }

    if (this.svgCanvas) {
      const component = new DrawingComponent(drawing);
      const container = this.resolveContainerForDrawing(drawing, true);
      const context = this.buildRenderContext(container);
      const element = component.createSVGElement(this.svgCanvas, context);
      if (element) {
        // 共有描画として視覚的に区別
        element.style.opacity = '0.7';
        element.setAttribute('data-shared', 'true');
        element.setAttribute('data-owner', drawing.ownerId);

        this.svgCanvas.appendChild(element);
        this.sharedDrawings.set(drawing.id, component);
        if (container) {
          this.registerContainerForDrawing(drawing.id, container, true);
        }

        console.log('✅ Shared drawing created:', drawing.id, 'by', drawing.ownerId);
      }
    }
  }

  /**
   * 共有描画コンポーネントを削除
   */
  private removeSharedDrawingComponent(drawingId: string): void {
    const component = this.sharedDrawings.get(drawingId);
    if (component) {
      component.destroy();
      this.unregisterContainerForDrawing(drawingId, true);
      this.sharedDrawings.delete(drawingId);
      console.log('Removed shared drawing:', drawingId);
    }
  }

  private resolveContainerForDrawing(drawing: Drawing, isShared: boolean = false): HTMLElement | null {
    if (!drawing.containerSelector) {
      return null;
    }

    try {
      const container = document.querySelector<HTMLElement>(drawing.containerSelector);
      if (container) {
        return container;
      }
      console.warn(
        'Failed to resolve container for drawing:',
        drawing.id,
        drawing.containerSelector
      );
    } catch (error) {
      console.warn('Failed to query container for drawing:', drawing.id, error);
    }

    if (drawing.pagePathData) {
      drawing.pathData = drawing.pagePathData;
    }
    if (!isShared) {
      delete drawing.containerSelector;
    }
    return null;
  }

  private buildRenderContext(container: HTMLElement | null): DrawingRenderContext {
    if (container) {
      const rect = container.getBoundingClientRect();
      return {
        hasContainer: true,
        pageLeft: window.scrollX + rect.left,
        pageTop: window.scrollY + rect.top,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
        viewportWidth: container.clientWidth,
        viewportHeight: container.clientHeight
      };
    }

    return {
      hasContainer: false,
      pageLeft: 0,
      pageTop: 0,
      scrollLeft: window.scrollX,
      scrollTop: window.scrollY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  }

  private registerContainerForDrawing(
    drawingId: string,
    container: HTMLElement,
    isShared: boolean
  ): void {
    if (isShared) {
      this.sharedDrawingContainers.set(drawingId, container);
    } else {
      this.drawingContainers.set(drawingId, container);
    }

    if (!this.containerScrollListeners.has(container)) {
      const handler = () => {
        this.updateDrawingsForContainer(container);
      };
      container.addEventListener('scroll', handler, { passive: true });
      this.containerScrollListeners.set(container, handler);
    }
  }

  private unregisterContainerForDrawing(drawingId: string, isShared: boolean): void {
    const map = isShared ? this.sharedDrawingContainers : this.drawingContainers;
    const container = map.get(drawingId);
    if (!container) {
      return;
    }

    map.delete(drawingId);

    const stillUsed =
      Array.from(this.drawingContainers.values()).includes(container) ||
      Array.from(this.sharedDrawingContainers.values()).includes(container);

    if (!stillUsed) {
      const listener = this.containerScrollListeners.get(container);
      if (listener) {
        container.removeEventListener('scroll', listener);
        this.containerScrollListeners.delete(container);
      }
    }
  }

  private updateDrawingsForContainer(container: HTMLElement): void {
    this.drawings.forEach((component, drawingId) => {
      if (this.drawingContainers.get(drawingId) === container) {
        const context = this.buildRenderContext(container);
        component.updateTransform(context);
      }
    });

    this.sharedDrawings.forEach((component, drawingId) => {
      if (this.sharedDrawingContainers.get(drawingId) === container) {
        const context = this.buildRenderContext(container);
        component.updateTransform(context);
      }
    });
  }

  private updateAllDrawingTransforms(): void {
    this.drawings.forEach((component, drawingId) => {
      const container = this.drawingContainers.get(drawingId) ?? null;
      const context = this.buildRenderContext(container);
      component.updateTransform(context);
    });

    this.sharedDrawings.forEach((component, drawingId) => {
      const container = this.sharedDrawingContainers.get(drawingId) ?? null;
      const context = this.buildRenderContext(container);
      component.updateTransform(context);
    });
  }

  private getDefaultDrawingContext(): DrawingContext {
    return {
      container: null,
      containerSelector: undefined,
      pageLeft: 0,
      pageTop: 0,
      scrollLeft: window.scrollX,
      scrollTop: window.scrollY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  }

  private resolveDrawingContext(event: PointerEvent): DrawingContext {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const elementAtPoint = this.getUnderlyingElement(event.clientX, event.clientY, target);
    const container = this.findScrollableContainer(elementAtPoint ?? target);

    if (container) {
      const rect = container.getBoundingClientRect();
      return {
        container,
        containerSelector: generateSelector(container),
        pageLeft: window.scrollX + rect.left,
        pageTop: window.scrollY + rect.top,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
        viewportWidth: container.clientWidth,
        viewportHeight: container.clientHeight
      };
    }

    return {
      container: null,
      containerSelector: undefined,
      pageLeft: 0,
      pageTop: 0,
      scrollLeft: window.scrollX,
      scrollTop: window.scrollY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  }

  private getUnderlyingElement(
    clientX: number,
    clientY: number,
    fallback: HTMLElement | null
  ): HTMLElement | null {
    const elements = document.elementsFromPoint(clientX, clientY);
    for (const el of elements) {
      if (el === this.svgCanvas || (this.toolbar && this.toolbar.contains(el))) {
        continue;
      }
      if (el instanceof HTMLElement) {
        return el;
      }
    }
    return fallback;
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

  private convertPagePathToAnchor(pathData: string, context: DrawingContext): string {
    if (!context.container) {
      return pathData;
    }

    return pathData.replace(/([ML])\s*([-\d.]+)\s+([-\d.]+)/g, (_match, command, x, y) => {
      const anchorPoint = this.convertPagePointToAnchor(parseFloat(x), parseFloat(y), context);
      return `${command} ${anchorPoint.x} ${anchorPoint.y}`;
    });
  }

  private convertPagePointToAnchor(
    pageX: number,
    pageY: number,
    context: DrawingContext
  ): { x: number; y: number } {
    return {
      x: this.convertPageXToAnchor(pageX, context),
      y: this.convertPageYToAnchor(pageY, context)
    };
  }

  private convertPageXToAnchor(pageX: number, context: DrawingContext): number {
    if (!context.container) {
      return pageX;
    }
    return context.scrollLeft + (pageX - context.pageLeft);
  }

  private convertPageYToAnchor(pageY: number, context: DrawingContext): number {
    if (!context.container) {
      return pageY;
    }
    return context.scrollTop + (pageY - context.pageTop);
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
        // 既存の描画にviewportSizeがない場合は現在のビューポートサイズを設定
        if (!drawing.viewportSize) {
          drawing.viewportSize = {
            width: window.innerWidth,
            height: window.innerHeight
          };
          console.log('📐 Added viewportSize to existing drawing:', drawing.id);
        }

        const component = new DrawingComponent(drawing);
        if (this.svgCanvas) {
          const container = this.resolveContainerForDrawing(drawing);
          const context = this.buildRenderContext(container);
          const element = component.createSVGElement(this.svgCanvas, context);
          if (element) {
            this.svgCanvas.appendChild(element);
            this.drawings.set(drawing.id, component);
            if (container) {
              this.registerContainerForDrawing(drawing.id, container, false);
            }

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
   * URL変更時の再初期化
   */
  private async handleUrlChange(newUrl: string): Promise<void> {
    if (!newUrl || newUrl === this.currentUrl) {
      return;
    }

    console.log(`DrawingManager: URL changed ${this.currentUrl} -> ${newUrl}`);

    if (this.drawingMode) {
      this.toggleDrawingMode();
    }

    this.isDrawing = false;
    this.currentPath = null;
    this.currentPathData = '';

    this.drawings.forEach(component => component.destroy());
    this.drawings.clear();

    this.sharedDrawings.forEach(component => component.destroy());
    this.sharedDrawings.clear();
    this.drawingContainers.clear();
    this.sharedDrawingContainers.clear();

    this.containerScrollListeners.forEach((listener, container) => {
      container.removeEventListener('scroll', listener);
    });
    this.containerScrollListeners.clear();

    if (this.svgCanvas) {
      this.svgCanvas.remove();
      this.svgCanvas = null;
    }

    this.currentUrl = newUrl;

    if (!this.settings.enabled) {
      return;
    }

    try {
      await this.loadDrawings();
    } catch (error) {
      console.error('Failed to reload drawings after URL change:', error);
    }

    if (this.p2pSyncManager) {
      this.p2pSyncManager.updateCurrentUrl(newUrl);
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
      this.updateAllDrawingTransforms();
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
    this.currentDrawingContext = this.resolveDrawingContext(e);
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

    const context = this.currentDrawingContext ?? this.getDefaultDrawingContext();

    let storedPathData = this.currentPathData;
    let pagePathData: string | undefined;

    if (context.container) {
      storedPathData = this.convertPagePathToAnchor(this.currentPathData, context);
      pagePathData = this.currentPathData;
    }

    const drawing: Drawing = {
      id: generateId(),
      url: this.currentUrl,
      type: 'pen',
      pathData: storedPathData,
      color: this.currentColor,
      strokeWidth: this.currentStrokeWidth,
      scrollOffset: context.container
        ? { x: context.scrollLeft, y: context.scrollTop }
        : { x: window.scrollX, y: window.scrollY },
      containerSelector: context.containerSelector,
      pagePathData,
      viewportSize: {
        width: context.container ? context.viewportWidth : window.innerWidth,
        height: context.container ? context.viewportHeight : window.innerHeight
      },
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };

    if (this.currentPath.parentNode) {
      this.currentPath.parentNode.removeChild(this.currentPath);
    }

    if (!this.svgCanvas) {
      this.createSVGCanvas();
    }

    const svg = this.svgCanvas;
    const component = new DrawingComponent(drawing);
    if (svg) {
      const container = context.container ?? null;
      const renderContext = this.buildRenderContext(container);
      const element = component.createSVGElement(svg, renderContext);
      if (element) {
        svg.appendChild(element);
        this.setupDrawingClickHandler(element, drawing.id);
      }
    }

    this.drawings.set(drawing.id, component);
    if (context.container) {
      this.registerContainerForDrawing(drawing.id, context.container, false);
    }

    this.saveDrawing(drawing);

    this.currentPath = null;
    this.currentPathData = '';
    this.currentDrawingContext = null;
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
      // P2P共有が有効な場合はP2P経由で保存（ブロードキャスト）
      if (this.p2pSyncManager && this.settings.sharingEnabled) {
        console.log('📡 Broadcasting drawing CREATE via P2P...');
        await this.p2pSyncManager.broadcastDrawingCreate(drawing);
        console.log('✅ P2P broadcast complete');
      } else {
        console.log('💾 Saving drawing locally only');
        await StorageManager.saveDrawing(drawing, this.settings);
      }
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

      this.unregisterContainerForDrawing(drawingId, false);

      // P2P共有が有効な場合はP2P経由で削除（ブロードキャスト）
      if (this.p2pSyncManager && this.settings.sharingEnabled) {
        console.log('📡 Broadcasting drawing DELETE via P2P...');
        await this.p2pSyncManager.broadcastDrawingDelete(drawingId, this.currentUrl);
        console.log('✅ P2P broadcast complete');
      } else {
        await StorageManager.deleteDrawing(drawingId, this.currentUrl, this.settings);
      }
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
      this.drawingContainers.clear();

      if (this.svgCanvas) {
        this.svgCanvas.remove();
        this.svgCanvas = null;
      }

      this.containerScrollListeners.forEach((listener, container) => {
        container.removeEventListener('scroll', listener);
      });
      this.containerScrollListeners.clear();
      this.sharedDrawingContainers.clear();

      await StorageManager.deleteAllDrawingsForUrl(this.currentUrl, this.settings);
      console.log('All drawings deleted');
    } catch (error) {
      console.error('Failed to delete all drawings:', error);
    }
  };

  /**
   * ウィンドウリサイズリスナーを設定
   */
  private setupResizeListener(): void {
    // debounce関数（shared/utils.tsから利用）
    const debounce = (func: Function, wait: number) => {
      let timeout: number | null = null;
      return (...args: any[]) => {
        if (timeout !== null) {
          clearTimeout(timeout);
        }
        timeout = window.setTimeout(() => func(...args), wait);
      };
    };

    const handleResize = debounce(() => {
      if (!this.svgCanvas) return;

      console.log('📐 Window resized, recalculating drawing positions...');
      console.log('📐 Current drawings count:', this.drawings.size);
      console.log('📐 Current shared drawings count:', this.sharedDrawings.size);

      // 自分の描画を再作成
      this.drawings.forEach((component, drawingId) => {
        const drawing = component.getDrawing();
        console.log('📐 Recreating drawing:', drawingId, {
          hasViewportSize: !!drawing.viewportSize,
          viewportSize: drawing.viewportSize
        });
        const container = this.drawingContainers.get(drawingId) ?? null;
        const context = this.buildRenderContext(container);
        const newElement = component.recreate(this.svgCanvas!, context);
        if (newElement && drawing.id) {
          // クリックハンドラーを再設定
          this.setupDrawingClickHandler(newElement, drawing.id);
        }
      });

      // 共有描画を再作成
      this.sharedDrawings.forEach((component, drawingId) => {
        const drawing = component.getDrawing();
        console.log('📐 Recreating shared drawing:', drawingId, {
          hasViewportSize: !!drawing.viewportSize,
          viewportSize: drawing.viewportSize
        });
        const container = this.sharedDrawingContainers.get(drawingId) ?? null;
        const context = this.buildRenderContext(container);
        const newElement = component.recreate(this.svgCanvas!, context);
        if (newElement) {
          // 共有描画として視覚的に区別
          newElement.style.opacity = '0.7';
          newElement.setAttribute('data-shared', 'true');
          if ('ownerId' in drawing) {
            newElement.setAttribute('data-owner', (drawing as any).ownerId);
          }
        }
      });

      console.log('✅ Drawing positions recalculated');
    }, 300); // 300ms debounce

    window.addEventListener('resize', handleResize);
    console.log('✅ Drawing resize listener setup complete');
  }

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

        case 'SPA_URL_CHANGED':
          if (typeof message.url === 'string') {
            this.handleUrlChange(message.url).catch(error => {
              console.error('Failed to handle SPA URL change in DrawingManager:', error);
            });
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Invalid URL' });
          }
          break;

        default:
          return false;
      }

      return true;
    });
  }
}
