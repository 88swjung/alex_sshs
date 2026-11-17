// ============================================================
// graphics.js — 재질(셰이더), 조명, 안개, 자동 해상도 조절
// 낮은 사양 노트북에서도 돌아가도록 가볍게: 그림자 맵 없음, 조명 2개, 모든 것을 InstancedMesh 로 묶음
// ============================================================

import * as THREE from 'three';
import { GRAPHICS } from './config.js';
import { makeBlobTexture, makeWallShadowTexture, makeGlowTexture } from './textures.js';

/**
 * 상자 재질(Lambert)에 "가짜 그늘(AO)"을 덧붙임.
 *  - 세로 면(벽, 가구 옆면)이 바닥 근처일수록 어두워지고, 천장 근처도 살짝 어두워짐
 *  → 그림자 계산 없이 모서리가 눌려 보여서 입체감이 크게 좋아진다.
 */
function createLitMaterial(ceilingHeight) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCeilH = { value: ceilingHeight };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vAoY;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 aoP = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          aoP = instanceMatrix * aoP;
        #endif
        vAoY = ( modelMatrix * aoP ).y;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAoY;\nuniform float uCeilH;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 aoN = inverseTransformDirection( normal, viewMatrix );
          float vertical = 1.0 - abs( aoN.y );
          float low = mix( 0.62, 1.0, smoothstep( 0.0, 0.85, vAoY ) );
          float high = mix( 0.9, 1.0, smoothstep( uCeilH, uCeilH - 0.4, vAoY ) );
          diffuseColor.rgb *= mix( 1.0, low * high, vertical );
        }`
      );
  };
  return mat;
}

/** 반투명 바닥 장식(그림자·빛 얼룩)용 재질 */
function createDecalMaterial(texture, { additive = false, opacity = 1, color = 0xffffff } = {}) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: !additive, // 더하기 혼합은 안개와 섞이면 이상해서 끔
    polygonOffset: true,       // 바닥과 같은 높이라 깜빡이지 않게 살짝 앞으로 당김
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export function createMaterials(ceilingHeight) {
  return {
    lit: createLitMaterial(ceilingHeight),
    glow: new THREE.MeshBasicMaterial({ color: 0xffffff }), // 형광등·창문처럼 스스로 빛나는 것
    shadowBlob: createDecalMaterial(makeBlobTexture(), { color: 0x1a1208, opacity: 0.32 }),
    shadowWall: createDecalMaterial(makeWallShadowTexture(), { color: 0x1a1208, opacity: 0.42 }),
    glowDecal: createDecalMaterial(makeGlowTexture(), { additive: true }),
  };
}

/** 렌더러·조명·안개 설정 */
export function setupGraphics(renderer, scene) {
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.NeutralToneMapping; // 밝은 곳이 하얗게 날아가지 않게
  renderer.toneMappingExposure = 1.0;

  scene.background = new THREE.Color(GRAPHICS.fogColor);
  scene.fog = new THREE.Fog(GRAPHICS.fogColor, GRAPHICS.fogNear, GRAPHICS.fogFar);

  // 낮 기준: 하늘색이 도는 위쪽 빛 + 따뜻한 바닥 반사광 + 약한 햇빛
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xf2e6cc, 2.1));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
  sun.position.set(-18, 40, 14);
  scene.add(sun);
}

/**
 * 자동 해상도 조절: 최근 프레임 시간이 길면 해상도를 낮추고, 한참 여유로우면 다시 올린다.
 * 화면을 그리는 비용은 거의 "픽셀 수"에 비례해서 가장 효과가 큼.
 */
export class AdaptiveQuality {
  constructor(renderer) {
    this.renderer = renderer;
    this.max = Math.min(window.devicePixelRatio || 1, GRAPHICS.maxPixelRatio);
    this.ratio = this.max;
    this.frames = 0;
    this.time = 0;
    this.goodSeconds = 0;
    this.badSeconds = 0;
    this.warmup = 3; // 처음 3초는 셰이더 컴파일 등으로 느리니 판단하지 않음
    renderer.setPixelRatio(this.ratio);
  }

  /** 매 프레임 호출. 해상도가 바뀌었으면 true */
  tick(dt) {
    if (!GRAPHICS.adaptiveQuality) return false;
    this.frames++;
    this.time += dt;
    if (this.time < 1) return false; // 1초 단위로 판단

    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;

    if (this.warmup > 0) {
      this.warmup--;
      return false;
    }

    let next = this.ratio;
    if (fps < GRAPHICS.targetFps) {
      this.goodSeconds = 0;
      this.badSeconds++;
      if (this.badSeconds >= 2) { // 2초 연속 느릴 때만 낮춤 (순간적인 끊김은 무시)
        next = Math.max(GRAPHICS.minPixelRatio, this.ratio - 0.15);
        this.badSeconds = 0;
      }
    } else if (fps > GRAPHICS.targetFps + 10) {
      this.badSeconds = 0;
      this.goodSeconds++;
      if (this.goodSeconds >= 5) { // 5초 연속 여유로울 때만 올림 (왔다갔다 방지)
        next = Math.min(this.max, this.ratio + 0.1);
        this.goodSeconds = 0;
      }
    } else {
      this.goodSeconds = 0;
      this.badSeconds = 0;
    }

    if (Math.abs(next - this.ratio) < 1e-3) return false;
    this.ratio = next;
    this.renderer.setPixelRatio(this.ratio);
    return true;
  }
}
