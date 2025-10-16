/**
 * ユーザーID管理
 * P2P接続用のユニークなピアIDを生成・管理
 */

import { v4 as uuidv4 } from 'uuid';
import { STORAGE_KEYS } from './constants';

export class UserManager {
  /**
   * ユーザーIDを取得（なければ生成）
   */
  static async getUserId(): Promise<string> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_ID);

      if (result[STORAGE_KEYS.USER_ID]) {
        return result[STORAGE_KEYS.USER_ID];
      }

      // IDが存在しない場合は生成
      const userId = this.generateUserId();
      await this.saveUserId(userId);

      console.log('New user ID generated:', userId);
      return userId;
    } catch (error) {
      console.error('Failed to get user ID:', error);
      // エラー時は一時的なIDを返す
      return this.generateUserId();
    }
  }

  /**
   * ユニークなユーザーIDを生成
   * フォーマット: memo-{uuid-prefix}
   */
  private static generateUserId(): string {
    // UUIDの最初の8文字を使用（短く読みやすく）
    const uuid = uuidv4().split('-')[0];
    return `memo-${uuid}`;
  }

  /**
   * ユーザーIDを保存
   */
  private static async saveUserId(userId: string): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.USER_ID]: userId });
    } catch (error) {
      console.error('Failed to save user ID:', error);
      throw error;
    }
  }

  /**
   * ユーザーIDをリセット（新しいIDを生成）
   */
  static async resetUserId(): Promise<string> {
    const newUserId = this.generateUserId();
    await this.saveUserId(newUserId);
    console.log('User ID reset:', newUserId);
    return newUserId;
  }

  /**
   * ユーザーIDが存在するか確認
   */
  static async hasUserId(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_ID);
      return !!result[STORAGE_KEYS.USER_ID];
    } catch (error) {
      console.error('Failed to check user ID:', error);
      return false;
    }
  }
}
