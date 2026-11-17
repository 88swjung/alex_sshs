// ============================================================
// config.js — 게임 전체에서 쓰는 숫자·색상을 모아 둔 곳
// 단위: 길이는 미터(m), 속도는 m/s, 각도는 별도 표기가 없으면 라디안
// ============================================================

export const CONFIG = {
  // --- 이동 속도 (m/s) ---
  speed: {
    quiet: 1.5, // 조용히 걷기 (마우스 오른쪽 버튼 누르는 동안)
    walk: 3.0,  // 걷기
    run: 5.5,   // 달리기 (Shift 누르는 동안)
  },

  // --- 플레이어 ---
  eyeHeight: 1.6,     // 눈높이 (m)
  playerRadius: 0.3,  // 몸 반지름 (m) — 충돌 계산에 사용

  // --- 마우스 시점 ---
  mouseSensitivity: 0.0022, // 마우스 1픽셀당 회전량(라디안)
  maxPitchDeg: 80,          // 위/아래로 고개를 꺾을 수 있는 최대 각도(도)
  rawMouse: true,           // true면 OS 마우스 가속을 끄고 원시 입력을 요청 (지원 안 하면 자동으로 일반 입력)

  // --- 카메라 ---
  fov: 75,
  near: 0.05,
  far: 150,

  // --- 시뮬레이션 ---
  maxDeltaTime: 0.05, // 프레임이 갑자기 느려져도 한 번에 이 시간(초) 이상은 진행하지 않음
  maxMoveStep: 0.1,   // 충돌 검사를 위해 한 번에 이동하는 최대 거리(m). 벽을 뚫고 가는 것을 막음
};

// --- 색상 (0xRRGGBB) ---
// 바닥 / 벽 / 천장 / 가구가 서로 구분되도록 잡은 색
export const COLORS = {
  sky: 0xbfdcf2,

  wall: 0xf0e8cf,
  baseboard: 0x8c8570,
  ceiling: 0xf6f6f1,
  lightPanel: 0xffffff,
  doorFrame: 0x6e4b2f,

  wood: 0xa8743f,        // 책상 상판
  woodDark: 0x7a4f2a,    // 교탁 몸체
  metal: 0x6d7580,       // 다리, 손잡이
  chair: 0x4f7cac,
  board: 0x2f6b4f,       // 칠판
  boardFrame: 0x9c7a50,
  locker: 0x5b8fb9,
  lockerPanel: 0x86b5d9,
  partition: 0x7fc4c0,   // 화장실 칸막이 / 자습실 가림판
  porcelain: 0xf4f4f4,   // 변기
  sinkBase: 0xd9dee3,
  sinkTop: 0xb8c2cc,
  mirror: 0xbfe3f0,
  cabinet: 0x8f9aa6,
  cabinetPanel: 0xaab4bf,
  monitor: 0x23282f,
  stairs: 0xbab5a9,
  stairsEdge: 0x8f8a7e,

  signBg: '#1f4e79',     // 표지판 (canvas 문자열 색)
  signText: '#ffffff',
};

// 방 종류별 바닥 스타일.
// tile > 0 이면 tile(m) 크기의 타일을 colors[0], colors[1] 번갈아 깔아서 이동할 때 속도감이 생김.
export const FLOOR_STYLE = {
  corridor:  { colors: [0xc6c0b1, 0xb2ac9d], tile: 1.5 },
  classroom: { colors: [0xdcc8a0], tile: 0 },
  restroom:  { colors: [0xa9d6e5, 0x8fc3d6], tile: 0.75 },
  study:     { colors: [0xa3c4a3], tile: 0 },
  office:    { colors: [0x8e9db3], tile: 0 },
  stairs:    { colors: [0xa4a4a4], tile: 0 },
  default:   { colors: [0xcccccc], tile: 0 },
};
