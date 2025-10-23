/**
 * Content Script エントリーポイント
 */

import { MemoManager } from './MemoManager';
import { HighlightManager } from './HighlightManager';
import { DrawingManager } from './DrawingManager';

// グローバルに1つだけマネージャーインスタンスを保持
let memoManager: MemoManager | null = null;
let highlightManager: HighlightManager | null = null;
let drawingManager: DrawingManager | null = null;
let spaNavigationHandlerInitialized = false;

/**
 * SPA遷移に対応するためのURL変更監視をセットアップ
 */
function setupSpaNavigationHandling(): void {
  if (spaNavigationHandlerInitialized) {
    return;
  }

  spaNavigationHandlerInitialized = true;
  let lastUrl = window.location.href;

  const applyUrlChangeToManagers = async (url: string): Promise<void> => {
    console.log('🔄 Detected SPA navigation, refreshing managers for URL:', url);

    try {
      if (memoManager) {
        await memoManager.handleUrlChange(url);
      }

      if (highlightManager) {
        await highlightManager.handleUrlChange(url);
      }

      if (drawingManager) {
        await drawingManager.handleUrlChange(url);
      }
    } catch (error) {
      console.error('Failed to refresh managers after SPA navigation:', error);
    }
  };

  const checkForUrlChange = () => {
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) {
      return;
    }

    lastUrl = currentUrl;
    void applyUrlChangeToManagers(currentUrl);
  };

  const scheduleUrlCheck = () => {
    window.requestAnimationFrame(checkForUrlChange);
  };

  window.addEventListener('popstate', scheduleUrlCheck);
  window.addEventListener('hashchange', scheduleUrlCheck);

  const originalPushState = history.pushState;
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    const result = originalPushState.apply(this, args);
    scheduleUrlCheck();
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    const result = originalReplaceState.apply(this, args);
    scheduleUrlCheck();
    return result;
  };
}

/**
 * 拡張機能を初期化
 */
function initializeExtension(): void {
  // 既に初期化済みの場合は何もしない
  if (memoManager && highlightManager && drawingManager) {
    console.log('Extension already initialized');
    return;
  }

  try {
    memoManager = new MemoManager();
    highlightManager = new HighlightManager();
    drawingManager = new DrawingManager();

    // MemoManagerのP2P初期化完了後、DrawingManagerにP2PSyncManagerを設定
    memoManager.onP2PInitialized((p2pManager) => {
      console.log('✅ P2P initialized, setting up DrawingManager');
      drawingManager?.setP2PSyncManager(p2pManager);
    });

    console.log('Memo Sticky Extension initialized (Memo + Highlight + Drawing)');

    setupSpaNavigationHandling();
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
  (window as any).drawingManager = drawingManager;
}
