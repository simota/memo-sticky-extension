/**
 * Content Script エントリーポイント
 */

import { MemoManager } from './MemoManager';

// グローバルに1つだけMemoManagerインスタンスを保持
let memoManager: MemoManager | null = null;

/**
 * 拡張機能を初期化
 */
function initializeExtension(): void {
  // 既に初期化済みの場合は何もしない
  if (memoManager) {
    console.log('MemoManager already initialized');
    return;
  }

  try {
    memoManager = new MemoManager();
    console.log('Memo Sticky Extension initialized');
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
}
