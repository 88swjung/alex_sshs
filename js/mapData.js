// ============================================================
// mapData.js — 맵 구조 데이터만 들어 있는 파일
// 실제 학교 "예지관 3층"
//   · 방 배치·문: school_structure/예지관/3F/예지_3F_general.png
//   · 방 안 가구: school_structure/예지관/3F/예지_3F_inside.png
//
// 좌표계 (단위: 미터)
//   x : 동쪽(+)  /  z : 남쪽(+)  → 북쪽은 z가 작은 쪽
//   원점 (0, 0) = 건물 북서쪽 모서리. 방의 (x, z)는 "북서쪽 모서리", w는 동서 길이, d는 남북 길이
//   방끼리 맞닿는 경계선은 벽 한 장으로 합쳐지고, 벽은 경계선 위에 가운데 정렬되어 서 있음
//
// 방(rooms) 항목
//   id      : 고유 이름 (문·가구가 이 id로 방을 가리킴)
//   name    : 화면(HUD)과 표지판에 쓰는 이름 (한글)
//   kind    : 'classroom'(교실·강의실) | 'lab'(실험실·준비실) | 'restroom'(화장실) | 'office'(교무실·사무실) |
//             'gym'(체육관) | 'stairs'(계단) | 'corridor'(복도) | 'study'(자습실) |
//             'solid'(벽으로 막힌 공간: 드나들 수 없고 문·가구·바닥이 없음)
//   x, z, w, d : 위치와 크기
//   front   : (선택) 이 방의 "앞쪽" 벽 'N'|'S'|'E'|'W'. 자동 배치(furniture 옵션)의 기준
//   furniture : (선택) 생략 = 종류에 맞게 자동 배치 / false = 자동 배치 없음 / { ... } = 자동 배치 옵션
//   items   : (선택) 방 안 가구 목록 — 아래 '가구 항목' 참고
//   decor   : (선택) false 면 이 방 벽에 게시판·포스터 같은 장식도 안 붙임
//   curtains: (선택) ['N', ...] 이 쪽 벽의 창문에만 검은 커튼이 달림 (걷어 둔 상태). 기본은 커튼 없음
//   zone    : (선택) 같은 zone 이름의 방끼리 맞닿은 곳은 벽 없이 터짐 (한 공간을 여러 칸으로 나눠 적을 때)
//   floorY  : (선택) 바닥 높이(m). 단상처럼 올라간 바닥. 가구도 그만큼 올려 놓음
//   steps   : (선택) { dir, n, to } 이 방 바닥 전체를 계단으로 만듦. dir 쪽으로 올라가 to 높이의 바닥과 이어짐
//   stairs  : (계단 방만) 건물 계단 구성. 아래 '계단' 항목 참고
//
// 가구 항목(items) — 가구는 모두 world.furniture 에 id·종류가 기록됨 (id 를 따로 안 주면 '방id-종류-번호')
//   { type, x, z, face, ...옵션 } : 방 북서쪽 모서리에서 (x, z) m 떨어진 곳에 가구 "중심"을 놓음.
//                                   face 는 가구 앞면이 향하는 방향 'N'|'S'|'E'|'W'
//   { type, wall, at, ...옵션 }   : 벽에 등을 붙이고 방 안쪽을 보게 놓음. wall 은 붙일 벽,
//                                   at 은 그 벽을 따라 잰 위치(N/S 벽이면 서쪽 모서리부터, E/W 벽이면 북쪽 모서리부터)의 가구 중심
//   옵션: w(옆 폭), d(깊이), h(높이) 등 가구 종류별 크기, id(직접 이름 붙이기)
//   가구 종류는 furniture.js 의 FURNITURE_TYPES 참고
//
// 문(doors) 항목
//   id    : 고유 이름
//   room  : 문이 달린 방의 id
//   wall  : 그 방의 어느 벽에 있는지 'N'|'S'|'E'|'W'
//   pos   : 벽 시작점에서 문 "중앙"까지의 거리(m). N/S 벽이면 서쪽 모서리부터, E/W 벽이면 북쪽 모서리부터
//   kind  : 'swing'(여닫이, 기본) | 'sliding'(미닫이). 두 종류 모두 world.setDoorOpen / toggleDoor 로 열고 닫을 수 있음
//   open  : (선택) 처음 상태. 기본 true(열림) — 열린 상태에서는 걸어 지나갈 수 있음
//   width, height : (선택) 생략하면 kind 에 맞는 기본값 사용
//   label : (선택) 문 위 표지판 글자. 생략하면 방 이름, false 면 표지판 없음
//   signSide : (선택) 'out'(방 바깥쪽 면, 기본) | 'in'(방 안쪽 면)
//   window  : (선택) true 면 문짝에 유리창
//   curtain : (선택) true 면 그 유리창에 검은 커튼 (걷어 둔 상태, 방 안쪽 면)
//
// 뚫린 통로(openings) 항목 — 문 없이 벽을 통째로 터 둔 곳 (계단·외부연결·융합인재관 연결)
//   id, room, wall : 어느 방의 어느 벽인지
//   from, to : 벽 시작점에서 터진 구간의 시작·끝(m)
//
// 계단(stairs, 계단 방에만): 다른 층이 아직 없어서 몇 칸만 만들고 막아 둠
//   depth   : 북쪽 벽에서 계단이 차지하는 깊이(m) (끝쪽 일부는 벽처럼 막힘)
//   flights : 서쪽에서 동쪽 순서로 [{ kind: 'down'|'up', to }] — to 는 방 서쪽 끝에서 이 계단이 끝나는 곳(m)
//
// 추가 가구(extraFurniture) — 방과 상관없이 월드 좌표로 직접 놓고 싶은 가구
//   { id, type, room, x, z, face: 'N'|'S'|'E'|'W', ...옵션 }
// ============================================================

// 방 한 칸을 "서쪽 x0 ~ 동쪽 x1, 북쪽 z0 ~ 남쪽 z1" 범위로 적는 도우미 (오타를 줄이려고 w, d 를 자동 계산)
const room = (id, name, kind, x0, x1, z0, z1, extra = {}) => ({
  id, name, kind, x: x0, z: z0, w: x1 - x0, d: z1 - z0, ...extra,
});

// 세로(z) 경계: 위쪽 줄 / 복도 / 아래쪽 줄
const Z0 = 0;       // 건물 북쪽 벽
const Z1 = 9.4;     // 위쪽 줄 방들의 남쪽 벽 = 복도 북쪽
const Z2 = 12.4;    // 복도 남쪽 = 아래쪽 줄 방들의 북쪽 벽 (복도 폭 3m)
const Z3 = 21.2;    // 건물 남쪽 벽

// 체육관 가로(x) 경계: 체육관 마룻바닥 | 단상 쪽 | 단상 쪽 안쪽 끝 | 동쪽 벽
const GX0 = 62.9;
const GXW = 85.3;   // 마룻바닥과 단상 쪽의 경계 (그림의 긴 빨간 선)
const GXI = 91.8;   // 단상·단상 위아래 방의 동쪽 끝 (그 바깥은 동쪽 벽을 따라 난 통로)
const GX1 = 94.5;
const STAGE = 0.5;  // 단상 높이

// ------------------------------------------------------------
// 가구 배치 도우미
// ------------------------------------------------------------
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

/** 의자 하나: (x, z) 에 놓고 face 쪽(책상 쪽)을 봄 */
const chair = (x, z, face, type = 'chair') => ({ type, x, z, face });

/**
 * 실험대 + 의자 4개 (남·북쪽 긴 변에 2개씩).  cx, cz = 실험대 중심
 * 의자는 실험대 쪽을 봄.
 */
const labSet = (cx, cz) => [
  { type: 'labBench', x: cx, z: cz, face: 'S', w: 1.3, d: 0.9 },
  chair(cx - 0.33, cz - 0.74, 'S'), chair(cx + 0.33, cz - 0.74, 'S'),
  chair(cx - 0.33, cz + 0.74, 'N'), chair(cx + 0.33, cz + 0.74, 'N'),
];

/**
 * 교실 1인용 책상·의자 (학생이 동쪽(앞)을 보고 앉음, 책상은 의자 동쪽).
 *   cols  : 책상 열의 x 위치들 (서 → 동)
 *   groups: 2인 한 쌍의 z 중심들 (쌍 안에서 책상 두 개가 0.7m 간격)
 */
const lectureSeats = (cols, groups) => {
  const items = [];
  for (const cx of cols) {
    for (const gz of groups) {
      for (const dz of [-0.35, 0.35]) {
        items.push({ type: 'desk', x: cx, z: gz + dz, face: 'E' });
        items.push(chair(cx - 0.5, gz + dz, 'E'));
      }
    }
  }
  return items;
};

/** 교무실 책상 + 사무용 의자: 책상은 벽 쪽(face)으로 붙이고 의자는 안쪽에서 책상을 봄 */
const officeDesk = (x, z, face) => {
  const dx = face === 'W' ? 0.8 : -0.8; // 의자는 책상에서 방 안쪽으로 0.8m
  return [
    { type: 'table', x, z, face, w: 1.4, d: 0.75, monitor: true },
    chair(x + dx, z, face, 'officeChair'),
  ];
};

/** 바닥 색칠/선 한 조각 (체육관 코트) */
const mark = (x, z, w, d, color) => ({ type: 'floorMark', x, z, face: 'N', w, d, color });

/** 사각형 테두리(선 두께 t) 를 floorMark 4개로 */
const outline = (x0, z0, x1, z1, color, t = 0.07) => [
  mark((x0 + x1) / 2, z0, x1 - x0 + t, t, color),
  mark((x0 + x1) / 2, z1, x1 - x0 + t, t, color),
  mark(x0, (z0 + z1) / 2, t, z1 - z0 - t, color),
  mark(x1, (z0 + z1) / 2, t, z1 - z0 - t, color),
];

const LINE = 0xf0efe9, BLUE = 0x3f6fae;

export const MAP = {
  name: '예지관 3층',

  // 맵 전체 기본값
  defaults: {
    ceilingHeight: 3,   // 천장 높이
    wallThickness: 0.2, // 벽 두께
    doorWidth: 1.0,     // 여닫이문 폭
    slidingDoorWidth: 1.2, // 미닫이문 폭
    doorHeight: 2.1,    // 문 높이
  },

  // 시작 위치: 복도 한가운데, 동쪽(계단·체육관 쪽)을 바라봄
  spawn: { x: 30, z: 10.9, facing: 'E' },

  rooms: [
    // ================= 복도 (폭 3m) =================
    // 서쪽 끝 "외부연결"에서 시작해 동쪽으로 이어짐
    room('passW',    '외부연결', 'corridor', -4, 0, Z1, Z2, { furniture: false, decor: false }),   // 다른 건물과 이어질 통로 (끝은 막아 둠)
    room('corridor', '복도',     'corridor', 0, 56.6, Z1, Z2),
    // 협의실 오른쪽 ~ 남자화장실 아래의 빈 공간도 복도
    room('corridorE', '복도',    'corridor', 56.6, 62.9, Z1, Z3),

    // ================= 위쪽 줄 (북쪽), 서 → 동 =================
    // ---- 첨단물리 기기실: 서쪽 벽 긴 실험대, 북쪽 큰 실험대, 동쪽 벽 실험대, 가운데 실험대 ----
    room('adv', '첨단물리 기기실', 'lab', 0, 4.0, Z0, Z1, {
      furniture: false,
      items: [
        { type: 'labBench', wall: 'W', at: 4.3, w: 5.4, d: 0.7 },
        { type: 'labBench', x: 2.45, z: 1.7, face: 'S', w: 2.7, d: 1.0 },
        { type: 'labBench', wall: 'E', at: 5.6, w: 4.4, d: 0.6 },
        { type: 'labBench', x: 2.0, z: 5.8, face: 'S', w: 1.2, d: 2.0 },
      ],
    }),

    // ---- 물리실험실2: 실험대 2×2 (의자 각 4개), 동쪽 벽 긴 교탁+의자+칠판, 남쪽(복도쪽) 벽 책장·책장·높은 실험장.
    //      북쪽 창문 검은 커튼, 복도 쪽 문 유리창 검은 커튼 ----
    room('lab2', '물리실험실2', 'lab', 4.0, 11.8, Z0, Z1, {
      furniture: false,
      curtains: ['N'],
      items: [
        ...[1.8, 4.2].flatMap((cx) => [2.4, 5.4].flatMap((cz) => labSet(cx, cz))),
        { type: 'table', x: 6.5, z: 3.7, face: 'W', w: 5.0, d: 0.9 },
        chair(7.35, 3.7, 'W', 'officeChair'),
        { type: 'board', wall: 'E', at: 3.7, w: 4.4 },
        { type: 'bookshelf', wall: 'S', at: 1.1, w: 1.4, d: 0.4, h: 1.9 },
        { type: 'bookshelf', wall: 'S', at: 3.7, w: 1.0, d: 0.4, h: 1.9 },
        { type: 'labCabinet', wall: 'S', at: 4.9, w: 1.0, d: 0.6, h: 2.3 },
      ],
    }),

    // ---- 물리실험실3: 실험실2와 같은 구성. 남쪽 벽은 장·장·높은 장 ----
    room('lab3', '물리실험실3', 'lab', 11.8, 20.5, Z0, Z1, {
      furniture: false,
      curtains: ['N'],
      items: [
        ...[2.0, 4.6].flatMap((cx) => [2.4, 5.4].flatMap((cz) => labSet(cx, cz))),
        { type: 'table', x: 6.9, z: 3.7, face: 'W', w: 5.0, d: 0.9 },
        chair(7.85, 3.7, 'W', 'officeChair'),
        { type: 'board', wall: 'E', at: 3.7, w: 4.4 },
        { type: 'closet', wall: 'S', at: 1.05, w: 1.6, d: 0.5, h: 1.2 },
        { type: 'closet', wall: 'S', at: 3.95, w: 1.1, d: 0.5, h: 1.2 },
        { type: 'closet', wall: 'S', at: 5.55, w: 1.5, d: 0.5, h: 2.2 },
      ],
    }),

    // ---- 교무실(북): 양쪽 벽에 책상 2개씩, 가운데 통로 쪽에 의자 ----
    room('officeN', '교무실', 'office', 20.5, 24.6, Z0, Z1, {
      furniture: false,
      items: [
        ...officeDesk(0.5, 2.4, 'W'), ...officeDesk(0.5, 6.1, 'W'),
        ...officeDesk(3.55, 2.4, 'E'), ...officeDesk(3.55, 6.1, 'E'),
      ],
    }),

    // ---- 물리강의실2: 학생은 동쪽(앞)을 봄. 동쪽 벽 칠판 + 교탁(긴 책상)·의자, 북쪽 창가 긴 책상,
    //      남쪽(복도쪽) 벽 긴 책상 ----
    room('lectureN', '물리강의실2', 'classroom', 24.6, 33.6, Z0, Z1, {
      furniture: false,
      items: [
        { type: 'board', wall: 'E', at: 4.4, w: 5.0 },
        { type: 'clock', wall: 'E', at: 4.4 },
        { type: 'table', x: 7.4, z: 4.4, face: 'W', w: 4.2, d: 0.8 },
        chair(8.3, 4.4, 'W', 'officeChair'),
        ...lectureSeats([1.5, 2.9, 4.3, 5.7], [2.0, 4.4, 6.8]),
        { type: 'table', wall: 'S', at: 4.85, w: 3.9, d: 0.7 },
        { type: 'table', wall: 'N', at: 4.5, w: 8.4, d: 0.5 },
      ],
    }),

    room('restroomF', '여자화장실', 'restroom', 33.6, 38.9, Z0, Z1, { decor: false }), // 칸·세면대 자동 배치
    // 계단: 가운데가 올라가는 계단, 양옆 두 개가 내려가는 계단. 문 없이 복도로 뚫려 있음
    room('stairs',    '계단',            'stairs',    38.9, 56.6, Z0, Z1, {
      decor: false,
      stairs: {
        depth: 3.6,
        flights: [
          { kind: 'down', to: 3.85 },
          { kind: 'up',   to: 13.8 },
          { kind: 'down', to: 17.7 },
        ],
      },
    }),

    // ---- 남자화장실: 북쪽 벽 변기 칸 3개(칸막이), 동쪽 벽 소변기 4개(사이 가림판), 서쪽 벽 세면대 3개 ----
    room('restroomM', '남자화장실', 'restroom', 56.6, 62.9, Z0, Z1, {
      furniture: false,
      decor: false,
      items: [
        { type: 'stall', wall: 'N', at: 0.65, left: true, right: false },
        { type: 'stall', wall: 'N', at: 1.65, left: true, right: false },
        { type: 'stall', wall: 'N', at: 2.65, left: true, right: false },
        ...[2.5, 3.4, 4.3, 5.2].map((at) => ({ type: 'urinal', wall: 'E', at })),
        ...[2.05, 2.95, 3.85, 4.75, 5.65].map((at) => ({ type: 'urinalDivider', wall: 'E', at, inset: 0.0 })),
        ...[3.2, 4.4, 5.6].map((at) => ({ type: 'sink', wall: 'W', at })),
        { type: 'bin', x: 5.6, z: 8.7, face: 'N' },
      ],
    }),

    // ================= 아래쪽 줄 (남쪽), 서 → 동 =================
    // ---- 물리실험실1: 실험대 3열×2줄(의자 각 4개), 서·동쪽 벽에 긴 책상+의자, 북쪽(복도쪽) 긴 책상,
    //      남쪽 창가 긴 책상. 남쪽 창문·복도 쪽 문 유리창 검은 커튼 ----
    room('lab1', '물리실험실1', 'lab', 0, 11.8, Z2, Z3, {
      furniture: false,
      curtains: ['S'],
      items: [
        { type: 'table', x: 1.45, z: 4.5, face: 'E', w: 5.0, d: 0.9 },
        chair(0.58, 4.5, 'E', 'officeChair'),
        { type: 'table', x: 10.45, z: 4.6, face: 'W', w: 5.0, d: 0.9 },
        chair(11.35, 4.6, 'W', 'officeChair'),
        ...[3.3, 5.8, 8.3].flatMap((cx) => [3.0, 6.0].flatMap((cz) => labSet(cx, cz))),
        { type: 'table', wall: 'N', at: 6.0, w: 5.8, d: 0.7 },
        { type: 'table', wall: 'S', at: 5.9, w: 11.0, d: 0.5 },
      ],
    }),

    // ---- 물리준비실: 북쪽 벽 장 2개, 가운데 책상 2개+의자, 남쪽 벽에서 뻗은 실험장 4줄(통로 사이) ----
    room('prep', '물리준비실', 'lab', 11.8, 20.5, Z2, Z3, {
      furniture: false,
      items: [
        { type: 'closet', wall: 'N', at: 1.2, w: 1.4, d: 0.5, h: 1.2 },
        { type: 'closet', wall: 'N', at: 7.1, w: 1.8, d: 0.5, h: 1.2 },
        { type: 'table', x: 4.4, z: 1.5, face: 'E', w: 2.6, d: 0.6 },
        { type: 'table', x: 5.5, z: 0.7, face: 'S', w: 1.3, d: 0.55 },
        chair(5.5, 1.5, 'N', 'officeChair'),
        // 실험장: 서쪽 벽(안쪽 보기) / 가운데 두 줄(등을 맞댄 양면) / 동쪽 벽
        ...[4.65, 6.25, 7.85].flatMap((z) => [
          { type: 'labCabinet', wall: 'W', at: z, w: 1.6, d: 0.6, h: 1.9 },
          { type: 'labCabinet', x: 2.3, z, face: 'W', w: 1.6, d: 0.6, h: 1.9 },
          { type: 'labCabinet', x: 2.9, z, face: 'E', w: 1.6, d: 0.6, h: 1.9 },
          { type: 'labCabinet', x: 5.3, z, face: 'W', w: 1.6, d: 0.6, h: 1.9 },
          { type: 'labCabinet', x: 5.9, z, face: 'E', w: 1.6, d: 0.6, h: 1.9 },
          { type: 'labCabinet', wall: 'E', at: z, w: 1.6, d: 0.6, h: 1.9 },
        ]),
      ],
    }),

    // ---- 교무실(남): 벽 쪽 책상 4개가 엇갈려 놓임 ----
    room('officeS', '교무실', 'office', 20.5, 24.6, Z2, Z3, {
      furniture: false,
      items: [
        ...officeDesk(3.55, 2.5, 'E'), ...officeDesk(0.5, 4.0, 'W'),
        ...officeDesk(3.55, 5.7, 'E'), ...officeDesk(0.5, 7.3, 'W'),
      ],
    }),

    // ---- 물리강의실1: 강의실2와 같은 구성 (복도가 북쪽이라 위아래가 뒤집힘) ----
    room('lectureS', '물리강의실1', 'classroom', 24.6, 33.6, Z2, Z3, {
      furniture: false,
      items: [
        { type: 'board', wall: 'E', at: 5.1, w: 5.0 },
        { type: 'clock', wall: 'E', at: 5.1 },
        { type: 'table', x: 7.4, z: 5.1, face: 'W', w: 4.2, d: 0.8 },
        chair(8.3, 5.1, 'W', 'officeChair'),
        ...lectureSeats([1.5, 2.9, 4.3, 5.7], [3.0, 5.1, 7.2]),
        { type: 'table', wall: 'N', at: 4.55, w: 3.7, d: 0.7 },
        { type: 'table', wall: 'S', at: 4.5, w: 8.4, d: 0.5 },
      ],
    }),

    // ---- 그림에 없는 방: 실제 고등학교에 맞게 채움 ----
    // 생활안전부: 교사 책상 4개 + 캐비닛 + 책장
    room('safety', '생활안전부', 'office', 33.6, 41.3, Z2, Z3, {
      furniture: false,
      items: [
        { type: 'table', x: 2.3, z: 3.3, face: 'S', w: 1.4, d: 0.75, monitor: true }, chair(2.3, 2.5, 'S', 'officeChair'),
        { type: 'table', x: 5.3, z: 3.3, face: 'S', w: 1.4, d: 0.75, monitor: true }, chair(5.3, 2.5, 'S', 'officeChair'),
        { type: 'table', x: 2.3, z: 6.1, face: 'S', w: 1.4, d: 0.75, monitor: true }, chair(2.3, 5.3, 'S', 'officeChair'),
        { type: 'table', x: 5.3, z: 6.1, face: 'S', w: 1.4, d: 0.75, monitor: true }, chair(5.3, 5.3, 'S', 'officeChair'),
        ...[1.5, 2.5, 3.5].map((at) => ({ type: 'cabinet', wall: 'E', at })),
        { type: 'bookshelf', wall: 'W', at: 5.0, w: 1.6 },
        { type: 'plant', x: 7.2, z: 8.2, face: 'N' },
      ],
    }),
    // 상담실: 상담 탁자와 의자, 소파, 책장
    room('counsel', '상담실', 'office', 41.3, 46.9, Z2, Z3, {
      furniture: false,
      items: [
        { type: 'table', x: 2.8, z: 4.4, face: 'S', w: 1.6, d: 0.9 },
        chair(2.4, 3.55, 'S', 'officeChair'), chair(3.2, 3.55, 'S', 'officeChair'),
        chair(2.4, 5.25, 'N', 'officeChair'), chair(3.2, 5.25, 'N', 'officeChair'),
        { type: 'sofa', wall: 'E', at: 6.8, w: 1.8, d: 0.8 },
        { type: 'bookshelf', wall: 'W', at: 5.5, w: 1.6 },
        { type: 'plant', x: 4.9, z: 1.0, face: 'S' },
      ],
    }),
    // 협의실: 긴 회의 탁자와 의자, 서쪽 벽 칠판, 북쪽 벽 캐비닛
    room('meeting', '협의실', 'office', 46.9, 56.6, Z2, Z3, {
      furniture: false,
      items: [
        { type: 'board', wall: 'W', at: 4.4, w: 4.0 },
        { type: 'table', x: 4.8, z: 4.4, face: 'S', w: 5.2, d: 1.3 },
        ...[2.6, 3.7, 4.8, 5.9, 7.0].flatMap((x) => [chair(x, 3.55, 'S', 'officeChair'), chair(x, 5.25, 'N', 'officeChair')]),
        chair(1.75, 4.4, 'E', 'officeChair'), chair(7.9, 4.4, 'W', 'officeChair'),
        ...[5.5, 6.5, 7.5].map((at) => ({ type: 'cabinet', wall: 'N', at })),
        { type: 'plant', x: 1.0, z: 8.0, face: 'N' },
      ],
    }),

    // ================= 체육관 (건물 동쪽 끝) =================
    // 한 공간(zone 'gym')을 칸으로 나눠 적음: 마룻바닥 / 단상 쪽(좁은 통로, 방 2개, 단상, 단상 계단 2개) / 동쪽 통로
    room('gym', '체육관', 'gym', GX0, GXW, Z0, Z3, {
      zone: 'gym',
      items: [
        // 농구 코트 선: 바닥 파랑 칠 + 흰 선
        mark(3.6, 10.6, 4.8, 4.8, BLUE), mark(19.0, 10.6, 4.8, 4.8, BLUE),
        ...outline(1.2, 4.1, 21.2, 17.1, LINE),
        mark(11.2, 10.6, 0.07, 13.0, LINE),
        ...outline(1.2, 8.2, 6.0, 13.0, LINE), ...outline(16.4, 8.2, 21.2, 13.0, LINE),
        // 벽에 거는 농구 골대 (서쪽 벽 2개, 동쪽 벽 2개)
        { type: 'hoop', wall: 'W', at: 5.0 }, { type: 'hoop', wall: 'W', at: 17.3 },
        { type: 'hoop', wall: 'E', at: 3.5 }, { type: 'hoop', wall: 'E', at: 18.3 },
      ],
    }),
    room('gymPassN', '좁은 통로', 'gym', GXW, GX1, Z0, 2.4, { zone: 'gym' }),
    room('gymPassS', '좁은 통로', 'gym', GXW, GX1, 19.4, Z3, { zone: 'gym' }),
    room('gymEast',  '체육관',    'gym', GXI, GX1, 2.4, 19.4, { zone: 'gym' }),

    // 단상 위쪽·아래쪽 방 (단상과 같은 높이, 문은 단상 쪽으로만)
    room('stageRoomN', '무대 옆방(북)', 'office', GXW, GXI, 2.4, 4.6, {
      floorY: STAGE, furniture: false, decor: false,
      items: [
        { type: 'bookshelf', wall: 'N', at: 1.0, w: 1.4, d: 0.4, h: 1.9 },
        { type: 'bookshelf', wall: 'N', at: 2.5, w: 1.4, d: 0.4, h: 1.9 },
        { type: 'cabinet', wall: 'N', at: 3.6 }, { type: 'cabinet', wall: 'N', at: 4.5 },
      ],
    }),
    room('stageRoomS', '무대 옆방(남)', 'office', GXW, GXI, 17.2, 19.4, {
      floorY: STAGE, furniture: false, decor: false,
      items: [
        { type: 'bookshelf', wall: 'S', at: 1.0, w: 1.4, d: 0.4, h: 1.9 },
        { type: 'bookshelf', wall: 'S', at: 2.5, w: 1.4, d: 0.4, h: 1.9 },
        { type: 'cabinet', wall: 'S', at: 3.6 }, { type: 'cabinet', wall: 'S', at: 4.5 },
      ],
    }),
    // 단상: 서쪽(체육관 쪽) 앞면은 낭떠러지 막이로 막히고, 양쪽 끝의 계단으로만 오를 수 있음
    room('stageMain', '단상', 'gym', 87.7, GXI, 4.6, 17.2, {
      zone: 'gym', floorY: STAGE,
      items: [
        { type: 'piano', x: 2.1, z: 11.4, face: 'W' },   // 그림의 단상 위 작은 네모 = 피아노
        chair(1.25, 11.4, 'E'),
      ],
    }),
    room('stageMid', '단상', 'gym', GXW, 87.7, 5.8, 16.0, { zone: 'gym', floorY: STAGE }),
    room('stageStairN', '단상 계단', 'gym', GXW, 87.7, 4.6, 5.8, { zone: 'gym', steps: { dir: 'E', n: 3, to: STAGE } }),
    room('stageStairS', '단상 계단', 'gym', GXW, 87.7, 16.0, 17.2, { zone: 'gym', steps: { dir: 'E', n: 3, to: STAGE } }),

    // 체육관 동쪽 벽 바깥의 "융합인재관 연결" 통로 (끝은 막아 둠)
    room('passE',     '융합인재관 연결', 'corridor',  GX1, 98.5, Z1, Z2, { furniture: false, decor: false }),
  ],

  doors: [
    // ---- 위쪽 줄: 복도 쪽(남쪽) 벽에 문 (실험실의 문은 유리창 + 검은 커튼) ----
    { id: 'adv-door',       room: 'adv',       wall: 'S', pos: 2.0 },
    { id: 'lab2-door-1',    room: 'lab2',      wall: 'S', pos: 2.5, curtain: true },
    { id: 'lab2-door-2',    room: 'lab2',      wall: 'S', pos: 6.0, curtain: true },
    { id: 'lab3-door-1',    room: 'lab3',      wall: 'S', pos: 2.7, curtain: true },
    { id: 'lab3-door-2',    room: 'lab3',      wall: 'S', pos: 7.0, curtain: true },
    { id: 'officeN-door',   room: 'officeN',   wall: 'S', pos: 2.05, kind: 'sliding' },
    { id: 'lectureN-door-1', room: 'lectureN', wall: 'S', pos: 2.0 },
    { id: 'lectureN-door-2', room: 'lectureN', wall: 'S', pos: 7.5 },
    { id: 'restroomF-door', room: 'restroomF', wall: 'S', pos: 3.7 },
    { id: 'restroomM-door', room: 'restroomM', wall: 'S', pos: 3.5 },  // 남자화장실은 아래쪽(남쪽) 벽에 문

    // ---- 아래쪽 줄: 복도 쪽(북쪽) 벽에 문 ----
    { id: 'lab1-door-1',    room: 'lab1',      wall: 'N', pos: 2.1, curtain: true },
    { id: 'lab1-door-2',    room: 'lab1',      wall: 'N', pos: 10.0, curtain: true },
    { id: 'prep-door',      room: 'prep',      wall: 'N', pos: 2.6, kind: 'sliding' },
    { id: 'officeS-door',   room: 'officeS',   wall: 'N', pos: 2.05, kind: 'sliding' },
    { id: 'lectureS-door-1', room: 'lectureS', wall: 'N', pos: 1.8 },
    { id: 'lectureS-door-2', room: 'lectureS', wall: 'N', pos: 7.4 },
    { id: 'safety-door',    room: 'safety',    wall: 'N', pos: 2.2 },
    { id: 'counsel-door',   room: 'counsel',   wall: 'N', pos: 2.0 },
    // 협의실: 오른쪽(동쪽) 벽에 문. 그 바깥은 빈 복도 공간
    { id: 'meeting-door',   room: 'meeting',   wall: 'E', pos: 5.9 },

    // ---- 방 사이 문 (그림의 방 사이 벽 빨간 표시, 여닫이) ----
    { id: 'lab1-prep-door',     room: 'lab1', wall: 'E', pos: 1.2, label: false },   // 물리실험실1 ↔ 물리준비실
    { id: 'prep-officeS-door',  room: 'prep', wall: 'E', pos: 1.2, label: false },   // 물리준비실 ↔ 교무실(남)
    { id: 'lab2-lab3-door',     room: 'lab2', wall: 'E', pos: 7.2, label: false },   // 물리실험실2 ↔ 물리실험실3

    // ---- 체육관: 복도와 벽으로 나뉘고, 복도 높이(남자화장실 옆)의 서쪽 벽에 여닫이문 1개 ----
    { id: 'gym-door',       room: 'gym',       wall: 'W', pos: 11.9, signSide: 'out' },
    // 단상 위아래 방은 단상 쪽으로 문이 남
    { id: 'stageRoomN-door', room: 'stageRoomN', wall: 'S', pos: 5.4, label: false },
    { id: 'stageRoomS-door', room: 'stageRoomS', wall: 'N', pos: 5.4, label: false },
  ],

  // 문 없이 뚫린 곳 (같은 zone 의 칸 사이는 자동으로 뚫리므로 여기 적지 않음)
  openings: [
    // 계단은 문 없이 복도로 뚫려 있음
    { id: 'stairs-open',   room: 'stairs',    wall: 'S', from: 0, to: 17.7 },
    // 복도 ↔ 협의실 오른쪽의 빈 복도 공간
    { id: 'corridor-east', room: 'corridor',  wall: 'E', from: 0, to: 3 },
    // 복도 서쪽 끝 ↔ 외부연결
    { id: 'passW-open',    room: 'passW',     wall: 'E', from: 0, to: 3 },
    // 체육관 동쪽 벽 ↔ 융합인재관 연결
    { id: 'passE-open',    room: 'passE',     wall: 'W', from: 0, to: 3 },
  ],

  // 방과 상관없이 월드 좌표로 직접 놓을 가구 (지금은 없음: 가구는 각 방의 items 에 적음)
  extraFurniture: [],
};
