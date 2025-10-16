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

    try {
      if (type === 'pen') {
        // フリーハンド描画
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
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
        circle.setAttribute('cx', params.cx);
        circle.setAttribute('cy', params.cy);
        circle.setAttribute('r', params.r);
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
        rect.setAttribute('x', params.x);
        rect.setAttribute('y', params.y);
        rect.setAttribute('width', params.width);
        rect.setAttribute('height', params.height);
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
