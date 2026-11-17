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
//   · 십자 창살 없는 통유리 한 장 + 얇은 알루미늄 테두리와 창턱
//   · 커튼은 기본으로 없음. 방(room)에 curtains: ['N', ...] 를 적으면 그 쪽 벽 창문에만
//     검은 커튼이 달림 (빛이 들어오도록 창 양옆으로 걷어 둔 모습)
//   · 창문마다 바닥에 햇빛 얼룩 + 창에서 바닥까지 비스듬히 내리는 옅은 빛줄기
// ------------------------------------------------------------
/** 이 면이 방의 어느 쪽 벽인지 ('N' | 'S' | 'E' | 'W') */
function wallLetter(face) {
  if (face.horizontal) return face.side > 0 ? 'N' : 'S';
  return face.side > 0 ? 'W' : 'E';
}

const SUN_SLOPE = 0.6; // 햇빛이 수평으로 1m 갈 때 내려오는 높이(m)

export function addWindows(B, faces) {
  const windowed = new Set();
  let counter = 0;

  for (const face of faces) {
    if (!face.room || face.other) continue; // 바깥에 면한 벽만
    if (face.room.stairs) continue;         // 계단 끝은 벽으로 막혀 있어서 창문을 달아도 안 보임
    const lo = face.s + 0.55, hi = face.e - 0.55;
    if (hi - lo < 1.9) continue;
    const n = Math.max(1, Math.floor((hi - lo) / 2.9));
    const spacing = (hi - lo) / n;
    const W = Math.min(2.2, spacing - 0.8);
    const frosted = face.room.kind === 'restroom';
    const curtained = !frosted && (face.room.curtains || []).includes(wallLetter(face));
    const depthAvailable = (face.horizontal ? face.room.d : face.room.w) - 0.4; // 맞은편 벽까지 거리

    for (let i = 0; i < n; i++) {
      const p = lo + (i + 0.5) * spacing;
      if (isBlocked(B, face, p - W / 2 - 0.3, p + W / 2 + 0.3, 0.45)) continue;
      windowed.add(face);
      counter++;

      const y0 = frosted ? 1.6 : 0.9, Hh = frosted ? 0.7 : 1.5;
      // 유리: 아래는 옅고 위는 하늘색인 띠 4개 (스스로 빛남). 색이 비슷해서 이음매는 안 보임
      const bands = COLORS.windowGlass.length;
      for (let k = 0; k < bands; k++) {
        wallBox(B, face, p, y0 + (Hh * k) / bands, W, Hh / bands + (k < bands - 1 ? 0.002 : 0), 0, 0.02,
          frosted ? COLORS.windowGlassFrosted : COLORS.windowGlass[k], true);
      }
      // 얇은 알루미늄 테두리 + 창턱 (가운데 창살 없음)
      const fr = COLORS.windowFrame;
      wallBox(B, face, p, y0 - 0.04, W + 0.08, 0.04, 0, 0.045, fr);              // 아래
      wallBox(B, face, p, y0 + Hh, W + 0.08, 0.04, 0, 0.045, fr);                // 위
      wallBox(B, face, p - W / 2 - 0.02, y0, 0.04, Hh, 0, 0.045, fr);            // 왼쪽
      wallBox(B, face, p + W / 2 + 0.02, y0, 0.04, Hh, 0, 0.045, fr);            // 오른쪽
      wallBox(B, face, p, y0 - 0.09, W + 0.2, 0.05, 0, 0.12, fr);                // 창턱

      // 검은 커튼: 그림에 표시된 방의 창문에만. 창 양옆으로 걷어 모아 둔 주름 3겹 + 커튼 봉
      if (curtained) {
        const blk = COLORS.curtainBlack;
        for (const s of [-1, 1]) {
          for (let j = 0; j < 3; j++) {
            wallBox(B, face, p + s * (W / 2 + 0.12 + j * 0.115), 0.32, 0.12, 2.3, j % 2 ? 0.075 : 0.025, 0.05, blk[(j + (s > 0 ? 1 : 0)) % blk.length]);
          }
        }
        wallBox(B, face, p, 2.62, W + 1.0, 0.04, 0.02, 0.04, COLORS.metal);       // 커튼 봉
      }

      // 햇빛: 바닥 얼룩(창 모양 그대로) + 창에서 바닥으로 내려오는 옅은 빛줄기
      const top = y0 + Hh;
      const k = Math.max(SUN_SLOPE, top / Math.max(2, depthAvailable));
      const d0 = y0 / k, d1 = top / k; // 바닥 얼룩이 시작하고 끝나는, 벽에서의 거리
      const strength = frosted ? 0.2 : 0.36;
      const [gx, gz] = facePoint(B, face, p, (d0 + d1) / 2);
      B.sunDecal.add(gx, gz, W, d1 - d0, // (판의 가로 = 창 폭, 세로 = 벽에서 멀어지는 길이. 회전은 아래 값이 맞춰 줌)
        scaled(COLORS.sunGlow, strength), face.horizontal ? (face.side > 0 ? 0 : Math.PI) : (face.side > 0 ? Math.PI / 2 : -Math.PI / 2));

      // 빛줄기 (정점마다 투명도를 달리해서 창 쪽이 진하고 바닥 쪽이 옅음)
      const along = (pp, off) => facePoint(B, face, pp, off);
      const wl = p - W / 2, wr = p + W / 2;
      const win = (pp, yy) => { const [x, z] = along(pp, 0.03); return [x, yy, z]; };
      const flo = (pp, dd) => { const [x, z] = along(pp, dd); return [x, 0.01, z]; };
      const aNear = frosted ? 0.04 : 0.075, aFar = 0.0;
      const q = (a, b, c, d, aa, ab, ac, ad) => B.shafts.push([a, aa], [b, ab], [c, ac], [d, ad]);
      q(win(wl, y0), win(wr, y0), flo(wr, d0), flo(wl, d0), aNear, aNear, aFar, aFar);           // 아래 면
      q(win(wl, top), win(wr, top), flo(wr, d1), flo(wl, d1), aNear, aNear, aFar, aFar);         // 위 면
      q(win(wl, y0), win(wl, top), flo(wl, d1), flo(wl, d0), aNear, aNear, aFar, aFar);          // 왼쪽 면
      q(win(wr, y0), win(wr, top), flo(wr, d1), flo(wr, d0), aNear, aNear, aFar, aFar);          // 오른쪽 면
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
  lab: ['poster', 'corkboard'],
  stairs: ['poster'],
};
const DECOR_WIDTH = { corkboard: 1.7, poster: 0.7, extinguisher: 0.4 };

export function addWallDecor(B, faces, windowed) {
  for (const face of faces) {
    if (!face.room || windowed.has(face) || face.room.decor === false) continue; // decor: false 인 빈 방은 장식 없음
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
