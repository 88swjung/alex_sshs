// ============================================================
// minimap.js — 오른쪽 위 미니맵. mapData(world.rooms, world.doors)에서 자동으로 그린다.
// 실제 학교 배치도로 바꿔도 코드를 고칠 필요가 없음.
// 방이 그려진 바탕은 한 번만 그려 두고, 매번 플레이어 표시만 덧그린다.
// ============================================================

const KIND_COLOR = {
  corridor: '#cfcdc6',
  classroom: '#aab2b0',
  lab: '#b0b6ad',
  gym: '#c2b49a',
  restroom: '#a9b8be',
  study: '#b3b9ac',
  office: '#adb2ba',
  stairs: '#bcb2a7',
  solid: '#7d8084',
};

export function createMinimap(canvas, world) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pad = 6;
  const maxW = 360, maxH = 170; // 건물이 가로로 길어서 가로를 넉넉히
  const b = world.bounds;
  const worldW = b.maxX - b.minX, worldH = b.maxZ - b.minZ;
  const scale = Math.min((maxW - pad * 2) / worldW, (maxH - pad * 2) / worldH); // 1m 가 몇 픽셀인지
  const cssW = Math.round(worldW * scale + pad * 2), cssH = Math.round(worldH * scale + pad * 2);

  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';

  const sx = (x) => (pad + (x - b.minX) * scale) * dpr;
  const sz = (z) => (pad + (z - b.minZ) * scale) * dpr;

  // ---- 바탕(방, 문, 이름)을 한 번만 그려 둠 ----
  const base = document.createElement('canvas');
  base.width = canvas.width;
  base.height = canvas.height;
  const g = base.getContext('2d');

  for (const r of world.rooms) {
    g.fillStyle = KIND_COLOR[r.kind] || '#dddddd';
    g.fillRect(sx(r.x), sz(r.z), r.w * scale * dpr, r.d * scale * dpr);
  }
  g.strokeStyle = 'rgba(25,28,33,0.85)';
  g.lineWidth = Math.max(1, 1.2 * dpr);
  for (const r of world.rooms) g.strokeRect(sx(r.x), sz(r.z), r.w * scale * dpr, r.d * scale * dpr);

  // 문: 벽선을 같은 색으로 끊어서 열린 자리처럼 보이게
  g.strokeStyle = KIND_COLOR.corridor;
  g.lineWidth = Math.max(2, 2.4 * dpr);
  for (const d of world.doors) {
    const h = d.width / 2;
    g.beginPath();
    if (d.horizontal) { g.moveTo(sx(d.center - h), sz(d.line)); g.lineTo(sx(d.center + h), sz(d.line)); }
    else { g.moveTo(sx(d.line), sz(d.center - h)); g.lineTo(sx(d.line), sz(d.center + h)); }
    g.stroke();
  }
  // 문 없이 뚫린 통로(계단·외부연결·융합인재관 연결)도 같은 방식으로 터 줌
  for (const o of world.openings || []) {
    g.beginPath();
    if (o.horizontal) { g.moveTo(sx(o.s), sz(o.line)); g.lineTo(sx(o.e), sz(o.line)); }
    else { g.moveTo(sx(o.line), sz(o.s)); g.lineTo(sx(o.line), sz(o.e)); }
    g.stroke();
  }

  // 방 이름 (칸이 충분히 넓을 때만)
  g.fillStyle = 'rgba(25,28,33,0.9)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${Math.round(9.5 * dpr)}px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
  for (const r of world.rooms) {
    if (r.kind === 'corridor' || r.kind === 'stairs' || r.kind === 'solid') continue;
    const label = r.name;
    if (g.measureText(label).width < r.w * scale * dpr - 4 * dpr) g.fillText(label, sx(r.x + r.w / 2), sz(r.z + r.d / 2));
  }

  const ctx = canvas.getContext('2d');

  return {
    /** 플레이어 위치·방향을 덧그림 */
    update(player) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0);

      const px = sx(player.x), pz = sz(player.z);
      // 바라보는 방향 (월드의 앞 방향 = (-sin yaw, -cos yaw))
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      const ang = Math.atan2(fz, fx);

      // 시야 부채꼴
      const len = 22 * dpr;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.arc(px, pz, len, ang - 0.6, ang + 0.6);
      ctx.closePath();
      ctx.fill();

      // 내 위치 점
      ctx.fillStyle = '#f2f2f0';
      ctx.strokeStyle = '#1b1e22';
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.arc(px, pz, 4 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    },
  };
}
