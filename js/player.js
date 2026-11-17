// ============================================================
// player.js — 1인칭 시점, 이동, 충돌
//
// 좌표계: x = 동쪽(+), z = 남쪽(+). yaw 0 이면 북쪽(-z)을 바라봄.
// 평평한 바닥이라 점프·중력은 없고, 충돌은 "원(반지름) vs 상자" 2D 계산으로 처리한다.
// ============================================================

import { CONFIG, VIEW } from './config.js';

export class Player {
  /**
   * @param {THREE.PerspectiveCamera} camera 플레이어 눈 역할을 하는 카메라
   * @param {object} world buildWorld() 가 돌려준 월드 (colliders, spawn 사용)
   */
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.camera.rotation.order = 'YXZ'; // 좌우(yaw) → 상하(pitch) 순서로 회전해야 시점이 기울지 않음

    this.enabled = false;     // 포인터가 잠겨 게임 중일 때만 true
    this.keys = new Set();    // 현재 눌려 있는 키 (event.code)
    this.rightDown = false;   // 마우스 오른쪽 버튼 (조용히 걷기)

    this.x = 0;
    this.z = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.groundY = 0;         // 지금 서 있는 곳의 바닥 높이 (단상·계단 위에서만 0이 아님)

    // 화면 연출용 값
    this.bobPhase = 0;
    this.bobBlend = 0;
    this.bobX = 0;
    this.bobY = 0;
    this.fovOffset = 0; // 달릴 때 시야각에 더해지는 값(도)
    this.respawn();
  }

  /** 시작 위치로 되돌리기 */
  respawn() {
    const sp = this.world.spawn;
    this.x = sp.x;
    this.z = sp.z;
    this.yaw = sp.yaw;
    this.pitch = 0;
    this.groundY = this.world.groundAt ? this.world.groundAt(this.x, this.z) : 0;
    this.applyCamera();
  }

  /** 입력 이벤트 연결 (한 번만 호출) */
  attach() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousedown', (e) => {
      if (this.enabled && e.button === 2) this.rightDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.rightDown = false;
    });
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('blur', () => this.releaseInputs());
    window.addEventListener('contextmenu', (e) => e.preventDefault()); // 오른쪽 클릭 메뉴 막기
  }

  /** 게임 시작/일시정지 전환 */
  setEnabled(on) {
    this.enabled = on;
    if (!on) this.releaseInputs();
  }

  /** 눌려 있던 키·버튼을 모두 뗀 상태로 (포커스를 잃었을 때 계속 걷는 문제 방지) */
  releaseInputs() {
    this.keys.clear();
    this.rightDown = false;
  }

  onMouseMove(e) {
    if (!this.enabled) return;
    // 가끔 브라우저가 비정상적으로 큰 값을 한 번에 보내는 경우가 있어 무시
    if (Math.abs(e.movementX) > 500 || Math.abs(e.movementY) > 500) return;
    const maxPitch = (CONFIG.maxPitchDeg * Math.PI) / 180;
    this.yaw -= e.movementX * CONFIG.mouseSensitivity;
    this.pitch -= e.movementY * CONFIG.mouseSensitivity;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  /** 지금 이동 상태: 'quiet' | 'walk' | 'run'.  조용히 걷기(오른쪽 버튼)가 Shift 보다 우선 */
  get moveMode() {
    if (this.rightDown) return 'quiet';
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) return 'run';
    return 'walk';
  }

  /** 한 프레임 진행 (dt: 초) */
  update(dt) {
    const px = this.x, pz = this.z;
    if (this.enabled) this.move(dt);
    this.updateGround(dt);
    this.updateViewEffects(dt, dt > 0 ? Math.hypot(this.x - px, this.z - pz) / dt : 0);
    this.applyCamera();
  }

  /** 계단·단상을 오르내릴 때 눈높이가 부드럽게 따라가게 함 (이동·충돌은 평면 그대로) */
  updateGround(dt) {
    const target = this.world.groundAt ? this.world.groundAt(this.x, this.z) : 0;
    if (Math.abs(target - this.groundY) < 0.001) {
      this.groundY = target;
      return;
    }
    this.groundY += (target - this.groundY) * (1 - Math.exp(-14 * dt));
  }

  /**
   * 보기 좋게 하는 연출 (이동 속도·충돌에는 영향 없음)
   *  - 걸을 때 화면이 위아래로 살짝 흔들림 (달리기 > 걷기 > 조용히)
   *  - 달릴 때 시야각이 살짝 넓어짐
   * @param {number} speed 이번 프레임에 실제로 움직인 속도(m/s). 벽에 막히면 작아짐
   */
  updateViewEffects(dt, speed) {
    const moving = this.enabled && speed > 0.3;
    const k = 1 - Math.exp(-10 * dt);
    this.bobBlend += ((moving ? 1 : 0) - this.bobBlend) * k;
    this.bobPhase += speed * dt * 2.3; // 걸음 수에 맞춰 위상이 진행
    const runTarget = this.enabled && moving && this.moveMode === 'run' ? VIEW.runFovKick : 0;
    this.fovOffset += (runTarget - this.fovOffset) * (1 - Math.exp(-6 * dt));
    this.bobY = 0;
    this.bobX = 0;
    if (VIEW.headBob) {
      const amp = VIEW.bobAmount * Math.min(1.6, speed / CONFIG.speed.walk) * this.bobBlend;
      this.bobY = Math.sin(this.bobPhase * 2) * amp;
      this.bobX = Math.cos(this.bobPhase) * amp * 0.5;
    }
  }

  move(dt) {
    // 입력 → 앞뒤(fwd), 좌우(strafe)
    const k = this.keys;
    let fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    let strafe = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    if (fwd === 0 && strafe === 0) return;

    // 대각선도 같은 속도가 되도록 길이를 1로 맞춤
    const len = Math.hypot(fwd, strafe);
    fwd /= len;
    strafe /= len;

    const speed = CONFIG.speed[this.moveMode];
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // 바라보는 방향(앞)과 그 오른쪽 방향 (x, z)
    const dirX = -sin * fwd + cos * strafe;
    const dirZ = -cos * fwd - sin * strafe;
    const dx = dirX * speed * dt;
    const dz = dirZ * speed * dt;

    // 이번 프레임에 가까이 있는 충돌 상자만 추려 둠
    const dist = Math.hypot(dx, dz);
    const reach = CONFIG.playerRadius + dist + 0.1;
    const near = this.world.colliders.filter(
      (b) => b.maxX > this.x - reach && b.minX < this.x + reach && b.maxZ > this.z - reach && b.minZ < this.z + reach
    );

    // 너무 빠르면 벽을 뚫을 수 있어서 잘게 나눠 이동
    const steps = Math.max(1, Math.ceil(dist / CONFIG.maxMoveStep));
    for (let i = 0; i < steps; i++) {
      this.x += dx / steps;
      this.z += dz / steps;
      this.resolveCollisions(near);
    }
  }

  /** 원(플레이어) 이 상자와 겹치면 밀어낸다. 벽에 비스듬히 부딪히면 벽을 따라 미끄러지게 됨 */
  resolveCollisions(boxes) {
    const r = CONFIG.playerRadius;
    for (let iter = 0; iter < 4; iter++) {
      let pushed = false;
      for (const b of boxes) {
        // 상자에서 원 중심에 가장 가까운 점
        const cx = Math.max(b.minX, Math.min(this.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(this.z, b.maxZ));
        const dx = this.x - cx;
        const dz = this.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;

        if (d2 > 1e-12) {
          // 보통의 경우: 가장 가까운 점 반대 방향으로 겹친 만큼 밀어냄
          const d = Math.sqrt(d2);
          const push = r - d;
          this.x += (dx / d) * push;
          this.z += (dz / d) * push;
        } else {
          // 중심이 상자 안으로 들어간 경우: 가장 가까운 면 밖으로 빼냄
          const toMinX = this.x - b.minX, toMaxX = b.maxX - this.x;
          const toMinZ = this.z - b.minZ, toMaxZ = b.maxZ - this.z;
          const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
          if (m === toMinX) this.x = b.minX - r;
          else if (m === toMaxX) this.x = b.maxX + r;
          else if (m === toMinZ) this.z = b.minZ - r;
          else this.z = b.maxZ + r;
        }
        pushed = true;
      }
      if (!pushed) break;
    }
  }

  applyCamera() {
    // 흔들림은 카메라에만 더함 (this.x, this.z 같은 실제 위치는 그대로)
    const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
    this.camera.position.set(this.x + cos * this.bobX, CONFIG.eyeHeight + this.groundY + this.bobY, this.z - sin * this.bobX);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
