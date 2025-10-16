/**
 * 付箋メモのデータ構造定義
 */

// 位置情報の種類
export type PositionType = 'fixed' | 'element';

// 付箋の位置情報
export interface MemoPosition {
  x: number;
  y: number;
  type: PositionType;
}

// 要素紐付け情報（type='element'の場合）
export interface ElementBinding {
  selector: string;
  offset: {
    x: number;
    y: number;
  };
}

// 付箋のスタイル設定
export interface MemoStyle {
  color: string;
  width: number;
  height: number;
  fontSize: number;
  zIndex: number;
}

// メモの基本データ構造
export interface Memo {
  id: string;
  url: string;
  content: string;
  position: MemoPosition;
  element?: ElementBinding;
  style: MemoStyle;
  createdAt: number;
  updatedAt: number;
}

// URL単位でメモを管理
export interface MemoStorage {
  [url: string]: Memo[];
}

// グローバル設定
export interface Settings {
  enabled: boolean;
  defaultColor: string;
  defaultSize: {
    width: number;
    height: number;
  };
  defaultFontSize: number;
  syncEnabled: boolean;
  excludedDomains: string[];
  removeQueryParams: boolean;
}

// メッセージング用の型定義
export type MessageType =
  | 'CREATE_MEMO'
  | 'UPDATE_MEMO'
  | 'DELETE_MEMO'
  | 'GET_MEMOS'
  | 'TOGGLE_CREATE_MODE'
  | 'SAVE_SETTINGS';

export interface Message {
  type: MessageType;
  payload?: any;
}

// デフォルト設定
export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  defaultColor: '#FFFACD', // 薄黄色
  defaultSize: {
    width: 200,
    height: 150
  },
  defaultFontSize: 14,
  syncEnabled: false,
  excludedDomains: [],
  removeQueryParams: false
};

// デフォルトスタイル
export const DEFAULT_STYLE: Omit<MemoStyle, 'zIndex'> = {
  color: '#FFFACD',
  width: 200,
  height: 150,
  fontSize: 14
};

// プリセットカラー
export const PRESET_COLORS = [
  '#FFFACD', // 薄黄色
  '#FFE4E1', // ピンク
  '#E0FFFF', // 水色
  '#F0E68C', // カーキ
  '#DDA0DD', // 薄紫
  '#98FB98'  // 薄緑
];
