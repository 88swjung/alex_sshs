// ============================================================
// textures.js — 코드로 그려 만드는 텍스처 (그림 파일 없음)
//   · 바닥에 깔리는 부드러운 그림자 / 빛 얼룩 (DataTexture)
//   · 문 위 표지판, 칠판 글씨 (canvas)
// ============================================================

import * as THREE from 'three';
import { COLORS, FONT_SIGN } from './config.js';

function dataTexture(size, w, h, alphaFn) {
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const a = Math.max(0, Math.min(1, alphaFn(i / (w - 1), j / (h - 1))));
      const k = (j * w + i) * 4;
      data[k] = data[k + 1] = data[k + 2] = 255;
      data[k + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 가구 밑 부드러운 사각 그림자 (가운데 진하고 가장자리로 갈수록 옅어짐) */
export function makeBlobTexture() {
  return dataTexture(64, 64, 64, (u, v) => {
    const x = Math.abs(u * 2 - 1), y = Math.abs(v * 2 - 1);
    const d = Math.pow(Math.pow(x, 4) + Math.pow(y, 4), 0.25); // 둥근 사각형 거리
    return 1 - smoothstep(0.35, 1.0, d);
  });
}

/** 벽 아래쪽에 깔리는 그림자 띠. v=1(위쪽 가장자리)이 벽에 닿는 쪽이고 멀어질수록 옅어짐 */
export function makeWallShadowTexture() {
  return dataTexture(4, 4, 64, (u, v) => Math.pow(v, 2.2) * 0.9);
}

/** 천장 조명 / 햇빛이 바닥에 만드는 빛 얼룩 (더하기 혼합으로 그림) */
export function makeGlowTexture() {
  return dataTexture(64, 64, 64, (u, v) => {
    const x = Math.abs(u * 2 - 1), y = Math.abs(v * 2 - 1);
    const d = Math.pow(Math.pow(x, 3) + Math.pow(y, 3), 1 / 3);
    return Math.pow(1 - smoothstep(0.0, 1.0, d), 1.6);
  });
}

// ------------------------------------------------------------
// 표지판 — 글꼴(Jua)이 늦게 로드될 수 있어서, 로드가 끝나면 다시 그린다
// ------------------------------------------------------------
const redrawList = [];
const signCache = new Map();

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 같은 글자의 표지판은 텍스처를 공유 */
export function makeSignTexture(text) {
  if (signCache.has(text)) return signCache.get(text);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const draw = () => {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, 512, 128);
    // 바탕: 위아래 그라데이션 + 둥근 모서리
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, COLORS.signBg1);
    grad.addColorStop(1, COLORS.signBg2);
    roundRect(g, 4, 4, 504, 120, 22);
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.stroke();
    // 아래쪽 주황 포인트 줄
    g.fillStyle = COLORS.signAccent;
    roundRect(g, 40, 108, 432, 8, 4);
    g.fill();
    // 글자 (길면 줄여서 맞춤)
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 74;
    g.font = `${size}px ${FONT_SIGN}`;
    while (g.measureText(text).width > 430 && size > 22) {
      size -= 4;
      g.font = `${size}px ${FONT_SIGN}`;
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillText(text, 258, 60);
    g.fillStyle = COLORS.signText;
    g.fillText(text, 256, 57);
    tex.needsUpdate = true;
  };

  draw();
  redrawList.push(draw);
  signCache.set(text, tex);
  return tex;
}

/** 칠판에 분필로 쓴 글씨와 낙서 */
export function makeChalkTexture(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const draw = () => {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, 1024, 256);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = `92px ${FONT_SIGN}`;
    g.fillText(title, 56, 78);
    g.fillStyle = 'rgba(255,226,122,0.9)';
    g.font = `52px ${FONT_SIGN}`;
    g.fillText(subtitle, 60, 170);
    // 분필 낙서: 별, 밑줄, 하트
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(60, 218); g.quadraticCurveTo(300, 236, 560, 216);
    g.stroke();
    g.strokeStyle = 'rgba(255,226,122,0.85)';
    const star = (cx, cy, r) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
      g.stroke();
    };
    star(860, 80, 44);
    star(940, 170, 28);
    g.strokeStyle = 'rgba(255,159,176,0.9)';
    g.beginPath();
    g.moveTo(760, 190);
    g.bezierCurveTo(720, 140, 790, 120, 790, 165);
    g.bezierCurveTo(790, 120, 860, 140, 820, 190);
    g.lineTo(790, 215);
    g.closePath();
    g.stroke();
    tex.needsUpdate = true;
  };

  draw();
  redrawList.push(draw);
  return tex;
}

/** 글꼴이 로드되면 글자가 들어간 텍스처를 다시 그림 (로드 실패해도 무시) */
export function redrawTextTexturesWhenFontReady() {
  if (!document.fonts || !document.fonts.load) return;
  document.fonts
    .load(`40px ${FONT_SIGN}`, '찐알렉스 1반 계단')
    .then(() => redrawList.forEach((fn) => fn()))
    .catch(() => {});
}
