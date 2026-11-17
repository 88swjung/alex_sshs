// ============================================================
// decor.js — 벽면(face)을 보고 창문과 벽 장식을 "자동으로" 놓는다.
//
// mapData 에 따로 적지 않아도, 건물 바깥쪽에 면한 벽에는 창문이,
// 복도·교실 등의 벽에는 게시판·포스터·소화기가, 긴 복도에는 휴지통이 놓인다.
// 실제 학교 배치도로 바꿔도 새 벽에 맞춰서 알아서 다시 놓임.
//
// face(벽의 한쪽 면) 구조 — mapBuilder.js 에서 만들어 넘겨줌:
//   { horizontal, coord, side, s, e, room, other, nx, nz }
//   horizontal : 벽이 동서 방향(z 고정)이면 true
//   coord      : 벽 중심선 좌표 (horizontal 이면 z, 아니면 x)
//   side       : +1 이면 좌표가 큰 쪽 면(남쪽/동쪽), -1 이면 작은 쪽 면
//   s, e       : 벽을 따라 잰 시작/끝 좌표
//   room, other: 이 면이 향한 방, 벽 반대편 방(건물 바깥이면 null)
//   nx, nz     : 벽에서 방 안쪽으로 향하는 방향
// ============================================================

import * as THREE from 'three';
import { COLORS } from './config.js';

const PAINT = 0.02; // 벽 페인트 두께 (mapBuilder.js 와 같은 값)

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const scaled = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

/** 벽 면 위의 점. p: 벽을 따라 잰 위치, off: 벽 표면(페인트 바깥)에서 방 안쪽으로 떨어진 거리 */
function facePoint(B, face, p, off) {
  const o = B.T / 2 + PAINT + off;
  return face.horizontal ? [p, face.coord + face.side * o] : [face.coord + face.side * o, p];
}

/** 벽 표면에 붙은 상자: 벽을 따라 길이 along, 높이 h, 두께 thick, 표면에서 off 만큼 띄움 */
function wallBox(B, face, p, y0, along, h, off, thick, color, glow = false) {
  const [x, z] = facePoint(B, face, p, off + thick / 2);
  const [sx, sz] = face.horizontal ? [along, thick] : [thick, along];
  (glow ? B.glow : B.batch).add(x, y0 + h / 2, z, sx, h, sz, color);
}

/** face 의 [p0, p1] 구간 바로 앞(벽에서 0.5m)에 키 큰 가구가 있으면 true */
function isBlocked(B, face, p0, p1, depth = 0.5) {
  const w0 = face.coord + face.side * (B.T / 2);
  const w1 = face.coord + face.side * (B.T / 2 + depth);
  const lo = Math.min(w0, w1), hi = Math.max(w0, w1);
  for (const t of B.tallBounds) {
    const [aMin, aMax, bMin, bMax] = face.horizontal ? [t.minX, t.maxX, t.minZ, t.maxZ] : [t.minZ, t.maxZ, t.minX, t.maxX];
    if (aMax > p0 && aMin < p1 && bMax > lo && bMin < hi) return true;
  }
  return false;
}

// ------------------------------------------------------------
// 창문 — 건물 바깥에 면한 벽에 자동으로 놓임
// ------------------------------------------------------------
export function addWindows(B, faces) {
  const windowed = new Set();
  let counter = 0;

  for (const face of faces) {
    if (!face.room || face.other) continue; // 바깥에 면한 벽만
    const lo = face.s + 0.55, hi = face.e - 0.55;
    if (hi - lo < 1.9) continue;
    const n = Math.max(1, Math.floor((hi - lo) / 2.7));
    const spacing = (hi - lo) / n;
    const W = Math.min(1.5, spacing - 0.7);
    const frosted = face.room.kind === 'restroom';

    for (let i = 0; i < n; i++) {
      const p = lo + (i + 0.5) * spacing;
      if (isBlocked(B, face, p - W / 2 - 0.3, p + W / 2 + 0.3, 0.45)) continue;
      windowed.add(face);
      counter++;

      const y0 = frosted ? 1.6 : 0.95, Hh = frosted ? 0.7 : 1.3;
      // 유리: 위쪽은 하늘색, 아래쪽은 옅은 색 (스스로 빛남)
      wallBox(B, face, p, y0, W, Hh * 0.55, 0, 0.02, frosted ? COLORS.windowSkyLow : COLORS.windowSkyLow, true);
      wallBox(B, face, p, y0 + Hh * 0.55, W, Hh * 0.45, 0, 0.02, frosted ? COLORS.windowSkyLow : COLORS.windowSky, true);
      // 창틀·가운데 살
      const fr = COLORS.windowFrame;
      wallBox(B, face, p, y0 - 0.04, W + 0.1, 0.05, 0, 0.05, fr);              // 아래
      wallBox(B, face, p, y0 + Hh - 0.01, W + 0.1, 0.05, 0, 0.05, fr);         // 위
      wallBox(B, face, p - W / 2 - 0.025, y0, 0.05, Hh, 0, 0.05, fr);          // 왼쪽
      wallBox(B, face, p + W / 2 + 0.025, y0, 0.05, Hh, 0, 0.05, fr);          // 오른쪽
      wallBox(B, face, p, y0, 0.04, Hh, 0, 0.04, fr);                           // 세로 살
      wallBox(B, face, p, y0 + Hh * 0.55, W, 0.04, 0, 0.04, fr);                // 가로 살
      wallBox(B, face, p, y0 - 0.09, W + 0.24, 0.05, 0, 0.13, fr);              // 창턱
      // 커튼 (화장실 제외)
      if (!frosted) {
        const cc = COLORS.curtain[Math.floor(hash(`${face.room.id}-${counter}`) * COLORS.curtain.length)];
        for (const s of [-1, 1]) {
          wallBox(B, face, p + s * (W / 2 + 0.22), y0 - 0.15, 0.34, Hh + 0.55, 0.03, 0.08, cc);
          wallBox(B, face, p + s * (W / 2 + 0.22), y0 - 0.15, 0.04, Hh + 0.55, 0.0, 0.04, scaled(cc, 0.8)); // 주름 한 줄
        }
        wallBox(B, face, p, y0 + Hh + 0.32, W + 0.9, 0.04, 0.02, 0.05, COLORS.metal); // 커튼 봉
      }
      // 바닥에 비치는 햇빛 얼룩
      const [gx, gz] = facePoint(B, face, p, 1.5);
      const sw = W + 0.4, sd = 2.4;
      B.glowDecal.add(gx, gz, face.horizontal ? sw : sd, face.horizontal ? sd : sw, scaled(COLORS.sunGlow, 0.3));
    }
  }
  return windowed;
}

// ------------------------------------------------------------
// 벽 장식 / 바닥 소품 — 안쪽 벽(건물 바깥이 아닌 벽)에 놓임
// ------------------------------------------------------------
// 방 종류별로 벽에 붙일 수 있는 장식 목록 (순서대로 돌려가며 사용)
const WALL_DECOR = {
  corridor: ['corkboard', 'poster', 'extinguisher', 'poster'],
  classroom: ['corkboard', 'poster'],
  study: ['poster', 'corkboard'],
  office: ['corkboard', 'poster'],
  stairs: ['poster'],
};
const DECOR_WIDTH = { corkboard: 1.7, poster: 0.7, extinguisher: 0.4 };

export function addWallDecor(B, faces, windowed) {
  for (const face of faces) {
    if (!face.room || windowed.has(face)) continue;
    const kinds = WALL_DECOR[face.room.kind];
    if (!kinds) continue;

    const lo = face.s + 0.7, hi = face.e - 0.7;
    const len = hi - lo;
    if (len < 1.2) continue;

    // 벽 장식: 4.5m 마다 하나씩 (짧은 벽은 하나)
    const n = Math.max(1, Math.floor(len / 4.5));
    for (let i = 0; i < n; i++) {
      const p = lo + ((i + 0.5) * len) / n;
      let type = kinds[Math.floor(hash(`${face.room.id}|${face.coord}|${Math.round(p)}`) * kinds.length)];
      if (len / n < DECOR_WIDTH[type] + 0.6) type = 'poster';
      const w = DECOR_WIDTH[type];
      if (len / n < w + 0.4) continue;
      if (isBlocked(B, face, p - w / 2, p + w / 2, 0.5)) continue;
      const tpl = B.types[type];
      const d = tpl.size.d;
      const [x, z] = facePoint(B, face, p, d / 2);
      B.placeFurniture({ id: B.nextId(face.room.id, type), type, room: face.room.id, x, z, f: [face.nx, face.nz], opts: {} });
    }

    // 긴 복도에는 휴지통을 벽 쪽에 놓음
    if (face.room.kind === 'corridor' && face.e - face.s >= 9) {
      const m = Math.floor((face.e - face.s) / 9);
      for (let i = 0; i < m; i++) {
        const p = face.s + ((i + 0.5) * (face.e - face.s)) / m + 1.8;
        const type = 'bin';
        const d = B.types[type].size.d;
        if (isBlocked(B, face, p - d, p + d, 0.8)) continue;
        const [x, z] = facePoint(B, face, p, d / 2 + 0.02);
        B.placeFurniture({ id: B.nextId(face.room.id, type), type, room: face.room.id, x, z, f: [face.nx, face.nz], opts: {} });
      }
    }
  }
}
