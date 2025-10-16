/**
 * Options ページスクリプト
 */

import { StorageManager } from '../shared/storage';
import { Settings } from '../shared/types';
import { UserManager } from '../shared/user-manager';

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

// P2P共有設定のDOM要素
const sharingEnabled = document.getElementById('sharingEnabled') as HTMLInputElement;
const myPeerId = document.getElementById('myPeerId') as HTMLInputElement;
const copyPeerIdBtn = document.getElementById('copyPeerIdBtn') as HTMLButtonElement;
const resetPeerIdBtn = document.getElementById('resetPeerIdBtn') as HTMLButtonElement;
const signalingServer = document.getElementById('signalingServer') as HTMLInputElement;
const newPeerId = document.getElementById('newPeerId') as HTMLInputElement;
const addPeerBtn = document.getElementById('addPeerBtn') as HTMLButtonElement;
const sharedPeersList = document.getElementById('sharedPeersList') as HTMLUListElement;

/**
 * 初期化
 */
async function init(): Promise<void> {
  try {
    // 設定を読み込み
    const settings = await StorageManager.getSettings();
    loadSettings(settings);

    // ピアIDを取得して表示
    await loadPeerId();

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

  // P2P共有設定
  sharingEnabled.checked = settings.sharingEnabled || false;
  signalingServer.value = settings.signalingServer || '';

  // 共有ピアリストを表示
  loadSharedPeersList(settings.sharedPeers || []);
}

/**
 * ピアIDを読み込み
 */
async function loadPeerId(): Promise<void> {
  try {
    const userId = await UserManager.getUserId();
    myPeerId.value = userId;
  } catch (error) {
    console.error('Failed to load peer ID:', error);
    myPeerId.value = 'エラー: IDを取得できませんでした';
  }
}

/**
 * 共有ピアリストを表示
 */
function loadSharedPeersList(peers: string[]): void {
  sharedPeersList.innerHTML = '';

  peers.forEach(peerId => {
    const li = document.createElement('li');
    li.className = 'peer-item';

    const span = document.createElement('span');
    span.textContent = peerId;
    span.className = 'peer-id-text';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '削除';
    removeBtn.className = 'btn btn-small btn-danger';
    removeBtn.addEventListener('click', () => removePeer(peerId));

    li.appendChild(span);
    li.appendChild(removeBtn);
    sharedPeersList.appendChild(li);
  });

  if (peers.length === 0) {
    const li = document.createElement('li');
    li.textContent = '共有相手が登録されていません';
    li.style.color = '#999';
    sharedPeersList.appendChild(li);
  }
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

  // P2P共有設定のイベントリスナー
  copyPeerIdBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(myPeerId.value);
      showSaveStatus('ピアIDをコピーしました', true);
    } catch (error) {
      console.error('Failed to copy peer ID:', error);
      showSaveStatus('コピーに失敗しました', false);
    }
  });

  resetPeerIdBtn.addEventListener('click', async () => {
    if (confirm('ピアIDを再生成しますか？共有相手は新しいIDで再接続する必要があります。')) {
      try {
        const newId = await UserManager.resetUserId();
        myPeerId.value = newId;
        showSaveStatus('ピアIDを再生成しました', true);
      } catch (error) {
        console.error('Failed to reset peer ID:', error);
        showSaveStatus('再生成に失敗しました', false);
      }
    }
  });

  addPeerBtn.addEventListener('click', async () => {
    await addPeer();
  });

  newPeerId.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      await addPeer();
    }
  });
}

/**
 * 設定を保存
 */
async function saveSettings(): Promise<void> {
  try {
    // 現在の共有ピアリストを取得
    const currentSettings = await StorageManager.getSettings();
    const sharedPeers = currentSettings.sharedPeers || [];

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
        .filter(d => d.length > 0),
      // P2P共有設定
      sharingEnabled: sharingEnabled.checked,
      signalingServer: signalingServer.value,
      sharedPeers: sharedPeers
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
 * ピアを追加
 */
async function addPeer(): Promise<void> {
  const peerId = newPeerId.value.trim();

  if (!peerId) {
    showSaveStatus('ピアIDを入力してください', false);
    return;
  }

  // 自分のIDと同じかチェック
  if (peerId === myPeerId.value) {
    showSaveStatus('自分のIDは追加できません', false);
    return;
  }

  try {
    const settings = await StorageManager.getSettings();
    const sharedPeers = settings.sharedPeers || [];

    // 既に存在するかチェック
    if (sharedPeers.includes(peerId)) {
      showSaveStatus('このピアIDは既に追加されています', false);
      return;
    }

    // 追加
    sharedPeers.push(peerId);
    await StorageManager.saveSettings({ sharedPeers });

    // UIを更新
    loadSharedPeersList(sharedPeers);
    newPeerId.value = '';

    showSaveStatus('ピアを追加しました', true);
    console.log('Peer added:', peerId);
  } catch (error) {
    console.error('Failed to add peer:', error);
    showSaveStatus('ピアの追加に失敗しました', false);
  }
}

/**
 * ピアを削除
 */
async function removePeer(peerId: string): Promise<void> {
  try {
    const settings = await StorageManager.getSettings();
    const sharedPeers = settings.sharedPeers || [];

    // 削除
    const updatedPeers = sharedPeers.filter(p => p !== peerId);
    await StorageManager.saveSettings({ sharedPeers: updatedPeers });

    // UIを更新
    loadSharedPeersList(updatedPeers);

    showSaveStatus('ピアを削除しました', true);
    console.log('Peer removed:', peerId);
  } catch (error) {
    console.error('Failed to remove peer:', error);
    showSaveStatus('ピアの削除に失敗しました', false);
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
