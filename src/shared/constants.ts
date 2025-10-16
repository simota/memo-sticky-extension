/**
 * アプリケーション全体で使用する定数定義
 */

// ストレージキー
export const STORAGE_KEYS = {
  MEMOS: 'memos',
  SETTINGS: 'settings'
} as const;

// Z-index範囲
export const Z_INDEX = {
  MIN: 10000,
  MAX: 99999
} as const;

// デバウンス時間（ミリ秒）
export const DEBOUNCE_TIME = {
  SAVE: 1000,
  RESIZE: 100
} as const;

// メモのサイズ制限
export const MEMO_SIZE = {
  MIN_WIDTH: 100,
  MAX_WIDTH: 800,
  MIN_HEIGHT: 80,
  MAX_HEIGHT: 600
} as const;

// クラス名（CSSとの連携用）
export const CSS_CLASSES = {
  MEMO_CONTAINER: 'memo-sticky-container',
  MEMO_HEADER: 'memo-sticky-header',
  MEMO_CONTENT: 'memo-sticky-content',
  MEMO_FOOTER: 'memo-sticky-footer',
  MEMO_RESIZE_HANDLE: 'memo-sticky-resize-handle',
  MEMO_DELETE_BTN: 'memo-sticky-delete-btn',
  MEMO_COLOR_BTN: 'memo-sticky-color-btn',
  CREATE_MODE: 'memo-sticky-create-mode'
} as const;

// アニメーション時間（ミリ秒）
export const ANIMATION_DURATION = 200;

// メッセージタイプ
export const MESSAGE_TYPES = {
  CREATE_MEMO: 'CREATE_MEMO',
  UPDATE_MEMO: 'UPDATE_MEMO',
  DELETE_MEMO: 'DELETE_MEMO',
  GET_MEMOS: 'GET_MEMOS',
  TOGGLE_CREATE_MODE: 'TOGGLE_CREATE_MODE',
  SAVE_SETTINGS: 'SAVE_SETTINGS'
} as const;
