# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Webページに付箋メモを貼り付けるChrome拡張機能（Manifest V3）。TypeScript + Webpack でビルドし、Chrome Storage APIでデータを永続化する。

## ビルドとコマンド

```bash
# 開発ビルド（ファイル変更を監視）
npm run dev

# プロダクションビルド
npm run build

# 型チェックのみ
npm run type-check
```

ビルド成果物は `dist/` ディレクトリに出力される。Chrome拡張として読み込むには `chrome://extensions/` でデベロッパーモードを有効にし、`dist` フォルダを指定する。

## アーキテクチャ

### 主要コンポーネント

1. **Content Script (`src/content/`)**
   - `MemoManager.ts`: メモのライフサイクル管理、ストレージとの同期、メッセージ処理
   - `MemoComponent.ts`: 個別の付箋UIコンポーネント（ドラッグ、リサイズ、編集機能）
   - `index.ts`: Content Scriptのエントリーポイント、MemoManagerの初期化

2. **Background Service Worker (`src/background/service-worker.ts`)**
   - 拡張機能のインストール・更新処理
   - キーボードショートカット（Ctrl+Shift+M）のハンドリング
   - コンテキストメニュー（右クリックメニュー）の管理
   - メッセージルーティング

3. **Shared Modules (`src/shared/`)**
   - `types.ts`: 全体で使用する型定義（Memo, Settings, MemoStorage等）
   - `storage.ts`: Chrome Storage APIのラッパークラス（StorageManager）
   - `utils.ts`: ユーティリティ関数（UUID生成、デバウンス、URL正規化等）
   - `constants.ts`: 定数定義（CSS_CLASSES, Z_INDEX, DEBOUNCE_TIME等）

4. **UI Components**
   - `src/popup/`: 拡張機能アイコンクリック時のポップアップUI
   - `src/options/`: 設定画面（オプションページ）

### データフロー

```
User Action (Webページ)
  → MemoComponent (UIイベント)
  → MemoManager (ビジネスロジック)
  → StorageManager (永続化)
  → Chrome Storage API
```

メッセージング:
```
Background Service Worker (キーボードショートカット)
  → chrome.tabs.sendMessage
  → Content Script (MemoManager.setupMessageListener)
  → MemoManager.toggleCreateMode()
```

### データモデル

- **Memo**: 個別の付箋データ（id, url, content, position, style, timestamps）
- **MemoStorage**: URL単位でメモを管理する辞書構造 `{ [url: string]: Memo[] }`
- **Settings**: グローバル設定（enabled, defaultColor, defaultSize等）

メモはURL単位で管理され、`StorageManager.getMemosForUrl()` で取得する。URL正規化オプション（クエリパラメータ除去）をサポート。

### 重要な実装パターン

1. **デバウンス付き自動保存**
   - `MemoManager.debouncedSaveMemo` でユーザー入力を1秒遅延保存
   - `DEBOUNCE_TIME.SAVE` 定数で制御

2. **z-index管理**
   - `MemoManager.nextZIndex` でメモの重なり順を管理
   - 既存メモ読み込み時に最大値+1で初期化

3. **イベントハンドリング**
   - `MemoComponent` はドラッグ、リサイズ、カラー変更を独立して処理
   - グローバルな `mousemove`, `mouseup` リスナーで全メモに対応

4. **メッセージング**
   - Content Script ⇔ Background間は `chrome.runtime.onMessage` で通信
   - メッセージタイプは `types.ts` の `MessageType` で定義

## 開発時の注意事項

### TypeScriptのビルドエラー回避

- `NodeJS.Timeout` の代わりに `ReturnType<typeof setTimeout>` を使用（ブラウザ環境のため）
- 未使用パラメータは `_` プレフィックスを付ける（例: `_sender`, `_tabId`）
- `process.env` へのアクセスは型チェックを迂回（`@ts-ignore` + runtime check）

### Webpack設定

4つのエントリーポイント:
- `background/service-worker`
- `content/index`
- `popup/popup`
- `options/options`

HTML/CSSファイルは `CopyWebpackPlugin` でコピー。`dist/` ディレクトリは毎回クリーンビルドされる。

### CSS分離

Content Scriptのスタイルは `src/content/styles/memo.css` に分離し、manifest.jsonで指定。ページのCSSとの衝突を避けるため、クラス名は `CSS_CLASSES` 定数で一元管理。

### ストレージ制限

- `chrome.storage.local`: 10MB（メモデータ）
- `chrome.storage.sync`: 100KB（設定データ、現在未使用）

大量のメモを扱う場合はストレージクォータに注意。

## 拡張予定機能

- 要素紐付けモード（`position.type = 'element'` の実装）
- Markdown対応
- Chrome同期機能（`settings.syncEnabled`）
- 全文検索

これらは型定義や一部のUIは用意済みだが、実装は未完了。
