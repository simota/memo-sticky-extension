/**
 * Popup UI スクリプト
 */

import { StorageManager } from '../shared/storage';

// DOM要素
const enableToggle = document.getElementById('enableToggle') as HTMLInputElement;
const createMemoBtn = document.getElementById('createMemoBtn') as HTMLButtonElement;
const toggleDrawingBtn = document.getElementById('toggleDrawingBtn') as HTMLButtonElement;
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
const importBtn = document.getElementById('importBtn') as HTMLButtonElement;
const importFileInput = document.getElementById('importFileInput') as HTMLInputElement;
const settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;
const memoCountElement = document.getElementById('memoCount') as HTMLParagraphElement;

/**
 * 初期化
 */
async function init(): Promise<void> {
  try {
    // 設定を読み込み
    const settings = await StorageManager.getSettings();
    enableToggle.checked = settings.enabled;

    // 現在のタブのメモ数を取得
    await updateMemoCount();

    // イベントリスナーを設定
    setupEventListeners();

    console.log('Popup initialized');
  } catch (error) {
    console.error('Failed to initialize popup:', error);
  }
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners(): void {
  // 有効/無効の切り替え
  enableToggle.addEventListener('change', async () => {
    await StorageManager.saveSettings({ enabled: enableToggle.checked });
  });

  // 新しいメモを作成
  createMemoBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'CREATE_MEMO' });
      window.close();
    }
  });

  // 描画モード切り替え
  toggleDrawingBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_DRAWING_MODE' }, (response) => {
        if (response?.enabled) {
          toggleDrawingBtn.textContent = '描画モード: ON';
          toggleDrawingBtn.classList.add('active');
        } else {
          toggleDrawingBtn.textContent = '描画モード: OFF';
          toggleDrawingBtn.classList.remove('active');
        }
      });
    }
  });

  // エクスポート
  exportBtn.addEventListener('click', async () => {
    await exportData();
  });

  // インポート
  importBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await importData(file);
    }
  });

  // 設定を開く
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

/**
 * メモ数を更新
 */
async function updateMemoCount(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url) return;

    const settings = await StorageManager.getSettings();
    const memos = await StorageManager.getMemosForUrl(tab.url, settings);

    memoCountElement.textContent = `このページのメモ: ${memos.length}個`;
  } catch (error) {
    console.error('Failed to update memo count:', error);
  }
}

/**
 * データをエクスポート
 */
async function exportData(): Promise<void> {
  try {
    const data = await StorageManager.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `memo-sticky-export-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    console.log('Data exported successfully');
  } catch (error) {
    console.error('Failed to export data:', error);
    alert('エクスポートに失敗しました');
  }
}

/**
 * データをインポート
 */
async function importData(file: File): Promise<void> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    await StorageManager.importData(data);

    alert('インポートが完了しました');
    await updateMemoCount();

    console.log('Data imported successfully');
  } catch (error) {
    console.error('Failed to import data:', error);
    alert('インポートに失敗しました');
  }
}

// 初期化を実行
init();
