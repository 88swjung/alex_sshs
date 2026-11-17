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
  fogColor: 0xece5d3,    // 먼 곳이 이 색으로 흐려져서 복도가 깊어 보임
  fogNear: 22,
  fogFar: 78,
  maxPixelRatio: 1.5,    // 고해상도 화면에서도 이 이상으로는 안 그림 (성능)
  minPixelRatio: 0.6,    // 자동 해상도 조절의 하한
  adaptiveQuality: true, // 프레임이 떨어지면 해상도를 자동으로 낮추고, 여유가 생기면 다시 올림
  targetFps: 48,         // 이 값보다 낮게 나오면 해상도를 낮춤
};

// UI 글꼴. Jua 는 index.html 에서 구글 폰트로 불러오고, 못 불러오면 뒤쪽 글꼴이 대신 쓰임
export const FONT_TITLE = '"Jua","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
export const FONT_SIGN = FONT_TITLE;

// --- 색상 (0xRRGGBB) ---
export const COLORS = {
  wall: 0xf6ecd6,        // 벽 속 (눈에 거의 안 보임. 페인트가 덮음)
  trim: 0xfffaf0,        // 벽 중간 띠, 천장 몰딩
  baseboard: 0x6f6a5e,   // 걸레받이
  ceiling: 0xfbf8f0,
  lightHousing: 0xdad6cc,
  lightGlow: 0xffffff,
  doorFrame: 0x7a5233,

  wood: 0xc08a4f,        // 책상 상판
  woodAlt: 0xd09c5f,
  woodDark: 0x7a4f2a,    // 교탁·서랍
  metal: 0x66707c,
  chairs: [0x4a9fd1, 0x3fbfa8, 0xf0a04b, 0xe8698b], // 의자 색(무작위로 섞임)
  board: 0x2d6a52,       // 칠판
  boardFrame: 0xa57f52,
  cork: 0xc9975c,
  paper: [0xffffff, 0xffe27a, 0xff9fb0, 0x9fd8ff, 0xb8f0b0, 0xffc58a],
  lockers: [0x4f8fc0, 0x3fa597, 0x7c9fd6],
  stallPartition: 0x7cc7c3,
  porcelain: 0xf6f6f6,
  sinkBase: 0xdde3e8,
  sinkTop: 0xb8c3cd,
  mirror: 0xc4e7f3,
  cabinet: 0x8e9ca9,
  cabinetPanel: 0xaebbc6,
  monitor: 0x20262d,
  screen: 0x5aa7d6,
  stairs: 0xc9c3b6,
  stairsEdge: 0x9a9486,
  rail: 0x5d6670,
  plantPot: 0xc9724a,
  plantLeaf: 0x4fa65b,
  plantLeaf2: 0x6cc070,
  bin: 0x4f7f9a,
  extinguisher: 0xd8352a,
  books: [0xd9534f, 0x4a9fd1, 0xf0c04b, 0x5cb85c, 0x8e6bbf, 0xf08a4b],

  windowFrame: 0xffffff,
  windowSky: 0xa9dcff,
  windowSkyLow: 0xe6f6ff,
  curtain: [0xf7a8a0, 0xf6d28b, 0x9fd6c0, 0xa9bdf0],
  sunGlow: 0xffe9b0,

  signBg1: '#2a6f97',    // 표지판 (canvas 문자열 색)
  signBg2: '#1d4e73',
  signAccent: '#ffb347',
  signText: '#ffffff',
};

// 방 종류별 벽 페인트: 아래쪽(lower, lowerH 높이까지)과 위쪽(upper) 색을 다르게 해서 학교 느낌을 냄
export const WALL_STYLE = {
  corridor:  { upper: 0xf9ead2, lower: 0x58b4a7, lowerH: 1.1 },
  classroom: { upper: 0xfef3d4, lower: 0x93d3b6, lowerH: 1.1 },
  restroom:  { upper: 0xe9f7f7, lower: 0x72c5d1, lowerH: 1.6 },
  study:     { upper: 0xeef3e3, lower: 0xa9d48f, lowerH: 1.1 },
  office:    { upper: 0xf0f0f5, lower: 0x7089b0, lowerH: 1.1 },
  stairs:    { upper: 0xfcebd0, lower: 0xe8916b, lowerH: 1.1 },
  default:   { upper: 0xf3ead6, lower: 0xb8b09c, lowerH: 1.1 },
};

// 방 종류별 바닥 스타일.
//   tile > 0   : tile(m) 크기 타일을 colors[0], colors[1] 번갈아 깖
//   planks > 0 : 폭 planks(m) 널빤지를 긴 쪽으로 깔고 널빤지마다 밝기를 조금씩 다르게 함
//   그 외      : 한 색
export const FLOOR_STYLE = {
  corridor:  { colors: [0xd9cdb1, 0xc6b996], tile: 1.5 },
  classroom: { colors: [0xd9a96b], planks: 0.45 },
  restroom:  { colors: [0xc5e8ee, 0xa6d6e0], tile: 0.6 },
  study:     { colors: [0xb4cca6, 0xa9c49b], tile: 1.0 },
  office:    { colors: [0x9fb0c7, 0x95a7c0], tile: 1.0 },
  stairs:    { colors: [0xcfcac0, 0xc2bdb2], tile: 1.5 },
  default:   { colors: [0xd0d0d0], tile: 0 },
};
