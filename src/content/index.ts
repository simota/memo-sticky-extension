/**
 * Content Script エントリーポイント
 */

import { MemoManager } from './MemoManager';
import { HighlightManager } from './HighlightManager';

// グローバルに1つだけマネージャーインスタンスを保持
let memoManager: MemoManager | null = null;
let highlightManager: HighlightManager | null = null;

/**
 * 拡張機能を初期化
 */
function initializeExtension(): void {
  // 既に初期化済みの場合は何もしない
  if (memoManager && highlightManager) {
    console.log('Extension already initialized');
    return;
  }

  try {
    memoManager = new MemoManager();
    highlightManager = new HighlightManager();
    console.log('Memo Sticky Extension initialized (Memo + Highlight)');
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
}

/**
 * DOM読み込み完了後に初期化
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  // 既に読み込み完了している場合
  initializeExtension();
}

// キーボードショートカットリスナー
chrome.commands?.onCommand.addListener((command) => {
  if (command === 'create-memo' && memoManager) {
    memoManager.toggleCreateMode();
  }
});

// ページアンロード時のクリーンアップ
window.addEventListener('beforeunload', () => {
  console.log('Cleaning up Memo Sticky Extension');
  // 必要に応じてクリーンアップ処理を追加
});

// デバッグ用：グローバルに公開（開発時のみ）
// @ts-ignore
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
  (window as any).memoManager = memoManager;
  (window as any).highlightManager = highlightManager;
}
