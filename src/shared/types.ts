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
  isMinimized?: boolean;
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
  defaultColor: '#FFFF88', // イエロー（ポストイット風）
  defaultSize: {
    width: 180,
    height: 120
  },
  defaultFontSize: 13,
  syncEnabled: false,
  excludedDomains: [],
  removeQueryParams: false
};

// デフォルトスタイル
export const DEFAULT_STYLE: Omit<MemoStyle, 'zIndex'> = {
  color: '#FFFF88',
  width: 180,
  height: 120,
  fontSize: 13
};

// プリセットカラー（ポストイット風）
export const PRESET_COLORS = [
  '#FFFF88', // イエロー（クラシック）
  '#CCFF90', // グリーン
  '#81D4FA', // ブルー
  '#F48FB1', // ピンク
  '#FFAB91'  // オレンジ
];

// ハイライト（マーカー）用カラー
export const HIGHLIGHT_COLORS = [
  { id: 'yellow', name: '黄色', color: '#FFFF00', bg: 'rgba(255, 255, 0, 0.3)' },
  { id: 'green', name: '緑', color: '#00FF00', bg: 'rgba(0, 255, 0, 0.3)' },
  { id: 'blue', name: '青', color: '#00BFFF', bg: 'rgba(0, 191, 255, 0.3)' },
  { id: 'pink', name: 'ピンク', color: '#FF69B4', bg: 'rgba(255, 105, 180, 0.3)' },
  { id: 'orange', name: 'オレンジ', color: '#FFA500', bg: 'rgba(255, 165, 0, 0.3)' }
];

// ハイライトの位置情報
export interface HighlightPosition {
  // XPathベースの位置情報
  startContainerXPath: string;
  endContainerXPath: string;
  startOffset: number;
  endOffset: number;
  // バックアップ用テキスト情報
  text: string;
  prefix: string; // 前後20文字程度
  suffix: string;
}

// ハイライトの基本データ構造
export interface Highlight {
  id: string;
  url: string;
  color: string;
  position: HighlightPosition;
  createdAt: number;
  updatedAt: number;
}

// URL単位でハイライトを管理
export interface HighlightStorage {
  [url: string]: Highlight[];
}
