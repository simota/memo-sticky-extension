/**
 * Chrome Storage APIラッパー
 */

import { Memo, MemoStorage, Settings, DEFAULT_SETTINGS } from './types';
import { STORAGE_KEYS } from './constants';
import { normalizeUrl } from './utils';

/**
 * ストレージ管理クラス
 */
export class StorageManager {
  /**
   * 全メモデータを取得
   */
  static async getAllMemos(): Promise<MemoStorage> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.MEMOS);
      return result[STORAGE_KEYS.MEMOS] || {};
    } catch (error) {
      console.error('Failed to get all memos:', error);
      return {};
    }
  }

  /**
   * 特定URLのメモを取得
   *
   * フォールバック機能:
   * - removeQueryParams設定を後から変更した場合でも、両方のキーを試す
   * - メインキーで見つからない場合、逆のキー（クエリあり/なし）も探す
   */
  static async getMemosForUrl(url: string, settings?: Settings): Promise<Memo[]> {
    try {
      const removeQuery = settings?.removeQueryParams ?? false;
      const normalizedUrl = normalizeUrl(url, removeQuery);
      const allMemos = await this.getAllMemos();

      // メインキーでメモを取得
      let memos = allMemos[normalizedUrl];

      // メモが見つからない場合、逆のキーでフォールバック
      if (!memos || memos.length === 0) {
        const fallbackUrl = normalizeUrl(url, !removeQuery);
        memos = allMemos[fallbackUrl];

        // フォールバックで見つかった場合、メインキーに移行
        if (memos && memos.length > 0) {
          console.log(`Migrating memos from ${fallbackUrl} to ${normalizedUrl}`);
          allMemos[normalizedUrl] = memos;
          delete allMemos[fallbackUrl];
          await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: allMemos });
        }
      }

      return memos || [];
    } catch (error) {
      console.error('Failed to get memos for URL:', error);
      return [];
    }
  }

  /**
   * メモを保存
   */
  static async saveMemo(memo: Memo, settings?: Settings): Promise<void> {
    try {
      const removeQuery = settings?.removeQueryParams ?? false;
      const normalizedUrl = normalizeUrl(memo.url, removeQuery);
      const allMemos = await this.getAllMemos();

      if (!allMemos[normalizedUrl]) {
        allMemos[normalizedUrl] = [];
      }

      // 既存のメモを更新または新規追加
      const existingIndex = allMemos[normalizedUrl].findIndex(m => m.id === memo.id);
      if (existingIndex !== -1) {
        allMemos[normalizedUrl][existingIndex] = memo;
      } else {
        allMemos[normalizedUrl].push(memo);
      }

      await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: allMemos });
    } catch (error) {
      console.error('Failed to save memo:', error);
      throw error;
    }
  }

  /**
   * メモを削除
   */
  static async deleteMemo(memoId: string, url: string, settings?: Settings): Promise<void> {
    try {
      const removeQuery = settings?.removeQueryParams ?? false;
      const normalizedUrl = normalizeUrl(url, removeQuery);
      const allMemos = await this.getAllMemos();

      if (allMemos[normalizedUrl]) {
        allMemos[normalizedUrl] = allMemos[normalizedUrl].filter(m => m.id !== memoId);

        // URLにメモが1つもなくなった場合は削除
        if (allMemos[normalizedUrl].length === 0) {
          delete allMemos[normalizedUrl];
        }

        await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: allMemos });
      }
    } catch (error) {
      console.error('Failed to delete memo:', error);
      throw error;
    }
  }

  /**
   * 特定URLの全メモを削除
   */
  static async deleteAllMemosForUrl(url: string, settings?: Settings): Promise<void> {
    try {
      const removeQuery = settings?.removeQueryParams ?? false;
      const normalizedUrl = normalizeUrl(url, removeQuery);
      const allMemos = await this.getAllMemos();

      delete allMemos[normalizedUrl];

      await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: allMemos });
    } catch (error) {
      console.error('Failed to delete all memos for URL:', error);
      throw error;
    }
  }

  /**
   * 設定を取得
   */
  static async getSettings(): Promise<Settings> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      return {
        ...DEFAULT_SETTINGS,
        ...(result[STORAGE_KEYS.SETTINGS] || {})
      };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * 設定を保存
   */
  static async saveSettings(settings: Partial<Settings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...settings };
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * ストレージの変更を監視
   */
  static addChangeListener(
    callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
  ): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    });
  }

  /**
   * 全データをエクスポート
   */
  static async exportData(): Promise<{ memos: MemoStorage; settings: Settings }> {
    try {
      const memos = await this.getAllMemos();
      const settings = await this.getSettings();
      return { memos, settings };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * データをインポート
   */
  static async importData(data: { memos?: MemoStorage; settings?: Settings }): Promise<void> {
    try {
      if (data.memos) {
        await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: data.memos });
      }
      if (data.settings) {
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: data.settings });
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  /**
   * 全データを削除
   */
  static async clearAllData(): Promise<void> {
    try {
      await chrome.storage.local.clear();
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }
}
