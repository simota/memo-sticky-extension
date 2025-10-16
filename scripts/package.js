#!/usr/bin/env node

/**
 * Chrome拡張機能をパッケージング（zip化）するスクリプト
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// package.jsonからバージョン情報を取得
const packageJson = require('../package.json');
const version = packageJson.version;

// パス設定
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outputFile = path.join(rootDir, `memo-sticky-extension-v${version}.zip`);

console.log('📦 Chrome拡張機能をパッケージング中...\n');

// distディレクトリの存在確認
if (!fs.existsSync(distDir)) {
  console.error('❌ エラー: distディレクトリが見つかりません');
  console.error('   先に "npm run build" を実行してください');
  process.exit(1);
}

// 既存のzipファイルを削除
if (fs.existsSync(outputFile)) {
  console.log(`🗑️  既存のファイルを削除: ${path.basename(outputFile)}`);
  fs.unlinkSync(outputFile);
}

try {
  // zipファイルを作成（ソースマップを除外）
  console.log(`📁 ファイルを圧縮中: ${distDir}`);

  // プラットフォームに応じたコマンドを選択
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Windows: PowerShellを使用
    const psCommand = `
      $source = "${distDir.replace(/\\/g, '\\\\')}"
      $destination = "${outputFile.replace(/\\/g, '\\\\')}"
      Compress-Archive -Path "$source\\*" -DestinationPath $destination -Force
    `;
    execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });
  } else {
    // macOS/Linux: zipコマンドを使用
    execSync(`cd "${distDir}" && zip -r "${outputFile}" . -x "*.map"`, {
      stdio: 'inherit'
    });
  }

  // 結果を表示
  const stats = fs.statSync(outputFile);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n✅ パッケージング完了！\n');
  console.log(`📦 ファイル名: ${path.basename(outputFile)}`);
  console.log(`📊 ファイルサイズ: ${sizeInMB} MB`);
  console.log(`📍 保存先: ${outputFile}`);
  console.log('\n💡 このzipファイルをChrome Web Storeにアップロードできます');

} catch (error) {
  console.error('\n❌ エラーが発生しました:', error.message);
  process.exit(1);
}
