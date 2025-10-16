#!/usr/bin/env node

/**
 * Chrome拡張機能のアイコンを生成するスクリプト
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// 出力先ディレクトリ
const iconsDir = path.join(__dirname, '../src/assets/icons');

// 生成するアイコンサイズ
const sizes = [16, 48, 128];

// アイコンの色（付箋紙風の黄色）
const STICKY_YELLOW = '#FFD93D';
const SHADOW_COLOR = '#F6BA2E';
const CORNER_FOLD = '#FFE66D';

/**
 * アイコンを生成
 */
function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 背景（黄色の付箋紙）
  ctx.fillStyle = STICKY_YELLOW;
  ctx.fillRect(0, 0, size, size);

  // グラデーション（立体感）
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // 右下に影
  ctx.fillStyle = SHADOW_COLOR;
  ctx.fillRect(size * 0.8, size * 0.8, size * 0.2, size * 0.2);

  // 右上の折れ目（小さいサイズでは省略）
  if (size >= 48) {
    const foldSize = size * 0.25;
    ctx.fillStyle = CORNER_FOLD;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(size - foldSize, 0);
    ctx.lineTo(size, foldSize);
    ctx.closePath();
    ctx.fill();

    // 折れ目の線
    ctx.strokeStyle = SHADOW_COLOR;
    ctx.lineWidth = size / 64;
    ctx.beginPath();
    ctx.moveTo(size - foldSize, 0);
    ctx.lineTo(size, foldSize);
    ctx.stroke();
  }

  // テキスト "M"（メモの頭文字）
  if (size >= 48) {
    ctx.fillStyle = '#6C5B3E';
    ctx.font = `bold ${size * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', size * 0.5, size * 0.55);
  }

  // PNGとして保存
  const buffer = canvas.toBuffer('image/png');
  const filename = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`✅ Generated: icon-${size}.png`);
}

/**
 * メイン処理
 */
function main() {
  console.log('🎨 アイコンを生成中...\n');

  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
    console.log(`📁 Created directory: ${iconsDir}`);
  }

  // 各サイズのアイコンを生成
  sizes.forEach(size => generateIcon(size));

  console.log('\n✨ アイコン生成完了！');
}

main();
