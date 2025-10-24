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
  /**
   * メモを紐付けたスクロールコンテナのCSSセレクター
   * （指定がない場合はページ全体に対する固定座標として扱う）
   */
  containerSelector?: string;
  /**
   * ページ全体における座標のバックアップ（コンテナが見つからない場合に使用）
   */
  pagePosition?: { x: number; y: number };
  element?: ElementBinding;
  style: MemoStyle;
  isMinimized?: boolean;
  viewportSize?: { width: number; height: number }; // 作成時のビューポートサイズ（スケーリング用）
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
  // P2P共有設定
  sharingEnabled: boolean; // 共有機能のON/OFF
  signalingServer: string; // シグナリングサーバーURL
  sharedPeers: string[]; // 共有相手のピアID配列
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
  removeQueryParams: false,
  // P2P共有設定のデフォルト
  sharingEnabled: false, // デフォルトは無効
  signalingServer: 'wss://your-signaling-server.com', // 実際のサーバーURLに置き換え
  sharedPeers: []
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

// 描画ツールの種類
export type DrawingToolType = 'pen' | 'circle' | 'rect' | 'arrow' | 'line' | 'eraser';

// 描画用カラー
export const DRAWING_COLORS = [
  { id: 'red', name: '赤', color: '#FF0000' },
  { id: 'blue', name: '青', color: '#0000FF' },
  { id: 'green', name: '緑', color: '#00FF00' },
  { id: 'yellow', name: '黄', color: '#FFFF00' },
  { id: 'black', name: '黒', color: '#000000' },
  { id: 'white', name: '白', color: '#FFFFFF' }
];

// 描画の基本データ構造
export interface Drawing {
  id: string;
  url: string;
  type: DrawingToolType;
  pathData: string; // SVG path data or shape params
  color: string;
  strokeWidth: number;
  scrollOffset: { x: number; y: number }; // ページのスクロール位置
  /**
   * 描画を紐付けたスクロールコンテナのCSSセレクター。
   * 指定がない場合はページ全体の座標として扱う。
   */
  containerSelector?: string;
  /**
   * ページ全体での座標データのバックアップ。
   * コンテナが見つからない場合のフォールバックとして使用する。
   */
  pagePathData?: string;
  viewportSize?: { width: number; height: number }; // 作成時のビューポートサイズ（スケーリング用）
  createdAt: number;
  updatedAt: number;
}

// URL単位で描画を管理
export interface DrawingStorage {
  [url: string]: Drawing[];
}

// ========================
// P2P共有機能用の型定義
// ========================

// 共有可能なメモ（所有者情報付き）
export interface SharedMemo extends Memo {
  ownerId: string; // 所有者のピアID
}

// 共有可能なハイライト（所有者情報付き）
export interface SharedHighlight extends Highlight {
  ownerId: string;
}

// 共有可能な描画（所有者情報付き）
export interface SharedDrawing extends Drawing {
  ownerId: string;
}
