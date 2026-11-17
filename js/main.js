// ============================================================
// main.js — 시작점. 화면(Three.js) 준비, 포인터 잠금, HUD, 그리기 반복
// ============================================================

import * as THREE from 'three';
import { CONFIG, VIEW } from './config.js';
import { MAP } from './mapData.js';
import { buildWorld } from './mapBuilder.js';
import { Player } from './player.js';
import { setupGraphics, AdaptiveQuality } from './graphics.js';
import { createMinimap } from './minimap.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const hudMove = document.getElementById('hud-move');
const hudPos = document.getElementById('hud-pos');
const roomName = document.getElementById('room-name');
const hudMap = document.getElementById('hud-map');

// ---- 렌더러 · 장면 ----
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  overlayMsg.textContent = '이 브라우저에서는 3D(WebGL)를 쓸 수 없어요.';
  throw err;
}
const quality = new AdaptiveQuality(renderer);
const scene = new THREE.Scene();
setupGraphics(renderer, scene);

const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, CONFIG.near, CONFIG.far);

// ---- 맵 · 플레이어 ----
const world = buildWorld(MAP);
scene.add(world.group);

const player = new Player(camera, world);
player.attach();

const minimap = VIEW.minimap ? createMinimap(document.getElementById('minimap'), world) : null;
if (!minimap) hudMap.classList.add('hidden');

// 디버깅·다음 단계 개발용: 브라우저 콘솔에서 window.game 으로 접근 가능
window.game = { THREE, scene, camera, renderer, world, player, quality };

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

let started = false;
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  player.setEnabled(locked);
  overlay.classList.toggle('hidden', locked);
  if (locked) started = true;
  else overlayMsg.textContent = started ? '일시정지 — 클릭하면 계속해요' : '화면을 클릭하면 시작해요';
});

document.addEventListener('pointerlockerror', () => {
  // ESC 직후 바로 다시 잠글 때 브라우저가 잠깐 거부하는 경우가 있음
  overlayMsg.textContent = '잠시 후 다시 한 번 클릭해 주세요';
});

// ---- HUD ----
let lastMode = '', lastRoom = '', lastPos = '', minimapTimer = 0;
function updateHud(dt) {
  const mode = player.moveMode;
  if (mode !== lastMode) {
    hudMove.dataset.mode = mode;
    lastMode = mode;
  }
  const room = world.roomAt(player.x, player.z);
  const name = room ? room.name : '-';
  if (name !== lastRoom) {
    roomName.textContent = name;
    lastRoom = name;
  }
  const pos = `x ${player.x.toFixed(1)}  z ${player.z.toFixed(1)}  |  ${name}`;
  if (pos !== lastPos) {
    hudPos.textContent = pos;
    lastPos = pos;
  }
  // 미니맵은 1초에 약 20번만 갱신
  minimapTimer += dt;
  if (minimap && minimapTimer > 0.05) {
    minimap.update(player);
    minimapTimer = 0;
  }
}

// ---- 그리기 반복 ----
let last = performance.now();
let fovShown = CONFIG.fov;
renderer.setAnimationLoop((now) => {
  const realDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(realDt, CONFIG.maxDeltaTime);

  player.update(dt);
  world.update(dt); // 문 열고 닫는 애니메이션

  // 달릴 때 시야각이 살짝 넓어지는 연출
  const fov = CONFIG.fov + player.fovOffset;
  if (Math.abs(fov - fovShown) > 0.02) {
    camera.fov = fovShown = fov;
    camera.updateProjectionMatrix();
  }

  updateHud(dt);
  renderer.render(scene, camera);

  // 자동 해상도 조절 (탭을 오래 떠났다 돌아온 프레임은 제외)
  if (realDt < 0.25 && quality.tick(realDt)) resize();
});
