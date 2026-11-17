// ============================================================
// mapData.js — 맵 구조 데이터만 들어 있는 파일
// 지금은 실제 학교 "예지관 3층" (참고 그림: school_structure/예지관/3F/예지_3F_general.png)
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
//   front   : (선택) 이 방의 "앞쪽" 벽 'N'|'S'|'E'|'W'. 칠판·칸막이 같은 가구 배치 기준
//   furniture : (선택) 생략 = 종류에 맞게 자동 배치 / false = 가구 없음 / { ... } = 자동 배치 옵션
//   decor   : (선택) false 면 이 방 벽에 게시판·포스터 같은 장식도 안 붙임 (빈 방용)
//   stairs  : (계단 방만) 계단 구성. 아래 '계단' 항목 참고
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
//
// 뚫린 통로(openings) 항목 — 문 없이 벽을 통째로 터 둔 곳 (계단·외부연결·융합인재관 연결)
//   id, room, wall : 어느 방의 어느 벽인지
//   from, to : 벽 시작점에서 터진 구간의 시작·끝(m)
//
// 계단(stairs, 계단 방에만): 다른 층이 아직 없어서 몇 칸만 만들고 막아 둠
//   depth   : 북쪽 벽에서 계단이 차지하는 깊이(m) (끝쪽 일부는 벽처럼 막힘)
//   flights : 서쪽에서 동쪽 순서로 [{ kind: 'down'|'up', to }] — to 는 방 서쪽 끝에서 이 계단이 끝나는 곳(m)
//
// 추가 가구(extraFurniture) — 자동 배치 외에 직접 놓고 싶은 가구
//   { id, type, room, x, z, face: 'N'|'S'|'E'|'W', ...옵션 }
// ============================================================

// 방 한 칸을 "서쪽 x0 ~ 동쪽 x1, 북쪽 z0 ~ 남쪽 z1" 범위로 적는 도우미 (오타를 줄이려고 w, d 를 자동 계산)
const room = (id, name, kind, x0, x1, z0, z1, extra = {}) => ({
  id, name, kind, x: x0, z: z0, w: x1 - x0, d: z1 - z0, ...extra,
});

// 가구도 장식도 없는 빈 방
const EMPTY = { furniture: false, decor: false };

// 세로(z) 경계: 위쪽 줄 / 복도 / 아래쪽 줄
const Z0 = 0;       // 건물 북쪽 벽
const Z1 = 9.4;     // 위쪽 줄 방들의 남쪽 벽 = 복도 북쪽
const Z2 = 12.4;    // 복도 남쪽 = 아래쪽 줄 방들의 북쪽 벽 (복도 폭 3m)
const Z3 = 21.2;    // 건물 남쪽 벽

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
    room('passW',    '외부연결', 'corridor', -4, 0, Z1, Z2, EMPTY),   // 다른 건물과 이어질 통로 (끝은 막아 둠)
    room('corridor', '복도',     'corridor', 0, 56.6, Z1, Z2),
    // 협의실 오른쪽 ~ 남자화장실 아래의 빈 공간도 복도
    room('corridorE', '복도',    'corridor', 56.6, 62.9, Z1, Z3),

    // ================= 위쪽 줄 (북쪽), 서 → 동 =================
    room('adv',       '첨단물리 기기실', 'lab',       0,    4.0,  Z0, Z1, EMPTY),
    room('lab2',      '물리실험실2',     'lab',       4.0,  11.8, Z0, Z1, EMPTY),
    room('lab3',      '물리실험실3',     'lab',       11.8, 20.5, Z0, Z1, EMPTY),
    room('officeN',   '교무실',          'office',    20.5, 24.6, Z0, Z1, EMPTY),
    room('lectureN',  '물리강의실2',     'classroom', 24.6, 33.6, Z0, Z1, EMPTY),
    room('restroomF', '여자화장실',      'restroom',  33.6, 38.9, Z0, Z1, EMPTY),
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
    room('restroomM', '남자화장실',      'restroom',  56.6, 62.9, Z0, Z1, EMPTY),

    // ================= 아래쪽 줄 (남쪽), 서 → 동 =================
    room('lab1',      '물리실험실1',     'lab',       0,    11.8, Z2, Z3, EMPTY),
    room('prep',      '물리준비실',      'lab',       11.8, 20.5, Z2, Z3, EMPTY),
    room('officeS',   '교무실',          'office',    20.5, 24.6, Z2, Z3, EMPTY),
    room('lectureS',  '물리강의실1',     'classroom', 24.6, 33.6, Z2, Z3, EMPTY),
    room('safety',    '생활안전부',      'office',    33.6, 41.3, Z2, Z3, EMPTY),
    room('counsel',   '상담실',          'office',    41.3, 46.9, Z2, Z3, EMPTY),
    room('meeting',   '협의실',          'office',    46.9, 56.6, Z2, Z3, EMPTY),

    // ================= 체육관 (건물 동쪽 끝, 위아래 꽉 찬 큰 공간) =================
    room('gym',       '체육관',          'gym',       62.9, 94.5, Z0, Z3, EMPTY),
    // 체육관 동쪽 벽 바깥의 "융합인재관 연결" 통로 (끝은 막아 둠)
    room('passE',     '융합인재관 연결', 'corridor',  94.5, 98.5, Z1, Z2, EMPTY),
  ],

  doors: [
    // ---- 위쪽 줄: 복도 쪽(남쪽) 벽에 문 ----
    { id: 'adv-door',       room: 'adv',       wall: 'S', pos: 2.0 },
    { id: 'lab2-door-1',    room: 'lab2',      wall: 'S', pos: 2.5 },
    { id: 'lab2-door-2',    room: 'lab2',      wall: 'S', pos: 6.0 },
    { id: 'lab3-door-1',    room: 'lab3',      wall: 'S', pos: 2.7 },
    { id: 'lab3-door-2',    room: 'lab3',      wall: 'S', pos: 7.0 },
    { id: 'officeN-door',   room: 'officeN',   wall: 'S', pos: 2.05, kind: 'sliding' },
    { id: 'lectureN-door-1', room: 'lectureN', wall: 'S', pos: 2.0 },
    { id: 'lectureN-door-2', room: 'lectureN', wall: 'S', pos: 7.5 },
    { id: 'restroomF-door', room: 'restroomF', wall: 'S', pos: 3.7 },
    { id: 'restroomM-door', room: 'restroomM', wall: 'S', pos: 3.5 },  // 남자화장실은 아래쪽(남쪽) 벽에 문

    // ---- 아래쪽 줄: 복도 쪽(북쪽) 벽에 문 ----
    { id: 'lab1-door-1',    room: 'lab1',      wall: 'N', pos: 2.1 },
    { id: 'lab1-door-2',    room: 'lab1',      wall: 'N', pos: 10.0 },
    { id: 'prep-door',      room: 'prep',      wall: 'N', pos: 2.6, kind: 'sliding' },
    { id: 'officeS-door',   room: 'officeS',   wall: 'N', pos: 2.05, kind: 'sliding' },
    { id: 'lectureS-door-1', room: 'lectureS', wall: 'N', pos: 1.8 },
    { id: 'lectureS-door-2', room: 'lectureS', wall: 'N', pos: 7.4 },
    { id: 'safety-door',    room: 'safety',    wall: 'N', pos: 2.2 },
    { id: 'counsel-door',   room: 'counsel',   wall: 'N', pos: 2.0 },
    // 협의실: 오른쪽(동쪽) 벽에 문. 그 바깥은 빈 복도 공간
    { id: 'meeting-door',   room: 'meeting',   wall: 'E', pos: 5.9 },

    // ---- 체육관: 복도와 벽으로 나뉘고, 복도 높이(남자화장실 옆)의 서쪽 벽에 여닫이문 1개 ----
    { id: 'gym-door',       room: 'gym',       wall: 'W', pos: 11.9, signSide: 'out' },
  ],

  // 문 없이 뚫린 곳
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

  // 자동 배치 말고 직접 놓을 가구 (지금은 없음: 모든 방은 빈 방)
  extraFurniture: [],
};
