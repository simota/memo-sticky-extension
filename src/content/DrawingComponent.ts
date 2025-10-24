/**
 * 描画コンポーネント - 個別のSVG描画要素を管理
 */

import { Drawing } from '../shared/types';

export interface DrawingRenderContext {
  hasContainer: boolean;
  pageLeft: number;
  pageTop: number;
  scrollLeft: number;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
}

export class DrawingComponent {
  private drawing: Drawing;
  private element: SVGElement | null = null;
  private renderedWithContainer = false;

  constructor(drawing: Drawing) {
    this.drawing = drawing;
  }

  /**
   * SVG要素を作成
   */
  createSVGElement(_svg: SVGSVGElement, context: DrawingRenderContext): SVGElement | null {
    const { type, color, strokeWidth } = this.drawing;
    const activePathData = this.getPathDataForContext(context);

    // ビューポートスケーリング計算
    let scaleX = 1;
    let scaleY = 1;

    if (!context.hasContainer && this.drawing.viewportSize) {
      const currentWidth = context.viewportWidth;
      const currentHeight = context.viewportHeight;
      const originalWidth = this.drawing.viewportSize.width;
      const originalHeight = this.drawing.viewportSize.height;

      scaleX = currentWidth / originalWidth;
      scaleY = currentHeight / originalHeight;

      console.log('📐 Scaling drawing:', {
        original: { width: originalWidth, height: originalHeight },
        current: { width: currentWidth, height: currentHeight },
        scale: { x: scaleX, y: scaleY }
      });
    }

    try {
      if (type === 'pen') {
        const scaledPathData = this.scalePathData(activePathData, scaleX, scaleY);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', scaledPathData);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', strokeWidth.toString());
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.dataset.drawingId = this.drawing.id;
        this.applyTransform(path, context);
        this.element = path;
        this.renderedWithContainer = context.hasContainer;
        return path;
      } else if (type === 'circle') {
        const params = JSON.parse(activePathData);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', (parseFloat(params.cx) * scaleX).toString());
        circle.setAttribute('cy', (parseFloat(params.cy) * scaleY).toString());
        circle.setAttribute('r', (parseFloat(params.r) * Math.min(scaleX, scaleY)).toString());
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', strokeWidth.toString());
        circle.setAttribute('fill', 'none');
        circle.dataset.drawingId = this.drawing.id;
        this.applyTransform(circle, context);
        this.element = circle;
        this.renderedWithContainer = context.hasContainer;
        return circle;
      } else if (type === 'rect') {
        const params = JSON.parse(activePathData);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', (parseFloat(params.x) * scaleX).toString());
        rect.setAttribute('y', (parseFloat(params.y) * scaleY).toString());
        rect.setAttribute('width', (parseFloat(params.width) * scaleX).toString());
        rect.setAttribute('height', (parseFloat(params.height) * scaleY).toString());
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', strokeWidth.toString());
        rect.setAttribute('fill', 'none');
        rect.dataset.drawingId = this.drawing.id;
        this.applyTransform(rect, context);
        this.element = rect;
        this.renderedWithContainer = context.hasContainer;
        return rect;
      }
    } catch (error) {
      console.error('Failed to create SVG element:', error);
    }

    return null;
  }

  private getPathDataForContext(context: DrawingRenderContext): string {
    if (!context.hasContainer && this.drawing.pagePathData) {
      return this.drawing.pagePathData;
    }
    return this.drawing.pathData;
  }

  /**
   * pathDataをスケーリング
   */
  private scalePathData(pathData: string, scaleX: number, scaleY: number): string {
    if (scaleX === 1 && scaleY === 1) {
      return pathData;
    }

    console.log('🔧 scalePathData input:', { pathData, scaleX, scaleY });

    const result = pathData.replace(/([ML])\s*([-\d.]+)\s+([-\d.]+)/g, (_match, command, x, y) => {
      const scaledX = parseFloat(x) * scaleX;
      const scaledY = parseFloat(y) * scaleY;
      return `${command} ${scaledX} ${scaledY}`;
    });

    console.log('🔧 scalePathData output:', result);
    return result;
  }

  private applyTransform(element: SVGElement, context: DrawingRenderContext): void {
    if (context.hasContainer) {
      const translateX = context.pageLeft - context.scrollLeft;
      const translateY = context.pageTop - context.scrollTop;
      element.setAttribute('transform', `translate(${translateX}, ${translateY})`);
    } else {
      element.removeAttribute('transform');
    }
  }

  updateTransform(context: DrawingRenderContext): void {
    if (!this.element) {
      return;
    }
    this.applyTransform(this.element, context);
  }

  /**
   * 描画を再作成（ウィンドウリサイズ時など）
   */
  recreate(svg: SVGSVGElement, context: DrawingRenderContext): SVGElement | null {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    const newElement = this.createSVGElement(svg, context);
    if (newElement && svg) {
      svg.appendChild(newElement);
    }
    return newElement;
  }

  getDrawing(): Drawing {
    return this.drawing;
  }

  isRenderedWithinContainer(): boolean {
    return this.renderedWithContainer;
  }

  getElement(): SVGElement | null {
    return this.element;
  }

  destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.renderedWithContainer = false;
  }
}
