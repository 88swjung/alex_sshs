// ============================================================
// main.js — 시작점. 화면(Three.js) 준비, 포인터 잠금, HUD, 그리기 반복
// ============================================================

import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';
import { MAP } from './mapData.js';
import { buildWorld } from './mapBuilder.js';
import { Player } from './player.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const hudMove = document.getElementById('hud-move');
const hudPos = document.getElementById('hud-pos');

const MODE_LABEL = { quiet: '조용히', walk: '걷기', run: '달리기' };

// ---- 렌더러 · 장면 ----
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (err) {
  overlayMsg.textContent = '이 브라우저에서는 3D(WebGL)를 쓸 수 없어요.';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false; // 성능을 위해 그림자 끔

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);

// 낮 기준의 밝은 조명 (그림자 없음)
scene.add(new THREE.HemisphereLight(0xffffff, 0xf0ead8, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-20, 40, 15);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, CONFIG.near, CONFIG.far);

// ---- 맵 · 플레이어 ----
const world = buildWorld(MAP);
scene.add(world.group);

const player = new Player(camera, world);
player.attach();

// 디버깅·다음 단계 개발용: 브라우저 콘솔에서 window.game 으로 접근 가능
window.game = { THREE, scene, camera, world, player };

// ---- 화면 크기 ----
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---- 포인터 잠금 (클릭하면 시작, ESC 로 풀리면 시작 화면 복귀) ----
function requestLock() {
  const retryPlain = () => {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* pointerlockerror 이벤트에서 처리 */ }
  };
  try {
    // 원시 마우스 입력 요청. 지원하지 않으면 일반 방식으로 다시 시도
    const p = canvas.requestPointerLock(CONFIG.rawMouse ? { unadjustedMovement: true } : undefined);
    if (p && p.catch) p.catch(retryPlain);
  } catch (e) {
    retryPlain();
  }
}

overlay.addEventListener('click', requestLock);
canvas.addEventListener('click', () => {
  if (document.pointerLockElement !== canvas) requestLock();
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  player.setEnabled(locked);
  overlay.classList.toggle('hidden', locked);
  if (!locked) overlayMsg.textContent = '화면을 클릭하면 시작해요';
});

document.addEventListener('pointerlockerror', () => {
  // ESC 직후 바로 다시 잠글 때 브라우저가 잠깐 거부하는 경우가 있음
  overlayMsg.textContent = '잠시 후 다시 한 번 클릭해 주세요';
});

// ---- HUD ----
let lastHudText = '';
function updateHud() {
  hudMove.textContent = MODE_LABEL[player.moveMode];
  hudMove.dataset.mode = player.moveMode;
  const room = world.roomAt(player.x, player.z);
  const text = `x ${player.x.toFixed(1)}  z ${player.z.toFixed(1)}  |  ${room ? room.name : '-'}`;
  if (text !== lastHudText) {
    hudPos.textContent = text;
    lastHudText = text;
  }
}

// ---- 그리기 반복 ----
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, CONFIG.maxDeltaTime);
  last = now;
  player.update(dt);
  updateHud();
  renderer.render(scene, camera);
});
