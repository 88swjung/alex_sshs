// ============================================================
// mapBuilder.js — mapData 를 읽어 3D 맵(바닥·벽·천장·가구·표지판)을 만들고,
//                 충돌용 정보(colliders)도 함께 만든다.
//
// 성능을 위해 모든 "상자" 모양 물체(벽, 바닥, 가구 부품...)를
// 하나의 InstancedMesh 로 묶어 한 번에 그린다. (그리기 호출 1번)
// 대신 문·가구는 나중에 하나씩 다룰 수 있도록 id/종류/위치/부품 번호를
// world.doors, world.furniture 목록에 기록해 둔다.
//
// 좌표계: x = 동쪽(+), z = 남쪽(+), y = 위쪽(+). (mapData.js 와 동일)
// ============================================================

import * as THREE from 'three';
import { COLORS, FLOOR_STYLE } from './config.js';

const EPS = 1e-6;
const SIGN_FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';

// 방위 → 바깥쪽을 향하는 방향 벡터 [x, z]
const SIDE_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

// ------------------------------------------------------------
// 1) 상자 모음: 모든 상자를 모아 두었다가 InstancedMesh 하나로 만든다
// ------------------------------------------------------------
class BoxBatch {
  constructor() {
    this.items = [];
  }

  get count() {
    return this.items.length;
  }

  // 중심 (cx, cy, cz), 크기 (sx, sy, sz), 색상 color 인 상자를 추가. 부품 번호를 돌려줌
  add(cx, cy, cz, sx, sy, sz, color) {
    this.items.push({ cx, cy, cz, sx, sy, sz, color });
    return this.items.length - 1;
  }

  toMesh() {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff }), // 색은 상자마다 따로(instanceColor)
      this.items.length
    );
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const color = new THREE.Color();
    this.items.forEach((b, i) => {
      pos.set(b.cx, b.cy, b.cz);
      scale.set(b.sx, b.sy, b.sz);
      matrix.compose(pos, quat, scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(b.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.name = 'static-boxes';
    return mesh;
  }
}

// ------------------------------------------------------------
// 2) 구간(interval) 계산 도우미 — 벽 합치기, 문 구멍 뚫기에 사용
// ------------------------------------------------------------

// 겹치거나 맞닿은 구간을 하나로 합침
function mergeIntervals(list) {
  const sorted = list.map((v) => [v[0], v[1]]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1] + EPS) last[1] = Math.max(last[1], iv[1]);
    else out.push(iv);
  }
  return out;
}

// 구간 목록에서 [s, e] 구간을 잘라냄
function subtractInterval(list, s, e) {
  const out = [];
  for (const [a, b] of list) {
    if (e <= a + EPS || s >= b - EPS) {
      out.push([a, b]); // 겹치지 않음
      continue;
    }
    if (s > a + EPS) out.push([a, s]);
    if (e < b - EPS) out.push([e, b]);
  }
  return out;
}

// ------------------------------------------------------------
// 3) 방 기준 좌표계(frame) — 가구를 "앞벽에서 몇 m, 옆으로 몇 m" 식으로 배치하기 위함
//    a : 앞쪽 벽 안쪽 면에서 방 안쪽으로 들어간 거리
//    b : 옆으로 잰 거리 (앞벽을 바라보고 섰을 때 왼쪽 끝에서 오른쪽으로)
//    방향 이름: 'front'(앞벽쪽) 'back'(뒷벽쪽) 'left'/'right'(b 감소/증가 방향)
// ------------------------------------------------------------
const FRAMES = {
  W: { u: [1, 0], v: [0, 1] },
  E: { u: [-1, 0], v: [0, -1] },
  N: { u: [0, 1], v: [-1, 0] },
  S: { u: [0, -1], v: [1, 0] },
};

function makeFrame(room, wallT, front) {
  const h = wallT / 2;
  const x0 = room.x + h, x1 = room.x + room.w - h; // 벽 안쪽 면 기준 사각형
  const z0 = room.z + h, z1 = room.z + room.d - h;
  const { u, v } = FRAMES[front];
  const origin = { W: [x0, z0], E: [x1, z1], N: [x1, z0], S: [x0, z1] }[front];
  const alongX = front === 'W' || front === 'E';
  const A = alongX ? x1 - x0 : z1 - z0; // 앞벽에서 뒷벽까지 깊이
  const B = alongX ? z1 - z0 : x1 - x0; // 옆 폭
  return {
    A,
    B,
    toWorld: (a, b) => [origin[0] + u[0] * a + v[0] * b, origin[1] + u[1] * a + v[1] * b],
    dir: (name) => {
      switch (name) {
        case 'front': return [-u[0], -u[1]];
        case 'back':  return [u[0], u[1]];
        case 'left':  return [-v[0], -v[1]];
        case 'right': return [v[0], v[1]];
        default: throw new Error('알 수 없는 방향: ' + name);
      }
    },
  };
}

// ------------------------------------------------------------
// 4) 가구 종류(FURNITURE_TYPES)
//    - w, d : 바닥 면적(옆 폭, 깊이). 옵션으로 바꿀 수 있음
//    - build(c, o) : 부품(상자)을 만든다.
//        c.box(lat, y0, dep, sl, sh, sd, color)
//          lat : 가구 중심에서 오른쪽(+)으로, dep : 뒤쪽(+)으로 떨어진 거리
//          y0  : 상자 바닥 높이, sl/sh/sd : 옆 폭/높이/깊이
//        "앞쪽"(dep < 0)은 그 가구를 쓰는 사람이 바라보는 방향
//    - colliders(o) : (선택) 충돌 상자 목록 [lat, dep, sl, sd]. 생략하면 바닥 면적 전체
//    - collide: false : 충돌 없음 (칠판처럼 벽에 붙은 것)
// ------------------------------------------------------------
const FURNITURE_TYPES = {
  // 책상 (옵션: partition 가림판, monitor 모니터)
  desk: {
    size: { w: 0.6, d: 0.45, h: 0.72 },
    build(c, o) {
      c.box(0, o.h - 0.04, 0, o.w, 0.04, o.d, COLORS.wood);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          c.box(sx * (o.w / 2 - 0.04), 0, sz * (o.d / 2 - 0.04), 0.04, o.h - 0.04, 0.04, COLORS.metal);
        }
      }
      if (o.partition) c.box(0, o.h, -o.d / 2 + 0.015, o.w, 0.35, 0.03, COLORS.partition);
      if (o.monitor) {
        c.box(0, o.h, -o.d / 2 + 0.2, 0.2, 0.02, 0.14, COLORS.metal);
        c.box(0, o.h + 0.02, -o.d / 2 + 0.2, 0.05, 0.12, 0.04, COLORS.metal);
        c.box(0, o.h + 0.14, -o.d / 2 + 0.2, 0.5, 0.3, 0.04, COLORS.monitor);
      }
    },
  },

  // 의자
  chair: {
    size: { w: 0.4, d: 0.4 },
    build(c, o) {
      c.box(0, 0.42, 0, o.w, 0.04, o.d, COLORS.chair);
      c.box(0, 0.46, o.d / 2 - 0.02, o.w, 0.4, 0.04, COLORS.chair); // 등받이(뒤쪽)
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          c.box(sx * (o.w / 2 - 0.03), 0, sz * (o.d / 2 - 0.03), 0.03, 0.42, 0.03, COLORS.metal);
        }
      }
    },
  },

  // 칠판 (벽에 붙어 있어서 충돌 없음)
  board: {
    size: { w: 4.0, d: 0.06 },
    collide: false,
    build(c, o) {
      c.box(0, 0.95, 0, o.w + 0.12, 1.3, o.d, COLORS.boardFrame);   // 테두리
      c.box(0, 1.0, -0.005, o.w, 1.2, o.d + 0.01, COLORS.board);    // 칠판 면 (살짝 튀어나옴)
      c.box(0, 0.93, -0.07, o.w, 0.03, 0.1, COLORS.boardFrame);     // 분필 받침
    },
  },

  // 교탁 (4단계에서 "교탁 밑" 숨기를 붙일 예정)
  lectern: {
    size: { w: 1.2, d: 0.6 },
    build(c, o) {
      c.box(0, 0, 0, o.w - 0.1, 0.88, o.d - 0.1, COLORS.woodDark);
      c.box(0, 0.88, 0, o.w, 0.05, o.d, COLORS.wood);
    },
  },

  // 사물함 한 칸 (4단계에서 숨는 곳이 될 예정)
  locker: {
    size: { w: 0.5, d: 0.45 },
    build(c, o) {
      c.box(0, 0, 0, o.w, 1.9, o.d, COLORS.locker);
      c.box(0, 0.08, -o.d / 2 - 0.004, o.w - 0.08, 1.74, 0.008, COLORS.lockerPanel);
      c.box(0, 1.5, -o.d / 2 - 0.01, 0.25, 0.03, 0.012, COLORS.metal);      // 환기구
      c.box(0.12, 0.95, -o.d / 2 - 0.012, 0.03, 0.12, 0.012, COLORS.metal); // 손잡이
    },
  },

  // 화장실 칸 (앞이 열려 있음). left/right: 옆 칸막이를 세울지
  stall: {
    size: { w: 1.0, d: 1.4 },
    build(c, o) {
      if (o.left) c.box(-o.w / 2 + 0.02, 0.15, 0, 0.04, 1.65, o.d, COLORS.partition);
      if (o.right) c.box(o.w / 2 - 0.02, 0.15, 0, 0.04, 1.65, o.d, COLORS.partition);
      // 변기 (뒤쪽 벽에 붙음)
      c.box(0, 0, o.d / 2 - 0.3, 0.38, 0.38, 0.55, COLORS.porcelain);
      c.box(0, 0.38, o.d / 2 - 0.28, 0.4, 0.04, 0.5, COLORS.porcelain);
      c.box(0, 0.38, o.d / 2 - 0.07, 0.38, 0.4, 0.14, COLORS.porcelain);
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
    build(c, o) {
      c.box(0, 0, 0, o.w, 0.8, o.d, COLORS.sinkBase);
      c.box(0, 0.8, 0, o.w, 0.05, o.d, COLORS.sinkTop);
      c.box(0, 0.85, o.d / 2 - 0.08, 0.04, 0.15, 0.04, COLORS.metal);
      c.box(0, 1.15, o.d / 2 - 0.01, o.w, 0.8, 0.02, COLORS.mirror);
    },
  },

  // 서류 캐비닛 (교무실)
  cabinet: {
    size: { w: 0.9, d: 0.45 },
    build(c, o) {
      c.box(0, 0, 0, o.w, 1.8, o.d, COLORS.cabinet);
      c.box(0, 0.05, -o.d / 2 - 0.004, o.w - 0.06, 1.7, 0.008, COLORS.cabinetPanel);
      c.box(0, 0.9, -o.d / 2 - 0.012, 0.3, 0.03, 0.012, COLORS.metal);
    },
  },

  // 계단 한 줄. face = 올라가는 사람이 바라보는 방향. 보기만 하고 올라갈 수 없음
  stairs: {
    size: { w: 2.2, d: 4.8, steps: 17, rise: 0.17 },
    build(c, o) {
      const run = o.d / o.steps;
      for (let i = 0; i < o.steps; i++) {
        const h = (i + 1) * o.rise;                 // i=0 이 가장 낮은 첫 계단
        const dep = o.d / 2 - (i + 0.5) * run;      // 낮은 계단이 뒤쪽, 높은 계단이 앞쪽
        c.box(0, 0, dep, o.w, h, run, i % 2 ? COLORS.stairsEdge : COLORS.stairs);
      }
    },
  },
};

// ------------------------------------------------------------
// 5) 방 종류별 자동 가구 배치(LAYOUTS)
//    room.furniture 에 객체를 주면 아래 기본 옵션을 덮어쓴다.
//    반환값: [{ type, a, b, face, o? }, ...]  (a, b 는 방 기준 좌표계)
// ------------------------------------------------------------
const LAYOUTS = {
  // 옵션: board, lectern, lockers (true/false), rows, cols, rowGap, colGap
  classroom(F, opt) {
    const o = { board: true, lectern: true, lockers: true, rows: 5, cols: 5, rowGap: 1.0, colGap: 1.3, ...opt };
    const items = [];
    if (o.board) items.push({ type: 'board', a: 0.03, b: F.B / 2, face: 'back', o: { w: Math.min(4.2, F.B - 1) } });
    if (o.lectern) items.push({ type: 'lectern', a: 1.1, b: F.B / 2, face: 'back' });

    // 책상·의자: 학생이 앞(칠판)을 보고 앉음
    for (let r = 0; r < o.rows; r++) {
      for (let c = 0; c < o.cols; c++) {
        const a = 2.4 + r * o.rowGap;
        const b = 0.8 + c * o.colGap;
        if (a + 0.7 > F.A - (o.lockers ? 0.45 : 0) || b + 0.3 > F.B) continue; // 방을 벗어나면 생략
        items.push({ type: 'desk', a, b, face: 'front' });
        items.push({ type: 'chair', a: a + 0.48, b, face: 'front' });
      }
    }

    // 뒤쪽 벽 사물함 줄
    if (o.lockers) {
      const n = Math.floor((F.B - 0.2) / 0.5);
      const b0 = (F.B - n * 0.5) / 2 + 0.25;
      for (let k = 0; k < n; k++) items.push({ type: 'locker', a: F.A - 0.225, b: b0 + k * 0.5, face: 'front' });
    }
    return items;
  },

  // 옵션: stalls(칸 수), sinks(세면대 수)
  restroom(F, opt) {
    const o = { stalls: 4, sinks: 3, ...opt };
    const items = [];
    // 앞벽(문 반대쪽)을 따라 칸막이 칸
    for (let k = 0; k < o.stalls; k++) {
      items.push({ type: 'stall', a: 0.7, b: 0.5 + k * 1.0, face: 'back', o: { left: k > 0, right: k === o.stalls - 1 } });
    }
    // 오른쪽 벽을 따라 세면대
    for (let k = 0; k < o.sinks; k++) items.push({ type: 'sink', a: 3.0 + k * 1.2, b: F.B - 0.25, face: 'left' });
    return items;
  },

  // 옵션: rows, cols, rowGap, colGap
  study(F, opt) {
    const o = { rows: 3, cols: 6, rowGap: 1.8, colGap: 2.2, ...opt };
    const items = [];
    for (let r = 0; r < o.rows; r++) {
      for (let c = 0; c < o.cols; c++) {
        const a = 1.3 + r * o.rowGap;
        const b = 1.3 + c * o.colGap;
        if (a + 1.0 > F.A || b + 0.7 > F.B) continue;
        items.push({ type: 'desk', a, b, face: 'front', o: { w: 1.4, d: 0.7, h: 0.74, partition: true } });
        items.push({ type: 'chair', a: a + 0.75, b, face: 'front', o: { w: 0.45, d: 0.45 } });
      }
    }
    return items;
  },

  // 옵션: rows, cols, rowGap, colGap, cabinets(true/false)
  office(F, opt) {
    const o = { rows: 2, cols: 4, rowGap: 2.6, colGap: 3.2, cabinets: true, ...opt };
    const items = [];
    for (let r = 0; r < o.rows; r++) {
      for (let c = 0; c < o.cols; c++) {
        const a = 1.7 + r * o.rowGap;
        const b = 2.0 + c * o.colGap;
        if (a + 1.0 > F.A || b + 0.7 > F.B) continue;
        items.push({ type: 'desk', a, b, face: 'front', o: { w: 1.4, d: 0.75, h: 0.75, monitor: true } });
        items.push({ type: 'chair', a: a + 0.8, b, face: 'front', o: { w: 0.45, d: 0.45 } });
      }
    }
    if (o.cabinets) {
      for (let k = 0; k < 5; k++) items.push({ type: 'cabinet', a: 0.25, b: 0.6 + k * 1.0, face: 'back' });
    }
    return items;
  },

  // 앞쪽(front) 벽에 붙여 계단 한 줄. 위로 올라가는 쪽이 앞벽
  stairs(F) {
    return [{ type: 'stairs', a: 2.4, b: 1.1, face: 'front' }];
  },

  corridor() {
    return [];
  },
};

// 방 종류 → 자동 배치 함수 이름
const LAYOUT_BY_KIND = {
  classroom: 'classroom',
  restroom: 'restroom',
  study: 'study',
  office: 'office',
  stairs: 'stairs',
  corridor: 'corridor',
};

// ------------------------------------------------------------
// 6) 표지판 (canvas 로 글자를 그려 텍스처로 사용)
// ------------------------------------------------------------
function makeSignTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = COLORS.signBg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = COLORS.signText;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = COLORS.signText;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 76;
  g.font = `bold ${size}px ${SIGN_FONT}`;
  while (g.measureText(text).width > 440 && size > 20) { // 글자가 길면 줄여서 맞춤
    size -= 4;
    g.font = `bold ${size}px ${SIGN_FONT}`;
  }
  g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------
// 7) 메인: 맵 데이터 → 3D 월드
// ------------------------------------------------------------
export function buildWorld(map) {
  const def = { ceilingHeight: 3, wallThickness: 0.2, doorWidth: 1.0, doorHeight: 2.1, ...map.defaults };
  const H = def.ceilingHeight;
  const T = def.wallThickness;

  const batch = new BoxBatch();
  const colliders = []; // 충돌용 상자 { minX, maxX, minZ, maxZ, kind, id }
  const group = new THREE.Group();
  group.name = 'school';

  const rooms = map.rooms.map((r) => ({ ...r }));
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  // ---- 문 정보 계산 (월드 좌표로 풀어 둠) ----
  const doors = (map.doors || []).map((d) => {
    const room = roomById.get(d.room);
    if (!room) throw new Error(`문 ${d.id}: 방 '${d.room}' 이(가) 없습니다`);
    const width = d.width ?? def.doorWidth;
    const height = d.height ?? def.doorHeight;
    const horizontal = d.wall === 'N' || d.wall === 'S'; // 벽이 동서 방향으로 뻗어 있는가
    const line = horizontal ? (d.wall === 'N' ? room.z : room.z + room.d) : d.wall === 'W' ? room.x : room.x + room.w;
    const center = horizontal ? room.x + d.pos : room.z + d.pos;
    return {
      id: d.id,
      type: 'door',
      room: d.room,
      wall: d.wall,
      width,
      height,
      horizontal,
      line,   // 벽 중심선 좌표 (horizontal 이면 z, 아니면 x)
      center, // 문 중앙의 벽 방향 좌표 (horizontal 이면 x, 아니면 z)
      x: horizontal ? center : line,
      z: horizontal ? line : center,
      label: d.label === undefined ? room.name : d.label,
      signSide: d.signSide || 'out',
    };
  });

  // ---- 바닥 · 천장 · 천장 조명 ----
  for (const r of rooms) {
    const style = FLOOR_STYLE[r.kind] || FLOOR_STYLE.default;
    const cx = r.x + r.w / 2, cz = r.z + r.d / 2;
    if (style.tile > 0) {
      // 두 색 타일을 번갈아 깔기
      let ix = 0;
      for (let x = 0; x < r.w - EPS; x += style.tile, ix++) {
        let iz = 0;
        for (let z = 0; z < r.d - EPS; z += style.tile, iz++) {
          const sx = Math.min(style.tile, r.w - x), sz = Math.min(style.tile, r.d - z);
          batch.add(r.x + x + sx / 2, -0.05, r.z + z + sz / 2, sx, 0.1, sz, style.colors[(ix + iz) % 2]);
        }
      }
    } else {
      batch.add(cx, -0.05, cz, r.w, 0.1, r.d, style.colors[0]);
    }
    batch.add(cx, H + 0.05, cz, r.w, 0.1, r.d, COLORS.ceiling);

    // 천장 조명 패널: 약 4m 간격 격자
    const nx = Math.max(1, Math.floor(r.w / 4)), nz = Math.max(1, Math.floor(r.d / 4));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        batch.add(r.x + ((i + 0.5) * r.w) / nx, H - 0.01, r.z + ((j + 0.5) * r.d) / nz, 1.2, 0.02, 0.5, COLORS.lightPanel);
      }
    }
  }

  // ---- 벽: 방 가장자리를 선(line)별로 모아 합친 뒤, 문 자리를 뚫는다 ----
  const lines = new Map(); // 'h:-7.500' → { horizontal, coord, intervals }
  const addEdge = (horizontal, coord, s, e) => {
    const key = (horizontal ? 'h:' : 'v:') + coord.toFixed(3);
    if (!lines.has(key)) lines.set(key, { horizontal, coord, intervals: [] });
    lines.get(key).intervals.push([s, e]);
  };
  for (const r of rooms) {
    addEdge(true, r.z, r.x, r.x + r.w);
    addEdge(true, r.z + r.d, r.x, r.x + r.w);
    addEdge(false, r.x, r.z, r.z + r.d);
    addEdge(false, r.x + r.w, r.z, r.z + r.d);
  }

  for (const ln of lines.values()) {
    // 모서리가 깔끔하게 만나도록 양 끝을 벽 두께의 절반만큼 늘림
    let segs = mergeIntervals(ln.intervals).map(([s, e]) => [s - T / 2, e + T / 2]);
    for (const d of doors) {
      if (d.horizontal !== ln.horizontal || Math.abs(d.line - ln.coord) > 1e-3) continue;
      const s = d.center - d.width / 2, e = d.center + d.width / 2;
      const inWall = segs.some(([a, b]) => s >= a - EPS && e <= b + EPS);
      if (!inWall) console.warn(`[mapBuilder] 문 '${d.id}' 이(가) 벽 위에 있지 않습니다. pos 값을 확인하세요.`);
      segs = subtractInterval(segs, s, e);
    }
    for (const [s, e] of segs) {
      if (e - s < 0.01) continue;
      const mid = (s + e) / 2, len = e - s;
      const [cx, cz, sx, sz] = ln.horizontal ? [mid, ln.coord, len, T] : [ln.coord, mid, T, len];
      batch.add(cx, H / 2, cz, sx, H, sz, COLORS.wall);
      // 걸레받이(벽 아래 띠)
      const [bx, bz] = ln.horizontal ? [len, T + 0.02] : [T + 0.02, len];
      batch.add(cx, 0.06, cz, bx, 0.12, bz, COLORS.baseboard);
      colliders.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2, kind: 'wall' });
    }
  }

  // ---- 문 위 벽(인방) + 문틀 ----
  for (const d of doors) {
    const s = d.center - d.width / 2, e = d.center + d.width / 2;
    const place = (alongMid, alongLen, y0, h, thick, color) => {
      const [cx, cz, sx, sz] = d.horizontal ? [alongMid, d.line, alongLen, thick] : [d.line, alongMid, thick, alongLen];
      batch.add(cx, y0 + h / 2, cz, sx, h, sz, color);
    };
    place(d.center, d.width, d.height, H - d.height, T, COLORS.wall);                 // 문 위 벽
    place(d.center, d.width + 0.12, d.height, 0.06, T + 0.02, COLORS.doorFrame);      // 문틀 윗부분
    place(s - 0.03, 0.06, 0, d.height, T + 0.02, COLORS.doorFrame);                   // 문틀 왼쪽
    place(e + 0.03, 0.06, 0, d.height, T + 0.02, COLORS.doorFrame);                   // 문틀 오른쪽
  }

  // ---- 가구 ----
  const furniture = []; // 가구 목록 (id, 종류, 방, 위치, 부품 번호)
  const counters = new Map();

  function placeFurniture(spec) {
    const tpl = FURNITURE_TYPES[spec.type];
    if (!tpl) {
      console.warn(`[mapBuilder] 알 수 없는 가구 종류: ${spec.type}`);
      return;
    }
    const o = { ...tpl.size, ...spec.opts };
    const f = spec.f;                // 가구를 쓰는 사람이 바라보는 방향
    const r = [-f[1], f[0]];         // 그 사람의 오른쪽
    const back = [-f[0], -f[1]];     // 그 사람의 뒤쪽
    const alongX = Math.abs(f[0]) > 0.5;
    const toWorld = (lat, dep) => [spec.x + lat * r[0] + dep * back[0], spec.z + lat * r[1] + dep * back[1]];
    const ctx = {
      box(lat, y0, dep, sl, sh, sd, color) {
        const [wx, wz] = toWorld(lat, dep);
        batch.add(wx, y0 + sh / 2, wz, alongX ? sd : sl, sh, alongX ? sl : sd, color);
      },
    };

    const start = batch.count;
    tpl.build(ctx, o);
    const end = batch.count;

    if (tpl.collide !== false) {
      const boxes = tpl.colliders ? tpl.colliders(o) : [[0, 0, o.w, o.d]];
      for (const [lat, dep, sl, sd] of boxes) {
        const [wx, wz] = toWorld(lat, dep);
        const sx = alongX ? sd : sl, sz = alongX ? sl : sd;
        colliders.push({ minX: wx - sx / 2, maxX: wx + sx / 2, minZ: wz - sz / 2, maxZ: wz + sz / 2, kind: 'furniture', id: spec.id });
      }
    }

    const fw = alongX ? o.d : o.w, fd = alongX ? o.w : o.d;
    furniture.push({
      id: spec.id,
      type: spec.type,
      room: spec.room,
      x: spec.x,
      z: spec.z,
      face: spec.f,
      bounds: { minX: spec.x - fw / 2, maxX: spec.x + fw / 2, minZ: spec.z - fd / 2, maxZ: spec.z + fd / 2 },
      parts: [start, end], // batch 안의 부품 번호 범위 [start, end)
    });
  }

  const nextId = (roomId, type) => {
    const key = roomId + '/' + type;
    const n = (counters.get(key) || 0) + 1;
    counters.set(key, n);
    return `${roomId}-${type}-${n}`;
  };

  for (const r of rooms) {
    if (r.furniture === false) continue; // 이 방은 가구 없음
    const layoutName = LAYOUT_BY_KIND[r.kind];
    if (!layoutName) continue;

    // "앞쪽" 벽: 직접 지정 > 교실은 서쪽 > 첫 문의 반대쪽
    const firstDoor = doors.find((d) => d.room === r.id);
    const front = r.front || (r.kind === 'classroom' ? 'W' : firstDoor ? OPPOSITE[firstDoor.wall] : 'S');
    const F = makeFrame(r, T, front);
    const opts = typeof r.furniture === 'object' ? r.furniture : {};

    for (const it of LAYOUTS[layoutName](F, opts)) {
      const [x, z] = F.toWorld(it.a, it.b);
      placeFurniture({ id: nextId(r.id, it.type), type: it.type, room: r.id, x, z, f: F.dir(it.face), opts: it.o });
    }
  }

  // mapData 에서 직접 지정한 추가 가구
  for (const ex of map.extraFurniture || []) {
    const { id, type, room, x, z, face, ...opts } = ex;
    placeFurniture({ id: id || nextId(room || 'extra', type), type, room, x, z, f: SIDE_VEC[face || 'N'], opts });
  }

  group.add(batch.toMesh());

  // ---- 문 위 이름 표지판 ----
  const signGeo = new THREE.PlaneGeometry(1.2, 0.3);
  for (const d of doors) {
    if (d.label === false || d.label === null || d.label === '') continue;
    const n = SIDE_VEC[d.wall].slice();
    if (d.signSide === 'in') { n[0] = -n[0]; n[1] = -n[1]; }
    const off = T / 2 + 0.015;
    const sign = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: makeSignTexture(String(d.label)) }));
    sign.position.set(d.x + n[0] * off, 2.55, d.z + n[1] * off);
    sign.rotation.y = Math.atan2(n[0], n[1]); // 평면의 앞면이 n 방향을 보게 함
    sign.name = `sign-${d.id}`;
    group.add(sign);
  }

  // ---- 위치 → 방 찾기 (HUD 표시용) ----
  const roomAt = (x, z) => {
    for (const r of rooms) {
      if (x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d) return r;
    }
    return null;
  };

  // 시작 위치
  const sp = map.spawn || { x: 0, z: 0, facing: 'N' };
  const facing = sp.facing || 'N';
  // yaw 0 = 북쪽(-z). 왼쪽으로 돌면(+) 서쪽.
  const yaw = { N: 0, W: Math.PI / 2, S: Math.PI, E: -Math.PI / 2 }[facing] ?? 0;

  return {
    name: map.name,
    group,
    colliders,
    rooms,
    doors,
    furniture,
    roomAt,
    spawn: { x: sp.x, z: sp.z, yaw },
    wallHeight: H,
  };
}
