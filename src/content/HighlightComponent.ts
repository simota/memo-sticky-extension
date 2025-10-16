/**
 * ハイライト（マーカー）コンポーネント
 */

import { Highlight, HighlightPosition } from '../shared/types';
import { CSS_CLASSES } from '../shared/constants';
import { generateId, getCurrentTimestamp } from '../shared/utils';

/**
 * XPathを生成
 */
export function getXPath(node: Node): string {
  if (node.nodeType === Node.DOCUMENT_NODE) {
    return '/';
  }

  const parent = node.parentNode;
  if (!parent) {
    return '';
  }

  const parentXPath = getXPath(parent);
  const siblings = Array.from(parent.childNodes);
  const nodeType = node.nodeType === Node.TEXT_NODE ? 'text()' : node.nodeName.toLowerCase();
  const index = siblings.filter(s =>
    (node.nodeType === Node.TEXT_NODE && s.nodeType === Node.TEXT_NODE) ||
    (node.nodeType !== Node.TEXT_NODE && s.nodeName === node.nodeName)
  ).indexOf(node as ChildNode) + 1;

  return `${parentXPath}/${nodeType}[${index}]`;
}

/**
 * XPathからノードを取得
 */
export function getNodeByXPath(xpath: string): Node | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } catch (error) {
    console.error('Failed to evaluate XPath:', error);
    return null;
  }
}

/**
 * Rangeから位置情報を抽出
 */
export function extractPosition(range: Range): HighlightPosition | null {
  try {
    const text = range.toString();
    const startXPath = getXPath(range.startContainer);
    const endXPath = getXPath(range.endContainer);

    // 前後のコンテキストを取得
    const fullText = range.startContainer.textContent || '';
    const start = range.startOffset;
    const prefix = fullText.substring(Math.max(0, start - 20), start);
    const suffix = fullText.substring(
      range.endOffset,
      Math.min(fullText.length, range.endOffset + 20)
    );

    return {
      startContainerXPath: startXPath,
      endContainerXPath: endXPath,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      text,
      prefix,
      suffix
    };
  } catch (error) {
    console.error('Failed to extract position:', error);
    return null;
  }
}

/**
 * 位置情報からRangeを復元
 */
export function restoreRange(position: HighlightPosition): Range | null {
  try {
    const startNode = getNodeByXPath(position.startContainerXPath);
    const endNode = getNodeByXPath(position.endContainerXPath);

    if (!startNode || !endNode) {
      console.warn('Failed to find nodes from XPath');
      return null;
    }

    const range = document.createRange();
    range.setStart(startNode, position.startOffset);
    range.setEnd(endNode, position.endOffset);

    // テキストが一致するか確認
    if (range.toString() !== position.text) {
      console.warn('Text mismatch, trying to find by context');
      return findByTextContext(position);
    }

    return range;
  } catch (error) {
    console.error('Failed to restore range:', error);
    return findByTextContext(position);
  }
}

/**
 * テキストコンテキストから範囲を検索（フォールバック）
 */
function findByTextContext(position: HighlightPosition): Range | null {
  try {
    const bodyText = document.body.textContent || '';
    const searchText = position.prefix + position.text + position.suffix;
    const index = bodyText.indexOf(searchText);

    if (index === -1) {
      console.warn('Could not find text context in document');
      return null;
    }

    // TreeWalkerで該当テキストノードを探す
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;

    const targetStart = index + position.prefix.length;
    const targetEnd = targetStart + position.text.length;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLength = node.textContent?.length || 0;

      if (currentOffset <= targetStart && targetStart < currentOffset + nodeLength) {
        startNode = node;
        startOffset = targetStart - currentOffset;
      }

      if (currentOffset <= targetEnd && targetEnd <= currentOffset + nodeLength) {
        endNode = node;
        endOffset = targetEnd - currentOffset;
        break;
      }

      currentOffset += nodeLength;
    }

    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    }

    return null;
  } catch (error) {
    console.error('Failed to find by text context:', error);
    return null;
  }
}

/**
 * ハイライトコンポーネントクラス
 */
export class HighlightComponent {
  private highlight: Highlight;
  private elements: HTMLElement[] = [];
  private onDelete: (highlightId: string) => void;

  constructor(
    highlight: Highlight,
    onDelete: (highlightId: string) => void
  ) {
    this.highlight = highlight;
    this.onDelete = onDelete;
  }

  /**
   * 選択範囲からハイライトを作成
   */
  static createFromSelection(
    url: string,
    color: string,
    onDelete: (highlightId: string) => void
  ): HighlightComponent | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      return null;
    }

    const position = extractPosition(range);
    if (!position) {
      return null;
    }

    const highlight: Highlight = {
      id: generateId(),
      url,
      color,
      position,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp()
    };

    const component = new HighlightComponent(highlight, onDelete);
    component.render(range);

    // 選択を解除
    selection.removeAllRanges();

    return component;
  }

  /**
   * 保存されたデータからハイライトを復元
   */
  restore(): boolean {
    const range = restoreRange(this.highlight.position);
    if (!range) {
      console.warn('Failed to restore highlight:', this.highlight.id);
      return false;
    }

    this.render(range);
    return true;
  }

  /**
   * ハイライトをレンダリング
   */
  private render(range: Range): void {
    try {
      // rangeの内容を<mark>要素でラップ
      const mark = document.createElement('mark');
      mark.className = CSS_CLASSES.HIGHLIGHT;
      mark.dataset.highlightId = this.highlight.id;
      mark.style.cssText = `
        background-color: ${this.highlight.color};
        cursor: pointer;
        position: relative;
      `;

      // クリックで削除
      mark.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.delete();
      });

      // ホバー時の視覚フィードバック
      mark.addEventListener('mouseenter', () => {
        mark.style.opacity = '0.7';
      });

      mark.addEventListener('mouseleave', () => {
        mark.style.opacity = '1';
      });

      // Rangeの内容を囲む
      range.surroundContents(mark);
      this.elements.push(mark);
    } catch (error) {
      // surroundContentsが失敗する場合（複数要素にまたがる場合）
      console.warn('surroundContents failed, using extractContents:', error);
      this.renderComplex(range);
    }
  }

  /**
   * 複雑な範囲のレンダリング（複数要素にまたがる場合）
   */
  private renderComplex(range: Range): void {
    const fragment = range.extractContents();
    const mark = document.createElement('mark');
    mark.className = CSS_CLASSES.HIGHLIGHT;
    mark.dataset.highlightId = this.highlight.id;
    mark.style.cssText = `
      background-color: ${this.highlight.color};
      cursor: pointer;
    `;

    mark.appendChild(fragment);

    mark.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.delete();
    });

    range.insertNode(mark);
    this.elements.push(mark);
  }

  /**
   * ハイライトを削除
   */
  delete(): void {
    this.elements.forEach(el => {
      // <mark>の内容を親要素に戻す
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
    });

    this.elements = [];
    this.onDelete(this.highlight.id);
  }

  /**
   * ハイライトデータを取得
   */
  getHighlight(): Highlight {
    return this.highlight;
  }

  /**
   * 要素を取得
   */
  getElements(): HTMLElement[] {
    return this.elements;
  }
}
