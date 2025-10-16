/**
 * 描画コンポーネント - 個別のSVG描画要素を管理
 */

import { Drawing } from '../shared/types';

export class DrawingComponent {
  private drawing: Drawing;
  private element: SVGElement | null = null;

  constructor(drawing: Drawing) {
    this.drawing = drawing;
  }

  /**
   * SVG要素を作成
   */
  createSVGElement(_svg: SVGSVGElement): SVGElement | null {
    const { type, pathData, color, strokeWidth } = this.drawing;

    // ビューポートスケーリング計算
    let scaleX = 1;
    let scaleY = 1;

    if (this.drawing.viewportSize) {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;
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
        // フリーハンド描画
        const scaledPathData = this.scalePathData(pathData, scaleX, scaleY);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', scaledPathData);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', strokeWidth.toString());
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.dataset.drawingId = this.drawing.id;
        this.element = path;
        return path;
      } else if (type === 'circle') {
        // 丸
        const params = JSON.parse(pathData);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', (parseFloat(params.cx) * scaleX).toString());
        circle.setAttribute('cy', (parseFloat(params.cy) * scaleY).toString());
        circle.setAttribute('r', (parseFloat(params.r) * Math.min(scaleX, scaleY)).toString());
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', strokeWidth.toString());
        circle.setAttribute('fill', 'none');
        circle.dataset.drawingId = this.drawing.id;
        this.element = circle;
        return circle;
      } else if (type === 'rect') {
        // 四角
        const params = JSON.parse(pathData);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', (parseFloat(params.x) * scaleX).toString());
        rect.setAttribute('y', (parseFloat(params.y) * scaleY).toString());
        rect.setAttribute('width', (parseFloat(params.width) * scaleX).toString());
        rect.setAttribute('height', (parseFloat(params.height) * scaleY).toString());
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', strokeWidth.toString());
        rect.setAttribute('fill', 'none');
        rect.dataset.drawingId = this.drawing.id;
        this.element = rect;
        return rect;
      }
    } catch (error) {
      console.error('Failed to create SVG element:', error);
    }

    return null;
  }

  /**
   * pathDataをスケーリング
   */
  private scalePathData(pathData: string, scaleX: number, scaleY: number): string {
    if (scaleX === 1 && scaleY === 1) {
      return pathData;
    }

    console.log('🔧 scalePathData input:', { pathData, scaleX, scaleY });

    // "M 100 200 L 150 250" のような座標をスケーリング
    // 負の数や小数点にも対応
    const result = pathData.replace(/([ML])\s*([-\d.]+)\s+([-\d.]+)/g, (_match, command, x, y) => {
      const scaledX = parseFloat(x) * scaleX;
      const scaledY = parseFloat(y) * scaleY;
      return `${command} ${scaledX} ${scaledY}`;
    });

    console.log('🔧 scalePathData output:', result);
    return result;
  }

  /**
   * 描画を再作成（ウィンドウリサイズ時など）
   */
  recreate(svg: SVGSVGElement): SVGElement | null {
    // 既存の要素を削除
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    // 新しい要素を作成
    const newElement = this.createSVGElement(svg);
    if (newElement && svg) {
      svg.appendChild(newElement);
    }
    return newElement;
  }

  /**
   * 描画データを取得
   */
  getDrawing(): Drawing {
    return this.drawing;
  }

  /**
   * SVG要素を取得
   */
  getElement(): SVGElement | null {
    return this.element;
  }

  /**
   * 削除
   */
  destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}
