/**
 * ユーティリティ関数
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * UUIDを生成
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * URLを正規化（オプションでクエリパラメータを除去）
 */
export function normalizeUrl(url: string, removeQuery: boolean = false): string {
  try {
    const urlObj = new URL(url);
    return removeQuery
      ? `${urlObj.origin}${urlObj.pathname}`
      : url;
  } catch (error) {
    console.error('Invalid URL:', url);
    return url;
  }
}

/**
 * デバウンス関数（flush機能付き）
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { flush: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = function(...args: Parameters<T>) {
    lastArgs = args;
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      lastArgs = null;
    }, wait);
  };

  // 即座に実行するflushメソッドを追加
  debounced.flush = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (lastArgs) {
      func(...lastArgs);
      lastArgs = null;
    }
  };

  return debounced as typeof debounced & { flush: () => void };
}

/**
 * 数値を範囲内に収める
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 現在のタイムスタンプを取得
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * HTMLをサニタイズ（基本的なXSS対策）
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * 要素がビューポート内にあるかチェック
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * ドメインが除外リストに含まれているかチェック
 */
export function isDomainExcluded(url: string, excludedDomains: string[]): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    return excludedDomains.some(domain => {
      // ワイルドカード対応
      if (domain.startsWith('*.')) {
        const baseDomain = domain.slice(2);
        return hostname.endsWith(baseDomain);
      }
      return hostname === domain;
    });
  } catch (error) {
    return false;
  }
}

/**
 * CSSセレクターを生成（要素を一意に特定するため）
 */
export function generateSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`;
  }

  if (element.className) {
    const classes = element.className.split(' ').filter(c => c.trim());
    if (classes.length > 0) {
      return `.${classes.join('.')}`;
    }
  }

  // パスベースのセレクター
  const path: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    } else {
      const siblings = current.parentElement?.children;
      if (siblings && siblings.length > 1) {
        const index = Array.from(siblings).indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      path.unshift(selector);
    }

    current = current.parentElement;
  }

  return path.join(' > ');
}
