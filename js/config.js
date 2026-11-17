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

// --- 화면 연출 (이동 속도·조작과는 무관한 보기 좋게 하는 효과) ---
export const VIEW = {
  headBob: true,        // 걸을 때 화면이 살짝 흔들리는 효과
  bobAmount: 0.028,     // 걷기 기준 위아래 흔들림 크기(m). 조용히는 작게, 달리기는 크게 자동 조절
  runFovKick: 6,        // 달릴 때 시야각이 넓어지는 정도(도)
  minimap: true,        // 오른쪽 위 미니맵 표시 (mapData 에서 자동 생성)
};

// --- 그래픽 / 성능 ---
export const GRAPHICS = {
  fogColor: 0xe4e4e1,    // 먼 곳이 이 색으로 흐려져서 복도가 깊어 보임
  fogNear: 22,
  fogFar: 78,
  maxPixelRatio: 1.5,    // 고해상도 화면에서도 이 이상으로는 안 그림 (성능)
  minPixelRatio: 0.6,    // 자동 해상도 조절의 하한
  adaptiveQuality: true, // 프레임이 떨어지면 해상도를 자동으로 낮추고, 여유가 생기면 다시 올림
  targetFps: 48,         // 이 값보다 낮게 나오면 해상도를 낮춤
};

// UI·표지판 글꼴 (1단계 때와 같은 기본 글꼴)
export const FONT_UI = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';

// --- 색상 (0xRRGGBB) ---
// 형광등 아래의 평범한 고등학교: 채도를 낮춘 무채색 계열 + 학교 비품의 파랑·회색
export const COLORS = {
  wall: 0xe8e6e0,        // 벽 속 (눈에 거의 안 보임. 페인트가 덮음)
  trim: 0xcfd2d4,        // 벽 중간 띠, 천장 몰딩
  baseboard: 0x5b5f66,   // 걸레받이
  ceiling: 0xefefed,
  lightHousing: 0xc4c8cc,
  lightGlow: 0xf6f9ff,
  doorFrame: 0x5e5a55,

  wood: 0xa88f6c,        // 교탁 상판
  woodDark: 0x6b5a48,
  metal: 0x80878e,
  frameGray: 0x8b9096,   // 책상·의자 금속 프레임
  deskTop: 0xc9ccd0,     // 학생 책상 상판 (밝은 회색)
  deskRim: 0x474c53,     // 학생 책상 테두리 (진회색)
  plasticBlue: 0x2d6cb3, // 책상 서랍, 의자 좌판·등받이
  plasticHole: 0x15181c, // 의자 등받이 구멍
  laminate: 0xd6d4ce,    // 교무실 책상 상판
  laminateSide: 0xa9aeb3,
  officeChair: 0x383d43,
  whiteboard: 0xe3e6e8, // 화이트보드 (스스로 밝은 재질이라 이 정도로 잡아야 흰색으로 보임)
  boardFrame: 0xb0b6bc,  // 알루미늄 프레임
  eboardBezel: 0x2a2e34,
  eboardScreen: 0x13161a, // 전자칠판 (꺼진 듯한 빈 화면)
  cork: 0xb59368,
  paper: [0xf1f1ee, 0xdfe5e9, 0xe8e3d2, 0xd4dce2],
  stallPartition: 0xcfd6d8,
  porcelain: 0xf3f4f4,
  sinkBase: 0xdde1e4,
  sinkTop: 0xb4bec6,
  mirror: 0xbccbd3,
  cabinet: 0x8d949b,
  cabinetPanel: 0xa9b0b7,
  monitor: 0x20252b,
  screen: 0x6f8fa8,
  stairs: 0xb4b1aa,
  stairsEdge: 0x8f8c85,
  rail: 0x565f68,
  plantPot: 0x8a8f94,
  plantLeaf: 0x4d7a4f,
  plantLeaf2: 0x5f8f5e,
  bin: 0x6f777f,
  extinguisher: 0xc8352b,
  books: [0x8a4b45, 0x3f5f7f, 0xb09a5a, 0x5a7a5f, 0x555a66, 0x7b6a4d],

  windowFrame: 0xb7bcc1, // 알루미늄 창틀
  windowSky: 0xb7cde2,   // 흐린 낮 하늘
  windowSkyLow: 0xdde7ef,
  curtain: [0xcbc5b8, 0xbcc1c4],
  sunGlow: 0xf2ebd8,

  signBg1: '#36424f',    // 표지판 (canvas 문자열 색)
  signBg2: '#2c3641',
  signLine: 'rgba(255,255,255,0.55)',
  signText: '#ffffff',
};

// 방 종류별 벽 페인트: 아래쪽(lower, lowerH 높이까지)과 위쪽(upper) 색을 다르게 함
export const WALL_STYLE = {
  corridor:  { upper: 0xe9e7e0, lower: 0xaeb8bd, lowerH: 1.0 },
  classroom: { upper: 0xeceae3, lower: 0xd2d0c8, lowerH: 0.9 },
  restroom:  { upper: 0xeceeee, lower: 0xd8e0e2, lowerH: 1.8 },
  study:     { upper: 0xe8e8e1, lower: 0xbcc4bb, lowerH: 1.0 },
  office:    { upper: 0xe9e8e3, lower: 0xc3c8ce, lowerH: 1.0 },
  stairs:    { upper: 0xe4e1d9, lower: 0xaeb2b6, lowerH: 1.0 },
  default:   { upper: 0xe6e4de, lower: 0xc3c1b9, lowerH: 1.0 },
};

// 방 종류별 바닥 스타일.
//   tile > 0   : tile(m) 크기 타일을 colors[0], colors[1] 번갈아 깖
//   planks > 0 : 폭 planks(m) 널빤지를 긴 쪽으로 깔고 널빤지마다 밝기를 조금씩 다르게 함
//   그 외      : 한 색
export const FLOOR_STYLE = {
  corridor:  { colors: [0xbdb9ad, 0xb1ada1], tile: 1.2 },
  classroom: { colors: [0xc4ab86], planks: 0.36 },
  restroom:  { colors: [0xd4dbdc, 0xc6cfd1], tile: 0.5 },
  study:     { colors: [0xaeb3ad, 0xa6aba5], tile: 1.0 },
  office:    { colors: [0x8f959c, 0x878d94], tile: 1.0 },
  stairs:    { colors: [0xb5b3ad, 0xaaa8a2], tile: 1.5 },
  default:   { colors: [0xc8c8c8], tile: 0 },
};
