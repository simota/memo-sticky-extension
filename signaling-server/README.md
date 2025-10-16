# Memo Chat Signaling Server

PeerJS WebRTC signaling server for memo-chat extension.

## 概要

このサーバーはChrome拡張機能のP2P接続を仲介するシグナリングサーバーです。
- ピア同士の接続情報（SDP/ICE Candidates）を交換
- 実際のデータ転送はピア間で直接行われる（サーバーを経由しない）
- 軽量でコストが低い

## ローカル開発

### 依存関係のインストール

```bash
cd signaling-server
npm install
```

### 起動

```bash
npm start
```

サーバーは `http://localhost:9000` で起動します。

### 開発モード（自動再起動）

```bash
npm run dev
```

## デプロイ

### 方法1: Render (推奨・無料)

1. [Render](https://render.com/)でアカウント作成
2. New → Web Service
3. リポジトリを接続
4. 設定：
   - **Root Directory**: `signaling-server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Deploy

デプロイ後のURL例: `https://memo-signaling-xxxx.onrender.com`

### 方法2: Heroku

```bash
# Heroku CLIをインストール（未インストールの場合）
# https://devcenter.heroku.com/articles/heroku-cli

# ログイン
heroku login

# アプリ作成
heroku create memo-signaling-server

# デプロイ
git subtree push --prefix signaling-server heroku main
```

### 方法3: Railway

1. [Railway](https://railway.app/)でアカウント作成
2. New Project → Deploy from GitHub repo
3. リポジトリを選択
4. 設定：
   - **Root Directory**: `signaling-server`
   - **Start Command**: `npm start`
5. Deploy

### 方法4: VPS（自前サーバー）

```bash
# Ubuntu/Debianの例
sudo apt update
sudo apt install nodejs npm

# プロジェクトをクローン
git clone <your-repo>
cd memo-chat/signaling-server
npm install

# PM2で永続化
sudo npm install -g pm2
pm2 start index.js --name memo-signaling
pm2 startup
pm2 save
```

### 方法5: Docker

```bash
# Dockerfileを作成（このREADMEと同じディレクトリ）
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 9000
CMD ["npm", "start"]

# ビルド
docker build -t memo-signaling-server .

# 実行
docker run -d -p 9000:9000 memo-signaling-server
```

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `PORT` | サーバーポート | 9000 |

## エンドポイント

### `GET /`
ステータス情報を返す

**レスポンス例:**
```json
{
  "status": "ok",
  "service": "Memo Chat Signaling Server",
  "version": "1.0.0"
}
```

### `GET /health`
ヘルスチェック

### `/peerjs`
PeerJSシグナリングエンドポイント（WebSocket）

## セキュリティ

- シグナリングサーバーは接続情報のみを中継
- 実際のメモデータはピア間で直接暗号化通信
- サーバーにメモデータは保存されない

## トラブルシューティング

### ピアが接続できない

1. **ファイアウォールの確認**: ポート9000が開いているか
2. **STUN/TURNサーバー**: NAT越えが必要な場合、Chrome拡張側でTURNサーバーを設定
3. **ログ確認**: サーバーログで接続エラーを確認

### 推奨: 無料STUN/TURNサーバー

Chrome拡張側で以下を設定：
```javascript
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' }, // Google Public STUN
  { urls: 'stun:stun1.l.google.com:19302' }
]
```

TURNサーバーが必要な場合:
- [Twilio TURN](https://www.twilio.com/stun-turn)（無料枠あり）
- [coturn](https://github.com/coturn/coturn)（自前構築）

## コスト見積もり

| サービス | 無料枠 | 有料プラン |
|---------|--------|-----------|
| Render | 750時間/月 | $7/月〜 |
| Railway | $5クレジット/月 | $5/月〜 |
| Heroku | Ecoプラン $5/月 | $5/月〜 |
| VPS | - | $5/月〜 |

**推奨**: Render無料プランで開始 → 必要に応じてアップグレード

## ライセンス

MIT
