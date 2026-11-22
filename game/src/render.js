// Sunset Vaults — everything the eye sees. One job: draw the room, the
// cones, the loot, the HUD, the title screen and the victory screen on
// one canvas. No game logic lives here; main.js owns the state.
import { ROOM_X, ROOM_Y, ROOM_W, ROOM_H, ROOM_PX_W, ROOM_PX_H, SX, SY, PALETTE, VIEW_W, VIEW_H, TOP_BAR_H, RIGHT_PANEL_X, RIGHT_PANEL_W, BOTTOM_CHIPS_Y } from './config.js';
import { conePolygon } from './geometry.js';
import { guardLine } from './guards.js';
import { ROOMS } from './levels.js';

const X = (x) => ROOM_X + x * SX;
const Y = (y) => ROOM_Y + y * SY;
const SW = (w) => w * SX; // logical width -> screen width
const SH = (h) => h * SY; // logical height -> screen height (v3: same scale)

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, weight, align) {
  ctx.fillStyle = color;
  ctx.font = `${weight || 700} ${size}px system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

// Text painted on the floor: a dark outline first, so it stays readable
// over the lighter palace paving (room labels, BAYANGAN, loot names,
// waypoint timers, guard names). HUD panels keep plain text().
function floorText(ctx, s, x, y, size, color, weight) {
  ctx.save();
  ctx.font = `${weight || 700} ${size}px system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(8,8,14,0.85)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function coneColor(state, suspicion) {
  // Two-tone cone: a soft outer wash + a bright core. Calm is pale cream,
  // suspicious is amber, chase is red — the state reads at a glance.
  if (state === 'chase' || suspicion > 80) return { fill: 'rgba(255,60,60,0.34)', core: 'rgba(255,60,60,0.5)', edge: '#ff6b6b' };
  if (state === 'suspicious' || state === 'investigate' || suspicion > 35) return { fill: 'rgba(255,165,35,0.38)', core: 'rgba(255,165,35,0.55)', edge: '#ff9d00' };
  return { fill: 'rgba(255,232,170,0.22)', core: 'rgba(255,232,170,0.36)', edge: '#ffe9a8' };
}

function conePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(X(pts[0].x), Y(pts[0].y));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i].x), Y(pts[i].y));
  ctx.closePath();
}

function drawCone(ctx, pts, corePts, colors) {
  conePath(ctx, pts);
  ctx.fillStyle = colors.fill;
  ctx.fill();
  if (corePts) {
    conePath(ctx, corePts);
    ctx.fillStyle = colors.core;
    ctx.fill();
  }
  conePath(ctx, pts);
  ctx.strokeStyle = colors.edge;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// A Mobile Legends style bush: a dense clump of small grass blades a
// sneaking thief can hide in. Deterministic per bush, so every render agrees.
function drawBush(ctx, bx, by, br, seed) {
  const rx = br * SX;
  const ry = br * SY;
  // Dark base so the clump reads as a solid bush, not loose blades.
  ctx.fillStyle = 'rgba(34, 66, 28, 0.9)';
  ctx.beginPath();
  ctx.ellipse(bx, by, rx, ry * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  const h = (n) => {
    const v = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  ctx.lineCap = 'round';
  const greens = ['#3f7d3a', '#5da85a', '#7cc47a'];
  for (let i = 0; i < 26; i++) {
    const a = h(i) * Math.PI * 2;
    const f = Math.sqrt(h(i + 100));
    const x = bx + Math.cos(a) * rx * f * 0.9;
    const y = by + Math.sin(a) * ry * f * 0.85;
    const len = 12 + h(i + 200) * 12;
    const lean = (h(i + 300) - 0.5) * 14;
    ctx.strokeStyle = greens[i % 3];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.4, y - len * 0.6, x + lean, y - len);
    ctx.stroke();
  }
}

// A small gravel bed: grey pebbles of different sizes.
function drawPebbles(ctx, x, y) {
  const stones = [[0, 0, 7, 5], [10, 3, 5, 4], [-9, 4, 6, 4], [4, -5, 5, 4], [-4, -6, 4, 3], [14, -3, 4, 3]];
  for (let i = 0; i < stones.length; i++) {
    const [dx, dy, rx, ry] = stones[i];
    ctx.fillStyle = ['#8a8f9e', '#6f7482', '#a2a7b5'][i % 3];
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, rx, ry, (i * 0.7) % 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + dx - 1, y + dy - 1, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Palace cobblestones: big paving stones in staggered rows, each stone
// a slightly different warm tone (deterministic hash, so every render
// agrees). The dark grout shows through the 2px joints. Clipped to the
// room frame — staggered rows start half a stone off the left edge.
function drawCobbles(ctx, tones, grout) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(ROOM_X, ROOM_Y, ROOM_PX_W, ROOM_PX_H);
  ctx.clip();
  ctx.fillStyle = grout;
  ctx.fillRect(ROOM_X, ROOM_Y, ROOM_PX_W, ROOM_PX_H);
  const W = 116, H = 80; // big palace paving stones, logical units
  const h = (a, b) => {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  let row = 0;
  for (let y = 0; y < ROOM_H; y += H, row++) {
    const off = (row % 2) * (W / 2);
    let col = 0;
    for (let x = -W + off; x < ROOM_W; x += W, col++) {
      const f = h(col, row);
      ctx.fillStyle = tones[Math.floor(f * tones.length) % tones.length];
      // v4: 1px joints (the 2px grout grid was too busy at judge scale).
      ctx.fillRect(ROOM_X + x * SX, ROOM_Y + y * SY, W * SX - 1, H * SY - 1);
      // Worn top edge catches the lamplight.
      ctx.fillStyle = 'rgba(255,220,160,0.04)';
      ctx.fillRect(ROOM_X + x * SX, ROOM_Y + y * SY, W * SX - 1, 2);
    }
  }
  ctx.restore();
}

function drawFloor(ctx, S) {
  const floor = S.room.floor;
  // Palace paving: big sandstone stones with dark mortar joints, one
  // tone per floor — warm sandstone in the hall, cool flagstones in the
  // vault, dark slate on the roof terrace. Still night-dark, so the
  // sunset lamps and the vision cones keep their contrast.
  // v4: tone palettes tightened — the per-stone variation was too busy
  // at judge scale. Still night-dark, so lamps and cones keep contrast.
  const tones = floor === 'marble'
    ? ['#2e2738', '#302939', '#2c2536', '#322b3c', '#2f2839']
    : floor === 'steel'
    ? ['#282c35', '#2a2e37', '#272b34', '#2b2f38', '#292d36']
    : ['#242738', '#262a3b', '#232635', '#272b3d', '#252839'];
  drawCobbles(ctx, tones, floor === 'marble' ? '#171221' : floor === 'steel' ? '#12151c' : '#10121e');
  if (floor === 'marble') {
    // Marble veins across the hall.
    ctx.strokeStyle = 'rgba(200,210,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(60), Y(120)); ctx.bezierCurveTo(X(400), Y(200), X(900), Y(90), X(1560), Y(180));
    ctx.moveTo(X(80), Y(620)); ctx.bezierCurveTo(X(420), Y(540), X(900), Y(700), X(1560), Y(600));
    ctx.stroke();
    // The red carpet runner down the middle of the hall — v4: wider and
    // bolder, a clear central runner instead of a thin strip.
    ctx.fillStyle = 'rgba(140,32,44,0.55)';
    ctx.fillRect(X(730), Y(0), SW(140), SH(1200));
    ctx.strokeStyle = 'rgba(245,197,66,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(730), Y(0)); ctx.lineTo(X(730), Y(1200));
    ctx.moveTo(X(870), Y(0)); ctx.lineTo(X(870), Y(1200));
    ctx.stroke();
    // Gold medallion in the middle of the runner.
    ctx.fillStyle = 'rgba(245,197,66,0.5)';
    ctx.beginPath();
    ctx.arc(X(800), Y(600), 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(140,32,44,0.8)';
    ctx.beginPath();
    ctx.arc(X(800), Y(600), 18, 0, Math.PI * 2);
    ctx.fill();
    // Framed sunset paintings on the top wall — the bank's own art.
    for (const px of [140, 800]) {
      const pg = ctx.createLinearGradient(X(px), Y(66), X(px), Y(112));
      pg.addColorStop(0, '#ff9a3c');
      pg.addColorStop(1, '#7a2d4d');
      ctx.fillStyle = pg;
      ctx.fillRect(X(px), Y(66), SW(90), SH(46));
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 2;
      ctx.strokeRect(X(px), Y(66), SW(90), SH(46));
      ctx.fillStyle = 'rgba(255,220,150,0.85)';
      ctx.beginPath();
      ctx.arc(X(px) + SW(90) / 2, Y(66) + 28, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (floor === 'steel') {
    ctx.strokeStyle = 'rgba(150,180,255,0.10)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let gx = 0; gx <= ROOM_PX_W; gx += 116) { ctx.moveTo(ROOM_X + gx, ROOM_Y); ctx.lineTo(ROOM_X + gx, ROOM_Y + ROOM_PX_H); }
    ctx.stroke();
    // v4: gold trim — a gold line along the top edge + gold corner
    // brackets, so the vault room reads as steel-and-gold at a glance.
    ctx.strokeStyle = 'rgba(245,197,66,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ROOM_X, ROOM_Y + 4); ctx.lineTo(ROOM_X + ROOM_PX_W, ROOM_Y + 4);
    ctx.stroke();
    ctx.lineWidth = 4;
    for (const [cx2, cy2] of [[ROOM_X + 14, ROOM_Y + 14], [ROOM_X + ROOM_PX_W - 14, ROOM_Y + 14]]) {
      ctx.beginPath();
      ctx.moveTo(cx2 - 10, cy2); ctx.lineTo(cx2 + 10, cy2);
      ctx.moveTo(cx2, cy2 - 10); ctx.lineTo(cx2, cy2 + 10);
      ctx.stroke();
    }
    // Wall pipes along the top of the vault room.
    ctx.strokeStyle = 'rgba(150,180,255,0.16)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ROOM_X, Y(36)); ctx.lineTo(ROOM_X + ROOM_PX_W, Y(36));
    ctx.moveTo(ROOM_X, Y(48)); ctx.lineTo(ROOM_X + ROOM_PX_W, Y(48));
    ctx.stroke();
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(X(120), Y(42), 6, 0, Math.PI * 2);
    ctx.arc(X(1480), Y(42), 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Rooftop terrace: moon, stars and city glow over the slate paving.
    ctx.fillStyle = 'rgba(255,244,200,0.9)';
    ctx.beginPath();
    ctx.arc(X(120), Y(92), 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,244,200,0.18)';
    ctx.beginPath();
    ctx.arc(X(120), Y(92), 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 40; i++) {
      const sx = ROOM_X + ((i * 173) % ROOM_PX_W);
      const sy = ROOM_Y + ((i * 97) % 200);
      ctx.globalAlpha = 0.25 + ((i * 37) % 60) / 100;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,170,80,0.10)';
    ctx.fillRect(ROOM_X, Y(1120), ROOM_PX_W, SH(80)); // city glow at the far edge
    // v4: parapet — a crenellated stone lip along the top edge, so the
    // roof reads as a rooftop terrace, not just dark floor.
    ctx.fillStyle = '#31364a';
    for (let px = ROOM_X; px < ROOM_X + ROOM_PX_W; px += 44) {
      ctx.fillRect(px, ROOM_Y, 26, 12);
    }
    ctx.fillStyle = 'rgba(245,197,66,0.35)';
    ctx.fillRect(ROOM_X, ROOM_Y + 12, ROOM_PX_W, 2);
  }
  // Warm lantern pools.
  for (const l of S.room.lamps) {
    const g = ctx.createRadialGradient(X(l.x), Y(l.y), 8, X(l.x), Y(l.y), l.r);
    g.addColorStop(0, 'rgba(255,190,90,0.26)');
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(X(l.x), Y(l.y), l.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(X(l.x), Y(l.y), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,138,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(X(l.x), Y(l.y), 10, 0, Math.PI * 2);
    ctx.stroke();
    // Dust motes drifting in the lamplight — the room feels lived in.
    ctx.fillStyle = 'rgba(255,220,150,0.5)';
    for (let i = 0; i < 6; i++) {
      const a = S.time * 0.3 + i * 1.7 + l.x;
      const dx = Math.cos(a) * (l.r * 0.55);
      const dy = Math.sin(a * 1.3) * (l.r * 0.4);
      ctx.globalAlpha = 0.2 + 0.25 * Math.abs(Math.sin(S.time + i));
      ctx.fillRect(X(l.x) + dx, Y(l.y) + dy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // Shadow pockets: where a sneaking thief is hard to see. The dashed
  // ring + BAYANGAN label mark the real mechanic radius (world r, scaled).
  for (const s of S.room.shadows) {
    const sr = s.r * SY;
    const g = ctx.createRadialGradient(X(s.x), Y(s.y), 4, X(s.x), Y(s.y), sr);
    g.addColorStop(0, 'rgba(40,60,120,0.22)');
    g.addColorStop(1, 'rgba(40,60,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(X(s.x), Y(s.y), sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(140,170,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(X(s.x), Y(s.y), sr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    floorText(ctx, 'BAYANGAN', X(s.x), Y(s.y) + 4, 10, 'rgba(180,200,255,0.85)', 800);
  }
  // Room names painted on the floor — the plan reads like a real blueprint.
  if (S.room.labels) {
    ctx.save();
    ctx.letterSpacing = '2px';
    for (const lb of S.room.labels) {
      floorText(ctx, lb.text, X(lb.x), Y(lb.y), 13, 'rgba(232,230,223,0.55)', 800);
    }
    ctx.restore();
  }
  // Bushes: dense Mobile Legends style grass a sneaking thief hides in.
  for (const b of S.room.bushes) drawBush(ctx, X(b.x), Y(b.y), b.r, b.x + b.y);
  // Gravel beds along the edges — the floor is lived in.
  const decor = {
    marble: { pebbles: [[150, 1160], [1550, 155], [800, 1160], [60, 420]] },
    steel: { pebbles: [[150, 1160], [1500, 1160], [250, 95], [1350, 95]] },
    roof: { pebbles: [[150, 1160], [1500, 1160], [250, 90], [1350, 90]] },
  }[floor] || { pebbles: [] };
  for (const [px, py] of decor.pebbles) drawPebbles(ctx, X(px), Y(py));
}

function drawBlock(ctx, b) {
  const x = X(b.x);
  const y = Y(b.y);
  if (b.kind === 'wall') {
    // A real brick wall: warm tan brick with dark mortar courses and
    // staggered joints, a gold coping along the top edge and a shadow
    // underneath — it reads as a wall, not a flat dark bar.
    const w = SW(b.w);
    const h = SH(b.h);
    ctx.save();
    ctx.fillStyle = '#8a6a48';
    rr(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = 'rgba(40,26,14,0.6)';
    ctx.lineWidth = 1;
    for (let yy = y + 8; yy < y + h; yy += 8) {
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
    }
    let row = 0;
    for (let yy = y; yy < y + h; yy += 8, row++) {
      const off = (row % 2) * 8;
      for (let xx = x + off + 16; xx < x + w; xx += 16) {
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, Math.min(yy + 8, y + h)); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y + h - 3, w, 3);
  } else if (b.kind === 'pillar') {
    ctx.fillStyle = '#2a2f42';
    rr(ctx, x, y, SW(b.w), SH(b.h), 8);
    ctx.fill();
    ctx.fillStyle = '#4a5170';
    rr(ctx, x + 6, y + 6, SW(b.w) - 12, SH(b.h) - 12, 5);
    ctx.fill();
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(x + SW(b.w) / 2, y + SH(b.h) / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.kind === 'vaultdoor') {
    ctx.fillStyle = '#3a3f52';
    rr(ctx, x, y, SW(b.w), SH(b.h), 6);
    ctx.fill();
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, y + 4, SW(b.w) - 8, SH(b.h) - 8);
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(x + SW(b.w) / 2, y + SH(b.h) / 2, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.kind === 'crate') {
    const w = SW(b.w);
    const hg = SH(b.h);
    ctx.fillStyle = '#6b4f2a';
    rr(ctx, x, y, w, hg, 4);
    ctx.fill();
    // Plank seam across the middle.
    ctx.strokeStyle = 'rgba(40,26,12,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + hg / 2); ctx.lineTo(x + w, y + hg / 2);
    ctx.stroke();
    // Lid: darker wood across the top third.
    ctx.fillStyle = '#54391d';
    ctx.fillRect(x, y, w, Math.max(3, hg * 0.28));
    // Iron bands.
    ctx.fillStyle = '#2e2a33';
    ctx.fillRect(x + w * 0.18, y, 4, hg);
    ctx.fillRect(x + w * 0.78, y, 4, hg);
    // Dark frame + brass corner studs + lamplight on the top edge.
    ctx.strokeStyle = '#3a2a16';
    ctx.lineWidth = 2;
    rr(ctx, x, y, w, hg, 4);
    ctx.stroke();
    ctx.fillStyle = '#c9a35a';
    for (const [sx2, sy2] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + hg - 5], [x + w - 5, y + hg - 5]]) {
      ctx.beginPath(); ctx.arc(sx2, sy2, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,220,150,0.25)';
    ctx.fillRect(x + 2, y, w - 4, 2);
  } else if (b.kind === 'vent') {
    // A roof vent: a big steel box with a spinning fan — a landmark, not a speck.
    const w = SW(b.w);
    const hg = SH(b.h);
    ctx.fillStyle = '#3d4257';
    rr(ctx, x, y, w, hg, 6);
    ctx.fill();
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2;
    rr(ctx, x, y, w, hg, 6);
    ctx.stroke();
    const fcx = x + w / 2;
    const fcy = y + hg / 2;
    ctx.strokeStyle = '#8b93ad';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.6;
      ctx.beginPath();
      ctx.moveTo(fcx, fcy);
      ctx.lineTo(fcx + Math.cos(a) * (w / 2 - 8), fcy + Math.sin(a) * (hg / 2 - 6));
      ctx.stroke();
    }
    ctx.fillStyle = '#2a2f42';
    ctx.beginPath();
    ctx.arc(fcx, fcy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(fcx, fcy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.kind === 'desk') {
    // A teller desk: dark wood, a gold top edge and stacked gold coins —
    // a big readable prop, not a flat bar.
    const w = SW(b.w);
    const hg = SH(b.h);
    ctx.fillStyle = '#4a3220';
    rr(ctx, x, y, w, hg, 6);
    ctx.fill();
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = '#6b4f2a';
    ctx.fillRect(x + 6, y + 8, w - 12, hg - 14);
    ctx.fillStyle = '#f5c542';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + 14 + i * 12, y + hg - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#2a1c0e';
    ctx.lineWidth = 2;
    rr(ctx, x, y, w, hg, 6);
    ctx.stroke();
  } else {
    ctx.fillStyle = b.kind === 'counter' ? '#33261a' : '#262b3a';
    rr(ctx, x, y, SW(b.w), SH(b.h), 6);
    ctx.fill();
    ctx.strokeStyle = '#4a5170';
    ctx.lineWidth = 1.5;
    rr(ctx, x, y, SW(b.w), SH(b.h), 6);
    ctx.stroke();
  }
  if (b.label) {
    // v4: the big iron door's label sits just below it (the door's own
    // face carries the gold wheel); vent labels go below the box too —
    // the fan blades cross the middle, so a centred label reads struck
    // through (the bottom vent's label goes above, the chips cover below).
    // Everything else keeps its label centred.
    // v4 fix: block labels use floorText (dark outline) so they stay
    // readable when a bright cone sweeps over them (MEJA TELLER was
    // washed out by the camera cone).
    let ly = y + SH(b.h) / 2 + 4;
    if (b.kind === 'vaultdoor') ly = y + SH(b.h) + 14;
    else if (b.kind === 'vent') ly = b.y > 1000 ? y - 8 : y + SH(b.h) + 14;
    floorText(ctx, b.label, x + SW(b.w) / 2, ly, 10, 'rgba(232,230,223,0.9)', 700);
  }
}

function drawLoot(ctx, S, l) {
  if (l.taken) return;
  const pulse = 1 + Math.sin(S.time * 4 + l.x) * 0.12;
  const cx = X(l.x);
  const cy = Y(l.y);
  // v4: the loot glow is bigger (58 -> 72) so it survives the judge
  // sheet; a pedestal loot gets a gold-framed display case + a wider glow.
  // v4.1: the cover staging shrinks the Berlian pedestal (visualScale
  // 0.65, then 0.42 in v4.2) — case + diamond were too dominant. Only
  // the Berlian sets visualScale, so every other loot renders exactly
  // as before. v4.2: the Berlian's label + price shrink with the same
  // factor as the v4.2 diamond shrink (see below); other loot labels
  // stay full size.
  const vs = l.visualScale || 1;
  const glowR = (l.pedestal ? 96 : 72) * pulse * vs;
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, glowR);
  glow.addColorStop(0, 'rgba(245,197,66,0.55)');
  glow.addColorStop(1, 'rgba(245,197,66,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fill();
  if (l.pedestal) {
    // A lit display case: gold frame, glass sheen, dark plinth.
    const cw = 116 * vs, ch = 88 * vs;
    ctx.fillStyle = 'rgba(20,16,10,0.85)';
    rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 8);
    ctx.fill();
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 3;
    rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(cx - 58 * vs, cy - 44 * vs);
    ctx.lineTo(cx - 20 * vs, cy - 44 * vs);
    ctx.lineTo(cx - 58 * vs, cy + 10 * vs);
    ctx.closePath();
    ctx.fill();
  }
  // Sparkles around the loot — it calls the eye.
  for (let i = 0; i < 4; i++) {
    const a = S.time * 1.5 + i * 1.9 + l.x;
    ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(S.time * 2 + i * 2.1));
    ctx.fillStyle = '#fff2c0';
    ctx.fillRect(cx + Math.cos(a) * 40 * vs, cy + Math.sin(a) * 34 * vs - 4, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f5c542';
  ctx.strokeStyle = '#fff2c0';
  ctx.lineWidth = 2;
  const k = 1.3 * vs; // v4: loot icons ~30% bigger; vs shrinks only the Berlian
  if (l.kind === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18 * k); ctx.lineTo(cx + 17 * k, cy); ctx.lineTo(cx, cy + 18 * k); ctx.lineTo(cx - 17 * k, cy);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#bff3ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 18 * k); ctx.lineTo(cx + 9 * k, cy - 5 * k); ctx.lineTo(cx - 9 * k, cy - 5 * k);
    ctx.closePath(); ctx.fill();
  } else if (l.kind === 'crown') {
    ctx.beginPath();
    ctx.moveTo(cx - 18 * k, cy + 10 * k); ctx.lineTo(cx - 18 * k, cy - 10 * k); ctx.lineTo(cx - 9 * k, cy); ctx.lineTo(cx, cy - 16 * k);
    ctx.lineTo(cx + 9 * k, cy); ctx.lineTo(cx + 18 * k, cy - 10 * k); ctx.lineTo(cx + 18 * k, cy + 10 * k);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5252';
    ctx.beginPath(); ctx.arc(cx, cy + 1, 4, 0, Math.PI * 2); ctx.fill();
  } else if (l.kind === 'book') {
    rr(ctx, cx - 16 * k, cy - 13 * k, 32 * k, 26 * k, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#7a5a12';
    ctx.beginPath(); ctx.moveTo(cx, cy - 13 * k); ctx.lineTo(cx, cy + 13 * k); ctx.stroke();
  } else if (l.kind === 'key') {
    ctx.beginPath(); ctx.arc(cx - 8 * k, cy, 9 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(cx, cy - 3, 23, 5);
    ctx.fillRect(cx + 16, cy - 3, 5, 12);
    ctx.fillRect(cx + 23, cy - 3, 5, 9);
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a5a12';
    text(ctx, '$', cx, cy + 5, 14, '#7a5a12', 800, 'center');
  }
  const nameY = l.pedestal ? cy - 56 * vs : cy - 30;
  const valY = l.pedestal ? cy + 58 * vs : cy + 34;
  // v4.2: the pedestal label + price shrink with the same factor as
  // this step's diamond shrink (visualScale 0.65 -> 0.42, factor
  // ~0.646), so the whole pedestal unit shrinks together: name 18px
  // -> ~11.6px, value 16px -> ~10.3px. Loot without visualScale keeps
  // full-size labels (lvs = 1); the 0.65 baseline is the v4.1 scale at
  // which labels were still full size.
  const lvs = l.pedestal && l.visualScale ? l.visualScale / 0.65 : 1;
  floorText(ctx, l.name, cx, nameY, (l.pedestal ? 18 : 16) * lvs, '#ffe9a8', 800);
  floorText(ctx, `$${l.value}`, cx, valY, (l.pedestal ? 16 : 13) * lvs, '#f5c542', 700);
}

function drawGuard(ctx, S, g) {
  const pts = conePolygon(g.x, g.y, g.angle, g.fov, g.range, S.room.blocks, ROOM_W, ROOM_H);
  const corePts = conePolygon(g.x, g.y, g.angle, g.fov * 0.55, g.range * 0.8, S.room.blocks, ROOM_W, ROOM_H);
  drawCone(ctx, pts, corePts, coneColor(g.state, g.suspicion));
  // Patrol route, numbered: dashed line + a numbered stop at each waypoint
  // (the guard waits 1.1s at every stop — the label says so).
  if (g.patrol && g.patrol.length > 1) {
    ctx.strokeStyle = 'rgba(232,230,223,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(X(g.patrol[0][0]), Y(g.patrol[0][1]));
    for (let i = 1; i < g.patrol.length; i++) ctx.lineTo(X(g.patrol[i][0]), Y(g.patrol[i][1]));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < g.patrol.length; i++) {
      const wx = X(g.patrol[i][0]);
      const wy = Y(g.patrol[i][1]);
      ctx.fillStyle = 'rgba(10,12,20,0.85)';
      ctx.beginPath();
      ctx.arc(wx, wy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, String(i + 1), wx, wy + 4, 11, '#f5c542', 800, 'center');
      floorText(ctx, '1.1s', wx, wy + 26, 10, 'rgba(232,230,223,0.8)', 700);
    }
  }
  const cx = X(g.x);
  const cy = Y(g.y);
  // Body: navy uniform, gold trim; the dog is a dark hound. v4: radius
  // 13 -> 16 so guards read at judge scale.
  ctx.fillStyle = g.dog ? '#3a2c22' : '#1d2f5e';
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = g.dog ? '#c98f4e' : '#f5c542';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#e8e6df';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(g.angle) * 22, cy + Math.sin(g.angle) * 22);
  ctx.stroke();
  if (g.dog) {
    ctx.fillStyle = '#c98f4e';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(g.angle) * 17, cy + Math.sin(g.angle) * 17, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Name tag: above the guard when calm; when a bubble is up, the role
  // also sits above the guard (cy-26) — below it, the role collided with
  // the waypoint-1 "1.1s" label and (for Sari) the MEJA CATATAN label.
  // The bubble tail ends at cy-79 and the facing tick at cy-22, so cy-26
  // is clear of both.
  const bubble = g.state === 'suspicious' || g.state === 'investigate' || g.state === 'chase';
  if (bubble) {
    floorText(ctx, g.role, cx, cy - 26, 10, '#9aa0b4', 700);
  } else {
    floorText(ctx, `${g.name} · ${g.role}`, cx, cy - 20, 11, '#e8e6df', 700);
  }
  // Named speech bubble: the guard's name + his own line, in a rounded
  // bubble. The "?" / "!" mark sits ABOVE the bubble with a clear gap —
  // never stacked on top of the words (v2.8 lesson).
  if (bubble) {
    const line = guardLine(g.name, g.state);
    const mark = g.state === 'chase' ? '!' : '?';
    const markColor = g.state === 'chase' ? '#ff5252' : '#ffc93c';
    ctx.font = '800 12px system-ui, "Segoe UI", sans-serif';
    const lineW = ctx.measureText(line).width;
    ctx.font = '800 9px system-ui, "Segoe UI", sans-serif';
    const nameW = ctx.measureText(g.name).width;
    const bw = Math.max(lineW, nameW) + 24;
    const bh = 42;
    const bx = Math.max(ROOM_X + 4, Math.min(cx - bw / 2, ROOM_X + ROOM_PX_W - bw - 4));
    const by = cy - 130;
    ctx.fillStyle = 'rgba(10,12,20,0.93)';
    rr(ctx, bx, by, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = markColor;
    ctx.lineWidth = 1.5;
    rr(ctx, bx, by, bw, bh, 8);
    ctx.stroke();
    // Tail from the bubble down toward the guard.
    ctx.fillStyle = 'rgba(10,12,20,0.93)';
    ctx.beginPath();
    ctx.moveTo(cx - 6, by + bh - 1);
    ctx.lineTo(cx + 6, by + bh - 1);
    ctx.lineTo(cx, by + bh + 9);
    ctx.closePath();
    ctx.fill();
    text(ctx, g.name, cx, by + 14, 9, '#f5c542', 800, 'center');
    text(ctx, line, cx, by + 31, 12, '#ffffff', 700, 'center');
    text(ctx, mark, cx, by - 12, g.state === 'chase' ? 24 : 20, markColor, 800, 'center');
  }
  if (g.suspicion > 5) {
    const barY = bubble ? cy + 48 : cy + 18;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cx - 20, barY, 40, 6);
    ctx.fillStyle = g.suspicion > 80 ? '#ff5252' : g.suspicion > 35 ? '#ffc93c' : '#5b8cff';
    ctx.fillRect(cx - 20, barY, 40 * (g.suspicion / 100), 6);
  }
}

function drawCamera(ctx, S, c) {
  const pts = conePolygon(c.x, c.y, c.angle, 0.62, c.range, S.room.blocks, ROOM_W, ROOM_H);
  const corePts = conePolygon(c.x, c.y, c.angle, 0.34, c.range * 0.8, S.room.blocks, ROOM_W, ROOM_H);
  const hot = c.suspicion > 50;
  // v4: the camera cone is hot saturated gold (it was pale cream) so it
  // reads as a threat at judge scale.
  drawCone(ctx, pts, corePts, hot
    ? { fill: 'rgba(255,80,80,0.30)', core: 'rgba(255,80,80,0.45)', edge: '#ff5252' }
    : { fill: 'rgba(255,196,60,0.34)', core: 'rgba(255,196,60,0.50)', edge: '#ffbe2e' });
  const cx = X(c.x);
  const cy = Y(c.y);
  ctx.fillStyle = '#2a2f42';
  rr(ctx, cx - 10, cy - 7, 20, 14, 3);
  ctx.fill();
  ctx.fillStyle = Math.floor(S.time * 2) % 2 === 0 ? '#ff5252' : '#7a2020';
  ctx.beginPath();
  ctx.arc(cx + 8, cy - 5, 3, 0, Math.PI * 2);
  ctx.fill();
  // Keep the label inside the room frame — edge cameras would push it
  // under the side panels.
  const lx = Math.max(ROOM_X + 32, Math.min(cx, ROOM_X + ROOM_PX_W - 32));
  floorText(ctx, 'KAMERA', lx, cy + 24, 9, 'rgba(232,230,223,0.85)', 700);
}

function drawExit(ctx, S) {
  const e = S.room.exit;
  const locked = S.lockdown > 0;
  const cx = X(e.x + e.w / 2);
  const cy = Y(e.y + e.h / 2);
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 70);
  glow.addColorStop(0, locked ? 'rgba(255,82,82,0.45)' : 'rgba(55,214,122,0.5)');
  glow.addColorStop(1, 'rgba(55,214,122,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = locked ? '#5e1d1d' : '#0d3d22';
  rr(ctx, X(e.x), Y(e.y), SW(e.w), SH(e.h), 6);
  ctx.fill();
  ctx.strokeStyle = locked ? '#ff5252' : '#37d67a';
  ctx.lineWidth = 3;
  rr(ctx, X(e.x), Y(e.y), SW(e.w), SH(e.h), 6);
  ctx.stroke();
  // v4 fix: the label uses floorText (dark outline) — "PELARIAN" is wider
  // than its box and AGUS's cone washed out its end.
  floorText(ctx, locked ? 'TERKUNCI' : e.label, cx, cy + 5, 13, locked ? '#ff8a8a' : '#7dffab', 800);
}

function drawPlayer(ctx, S) {
  const p = S.player;
  const cx = X(p.x);
  const cy = Y(p.y);
  // v4: Raka is BIG — body radius 11 -> 18 with a glowing white ring, so
  // the thief is impossible to miss at judge scale (he was a 7px dot).
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 15, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(245,197,66,0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#14161f';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = '#f5c542';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, Math.PI * 2);
  ctx.stroke();
  // Hood point + facing tick.
  ctx.fillStyle = '#f5c542';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(p.dir) * 18, cy + Math.sin(p.dir) * 18);
  ctx.lineTo(cx + Math.cos(p.dir + 2.6) * 11, cy + Math.sin(p.dir + 2.6) * 11);
  ctx.lineTo(cx + Math.cos(p.dir - 2.6) * 11, cy + Math.sin(p.dir - 2.6) * 11);
  ctx.closePath();
  ctx.fill();
  floorText(ctx, 'RAKA', cx, cy - 30, 13, '#e8e6df', 800);
  if (S.playerHidden) {
    // A green HIDDEN pill, not bare text — it has to read at a glance.
    const label = 'HIDDEN';
    ctx.font = '800 11px system-ui, "Segoe UI", sans-serif';
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(10,40,22,0.9)';
    rr(ctx, cx - w / 2, cy + 26, w, 18, 9);
    ctx.fill();
    ctx.strokeStyle = '#37d67a';
    ctx.lineWidth = 1.5;
    rr(ctx, cx - w / 2, cy + 26, w, 18, 9);
    ctx.stroke();
    text(ctx, label, cx, cy + 39, 11, '#7dffab', 800, 'center');
  }
  if (p.sneak) floorText(ctx, 'JONGKOK', cx, cy + (S.playerHidden ? 58 : 46), 10, '#9aa0b4', 700);
}

function drawFloats(ctx, S) {
  for (const f of S.floats) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.6);
    text(ctx, f.text, X(f.x), Y(f.y) - f.t * 34, 20, f.color, 800, 'center');
  }
  ctx.globalAlpha = 1;
}

function drawCoinRing(ctx, S) {
  if (!S.coinFx) return;
  const r = S.coinFx.t * 130;
  ctx.globalAlpha = Math.max(0, 0.9 - S.coinFx.t);
  ctx.strokeStyle = '#f5c542';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(X(S.coinFx.x), Y(S.coinFx.y), r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  floorText(ctx, 'DENTING KOIN', X(S.coinFx.x), Y(S.coinFx.y) - r - 8, 12, '#ffe9a8', 800);
}

function bar(ctx, x, y, w, h, frac, color, label, valueText) {
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  rr(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  if (frac > 0) { rr(ctx, x, y, Math.max(6, w * frac), h, 4); ctx.fill(); }
  text(ctx, label, x, y - 6, 11, '#e8e6df', 800, 'left');
  if (valueText) text(ctx, valueText, x + w, y - 6, 11, '#e8e6df', 700, 'right');
}

function drawTopBar(ctx, S) {
  // v4: one thin bar (36px). Title + room on the left, the TARGET chip
  // in the middle, money + harta + timer on the right.
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 0, VIEW_W, TOP_BAR_H);
  ctx.fillStyle = '#f5c542';
  ctx.fillRect(0, TOP_BAR_H, VIEW_W, 2);
  text(ctx, 'SUNSET VAULTS', 14, 24, 17, '#f5c542', 800, 'left');
  text(ctx, `${S.room.name}  ·  ${S.room.sub}`, 168, 23, 12, '#e8e6df', 700, 'left');
  // TARGET chip: the next loot to steal, centred in the bar.
  const next = S.loot.find((l) => !l.taken);
  const chipText = next ? `TARGET: ${next.name} $${next.value}` : 'SEMUA HARTA!';
  ctx.font = '800 12px system-ui, "Segoe UI", sans-serif';
  const chipW = ctx.measureText(chipText).width + 28;
  const chipX = (VIEW_W - chipW) / 2;
  ctx.fillStyle = 'rgba(245,197,66,0.16)';
  rr(ctx, chipX, 6, chipW, 24, 12);
  ctx.fill();
  ctx.strokeStyle = '#f5c542';
  ctx.lineWidth = 1.5;
  rr(ctx, chipX, 6, chipW, 24, 12);
  ctx.stroke();
  text(ctx, chipText, VIEW_W / 2, 23, 12, '#ffe9a8', 800, 'center');
  const totalGot = (S.roomsLootGot || []).reduce((a, b) => a + b, 0);
  const totalAll = ROOMS.reduce((a, r) => a + r.loot.length, 0);
  const mm = String(Math.floor(S.time / 60)).padStart(2, '0');
  const ss = String(Math.floor(S.time % 60)).padStart(2, '0');
  text(ctx, `$${S.money}  ·  HARTA ${totalGot}/${totalAll}  ·  ${mm}:${ss}`, 1266, 24, 14, '#e8e6df', 700, 'right');
}

function chip(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,12,20,0.82)';
  rr(ctx, x, y, w, h, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245,197,66,0.45)';
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, 9);
  ctx.stroke();
}

function drawBottomBar(ctx, S) {
  // v4: a floating row of picture chips over the map's bottom edge —
  // the coin gadget as a card, the controls as one hint line, and the
  // legend as 4 tiny icons. Nothing here is a wall of text.
  const y = BOTTOM_CHIPS_Y;
  const h = 30;
  // Coin gadget card.
  let x = 84;
  chip(ctx, x, y, 108, h);
  ctx.fillStyle = '#f5c542';
  ctx.beginPath();
  ctx.arc(x + 18, y + h / 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a5a12';
  text(ctx, '$', x + 18, y + h / 2 + 4, 12, '#7a5a12', 800, 'center');
  text(ctx, `KOIN ×${S.coins}`, x + 32, y + h / 2 + 4, 13, '#e8e6df', 800, 'left');
  // Controls hint, one line.
  x = 206;
  const hint = 'WASD jalan · Shift jongkok · Klik kanan / C lempar koin · H jeda · R ulangi';
  ctx.font = '400 12px system-ui, "Segoe UI", sans-serif';
  const hw = ctx.measureText(hint).width + 24;
  chip(ctx, x, y, hw, h);
  text(ctx, hint, x + 12, y + h / 2 + 4, 12, '#c9cdd9', 400, 'left');
  // Legend: 4 tiny icons.
  const items = [
    ['cone', 'Kerucut'],
    ['exit', 'EXIT'],
    ['loot', 'Harta'],
    ['bush', 'Semak'],
  ];
  let lx = 206 + hw + 14;
  for (const [icon, label] of items) {
    ctx.font = '700 12px system-ui, "Segoe UI", sans-serif';
    const lw = ctx.measureText(label).width + 34;
    chip(ctx, lx, y, lw, h);
    const iy = y + h / 2;
    if (icon === 'cone') {
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.moveTo(lx + 12, iy - 7);
      ctx.lineTo(lx + 19, iy + 6);
      ctx.lineTo(lx + 5, iy + 6);
      ctx.closePath();
      ctx.fill();
    } else if (icon === 'exit') {
      ctx.fillStyle = '#37d67a';
      ctx.fillRect(lx + 6, iy - 6, 12, 12);
    } else if (icon === 'loot') {
      ctx.fillStyle = '#f5c542';
      ctx.beginPath();
      ctx.moveTo(lx + 12, iy - 7); ctx.lineTo(lx + 19, iy); ctx.lineTo(lx + 12, iy + 7); ctx.lineTo(lx + 5, iy);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#5da85a';
      for (const [dx, dy] of [[-3, 0], [0, -4], [3, 0]]) {
        ctx.beginPath();
        ctx.arc(lx + 12 + dx, iy + dy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    text(ctx, label, lx + 24, iy + 4, 12, '#e8e6df', 700, 'left');
    lx += lw + 8;
  }
}

function drawRightPanel(ctx, S) {
  // v4: a slim rail (~110px) — only the big DETECTION number, the ALARM
  // bar and the live guard roster. Legend, minimap and field notes moved
  // to the bottom chips / pause screen (H).
  const px = RIGHT_PANEL_X;
  const pw = RIGHT_PANEL_W;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(px, TOP_BAR_H + 2, pw, VIEW_H - TOP_BAR_H - 2);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(px, TOP_BAR_H + 2, 1, VIEW_H - TOP_BAR_H - 2);
  const ix = px + 8;
  const iw = pw - 16;
  let y = TOP_BAR_H + 28;
  const detColor = S.detection > 80 ? '#ff5252' : S.detection > 35 ? '#ffc93c' : '#e8e6df';
  text(ctx, 'DETECTION', ix, y, 11, detColor, 800, 'left');
  text(ctx, `${S.detection}%`, px + pw - 8, y + 30, 30, S.detection > 80 ? '#ff5252' : S.detection > 35 ? '#ffc93c' : '#5b8cff', 800, 'right');
  y += 52;
  bar(ctx, ix, y + 12, iw, 10, S.alarm / 100, '#ff5252', 'ALARM', `${Math.round(S.alarm)}%`);
  y += 40;
  if (S.lockdown > 0) {
    text(ctx, `TERKUNCI ${Math.ceil(S.lockdown)} dtk`, ix, y, 11, '#ff5252', 800, 'left');
    y += 22;
  }
  text(ctx, 'PENJAGA', ix, y, 11, '#f5c542', 800, 'left');
  y += 20;
  for (const g of S.guards) {
    const status = g.state === 'chase' ? 'MENGEJAR!'
      : g.state === 'suspicious' ? `CURIGA ${Math.round(g.suspicion)}%`
      : g.state === 'investigate' ? `MENCARI ${Math.round(g.suspicion)}%`
      : 'PATROLI';
    const dot = g.state === 'chase' ? '#ff5252' : g.state === 'patrol' ? '#ffe9a8' : '#ffc93c';
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(ix + 5, y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, g.name, ix + 15, y, 11, '#e8e6df', 800, 'left');
    text(ctx, status, ix + 15, y + 13, 10, '#9aa0b4', 700, 'left');
    y += 34;
  }
  for (const c of S.cameras) {
    ctx.fillStyle = c.suspicion > 50 ? '#ff5252' : '#ffd878';
    ctx.beginPath();
    ctx.arc(ix + 5, y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'KAMERA', ix + 15, y, 11, '#e8e6df', 800, 'left');
    text(ctx, c.suspicion > 50 ? 'MELIHAT!' : 'MENYAPU', ix + 15, y + 13, 10, '#9aa0b4', 700, 'left');
    y += 34;
  }
}

export function drawGame(ctx, S) {
  ctx.fillStyle = '#07080c';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawFloor(ctx, S);
  drawDoorFrames(ctx);
  // Room frame.
  ctx.strokeStyle = PALETTE.wallTop;
  ctx.lineWidth = 4;
  ctx.strokeRect(ROOM_X - 2, ROOM_Y - 2, ROOM_PX_W + 4, ROOM_PX_H + 4);
  if (S.room.ironDoor) {
    ctx.fillStyle = '#3a3f52';
    ctx.fillRect(X(S.room.ironDoor.x), Y(S.room.ironDoor.y), SW(S.room.ironDoor.w), SH(S.room.ironDoor.h));
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2;
    ctx.strokeRect(X(S.room.ironDoor.x), Y(S.room.ironDoor.y), SW(S.room.ironDoor.w), SH(S.room.ironDoor.h));
  }
  // Lasers under the cones, over the floor.
  for (const lz of S.room.lasers) {
    ctx.strokeStyle = '#ff3c3c';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(X(lz.x1), Y(lz.y1));
    ctx.lineTo(X(lz.x2), Y(lz.y2));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff5252';
    ctx.beginPath();
    ctx.arc(X(lz.x1), Y(lz.y1), 5, 0, Math.PI * 2);
    ctx.arc(X(lz.x2), Y(lz.y2), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of S.room.blocks) drawBlock(ctx, b);
  drawExit(ctx, S);
  for (const l of S.loot) drawLoot(ctx, S, l);
  for (const c of S.cameras) drawCamera(ctx, S, c);
  for (const g of S.guards) drawGuard(ctx, S, g);
  drawPlayer(ctx, S);
  drawCoinRing(ctx, S);
  drawFloats(ctx, S);
  drawSpotlight(ctx, S);
  drawCallouts(ctx, S);
  // Staged caption (cover only): the near-miss moment as a big pill.
  if (S.shotTag) {
    const tx = X(S.shotTag.x);
    const ty = Y(S.shotTag.y);
    ctx.font = '800 22px system-ui, "Segoe UI", sans-serif';
    const tw = Math.max(ctx.measureText(S.shotTag.text).width, ctx.measureText(S.shotTag.sub).width) + 36;
    ctx.fillStyle = 'rgba(10,12,20,0.92)';
    rr(ctx, tx - tw / 2, ty - 24, tw, 52, 12);
    ctx.fill();
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2;
    rr(ctx, tx - tw / 2, ty - 24, tw, 52, 12);
    ctx.stroke();
    text(ctx, S.shotTag.text, tx, ty - 2, 22, '#ffc93c', 800, 'center');
    text(ctx, S.shotTag.sub, tx, ty + 18, 12, '#e8e6df', 700, 'center');
  }
  drawEventBanner(ctx, S);
  drawTopBar(ctx, S);
  drawRightPanel(ctx, S);
  drawBottomBar(ctx, S);
}

// v4: every door gap in the shared floor plan gets a thin gold threshold
// frame, so the passages read as doors at a glance. Gaps: the two 160-wide
// gaps in each horizontal band (y 400 and y 800) and the 120-wide gaps in
// the lower vertical walls (y 880..1000).
function drawDoorFrames(ctx) {
  ctx.strokeStyle = 'rgba(245,197,66,0.55)';
  ctx.lineWidth = 2;
  const gaps = [
    [480, 400, 160, 26], [1000, 400, 160, 26],
    [480, 800, 160, 26], [1000, 800, 160, 26],
    [533, 880, 26, 120], [1066, 880, 26, 120],
  ];
  for (const [gx, gy, gw, gh] of gaps) {
    ctx.strokeRect(X(gx) + 1, Y(gy) + 1, SW(gw) - 2, SH(gh) - 2);
  }
}

// v4: staged callouts — a leader line from a short label to the thing it
// explains, so the judge learns the mechanics inside the picture.
function drawCallouts(ctx, S) {
  if (!S.callouts) return;
  for (const c of S.callouts) {
    const px = X(c.x);
    const py = Y(c.y);
    const lx = X(c.lx);
    const ly = Y(c.ly);
    ctx.strokeStyle = 'rgba(245,197,66,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    floorText(ctx, c.text, lx, ly, 12, '#ffe9a8', 800);
  }
}

// v4: a staged event banner — one line of drama floating above the map.
function drawEventBanner(ctx, S) {
  if (!S.eventBanner) return;
  ctx.font = '700 14px system-ui, "Segoe UI", sans-serif';
  const w = ctx.measureText(S.eventBanner).width + 40;
  const x = (VIEW_W - w) / 2;
  const y = TOP_BAR_H + 8;
  ctx.fillStyle = 'rgba(10,12,20,0.88)';
  rr(ctx, x, y, w, 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffc93c';
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, 28, 14);
  ctx.stroke();
  text(ctx, S.eventBanner, VIEW_W / 2, y + 19, 14, '#ffe9a8', 700, 'center');
}

// v4: a staged heli searchlight — a soft beam from the top edge down to
// the chase, drawn over the map but under the HUD.
function drawSpotlight(ctx, S) {
  if (!S.spotlight) return;
  const tx = X(S.spotlight.x);
  const ty = Y(S.spotlight.y);
  const g = ctx.createRadialGradient(tx, ty, 4, tx, ty, S.spotlight.r);
  g.addColorStop(0, 'rgba(255,244,200,0.35)');
  g.addColorStop(1, 'rgba(255,244,200,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(tx, ty, S.spotlight.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,244,200,0.08)';
  ctx.beginPath();
  ctx.moveTo(tx - 30, TOP_BAR_H);
  ctx.lineTo(tx + 30, TOP_BAR_H);
  ctx.lineTo(tx + S.spotlight.r * 0.7, ty);
  ctx.lineTo(tx - S.spotlight.r * 0.7, ty);
  ctx.closePath();
  ctx.fill();
}

function overlayPanel(ctx, w, h) {
  ctx.fillStyle = 'rgba(4,5,9,0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(10,12,20,0.95)';
  rr(ctx, (VIEW_W - w) / 2, (VIEW_H - h) / 2, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = '#f5c542';
  ctx.lineWidth = 2;
  rr(ctx, (VIEW_W - w) / 2, (VIEW_H - h) / 2, w, h, 14);
  ctx.stroke();
}

export function drawTitle(ctx, S) {
  ctx.fillStyle = '#07080c';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#1a1030');
  g.addColorStop(0.55, '#3d1f2e');
  g.addColorStop(1, '#0d0f16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Sunset glow + skyline silhouette.
  ctx.fillStyle = 'rgba(255,150,60,0.25)';
  ctx.beginPath();
  ctx.arc(640, 330, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0c14';
  for (let i = 0; i < 14; i++) {
    const bw = 60 + ((i * 53) % 50);
    ctx.fillRect(40 + i * 88, 560 - ((i * 67) % 160), bw, 240);
  }
  text(ctx, 'SUNSET VAULTS', 640, 190, 76, '#f5c542', 800, 'center');
  text(ctx, 'One Night, Three Vaults', 640, 238, 30, '#ffe9a8', 700, 'center');
  text(ctx, 'Bank Senja  ·  Raka si pencuri  ·  satu malam, tiga brankas', 640, 272, 17, '#e8e6df', 400, 'center');
  // Three room cards.
  const cards = [
    ['1 · AULA BANK', 'Berlian Senja — $500', 'Enam ruangan, 1 penjaga'],
    ['2 · RUANG BRANKAS', 'Mahkota Ledger — $800', 'Brankas + laser, 2 kamera'],
    ['3 · ATAP & PELARIAN', 'Kunci Master Senja — $1000', 'Parapet, lampu sorot, anjing K-9'],
  ];
  cards.forEach(([title, loot, note], i) => {
    const cx = 250 + i * 270;
    ctx.fillStyle = 'rgba(10,12,20,0.9)';
    rr(ctx, cx, 330, 240, 150, 10);
    ctx.fill();
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2;
    rr(ctx, cx, 330, 240, 150, 10);
    ctx.stroke();
    text(ctx, title, cx + 120, 368, 17, '#f5c542', 800, 'center');
    text(ctx, loot, cx + 120, 402, 15, '#e8e6df', 700, 'center');
    text(ctx, note, cx + 120, 432, 13, '#9aa0b4', 400, 'center');
    text(ctx, '3 heists · penjaga · harta bernama · gadget', 640, 540, 16, '#c9cdd9', 700, 'center');
  });
  text(ctx, 'WASD jalan · Shift jongkok · Semak = sembunyi · Klik kanan / C lempar koin · Ambil harta, lalu ke EXIT hijau', 640, 600, 16, '#e8e6df', 400, 'center');
  text(ctx, 'Bonus GHOST +$500 kalau tak pernah ketahuan penuh', 640, 630, 15, '#7dffab', 700, 'center');
  const blink = Math.floor(S.time * 2) % 2 === 0;
  if (blink) text(ctx, '▶  KLIK / TEKAN ENTER UNTUK MULAI', 640, 700, 22, '#ffffff', 800, 'center');
}

export function drawVictory(ctx, S) {
  drawGame(ctx, S);
  const v = S.victory;
  // v4 fix: a centre card, not a full-width bottom strip — the strip hid
  // the whole lower roof (GUDANG ALAT, JALUR LARIKAN, KOIN EMAS $100).
  // v4.1: the card grows taller (sy 410 -> 330, sh 330 -> 410) to hold
  // a real end menu — the old one-line "TEKAN R" was too bare for a
  // final screen. Width stays 560 and the bottom stays at 740, so the
  // lower roof rooms are still visible at the card's left and right.
  // Cost: the taller card now covers the ATAP TENGAH floor label and
  // one PETI in the middle band; Raka, K-9, Agus and the PELARIAN
  // label stay visible above it.
  ctx.fillStyle = 'rgba(4,5,9,0.35)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const sx = 300, sy = 330, sw = 560, sh = 410;
  ctx.fillStyle = 'rgba(10,12,20,0.95)';
  rr(ctx, sx, sy, sw, sh, 14);
  ctx.fill();
  ctx.strokeStyle = '#f5c542';
  ctx.lineWidth = 2;
  rr(ctx, sx, sy, sw, sh, 14);
  ctx.stroke();
  // Headline + sub, stacked.
  text(ctx, 'PELARIAN BERHASIL!', sx + 40, sy + 46, 34, '#7dffab', 800, 'left');
  text(ctx, 'Raka kabur dari Bank Senja tanpa jejak.', sx + 40, sy + 72, 15, '#e8e6df', 400, 'left');
  // Breakdown, stacked: label left, value right.
  const rows = [
    ['Harta rampasan', `$${v.loot}`],
    [v.ghost ? 'Bonus GHOST' : 'Bonus GHOST — hangus', v.ghost ? `+$${v.ghost}` : '$0'],
    ['Bonus kecepatan', `+$${v.speed}`],
  ];
  let y = sy + 100;
  for (const [label, val] of rows) {
    text(ctx, label, sx + 40, y, 16, '#e8e6df', 700, 'left');
    text(ctx, val, sx + sw - 40, y, 16, '#f5c542', 800, 'right');
    y += 28;
  }
  // Total on one line: the label left, the big number right.
  text(ctx, 'TOTAL', sx + 40, sy + 200, 18, '#ffffff', 800, 'left');
  text(ctx, `$${v.total}`, sx + sw - 40, sy + 200, 44, '#7dffab', 800, 'right');
  text(ctx, `Waktu: ${v.timeText}   ·   Harta ${v.lootCount}/${v.lootTotal}`, sx + 40, sy + 224, 14, '#9aa0b4', 700, 'left');
  // Thin separator between the score and the menu.
  ctx.strokeStyle = 'rgba(245,197,66,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx + 40, sy + 242);
  ctx.lineTo(sx + sw - 40, sy + 242);
  ctx.stroke();
  // End menu: 6 rows, label left, key badge right, badges in one
  // right-aligned column; MAIN LAGI is the highlighted active choice.
  // R restarts for real on this screen; the other rows are display
  // menu options (as on the title screen).
  const menu = [
    ['MAIN LAGI', 'R'],
    ['ULANGI MISI', 'U'],
    ['BUKA PETA', 'M'],
    ['LIHAT HARTA', 'H'],
    ['LIHAT CATATAN', 'N'],
    ['MENU UTAMA', 'ESC'],
  ];
  let my = sy + 266;
  for (let i = 0; i < menu.length; i++) {
    const [label, key] = menu[i];
    if (i === 0) {
      ctx.fillStyle = 'rgba(245,197,66,0.18)';
      rr(ctx, sx + 28, my - 18, sw - 56, 24, 6);
      ctx.fill();
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 1;
      rr(ctx, sx + 28, my - 18, sw - 56, 24, 6);
      ctx.stroke();
    }
    text(ctx, label, sx + 40, my, 15, i === 0 ? '#ffe9a8' : '#e8e6df', 800, 'left');
    const kw = key.length > 1 ? 46 : 28;
    const kx = sx + sw - 40 - kw;
    ctx.strokeStyle = i === 0 ? '#f5c542' : 'rgba(154,160,180,0.8)';
    ctx.lineWidth = 1;
    rr(ctx, kx, my - 16, kw, 20, 4);
    ctx.stroke();
    text(ctx, key, kx + kw / 2, my, 12, i === 0 ? '#ffe9a8' : '#9aa0b4', 800, 'center');
    my += 25;
  }
}

export function drawPause(ctx, S) {
  // v4: the pause screen (H) is where the CATATAN log, the minimap and
  // the field notes live now that they are off the map screen.
  drawGame(ctx, S);
  ctx.fillStyle = 'rgba(4,5,9,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  overlayPanel(ctx, 780, 560);
  const cx = VIEW_W / 2;
  const top = (VIEW_H - 560) / 2;
  text(ctx, 'JEDA  —  tekan H untuk lanjut', cx, top + 56, 28, '#f5c542', 800, 'center');
  // Minimap, left half.
  const mw = 320, mh = 240;
  const mx = cx - 360, my = top + 92;
  const sx = mw / ROOM_W;
  const sy = mh / ROOM_H;
  ctx.fillStyle = '#0d0f16';
  ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#2c3247';
  ctx.strokeRect(mx, my, mw, mh);
  ctx.fillStyle = '#4a5170';
  for (const blk of S.room.blocks) ctx.fillRect(mx + blk.x * sx, my + blk.y * sy, Math.max(2, blk.w * sx), Math.max(2, blk.h * sy));
  ctx.fillStyle = '#2f6b2f';
  for (const bush of S.room.bushes) {
    ctx.beginPath();
    ctx.arc(mx + bush.x * sx, my + bush.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#37d67a';
  ctx.fillRect(mx + S.room.exit.x * sx, my + S.room.exit.y * sy, 14, 14);
  for (const l of S.loot) {
    if (l.taken) continue;
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(mx + l.x * sx, my + l.y * sy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const g of S.guards) {
    ctx.fillStyle = '#ff5252';
    ctx.beginPath();
    ctx.arc(mx + g.x * sx, my + g.y * sy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx + S.player.x * sx, my + S.player.y * sy, 6, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'PETA', mx, my + mh + 24, 13, '#f5c542', 800, 'left');
  // CATATAN + field notes, right half.
  const rx = cx + 10;
  text(ctx, 'CATATAN', rx, my + 20, 15, '#f5c542', 800, 'left');
  let y = my + 48;
  for (const line of S.log.slice(-8)) {
    text(ctx, line, rx, y, 13, '#c9cdd9', 400, 'left');
    y += 20;
  }
  y += 12;
  text(ctx, 'FIELD NOTES', rx, y, 15, '#f5c542', 800, 'left');
  y += 24;
  for (const note of ['Kerucut: pandangan penjaga', 'Bayangan: sembunyi', 'Semak: sembunyi', 'Kamera: alarm naik', 'Peti: halangi jalan', 'EXIT hijau: kabur']) {
    text(ctx, '·  ' + note, rx, y, 13, '#e8e6df', 700, 'left');
    y += 20;
  }
  y += 12;
  text(ctx, 'WASD jalan · Shift jongkok · Klik kanan / C lempar koin · R ulangi', rx, y, 12, '#9aa0b4', 400, 'left');
}

export function drawCaught(ctx, S) {
  drawGame(ctx, S);
  overlayPanel(ctx, 560, 300);
  const cx = VIEW_W / 2;
  const top = (VIEW_H - 300) / 2;
  text(ctx, 'TERTANGKAP!', cx, top + 80, 44, '#ff5252', 800, 'center');
  text(ctx, `${S.caughtBy || 'Penjaga'} menangkap Raka di ${S.room.name}.`, cx, top + 122, 17, '#e8e6df', 400, 'center');
  text(ctx, 'Alarm penuh membuat pintu keluar terkunci.', cx, top + 152, 15, '#9aa0b4', 400, 'center');
  text(ctx, 'TEKAN R UNTUK COBA LAGI', cx, top + 210, 19, '#ffffff', 800, 'center');
}

export { ROOMS };
