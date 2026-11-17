// ============================================================
// furniture.js — 가구 종류(FURNITURE_TYPES)와 방 종류별 자동 배치(LAYOUTS)
//
// 가구는 모두 "상자"를 조합해서 만든다 (낮은 사양에서도 빠르게 그리기 위함).
//
// 가구 종류 정의:
//   size    : { w: 옆 폭, d: 깊이, ... } 기본 크기. 배치 옵션(o)으로 덮어쓸 수 있음
//   build(c, o) : 부품(상자)을 만든다.
//       c.box(lat, y0, dep, sl, sh, sd, color, rot?)
//         lat : 가구 중심에서 오른쪽(+)으로 떨어진 거리,  dep : 뒤쪽(+)으로 떨어진 거리
//         y0  : 상자 바닥 높이,  sl/sh/sd : 옆 폭/높이/깊이
//         rot : [축, 각도] 로 상자를 기울임. 축은 'lat'(옆) | 'dep'(앞뒤) | 'up'(위)
//       c.glow(...)  : box 와 같지만 스스로 빛나는 재질 (모니터 화면 등)
//       c.plane(lat, yCenter, dep, w, h, texture) : 앞면에 그림 한 장 붙이기
//       c.rand()     : 이 가구 고유의 (항상 같은 값이 나오는) 난수 0~1
//     "앞쪽"(dep < 0)은 face 가 가리키는 방향
//   colliders(o) : (선택) 충돌 상자 [lat, dep, sl, sd] 목록. 없으면 바닥 면적 전체
//   collide:false: 충돌 없음 (벽에 붙은 것)
//   shadow:false : 바닥 그림자 없음 (벽에 붙은 것)
//   tall:true    : 키가 커서 창문·벽 장식을 가림
//   decor:true   : 장식품. world.furniture(숨는 곳 등 기능이 붙는 가구 목록)에는 기록하지 않음
// ============================================================

import * as THREE from 'three';
import { COLORS } from './config.js';

const pick = (arr, r) => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
const WHITE = new THREE.Color(0xffffff);
const lighten = (hex, t) => new THREE.Color(hex).lerp(WHITE, t).getHex();

export const FURNITURE_TYPES = {
  // ---------------- 교실 ----------------
  // 학생용 1인 책상: 밝은 회색 상판 + 진회색 테두리 + 상판 아래 파란 플라스틱 서랍
  //                  + 회색 금속 다리(옆에서 보면 T자 받침) + 발 받침대
  // (옵션: partition 가림판 — 자습실용)
  desk: {
    size: { w: 0.62, d: 0.48, h: 0.74 },
    build(c, o) {
      const { w, d, h } = o;
      // 상판: 진회색 테두리 판 위에 밝은 회색 판을 살짝 작게 얹음
      c.box(0, h - 0.045, 0, w, 0.04, d, COLORS.deskRim);
      c.box(0, h - 0.03, 0, w - 0.05, 0.03, d - 0.05, COLORS.deskTop);
      // 서랍(파란 플라스틱 상자): 앉는 사람 쪽(뒤)이 열려 있음
      const dh = 0.17, dw = w - 0.14, dd = d - 0.08, dy = h - 0.045 - dh;
      c.box(0, dy, 0, dw, 0.012, dd, COLORS.plasticBlue);
      for (const s of [-1, 1]) c.box(s * (dw / 2 - 0.006), dy, 0, 0.012, dh, dd, COLORS.plasticBlue);
      c.box(0, dy, -dd / 2 + 0.006, dw, dh, 0.012, COLORS.plasticBlue);
      // 다리: 양옆에 기둥 + 바닥 받침(T자) + 상판 밑 가로대, 앞쪽에 발 받침대
      for (const s of [-1, 1]) {
        const lat = s * (w / 2 - 0.04);
        c.box(lat, 0.03, 0, 0.03, h - 0.075, 0.03, COLORS.frameGray);        // 기둥
        c.box(lat, 0, 0, 0.04, 0.03, d - 0.06, COLORS.frameGray);            // 바닥 받침 (기둥과 T자)
        c.box(lat, h - 0.075, 0, 0.03, 0.03, d - 0.08, COLORS.frameGray);    // 상판 밑 가로대
        c.box(lat, 0.03, -d / 2 + 0.05, 0.025, 0.16, 0.025, COLORS.frameGray); // 발 받침대 지지대
      }
      c.box(0, 0.19, -d / 2 + 0.05, w - 0.06, 0.025, 0.025, COLORS.frameGray); // 발 받침대
      if (o.partition) c.box(0, h, -d / 2 + 0.015, w, 0.34, 0.03, COLORS.stallPartition);
      // 가끔 책 한 권
      if (c.rand() < 0.22) {
        c.box((c.rand() - 0.5) * (w - 0.3), h, (c.rand() - 0.5) * (d - 0.2), 0.2, 0.03, 0.15, pick(COLORS.books, c.rand()), ['up', (c.rand() - 0.5) * 0.6]);
      }
    },
  },

  // 학생용 의자: 파란 플라스틱 좌판·등받이 + 회색 금속 프레임.
  // 등받이에는 작은 구멍 무늬와 손잡이 구멍이 있음
  chair: {
    size: { w: 0.42, d: 0.42 },
    build(c, o) {
      const { w, d } = o;
      c.box(0, 0.43, 0, w, 0.04, d, COLORS.plasticBlue);                          // 좌판
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) c.box(sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.04), 0.025, 0.43, 0.025, COLORS.frameGray); // 다리
        c.box(sx * (w / 2 - 0.06), 0.47, d / 2 - 0.035, 0.025, 0.16, 0.025, COLORS.frameGray); // 등받이 지지대
      }
      const bz = d / 2 - 0.02;                                                    // 등받이 위치(뒤쪽)
      c.box(0, 0.62, bz, w - 0.02, 0.21, 0.03, COLORS.plasticBlue);               // 등받이
      // 앉은 사람 쪽 면(앞쪽, dep 작은 쪽)에 구멍 무늬: 3열 × 2줄
      for (let i = -1; i <= 1; i++) {
        for (let j = 0; j < 2; j++) c.box(i * 0.09, 0.645 + j * 0.04, bz - 0.0155, 0.022, 0.016, 0.006, COLORS.plasticHole);
      }
      // 손잡이 구멍: 등받이 윗부분 앞뒤 양면
      c.box(0, 0.775, bz - 0.0155, 0.13, 0.03, 0.006, COLORS.plasticHole);
      c.box(0, 0.775, bz + 0.0155, 0.13, 0.03, 0.006, COLORS.plasticHole);
    },
  },

  // 화이트보드 + 가운데 전자칠판 (둘 다 빈 상태). 벽에 붙어 있어서 충돌 없음
  board: {
    size: { w: 5.6, d: 0.06, ew: 2.0 },
    collide: false,
    shadow: false,
    tall: true,
    build(c, o) {
      const y0 = 0.95, bh = 1.2;
      c.box(0, y0 - 0.03, 0, o.w + 0.06, bh + 0.06, o.d, COLORS.boardFrame);          // 알루미늄 프레임
      c.glow(0, y0, -0.005, o.w, bh, o.d + 0.01, COLORS.whiteboard);                    // 화이트보드 면
      c.box(0, y0 - 0.045, -0.07, o.w, 0.03, 0.1, COLORS.boardFrame);                  // 마커 받침
      // 전자칠판: 보드 앞으로 살짝 나온 검은 베젤 + 꺼진 화면
      const ey = y0 - 0.02, eh = bh + 0.04;
      c.box(0, ey, -0.05, o.ew + 0.08, eh, 0.04, COLORS.eboardBezel);
      c.box(0, ey + 0.035, -0.0725, o.ew - 0.02, eh - 0.07, 0.006, COLORS.eboardScreen);
    },
  },

  // 교탁 (4단계에서 "교탁 밑" 숨기를 붙일 예정)
  lectern: {
    size: { w: 1.2, d: 0.6 },
    build(c, o) {
      c.box(0, 0, 0, o.w - 0.1, 0.88, o.d - 0.1, COLORS.woodDark);
      c.box(0, 0, -(o.d - 0.1) / 2 - 0.005, o.w - 0.3, 0.8, 0.01, COLORS.wood); // 앞 판
      c.box(0, 0.88, 0, o.w, 0.05, o.d, COLORS.wood);
      // 교탁 위 모니터와 키보드
      c.box(0, 0.93, -0.05, 0.2, 0.02, 0.14, COLORS.metal);
      c.box(0, 0.95, -0.05, 0.05, 0.12, 0.04, COLORS.metal);
      c.box(0, 1.06, -0.05, 0.5, 0.3, 0.04, COLORS.monitor);
      c.box(0, 0.93, 0.1, 0.36, 0.018, 0.12, COLORS.metal);
    },
  },

  // ---------------- 화장실 ----------------
  // 화장실 칸 (앞이 열려 있음). left/right: 옆 칸막이를 세울지
  stall: {
    size: { w: 1.0, d: 1.4 },
    shadow: false,
    build(c, o) {
      for (const side of [-1, 1]) {
        if ((side < 0 && !o.left) || (side > 0 && !o.right)) continue;
        c.box(side * (o.w / 2 - 0.02), 0.15, 0, 0.04, 1.65, o.d, COLORS.stallPartition);
        c.box(side * (o.w / 2 - 0.02), 1.7, 0, 0.05, 0.05, o.d, COLORS.metal); // 칸막이 윗 테두리
      }
      // 변기 (뒤쪽 벽에 붙음)
      c.box(0, 0, o.d / 2 - 0.3, 0.38, 0.38, 0.55, COLORS.porcelain);
      c.box(0, 0.38, o.d / 2 - 0.28, 0.4, 0.04, 0.5, COLORS.porcelain);
      c.box(0, 0.38, o.d / 2 - 0.07, 0.38, 0.4, 0.14, COLORS.porcelain);
      c.box(0.2, 0.75, o.d / 2 - 0.07, 0.04, 0.03, 0.03, COLORS.metal); // 물 내리는 손잡이
      c.box(-0.26, 0.5, o.d / 2 - 0.05, 0.14, 0.14, 0.1, 0xffffff);      // 휴지걸이
    },
    colliders(o) {
      const list = [[0, o.d / 2 - 0.3, 0.4, 0.55]]; // 변기
      if (o.left) list.push([-o.w / 2 + 0.02, 0, 0.04, o.d]);
      if (o.right) list.push([o.w / 2 - 0.02, 0, 0.04, o.d]);
      return list;
    },
  },

  // 세면대 + 거울 (뒤쪽이 벽)
  sink: {
    size: { w: 0.6, d: 0.5 },
    shadow: false,
    build(c, o) {
      c.box(0, 0, 0, o.w, 0.8, o.d, COLORS.sinkBase);
      c.box(0, 0.8, 0, o.w, 0.05, o.d, COLORS.sinkTop);
      c.box(0, 0.85, 0.02, 0.4, 0.02, 0.3, 0xeef3f6);                 // 세면대 안쪽 홈
      c.box(0, 0.85, o.d / 2 - 0.08, 0.04, 0.16, 0.04, COLORS.metal); // 수도꼭지
      c.box(0, 0.99, o.d / 2 - 0.14, 0.04, 0.03, 0.14, COLORS.metal);
      c.glow(0, 1.15, o.d / 2 - 0.01, o.w, 0.85, 0.02, COLORS.mirror);
      c.box(0, 1.13, o.d / 2 - 0.014, o.w + 0.06, 0.91, 0.016, 0xffffff); // 거울 테두리
    },
  },

  // ---------------- 교무실 / 자습실 ----------------
  // 교무실 책상: 연회색 상판 + 양옆 패널 (옵션: monitor 모니터+키보드)
  table: {
    size: { w: 1.4, d: 0.75, h: 0.75 },
    build(c, o) {
      const { w, d, h } = o;
      c.box(0, h - 0.03, 0, w, 0.03, d, COLORS.laminate);
      for (const s of [-1, 1]) c.box(s * (w / 2 - 0.015), 0, 0, 0.03, h - 0.03, d - 0.04, COLORS.laminateSide);
      c.box(0, 0.25, -d / 2 + 0.03, w - 0.06, h - 0.28, 0.02, COLORS.laminateSide); // 앞 가림판
      if (o.monitor) {
        c.box(0, h, -d / 2 + 0.2, 0.2, 0.02, 0.14, COLORS.metal);
        c.box(0, h + 0.02, -d / 2 + 0.2, 0.05, 0.12, 0.04, COLORS.metal);
        c.box(0, h + 0.14, -d / 2 + 0.2, 0.5, 0.3, 0.04, COLORS.monitor);
        c.glow(0, h + 0.16, -d / 2 + 0.178, 0.45, 0.25, 0.005, COLORS.screen);
        c.box(0, h, 0.1, 0.36, 0.018, 0.12, COLORS.metal); // 키보드
      }
      if (c.rand() < 0.5) c.box((c.rand() - 0.5) * (w - 0.5), h, 0.12, 0.21, 0.03, 0.297, 0xf1f1ee, ['up', (c.rand() - 0.5) * 0.5]); // 서류
    },
  },

  // 교무실 의자 (바퀴 달린 사무용)
  officeChair: {
    size: { w: 0.5, d: 0.5 },
    build(c, o) {
      c.box(0, 0.44, 0, o.w - 0.04, 0.07, o.d - 0.06, COLORS.officeChair);        // 좌판
      c.box(0, 0.55, o.d / 2 - 0.03, o.w - 0.06, 0.45, 0.06, COLORS.officeChair); // 등받이
      c.box(0, 0.08, 0, 0.05, 0.36, 0.05, COLORS.metal);                           // 기둥
      c.box(0, 0.04, 0, 0.5, 0.04, 0.05, COLORS.metal);                            // 다리 (X자)
      c.box(0, 0.04, 0, 0.5, 0.04, 0.05, COLORS.metal, ['up', Math.PI / 2]);
      c.box(0, 0.04, 0, 0.5, 0.04, 0.05, COLORS.metal, ['up', Math.PI / 4]);
    },
  },

  // 서류 캐비닛
  cabinet: {
    size: { w: 0.9, d: 0.45 },
    shadow: false,
    tall: true,
    build(c, o) {
      c.box(0, 0, 0, o.w, 1.8, o.d, COLORS.cabinet);
      c.box(0, 0.05, -o.d / 2 - 0.004, o.w - 0.06, 1.7, 0.008, COLORS.cabinetPanel);
      c.box(0, 0.9, -o.d / 2 - 0.012, 0.3, 0.03, 0.012, COLORS.metal);
      for (const y of [0.45, 1.35]) c.box(0, y, -o.d / 2 - 0.012, 0.3, 0.03, 0.012, COLORS.metal);
    },
  },

  // 책장 (옵션: w 로 폭 조절)
  bookshelf: {
    size: { w: 1.6, d: 0.4, h: 1.9 },
    shadow: false,
    tall: true,
    build(c, o) {
      c.box(0, 0, 0.0, o.w, o.h, o.d, COLORS.woodDark);
      // 선반 4칸에 책 꽂기
      const shelfH = (o.h - 0.1) / 4;
      for (let s = 0; s < 4; s++) {
        const y0 = 0.07 + s * shelfH;
        c.box(0, y0 - 0.02, -0.01, o.w - 0.08, shelfH - 0.06 + 0.02, o.d - 0.04, 0x3a2614); // 안쪽 어두운 면
        let x = -o.w / 2 + 0.07;
        while (x < o.w / 2 - 0.1) {
          const bw = 0.04 + c.rand() * 0.05;
          const bh = shelfH * (0.55 + c.rand() * 0.35);
          if (c.rand() < 0.1) { x += 0.12; continue; } // 가끔 빈 자리
          c.box(x + bw / 2, y0, -0.02, bw, bh, o.d - 0.1, pick(COLORS.books, c.rand()));
          x += bw + 0.005;
        }
      }
    },
  },

  // ---------------- 계단 ----------------
  // 계단 한 줄 + 난간. face = 올라가는 사람이 바라보는 방향. 보기만 하고 올라갈 수 없음
  stairs: {
    size: { w: 2.2, d: 4.8, steps: 17, rise: 0.17 },
    tall: true,
    build(c, o) {
      const run = o.d / o.steps;
      const depOf = (i) => o.d / 2 - (i + 0.5) * run; // 낮은 계단이 뒤쪽, 높은 계단이 앞쪽
      for (let i = 0; i < o.steps; i++) {
        const h = (i + 1) * o.rise;
        c.box(0, 0, depOf(i), o.w, h - 0.03, run, COLORS.stairsEdge);              // 계단 옆면(챙)
        c.box(0, h - 0.03, depOf(i) + 0.02, o.w, 0.03, run + 0.04, COLORS.stairs); // 밟는 면
      }
      // 난간: 기둥 + 경사진 손잡이
      const total = o.steps * o.rise;
      const slope = Math.atan2(total - o.rise, o.d - run);
      const len = Math.hypot(o.d - run, total - o.rise);
      for (const side of [-1, 1]) {
        const lat = side * (o.w / 2 - 0.04);
        for (let i = 0; i < o.steps; i += 3) c.box(lat, (i + 1) * o.rise, depOf(i), 0.04, 0.9, 0.04, COLORS.rail);
        c.box(lat, (total + o.rise) / 2 + 0.9 - 0.025, 0, 0.06, 0.05, len, COLORS.rail, ['lat', slope]);
      }
    },
  },

  // 올라가는 계단 (몇 칸만 만들고 끝을 벽으로 막아 둠). face = 올라가는 사람이 바라보는 방향
  //   steps 칸 × 높이 rise, 길이 d 중 끝쪽 block(m)은 천장까지 이어지는 막힌 벽
  stairsUp: {
    size: { w: 3, d: 3.6, steps: 8, rise: 0.17, block: 1.2, h: 3 },
    tall: true,
    build(c, o) {
      const flight = o.d - o.block;
      const run = flight / o.steps;
      const depOf = (i) => o.d / 2 - (i + 0.5) * run; // 낮은 계단이 뒤쪽(출발), 높은 계단이 앞쪽
      for (let i = 0; i < o.steps; i++) {
        const h = (i + 1) * o.rise;
        c.box(0, 0, depOf(i), o.w, h - 0.03, run, COLORS.stairsEdge);              // 계단 옆면(챙)
        c.box(0, h - 0.03, depOf(i) + 0.02, o.w, 0.03, run + 0.04, COLORS.stairs); // 밟는 면
      }
      c.box(0, 0, -o.d / 2 + o.block / 2, o.w, o.h, o.block, COLORS.stairsBlock);   // 막힌 끝
      // 난간: 기둥 + 경사진 손잡이
      const total = o.steps * o.rise;
      const slope = Math.atan2(total - o.rise, flight - run);
      const len = Math.hypot(flight - run, total - o.rise);
      for (const side of [-1, 1]) {
        const lat = side * (o.w / 2 - 0.04);
        for (let i = 0; i < o.steps; i += 3) c.box(lat, (i + 1) * o.rise, depOf(i), 0.04, 0.9, 0.04, COLORS.rail);
        c.box(lat, (total + o.rise) / 2 + 0.9 - 0.025, o.d / 2 - flight / 2, 0.06, 0.05, len, COLORS.rail, ['lat', slope]);
      }
    },
  },

  // 내려가는 계단 (바닥을 비운 구덩이에 몇 칸만 만들고 끝을 벽으로 막아 둠). 입구에 난간
  //   face = 내려가는 사람이 바라보는 방향
  stairsDown: {
    size: { w: 3.6, d: 3.6, steps: 8, rise: 0.17, block: 1.2, h: 3 },
    shadow: false, // 바닥이 없는 자리라 가짜 그림자를 깔지 않음
    build(c, o) {
      const flight = o.d - o.block;
      const run = flight / o.steps;
      const depOf = (i) => o.d / 2 - (i + 0.5) * run; // 입구쪽이 높고(뒤쪽), 깊은 쪽이 앞쪽
      const bottom = -(o.steps * o.rise + 0.25);
      for (let i = 0; i < o.steps; i++) {
        const top = -(i + 1) * o.rise;
        c.box(0, bottom, depOf(i), o.w, top - bottom - 0.03, run, COLORS.stairsEdge);
        c.box(0, top - 0.03, depOf(i) + 0.02, o.w, 0.03, run + 0.04, COLORS.stairs);
      }
      // 구덩이 옆면, 입구 쪽 면, 막힌 끝
      for (const side of [-1, 1]) c.box(side * (o.w / 2 - 0.015), bottom, 0, 0.03, -bottom, o.d, COLORS.stairsEdge);
      c.box(0, -o.rise, o.d / 2 - 0.02, o.w, o.rise, 0.04, COLORS.stairsEdge);
      c.box(0, bottom, -o.d / 2 + o.block / 2, o.w, o.h - bottom, o.block, COLORS.stairsBlock);
      // 입구 난간
      const edge = o.d / 2 - 0.05;
      c.box(0, 0.95, edge, o.w, 0.05, 0.05, COLORS.rail);
      c.box(0, 0.5, edge, o.w, 0.03, 0.03, COLORS.rail);
      const n = Math.max(2, Math.ceil(o.w / 1.0) + 1);
      for (let k = 0; k < n; k++) c.box(-o.w / 2 + 0.04 + (k * (o.w - 0.08)) / (n - 1), 0, edge, 0.04, 0.95, 0.04, COLORS.rail);
    },
  },

  // ---------------- 장식품 (벽에 붙이는 것 포함) ----------------
  // 화분
  plant: {
    size: { w: 0.5, d: 0.5 },
    decor: true,
    build(c, o) {
      c.box(0, 0, 0, 0.34, 0.34, 0.34, COLORS.plantPot);
      c.box(0, 0.34, 0, 0.3, 0.04, 0.3, 0x5a3a22); // 흙
      for (let i = 0; i < 6; i++) {
        const a = c.rand() * 6.28, r = 0.05 + c.rand() * 0.12;
        const s = 0.22 + c.rand() * 0.16;
        c.box(Math.cos(a) * r, 0.4 + i * 0.09, Math.sin(a) * r, s, 0.12, s, i % 2 ? COLORS.plantLeaf : COLORS.plantLeaf2, ['up', c.rand() * 3]);
      }
    },
  },

  // 휴지통
  bin: {
    size: { w: 0.36, d: 0.36 },
    decor: true,
    build(c, o) {
      c.box(0, 0, 0, o.w, 0.55, o.d, COLORS.bin);
      c.box(0, 0.55, 0, o.w + 0.02, 0.03, o.d + 0.02, lighten(COLORS.bin, 0.3));
      c.box(0, 0.35, -o.d / 2 - 0.004, o.w - 0.08, 0.04, 0.008, lighten(COLORS.bin, 0.5));
    },
  },

  // 벽시계 (벽 쪽이 뒤)
  clock: {
    size: { w: 0.42, d: 0.05, y: 2.4 },
    decor: true,
    collide: false,
    shadow: false,
    build(c, o) {
      c.box(0, o.y - 0.21, 0, 0.42, 0.42, o.d, 0x2c2c33);                           // 테두리
      c.box(0, o.y - 0.195, -0.004, 0.37, 0.37, o.d, 0xffffff);                     // 시계판
      c.box(-0.035, o.y - 0.135, -0.03, 0.02, 0.13, 0.012, 0x222222, ['dep', 0.5]); // 시침
      c.box(0.03, o.y - 0.12, -0.034, 0.012, 0.19, 0.012, 0x222222, ['dep', -0.9]); // 분침
      c.box(0, o.y - 0.2, -0.04, 0.03, 0.03, 0.014, COLORS.extinguisher);           // 가운데 점
    },
  },

  // 게시판 (코르크 + 알록달록한 종이)
  corkboard: {
    size: { w: 1.6, d: 0.04, h: 0.9, y: 1.15 },
    decor: true,
    collide: false,
    shadow: false,
    build(c, o) {
      c.box(0, o.y - 0.04, 0, o.w + 0.1, o.h + 0.08, o.d, COLORS.boardFrame);
      c.box(0, o.y, -0.006, o.w, o.h, o.d, COLORS.cork);
      const n = Math.floor(o.w * 4);
      for (let i = 0; i < n; i++) {
        const pw = 0.18 + c.rand() * 0.18, ph = 0.2 + c.rand() * 0.25;
        const x = (c.rand() - 0.5) * (o.w - pw - 0.1), y = o.y + 0.05 + c.rand() * (o.h - ph - 0.1);
        c.box(x, y, -0.03, pw, ph, 0.008, pick(COLORS.paper, c.rand()), ['dep', (c.rand() - 0.5) * 0.3]);
        c.box(x, y + ph - 0.03, -0.037, 0.025, 0.025, 0.008, COLORS.extinguisher); // 압정
      }
    },
  },

  // 포스터
  poster: {
    size: { w: 0.62, d: 0.02, h: 0.88, y: 1.2 },
    decor: true,
    collide: false,
    shadow: false,
    build(c, o) {
      const bg = pick(COLORS.paper, c.rand());
      c.box(0, o.y, 0, o.w, o.h, o.d, bg);
      c.box(0, o.y + o.h * 0.5, -0.0135, o.w - 0.1, o.h * 0.38, 0.006, pick(COLORS.books, c.rand())); // 그림
      c.box(0, o.y + o.h * 0.32, -0.0135, o.w - 0.2, 0.05, 0.006, 0x333333);                           // 제목 줄
      c.box(0, o.y + o.h * 0.2, -0.0135, o.w - 0.24, 0.03, 0.006, 0x666666);                           // 글 줄
      c.box(0, o.y + o.h * 0.12, -0.0135, o.w - 0.3, 0.03, 0.006, 0x666666);
    },
  },

  // 소화기
  extinguisher: {
    size: { w: 0.22, d: 0.14 },
    decor: true,
    collide: false,
    shadow: false,
    build(c, o) {
      c.box(0, 0.35, 0.03, 0.04, 0.5, 0.03, COLORS.metal);                  // 벽 고정대
      c.box(0, 0.4, -0.01, 0.14, 0.46, 0.12, COLORS.extinguisher);          // 몸통
      c.box(0, 0.86, -0.01, 0.07, 0.07, 0.07, 0x222222);                    // 머리
      c.box(0.06, 0.78, -0.07, 0.03, 0.03, 0.08, 0x222222);                 // 호스
      c.box(0, 1.35, 0.05, 0.3, 0.3, 0.012, 0xffffff);                      // 위치 표지판
      c.box(0, 1.35, 0.043, 0.22, 0.22, 0.012, COLORS.extinguisher);
    },
  },
};

// ------------------------------------------------------------
// 방 종류별 자동 배치(LAYOUTS)
//   room.furniture 에 객체를 주면 아래 기본 옵션을 덮어쓴다.
//   F : 방 기준 좌표계 (A = 앞벽~뒷벽 깊이, B = 옆 폭)
//   반환값: [{ type, a, b, face, o? }, ...]  (a, b 는 앞벽/왼쪽에서 잰 거리)
// ------------------------------------------------------------
export const LAYOUTS = {
  // 옵션: board, lectern, clock, bin (true/false), rows, cols, rowGap, colGap
  classroom(F, opt) {
    const o = { board: true, lectern: true, clock: true, bin: true, rows: 6, cols: 5, rowGap: 1.05, colGap: 1.3, ...opt };
    const items = [];
    if (o.board) items.push({ type: 'board', a: 0.03, b: F.B / 2, face: 'back', o: { w: Math.min(5.6, F.B - 1.4) } });
    if (o.clock) items.push({ type: 'clock', a: 0.025, b: F.B / 2, face: 'back' });
    if (o.lectern) items.push({ type: 'lectern', a: 1.1, b: F.B / 2, face: 'back' });
    if (o.bin) items.push({ type: 'bin', a: 0.4, b: 0.4, face: 'back' });

    // 1인용 책상·의자: 학생이 앞(칠판)을 보고 앉음
    for (let r = 0; r < o.rows; r++) {
      for (let c = 0; c < o.cols; c++) {
        const a = 2.4 + r * o.rowGap;
        const b = 0.8 + c * o.colGap;
        if (a + 0.75 > F.A || b + 0.35 > F.B) continue; // 방을 벗어나면 생략
        items.push({ type: 'desk', a, b, face: 'front' });
        items.push({ type: 'chair', a: a + 0.5, b, face: 'front' });
      }
    }
    return items;
  },

  // 옵션: stalls(칸 수), sinks(세면대 수), bin
  restroom(F, opt) {
    const o = { stalls: 4, sinks: 3, bin: true, ...opt };
    const items = [];
    for (let k = 0; k < o.stalls; k++) {
      items.push({ type: 'stall', a: 0.7, b: 0.5 + k * 1.0, face: 'back', o: { left: k > 0, right: k === o.stalls - 1 } });
    }
    for (let k = 0; k < o.sinks; k++) items.push({ type: 'sink', a: 3.0 + k * 1.2, b: F.B - 0.25, face: 'left' });
    if (o.bin) items.push({ type: 'bin', a: F.A - 0.4, b: F.B - 0.35, face: 'front' });
    return items;
  },

  // 옵션: rows, cols (생략하면 방 크기에 맞춰 자동), rowGap, colGap, shelves, plant
  study(F, opt) {
    const o = { rowGap: 1.6, colGap: 1.5, shelves: 0, plant: false, ...opt };
    const rows = o.rows ?? Math.max(1, Math.floor((F.A - 3.0) / o.rowGap) + 1);
    const cols = o.cols ?? Math.max(1, Math.floor((F.B - 0.6) / o.colGap));
    const b0 = (F.B - (cols - 1) * o.colGap) / 2; // 옆으로 가운데 정렬
    const items = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = 1.3 + r * o.rowGap;
        const b = b0 + c * o.colGap;
        if (a + 0.9 > F.A || b + 0.5 > F.B) continue;
        items.push({ type: 'desk', a, b, face: 'front', o: { w: 0.9, d: 0.58, partition: true } });
        items.push({ type: 'chair', a: a + 0.6, b, face: 'front' });
      }
    }
    // 오른쪽 벽을 따라 책장
    for (let k = 0; k < o.shelves; k++) {
      items.push({ type: 'bookshelf', a: 1.2 + k * 1.75, b: F.B - 0.2, face: 'left' });
    }
    if (o.plant) items.push({ type: 'plant', a: F.A - 0.4, b: F.B - 0.4, face: 'front' });
    return items;
  },

  // 옵션: rows, cols, rowGap, colGap, cabinets, plant
  office(F, opt) {
    const o = { rows: 2, cols: 4, rowGap: 2.6, colGap: 3.2, cabinets: true, plant: true, ...opt };
    const items = [];
    for (let r = 0; r < o.rows; r++) {
      for (let c = 0; c < o.cols; c++) {
        const a = 1.7 + r * o.rowGap;
        const b = 2.0 + c * o.colGap;
        if (a + 1.0 > F.A || b + 0.7 > F.B) continue;
        items.push({ type: 'table', a, b, face: 'front', o: { monitor: true } });
        items.push({ type: 'officeChair', a: a + 0.8, b, face: 'front' });
      }
    }
    if (o.cabinets) {
      for (let k = 0; k < 5; k++) items.push({ type: 'cabinet', a: 0.25, b: 0.6 + k * 1.0, face: 'back' });
    }
    if (o.plant) items.push({ type: 'plant', a: F.A - 0.4, b: F.B - 0.4, face: 'front' });
    return items;
  },

  // room.stairs 가 있으면: 북쪽 벽에 붙여 서쪽→동쪽 순서로 올라가는/내려가는 계단을 나란히 놓음
  //   (front 가 'S' 인 계단 방 기준: a 는 남쪽 벽에서 북쪽으로, b 는 서쪽에서 동쪽으로 잰 거리)
  // room.stairs 가 없으면: 앞쪽(front) 벽에 붙여 계단 한 줄. 위로 올라가는 쪽이 앞벽
  stairs(F, opt, room) {
    if (!room.stairs) return [{ type: 'stairs', a: 2.4, b: 1.1, face: 'front' }];
    const { depth, flights } = room.stairs;
    const edge = (room.w - F.B) / 2; // 벽 두께 절반 + 페인트
    const items = [];
    let prev = 0;
    flights.forEach((fl, i) => {
      const lo = Math.max(prev, edge), hi = Math.min(fl.to, room.w - edge);
      prev = fl.to;
      items.push({
        type: fl.kind === 'up' ? 'stairsUp' : 'stairsDown',
        a: F.A - depth / 2,
        b: (lo + hi) / 2 - edge,
        face: 'back', // 북쪽(방 안쪽 끝)을 바라보며 오르내림
        o: { w: hi - lo, d: depth },
      });
    });
    return items;
  },

  corridor() {
    return [];
  },
};

// 방 종류 → 자동 배치 함수 이름
export const LAYOUT_BY_KIND = {
  classroom: 'classroom',
  restroom: 'restroom',
  study: 'study',
  office: 'office',
  stairs: 'stairs',
  corridor: 'corridor',
};
