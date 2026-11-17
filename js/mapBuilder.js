// ============================================================
// mapBuilder.js — mapData 를 읽어 3D 맵(바닥·벽·천장·가구·창문·표지판)을 만들고,
//                 충돌용 정보(colliders)도 함께 만든다.
//
// 성능을 위해 거의 모든 물체를 "상자"로 만들어 InstancedMesh 에 담아 한 번에 그린다.
//   · lit  : 빛을 받는 상자 (벽, 바닥, 천장, 가구)
//   · glow : 스스로 빛나는 상자 (형광등, 창문 유리, 모니터 화면)
//   · 바닥 장식: 가구 그림자, 벽 아래 그늘, 형광등·햇빛 얼룩 (반투명 판)
// 문·가구는 나중에 하나씩 다룰 수 있도록 id/종류/위치/부품 번호를
// world.doors, world.furniture 목록에 기록해 둔다.
//
// 좌표계: x = 동쪽(+), z = 남쪽(+), y = 위쪽(+). (mapData.js 와 동일)
// ============================================================

import * as THREE from 'three';
import { COLORS, FLOOR_STYLE, WALL_STYLE } from './config.js';
import { FURNITURE_TYPES, LAYOUTS, LAYOUT_BY_KIND } from './furniture.js';
import { createMaterials } from './graphics.js';
import { makeSignTexture } from './textures.js';
import { addWindows, addWallDecor } from './decor.js';

const EPS = 1e-6;
const PAINT = 0.02; // 벽 페인트 두께 (decor.js 와 같은 값)

// 방위 → 바깥쪽을 향하는 방향 벡터 [x, z]
const SIDE_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

// ------------------------------------------------------------
// 작은 도구들
// ------------------------------------------------------------
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 같은 씨앗이면 항상 같은 값이 나오는 난수 (가구마다 모양이 조금씩 다르지만 새로고침해도 그대로) */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const scaled = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

// ------------------------------------------------------------
// 1) 상자 모음 / 바닥 장식 모음
// ------------------------------------------------------------
class BoxBatch {
  constructor() {
    this.items = [];
  }

  get count() {
    return this.items.length;
  }

  // 중심 (cx, cy, cz), 크기 (sx, sy, sz), 색 color. quat 가 있으면 기울임. 부품 번호를 돌려줌
  add(cx, cy, cz, sx, sy, sz, color, quat = null) {
    this.items.push({ cx, cy, cz, sx, sy, sz, color, quat });
    return this.items.length - 1;
  }

  toMesh(material, name) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, Math.max(1, this.items.length));
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const ident = new THREE.Quaternion();
    const color = new THREE.Color();
    this.items.forEach((b, i) => {
      pos.set(b.cx, b.cy, b.cz);
      scale.set(b.sx, b.sy, b.sz);
      matrix.compose(pos, b.quat || ident, scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(b.color));
    });
    mesh.count = this.items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.name = name;
    return mesh;
  }
}

/** 바닥에 깔리는 납작한 판(그림자, 빛 얼룩) 모음 */
class DecalBatch {
  constructor() {
    this.items = [];
  }

  // 중심 (cx, cz), 크기 (sx, sz), 색 color, 회전 rotY. y 는 바닥 바로 위
  add(cx, cz, sx, sz, color = 0xffffff, rotY = 0) {
    this.items.push({ cx, cz, sx, sz, color, rotY });
  }

  toMesh(material, name, renderOrder) {
    if (this.items.length === 0) return null;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2); // 눕힘. 판의 위쪽 가장자리(v=1)가 -z 방향
    const mesh = new THREE.InstancedMesh(geo, material, this.items.length);
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    this.items.forEach((d, i) => {
      pos.set(d.cx, 0.004, d.cz);
      scale.set(d.sx, 1, d.sz);
      quat.setFromAxisAngle(up, d.rotY);
      matrix.compose(pos, quat, scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(d.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.renderOrder = renderOrder;
    mesh.name = name;
    return mesh;
  }
}

// ------------------------------------------------------------
// 2) 구간(interval) 계산 도우미 — 벽 합치기, 문 구멍 뚫기에 사용
// ------------------------------------------------------------
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

function subtractInterval(list, s, e) {
  const out = [];
  for (const [a, b] of list) {
    if (e <= a + EPS || s >= b - EPS) {
      out.push([a, b]);
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
  const h = wallT / 2 + PAINT;
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
// 4) 메인: 맵 데이터 → 3D 월드
// ------------------------------------------------------------
export function buildWorld(map) {
  const def = { ceilingHeight: 3, wallThickness: 0.2, doorWidth: 1.0, doorHeight: 2.1, ...map.defaults };
  const H = def.ceilingHeight;
  const T = def.wallThickness;

  const materials = createMaterials(H);
  const batch = new BoxBatch();       // 빛을 받는 상자
  const glow = new BoxBatch();        // 스스로 빛나는 상자
  const shadowBlob = new DecalBatch(); // 가구 밑 그림자
  const shadowWall = new DecalBatch(); // 벽 아래 그늘
  const glowDecal = new DecalBatch();  // 빛 얼룩
  const colliders = [];                // 충돌용 상자 { minX, maxX, minZ, maxZ, kind, id }
  const tallBounds = [];               // 키 큰 가구의 바닥 범위 (창문·벽장식 배치 시 피함)
  const group = new THREE.Group();
  group.name = 'school';

  const rooms = map.rooms.map((r) => ({ ...r }));
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const roomAtPoint = (x, z) => rooms.find((r) => x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d) || null;

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
    const rng = makeRng(hashStr('floor-' + r.id));

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
    } else if (style.planks > 0) {
      // 긴 쪽 방향으로 널빤지를 깔고, 널빤지마다 밝기를 조금씩 다르게
      const alongX = r.w >= r.d;
      const across = alongX ? r.d : r.w;
      const n = Math.ceil(across / style.planks - EPS);
      const base = new THREE.Color(style.colors[0]);
      for (let i = 0; i < n; i++) {
        const lo = i * style.planks, wd = Math.min(style.planks, across - lo);
        const col = base.clone().offsetHSL(0, (rng() - 0.5) * 0.04, (rng() - 0.5) * 0.07).getHex();
        if (alongX) batch.add(cx, -0.05, r.z + lo + wd / 2, r.w, 0.1, wd, col);
        else batch.add(r.x + lo + wd / 2, -0.05, cz, wd, 0.1, r.d, col);
      }
    } else {
      batch.add(cx, -0.05, cz, r.w, 0.1, r.d, style.colors[0]);
    }

    batch.add(cx, H + 0.05, cz, r.w, 0.1, r.d, COLORS.ceiling);

    // 천장 형광등: 약 3.8m 간격 격자 + 바닥에 은은한 빛 얼룩
    const nx = Math.max(1, Math.round(r.w / 3.8)), nz = Math.max(1, Math.round(r.d / 3.8));
    const cw = r.w / nx, cd = r.d / nz;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const lx = r.x + (i + 0.5) * cw, lz = r.z + (j + 0.5) * cd;
        batch.add(lx, H - 0.02, lz, 1.3, 0.04, 0.5, COLORS.lightHousing);
        glow.add(lx, H - 0.045, lz, 1.12, 0.01, 0.34, COLORS.lightGlow);
        glowDecal.add(lx, lz, Math.min(cw * 0.95, 3.6), Math.min(cd * 0.95, 3.6), scaled(0xfff1d6, 0.09));
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
  // 벽을 방 경계마다 잘라서 "어느 방 쪽 면인지" 알아내기 위한 경계 좌표
  const xBreaks = [...new Set(rooms.flatMap((r) => [r.x, r.x + r.w]))].sort((a, b) => a - b);
  const zBreaks = [...new Set(rooms.flatMap((r) => [r.z, r.z + r.d]))].sort((a, b) => a - b);

  const faces = []; // 벽의 한쪽 면 목록 (창문·벽장식 배치에 사용)

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

    const breaks = ln.horizontal ? xBreaks : zBreaks;
    for (const [s, e] of segs) {
      if (e - s < 0.01) continue;
      const mid = (s + e) / 2, len = e - s;
      const [cx, cz, sx, sz] = ln.horizontal ? [mid, ln.coord, len, T] : [ln.coord, mid, T, len];
      batch.add(cx, H / 2, cz, sx, H, sz, COLORS.wall); // 벽 속(페인트가 덮음)
      colliders.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2, kind: 'wall' });

      // 이 벽 조각을 방 경계에서 다시 잘라서, 양쪽 면이 각각 어느 방을 향하는지 정함
      const pts = [s, ...breaks.filter((v) => v > s + 0.15 && v < e - 0.15), e];
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1], m = (a + b) / 2;
        for (const side of [1, -1]) {
          const at = (sd) => (ln.horizontal ? roomAtPoint(m, ln.coord + sd * 0.3) : roomAtPoint(ln.coord + sd * 0.3, m));
          const room = at(side);
          if (!room) continue; // 건물 바깥쪽 면은 안 보이니 칠하지 않음
          faces.push({
            horizontal: ln.horizontal,
            coord: ln.coord,
            side,
            s: a,
            e: b,
            room,
            other: at(-side),
            nx: ln.horizontal ? 0 : side,
            nz: ln.horizontal ? side : 0,
          });
        }
      }
    }
  }

  // ---- 벽 면 마감: 페인트(아래/위 색 다르게), 중간 띠, 걸레받이, 천장 몰딩, 벽 아래 그늘 ----
  for (const f of faces) {
    const st = WALL_STYLE[f.room.kind] || WALL_STYLE.default;
    const len = f.e - f.s, mid = (f.s + f.e) / 2;
    // 벽 표면에서 off 만큼 띄운 상자
    const panel = (y0, h, off, thick, color) => {
      const p = T / 2 + off + thick / 2;
      const [cx, cz, sx, sz] = f.horizontal ? [mid, f.coord + f.side * p, len, thick] : [f.coord + f.side * p, mid, thick, len];
      batch.add(cx, y0 + h / 2, cz, sx, h, sz, color);
    };
    panel(0, st.lowerH, 0, PAINT, st.lower);
    panel(st.lowerH, H - st.lowerH, 0, PAINT, st.upper);
    panel(st.lowerH - 0.03, 0.06, 0, 0.045, COLORS.trim);  // 중간 띠
    panel(0, 0.11, 0, 0.04, COLORS.baseboard);             // 걸레받이
    panel(H - 0.07, 0.07, 0, 0.04, COLORS.trim);           // 천장 몰딩

    // 벽 아래쪽 그늘 (바닥에 깔리는 반투명 띠)
    const depth = 0.8;
    const c = T / 2 + depth / 2;
    if (f.horizontal) shadowWall.add(mid, f.coord + f.side * c, len, depth, 0xffffff, f.side > 0 ? 0 : Math.PI);
    else shadowWall.add(f.coord + f.side * c, mid, len, depth, 0xffffff, f.side > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  // ---- 문 위 벽(인방) + 문틀 ----
  for (const d of doors) {
    const s = d.center - d.width / 2, e = d.center + d.width / 2;
    const place = (alongMid, alongLen, y0, h, thick, color, shift = 0) => {
      const [cx, cz, sx, sz] = d.horizontal
        ? [alongMid, d.line + shift, alongLen, thick]
        : [d.line + shift, alongMid, thick, alongLen];
      batch.add(cx, y0 + h / 2, cz, sx, h, sz, color);
    };
    place(d.center, d.width, d.height, H - d.height, T, COLORS.wall); // 문 위 벽 속

    // 문 위 벽 양쪽 면 페인트
    for (const side of [1, -1]) {
      const room = d.horizontal ? roomAtPoint(d.center, d.line + side * 0.3) : roomAtPoint(d.line + side * 0.3, d.center);
      if (!room) continue;
      const st = WALL_STYLE[room.kind] || WALL_STYLE.default;
      place(d.center, d.width, d.height, H - d.height, PAINT, st.upper, side * (T / 2 + PAINT / 2));
      place(d.center, d.width, H - 0.07, 0.07, 0.04, COLORS.trim, side * (T / 2 + 0.02));
    }

    place(d.center, d.width + 0.12, d.height, 0.06, T + 0.06, COLORS.doorFrame);  // 문틀 윗부분
    place(s - 0.03, 0.06, 0, d.height, T + 0.06, COLORS.doorFrame);               // 문틀 왼쪽
    place(e + 0.03, 0.06, 0, d.height, T + 0.06, COLORS.doorFrame);               // 문틀 오른쪽
  }

  // ---- 가구 ----
  const furniture = []; // 가구 목록 (id, 종류, 방, 위치, 부품 번호)
  const counters = new Map();
  const extraMeshes = []; // 칠판 글씨처럼 그림이 붙은 판

  const nextId = (roomId, type) => {
    const key = roomId + '/' + type;
    const n = (counters.get(key) || 0) + 1;
    counters.set(key, n);
    return `${roomId}-${type}-${n}`;
  };

  const planeCache = new Map();

  function placeFurniture(spec) {
    const tpl = FURNITURE_TYPES[spec.type];
    if (!tpl) {
      console.warn(`[mapBuilder] 알 수 없는 가구 종류: ${spec.type}`);
      return;
    }
    const o = { ...tpl.size, ...spec.opts };
    const f = spec.f;                // 이 가구의 앞면이 향하는 방향
    const r = [-f[1], f[0]];         // 앞면을 바라볼 때의 오른쪽
    const back = [-f[0], -f[1]];     // 뒤쪽
    const alongX = Math.abs(f[0]) > 0.5;
    const toWorld = (lat, dep) => [spec.x + lat * r[0] + dep * back[0], spec.z + lat * r[1] + dep * back[1]];
    const rng = makeRng(hashStr(spec.id));

    const axes = { lat: [r[0], 0, r[1]], dep: [back[0], 0, back[1]], up: [0, 1, 0] };
    const makeBox = (target) => (lat, y0, dep, sl, sh, sd, color, rot) => {
      const [wx, wz] = toWorld(lat, dep);
      let quat = null;
      if (rot) quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axes[rot[0]]), rot[1]);
      target.add(wx, y0 + sh / 2, wz, alongX ? sd : sl, sh, alongX ? sl : sd, color, quat);
    };
    const ctx = {
      box: makeBox(batch),
      glow: makeBox(glow),
      rand: rng,
      plane(lat, yc, dep, w, h, texture) {
        const [wx, wz] = toWorld(lat, dep);
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
        );
        mesh.position.set(wx, yc, wz);
        mesh.rotation.y = Math.atan2(f[0], f[1]); // 앞면이 f 방향을 보게
        extraMeshes.push(mesh);
      },
    };

    const start = batch.count;
    tpl.build(ctx, o);
    const end = batch.count;

    const fw = alongX ? o.d : o.w, fd = alongX ? o.w : o.d; // 바닥 면적 (x 크기, z 크기)
    const bounds = { minX: spec.x - fw / 2, maxX: spec.x + fw / 2, minZ: spec.z - fd / 2, maxZ: spec.z + fd / 2 };

    if (tpl.collide !== false) {
      const boxes = tpl.colliders ? tpl.colliders(o) : [[0, 0, o.w, o.d]];
      for (const [lat, dep, sl, sd] of boxes) {
        const [wx, wz] = toWorld(lat, dep);
        const sx = alongX ? sd : sl, sz = alongX ? sl : sd;
        colliders.push({ minX: wx - sx / 2, maxX: wx + sx / 2, minZ: wz - sz / 2, maxZ: wz + sz / 2, kind: 'furniture', id: spec.id });
      }
      if (tpl.shadow !== false) shadowBlob.add(spec.x, spec.z, fw + 0.32, fd + 0.32);
    }
    if (tpl.tall) tallBounds.push(bounds);

    if (!tpl.decor) {
      furniture.push({
        id: spec.id,
        type: spec.type,
        room: spec.room,
        x: spec.x,
        z: spec.z,
        face: spec.f,
        bounds,
        parts: [start, end], // lit 상자 목록 안의 부품 번호 범위 [start, end)
      });
    }
  }

  for (const r of rooms) {
    if (r.furniture === false) continue; // 이 방은 가구 없음
    const layoutName = LAYOUT_BY_KIND[r.kind];
    if (!layoutName) continue;

    // "앞쪽" 벽: 직접 지정 > 교실은 서쪽 > 첫 문의 반대쪽
    const firstDoor = doors.find((d) => d.room === r.id);
    const front = r.front || (r.kind === 'classroom' ? 'W' : firstDoor ? OPPOSITE[firstDoor.wall] : 'S');
    const F = makeFrame(r, T, front);
    const opts = typeof r.furniture === 'object' ? r.furniture : {};

    for (const it of LAYOUTS[layoutName](F, opts, r)) {
      const [x, z] = F.toWorld(it.a, it.b);
      placeFurniture({ id: nextId(r.id, it.type), type: it.type, room: r.id, x, z, f: F.dir(it.face), opts: it.o });
    }
  }

  // mapData 에서 직접 지정한 추가 가구
  for (const ex of map.extraFurniture || []) {
    const { id, type, room, x, z, face, ...opts } = ex;
    placeFurniture({ id: id || nextId(room || 'extra', type), type, room, x, z, f: SIDE_VEC[face || 'N'], opts });
  }

  // ---- 창문, 벽 장식, 복도 소품 (벽 면을 보고 자동 배치) ----
  const B = { T, H, batch, glow, glowDecal, tallBounds, types: FURNITURE_TYPES, nextId, placeFurniture };
  const windowed = addWindows(B, faces);
  addWallDecor(B, faces, windowed);

  // ---- 메쉬 만들기 ----
  group.add(batch.toMesh(materials.lit, 'boxes'));
  group.add(glow.toMesh(materials.glow, 'glow-boxes'));
  const decals = [
    shadowWall.toMesh(materials.shadowWall, 'shadow-wall', 1),
    shadowBlob.toMesh(materials.shadowBlob, 'shadow-furniture', 2),
    glowDecal.toMesh(materials.glowDecal, 'light-pools', 3),
  ];
  for (const m of decals) if (m) group.add(m);
  for (const m of extraMeshes) {
    m.renderOrder = 4;
    group.add(m);
  }

  // ---- 문 위 이름 표지판 ----
  const signGeo = new THREE.PlaneGeometry(1.2, 0.3);
  const signMats = new Map();
  for (const d of doors) {
    if (d.label === false || d.label === null || d.label === '') continue;
    const n = SIDE_VEC[d.wall].slice();
    if (d.signSide === 'in') { n[0] = -n[0]; n[1] = -n[1]; }
    const off = T / 2 + PAINT + 0.006;
    const text = String(d.label);
    if (!signMats.has(text)) signMats.set(text, new THREE.MeshBasicMaterial({ map: makeSignTexture(text), transparent: true }));
    const sign = new THREE.Mesh(signGeo, signMats.get(text));
    sign.position.set(d.x + n[0] * off, 2.55, d.z + n[1] * off);
    sign.rotation.y = Math.atan2(n[0], n[1]); // 평면의 앞면이 n 방향을 보게 함
    sign.name = `sign-${d.id}`;
    group.add(sign);
  }

  // ---- 위치 → 방 찾기 (HUD 표시용) ----
  const roomAt = (x, z) => roomAtPoint(x, z);

  // 맵 전체 범위 (미니맵용)
  const bounds = rooms.reduce(
    (b, r) => ({
      minX: Math.min(b.minX, r.x), maxX: Math.max(b.maxX, r.x + r.w),
      minZ: Math.min(b.minZ, r.z), maxZ: Math.max(b.maxZ, r.z + r.d),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  );

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
    bounds,
    spawn: { x: sp.x, z: sp.z, yaw },
    wallHeight: H,
  };
}
