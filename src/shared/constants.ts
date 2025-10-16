/**
 * アプリケーション全体で使用する定数定義
 */

// ストレージキー
export const STORAGE_KEYS = {
  MEMOS: 'memos',
  SETTINGS: 'settings',
  HIGHLIGHTS: 'highlights',
  DRAWINGS: 'drawings',
  USER_ID: 'userId' // P2P用のユーザーID
} as const;

// Z-index範囲
export const Z_INDEX = {
  MIN: 10000,
  MAX: 99999
} as const;

// デバウンス時間（ミリ秒）
export const DEBOUNCE_TIME = {
  SAVE: 500,
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
  CREATE_MODE: 'memo-sticky-create-mode',
  HIGHLIGHT: 'memo-highlight',
  HIGHLIGHT_DELETE_BTN: 'memo-highlight-delete-btn',
  DRAWING_CANVAS: 'memo-drawing-canvas',
  DRAWING_TOOLBAR: 'memo-drawing-toolbar',
  DRAWING_MODE: 'memo-drawing-mode',
  // P2P共有用
  SHARED_MEMO_CONTAINER: 'memo-shared-container',
  SHARED_MEMO_BADGE: 'memo-shared-badge'
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
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  CREATE_HIGHLIGHT: 'CREATE_HIGHLIGHT',
  DELETE_HIGHLIGHT: 'DELETE_HIGHLIGHT',
  DELETE_ALL_HIGHLIGHTS: 'DELETE_ALL_HIGHLIGHTS',
  TOGGLE_DRAWING_MODE: 'TOGGLE_DRAWING_MODE',
  DELETE_ALL_DRAWINGS: 'DELETE_ALL_DRAWINGS'
} as const;
