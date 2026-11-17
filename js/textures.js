// ============================================================
// textures.js — 코드로 그려 만드는 텍스처 (그림 파일 없음)
//   · 바닥에 깔리는 부드러운 그림자 / 빛 얼룩 (DataTexture)
//   · 문 위 표지판 (canvas)
// ============================================================

import * as THREE from 'three';
import { COLORS, FONT_UI } from './config.js';

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
// 표지판 — 짙은 회청색 바탕에 흰 글씨의 평범한 실명 표지판
// ------------------------------------------------------------
const signCache = new Map();

/** 같은 글자의 표지판은 텍스처를 공유 */
export function makeSignTexture(text) {
  if (signCache.has(text)) return signCache.get(text);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext('2d');

  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, COLORS.signBg1);
  grad.addColorStop(1, COLORS.signBg2);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = COLORS.signLine;
  g.lineWidth = 3;
  g.strokeRect(8, 8, 496, 112);

  // 글자 (길면 줄여서 맞춤)
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 72;
  g.font = `bold ${size}px ${FONT_UI}`;
  while (g.measureText(text).width > 430 && size > 22) {
    size -= 4;
    g.font = `bold ${size}px ${FONT_UI}`;
  }
  g.fillStyle = COLORS.signText;
  g.fillText(text, 256, 66);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  signCache.set(text, tex);
  return tex;
}
