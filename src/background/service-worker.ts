/**
 * Background Service Worker
 */

import { StorageManager } from '../shared/storage';
import { HIGHLIGHT_COLORS } from '../shared/types';

// 拡張機能インストール時の処理
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    console.log('Memo Sticky Extension installed');

    // 初期設定を保存
    await StorageManager.saveSettings({
      enabled: true
    });
  } else if (details.reason === 'update') {
    console.log('Memo Sticky Extension updated');
  }

  // コンテキストメニューを作成（インストール/更新時に毎回実行）
  try {
    // メモ関連
    chrome.contextMenus.create({
      id: 'create-memo',
      title: 'この場所にメモを作成',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'create-memo-selection',
      title: '選択したテキストでメモを作成',
      contexts: ['selection']
    });

    // ハイライト関連
    chrome.contextMenus.create({
      id: 'highlight-parent',
      title: 'マーカーで強調',
      contexts: ['selection']
    });

    // 各色のサブメニューを作成
    HIGHLIGHT_COLORS.forEach((colorInfo) => {
      chrome.contextMenus.create({
        id: `highlight-${colorInfo.id}`,
        parentId: 'highlight-parent',
        title: colorInfo.name,
        contexts: ['selection']
      });
    });

    console.log('Context menus created');
  } catch (error) {
    console.error('Failed to create context menus:', error);
  }
});

// コマンドリスナー（キーボードショートカット）
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'create-memo') {
    // アクティブなタブにメッセージを送信
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'CREATE_MEMO' });
    }
  }
});

// メッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    });

  // 非同期応答のため、trueを返す
  return true;
});

/**
 * メッセージを処理
 */
async function handleMessage(message: any, _sender: chrome.runtime.MessageSender): Promise<any> {
  switch (message.type) {
    case 'GET_SETTINGS':
      const settings = await StorageManager.getSettings();
      return { success: true, settings };

    case 'SAVE_SETTINGS':
      await StorageManager.saveSettings(message.settings);
      return { success: true };

    case 'EXPORT_DATA':
      const data = await StorageManager.exportData();
      return { success: true, data };

    case 'IMPORT_DATA':
      await StorageManager.importData(message.data);
      return { success: true };

    case 'CLEAR_ALL_DATA':
      await StorageManager.clearAllData();
      return { success: true };

    case 'GET_MEMOS_FOR_URL':
      const memos = await StorageManager.getMemosForUrl(message.url);
      return { success: true, memos };

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// コンテキストメニューのクリックハンドラー
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  const menuId = info.menuItemId as string;

  if (menuId === 'create-memo') {
    // 右クリック位置に直接メモを作成
    chrome.tabs.sendMessage(tab.id, { type: 'CREATE_MEMO_AT_CONTEXT_POSITION' });
  } else if (menuId === 'create-memo-selection') {
    // 選択テキスト付きでメモを作成
    chrome.tabs.sendMessage(tab.id, {
      type: 'CREATE_MEMO_WITH_TEXT',
      text: info.selectionText
    });
  } else if (menuId.startsWith('highlight-')) {
    // ハイライトを作成
    const colorId = menuId.replace('highlight-', '');
    const colorInfo = HIGHLIGHT_COLORS.find(c => c.id === colorId);

    if (colorInfo) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'CREATE_HIGHLIGHT',
        color: colorInfo.bg
      });
    }
  }
});

// ストレージの変更を監視
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage changed:', areaName, changes);
});

// タブが更新された時の処理（オプション）
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 必要に応じて処理を追加
  }
});

console.log('Background Service Worker initialized');
