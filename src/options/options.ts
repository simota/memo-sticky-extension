/**
 * Options ページスクリプト
 */

import { StorageManager } from '../shared/storage';
import { Settings } from '../shared/types';

// DOM要素
const enabledToggle = document.getElementById('enabledToggle') as HTMLInputElement;
const defaultColor = document.getElementById('defaultColor') as HTMLInputElement;
const defaultWidth = document.getElementById('defaultWidth') as HTMLInputElement;
const defaultHeight = document.getElementById('defaultHeight') as HTMLInputElement;
const defaultFontSize = document.getElementById('defaultFontSize') as HTMLInputElement;
const removeQueryParams = document.getElementById('removeQueryParams') as HTMLInputElement;
const syncEnabled = document.getElementById('syncEnabled') as HTMLInputElement;
const excludedDomains = document.getElementById('excludedDomains') as HTMLTextAreaElement;
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
const importBtn = document.getElementById('importBtn') as HTMLButtonElement;
const clearAllBtn = document.getElementById('clearAllBtn') as HTMLButtonElement;
const importFileInput = document.getElementById('importFileInput') as HTMLInputElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const saveStatus = document.getElementById('saveStatus') as HTMLSpanElement;

/**
 * 初期化
 */
async function init(): Promise<void> {
  try {
    // 設定を読み込み
    const settings = await StorageManager.getSettings();
    loadSettings(settings);

    // イベントリスナーを設定
    setupEventListeners();

    console.log('Options page initialized');
  } catch (error) {
    console.error('Failed to initialize options page:', error);
  }
}

/**
 * 設定を読み込み
 */
function loadSettings(settings: Settings): void {
  enabledToggle.checked = settings.enabled;
  defaultColor.value = settings.defaultColor;
  defaultWidth.value = String(settings.defaultSize.width);
  defaultHeight.value = String(settings.defaultSize.height);
  defaultFontSize.value = String(settings.defaultFontSize);
  removeQueryParams.checked = settings.removeQueryParams;
  syncEnabled.checked = settings.syncEnabled;
  excludedDomains.value = settings.excludedDomains.join('\n');
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners(): void {
  // 保存ボタン
  saveBtn.addEventListener('click', async () => {
    await saveSettings();
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

  // 全データ削除
  clearAllBtn.addEventListener('click', async () => {
    if (confirm('本当に全データを削除しますか？この操作は取り消せません。')) {
      await clearAllData();
    }
  });
}

/**
 * 設定を保存
 */
async function saveSettings(): Promise<void> {
  try {
    const settings: Partial<Settings> = {
      enabled: enabledToggle.checked,
      defaultColor: defaultColor.value,
      defaultSize: {
        width: parseInt(defaultWidth.value),
        height: parseInt(defaultHeight.value)
      },
      defaultFontSize: parseInt(defaultFontSize.value),
      removeQueryParams: removeQueryParams.checked,
      syncEnabled: syncEnabled.checked,
      excludedDomains: excludedDomains.value
        .split('\n')
        .map(d => d.trim())
        .filter(d => d.length > 0)
    };

    await StorageManager.saveSettings(settings);

    // 保存完了メッセージを表示
    showSaveStatus('設定を保存しました', true);

    console.log('Settings saved successfully');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showSaveStatus('保存に失敗しました', false);
  }
}

/**
 * 保存ステータスを表示
 */
function showSaveStatus(message: string, success: boolean): void {
  saveStatus.textContent = message;
  saveStatus.style.color = success ? '#28a745' : '#dc3545';

  setTimeout(() => {
    saveStatus.textContent = '';
  }, 3000);
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

    showSaveStatus('エクスポートが完了しました', true);
    console.log('Data exported successfully');
  } catch (error) {
    console.error('Failed to export data:', error);
    showSaveStatus('エクスポートに失敗しました', false);
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

    showSaveStatus('インポートが完了しました', true);

    // 設定を再読み込み
    const settings = await StorageManager.getSettings();
    loadSettings(settings);

    console.log('Data imported successfully');
  } catch (error) {
    console.error('Failed to import data:', error);
    showSaveStatus('インポートに失敗しました', false);
  }
}

/**
 * 全データを削除
 */
async function clearAllData(): Promise<void> {
  try {
    await StorageManager.clearAllData();

    showSaveStatus('全データを削除しました', true);

    // デフォルト設定を再読み込み
    const settings = await StorageManager.getSettings();
    loadSettings(settings);

    console.log('All data cleared');
  } catch (error) {
    console.error('Failed to clear all data:', error);
    showSaveStatus('削除に失敗しました', false);
  }
}

// 初期化を実行
init();
