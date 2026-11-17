// ============================================================
// mapData.js — 맵 구조 데이터만 들어 있는 파일
// 나중에 실제 학교 배치도로 바꿀 때는 이 파일만 고치면 됩니다.
//
// 좌표계 (단위: 미터)
//   x : 동쪽(+)  /  z : 남쪽(+)  → 북쪽은 z가 작은 쪽
//   방의 (x, z)는 "북서쪽 모서리", w는 x방향(동서) 길이, d는 z방향(남북) 길이
//   방끼리 맞닿는 경계선은 벽 한 장으로 합쳐지고, 벽은 경계선 위에 가운데 정렬되어 서 있음
//
// 방(rooms) 항목
//   id      : 고유 이름 (문·가구가 이 id로 방을 가리킴)
//   name    : 화면(HUD)과 표지판에 쓰는 이름
//   kind    : 'classroom'(교실) | 'restroom'(화장실) | 'study'(자습실) |
//             'office'(교무실)  | 'stairs'(계단)     | 'corridor'(복도)
//   x, z, w, d : 위치와 크기
//   front   : (선택) 이 방의 "앞쪽" 벽 'N'|'S'|'E'|'W'. 칠판·사물함·칸막이 같은 가구 배치 기준.
//             생략하면 교실은 'W', 그 외는 첫 번째 문의 반대쪽 벽
//   furniture : (선택) 생략 = 종류에 맞게 자동 배치 / false = 가구 없음 /
//             { rows: 4, cols: 5, lockers: false ... } = 자동 배치 옵션 조절
//             (옵션 목록은 mapBuilder.js 의 LAYOUTS 참고)
//
// 문(doors) 항목  — 이번 단계에서는 문짝 없이 뚫린 구멍
//   id    : 고유 이름 (4단계 문 잠금 때 이 id로 문을 찾음)
//   room  : 문이 달린 방의 id
//   wall  : 그 방의 어느 벽에 있는지 'N'|'S'|'E'|'W'
//   pos   : 벽 시작점에서 문 "중앙"까지의 거리(m).
//           N/S 벽이면 서쪽 모서리부터, E/W 벽이면 북쪽 모서리부터
//   width, height : (선택) 생략하면 defaults 값 사용
//   label : (선택) 문 위 표지판 글자. 생략하면 방 이름, false면 표지판 없음
//   signSide : (선택) 'out'(방 바깥쪽 면, 기본) | 'in'(방 안쪽 면)
//
// 추가 가구(extraFurniture) — 자동 배치 외에 직접 놓고 싶은 가구
//   { id, type, room, x, z, face: 'N'|'S'|'E'|'W', ...옵션 }
//   type 은 mapBuilder.js 의 FURNITURE_TYPES 참고 (desk, chair, locker, cabinet ...)
//   face 는 그 가구를 쓰는 사람이 바라보는 방향
// ============================================================

export const MAP = {
  name: '임시 학교 1층',

  // 맵 전체 기본값
  defaults: {
    ceilingHeight: 3,   // 천장 높이
    wallThickness: 0.2, // 벽 두께
    doorWidth: 1.0,     // 문 폭
    doorHeight: 2.1,    // 문 높이
  },

  // 시작 위치: 복도 한가운데, 복도를 따라 동쪽을 바라봄
  spawn: { x: 30, z: 1.5, facing: 'E' },

  rooms: [
    // ---- 복도 (동서로 60m, 폭 3m) ----
    { id: 'corridor', name: '복도', kind: 'corridor', x: 0, z: 0, w: 60, d: 3 },

    // ---- 복도 양 끝 계단실 (올라갈 수 없음) ----
    { id: 'stairW', name: '서쪽 계단', kind: 'stairs', x: -6, z: -1.5, w: 6, d: 6, front: 'W' },
    { id: 'stairE', name: '동쪽 계단', kind: 'stairs', x: 60, z: -1.5, w: 6, d: 6, front: 'E' },

    // ---- 복도 북쪽: 교실 6개 (9m × 7.5m). 칠판은 서쪽 벽 ----
    { id: 'class1', name: '1반', kind: 'classroom', x: 3,  z: -7.5, w: 9, d: 7.5, front: 'W' },
    { id: 'class2', name: '2반', kind: 'classroom', x: 12, z: -7.5, w: 9, d: 7.5, front: 'W' },
    { id: 'class3', name: '3반', kind: 'classroom', x: 21, z: -7.5, w: 9, d: 7.5, front: 'W' },
    { id: 'class4', name: '4반', kind: 'classroom', x: 30, z: -7.5, w: 9, d: 7.5, front: 'W' },
    { id: 'class5', name: '5반', kind: 'classroom', x: 39, z: -7.5, w: 9, d: 7.5, front: 'W' },
    { id: 'class6', name: '6반', kind: 'classroom', x: 48, z: -7.5, w: 9, d: 7.5, front: 'W' },

    // ---- 복도 남쪽 ----
    { id: 'restroomM', name: '남자 화장실', kind: 'restroom', x: 3,  z: 3, w: 8,  d: 8 },
    { id: 'restroomF', name: '여자 화장실', kind: 'restroom', x: 11, z: 3, w: 8,  d: 8 },
    { id: 'study',     name: '자습실',      kind: 'study',    x: 19, z: 3, w: 14, d: 8 },
    { id: 'office',    name: '교무실',      kind: 'office',   x: 33, z: 3, w: 14, d: 8 },
  ],

  doors: [
    // 교실: 복도(남쪽) 벽에 앞문(서쪽, 칠판 쪽)·뒷문(동쪽)
    { id: 'class1-front', room: 'class1', wall: 'S', pos: 1.2 },
    { id: 'class1-back',  room: 'class1', wall: 'S', pos: 7.8 },
    { id: 'class2-front', room: 'class2', wall: 'S', pos: 1.2 },
    { id: 'class2-back',  room: 'class2', wall: 'S', pos: 7.8 },
    { id: 'class3-front', room: 'class3', wall: 'S', pos: 1.2 },
    { id: 'class3-back',  room: 'class3', wall: 'S', pos: 7.8 },
    { id: 'class4-front', room: 'class4', wall: 'S', pos: 1.2 },
    { id: 'class4-back',  room: 'class4', wall: 'S', pos: 7.8 },
    { id: 'class5-front', room: 'class5', wall: 'S', pos: 1.2 },
    { id: 'class5-back',  room: 'class5', wall: 'S', pos: 7.8 },
    { id: 'class6-front', room: 'class6', wall: 'S', pos: 1.2 },
    { id: 'class6-back',  room: 'class6', wall: 'S', pos: 7.8 },

    // 복도 남쪽 방들: 북쪽 벽에 문 1개
    { id: 'restroomM-door', room: 'restroomM', wall: 'N', pos: 1.5 },
    { id: 'restroomF-door', room: 'restroomF', wall: 'N', pos: 1.5 },
    { id: 'study-door',     room: 'study',     wall: 'N', pos: 2.0 },
    { id: 'office-door',    room: 'office',    wall: 'N', pos: 2.0 },

    // 계단실: 복도 쪽 벽에 문 1개 (z = 1.5, 복도 한가운데 높이)
    { id: 'stairW-door', room: 'stairW', wall: 'E', pos: 3, label: '계단' },
    { id: 'stairE-door', room: 'stairE', wall: 'W', pos: 3, label: '계단' },
  ],

  // 자동 배치 말고 직접 놓을 가구 (지금은 없음)
  // 예) { id: 'extra-desk-1', type: 'desk', room: 'corridor', x: 10, z: 1.5, face: 'N' }
  extraFurniture: [],
};
