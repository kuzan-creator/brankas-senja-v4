// Sunset Vaults — game state and loop. One job: own the state, run one
// frame at a time (move, watch, alarm, loot, win, lose) and hand the
// drawing to render.js. The ?shot= scenes and the selftest live in
// shots.js so this file stays the live game only.
import { ROOM_X, ROOM_Y, ROOM_W, ROOM_H, SX, SY, WALK_SPEED, SNEAK_SPEED, PLAYER_R, GHOST_BONUS, SPEED_BONUS_MAX, ALARM_LOCKDOWN_SECONDS } from './config.js';
import { ROOMS } from './levels.js';
import { makeGuard, makeCamera, updateWatchers, sendGuardToCoin, guardLine } from './guards.js';
import { moveCircle, pointInRect, segmentCrossesLaser, clamp } from './geometry.js';
import { createInput, axis } from './input.js';
import { ensureAudio, sfx } from './audio.js';
import { drawGame, drawTitle, drawVictory, drawCaught, drawPause } from './render.js';
import { stageShot, runSelftest } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput(canvas);

export function newState() {
  return {
    screen: 'title', // title | play | pause | caught | victory
    roomIndex: 0,
    room: ROOMS[0],
    player: { x: 70, y: 640, dir: -Math.PI / 2, sneak: false },
    guards: [], cameras: [], loot: [],
    coins: 3, coinFx: null,
    money: 0, moneyAtRoomStart: 0,
    lootGot: 0, lootTotal: 0, allLoot: false,
    roomsLootGot: [0, 0, 0], // harta per ruangan, kumulatif sepanjang malam
    detection: 0, alarm: 0, visibility: 0, noise: 0,
    time: 0, totalTime: 0,
    everDetected: false, lockdown: 0,
    log: [], floats: [],
    victory: null, caughtBy: null,
    playerHidden: false,
    frozen: false,
    camY: 0, // vertical camera scroll: 0..(ROOM_H - ROOM_PX_H), follows the thief
    lastStep: 0,
  };
}

const S = newState();
S.loadRoom = loadRoom;

function log(line) {
  S.log.push(line);
  if (S.log.length > 12) S.log.shift();
  statusEl.textContent = line;
}

function loadRoom(i) {
  // Ulangi ruangan yang sama (R / tertangkap): hitungan harta ruangan itu
  // di-nol-kan lagi, karena hartanya muncul kembali. Pindah ruangan: hitungan
  // ruangan lama tetap.
  if (S.room && S.roomIndex === i && S.roomsLootGot) S.roomsLootGot[i] = 0;
  const def = ROOMS[i];
  S.roomIndex = i;
  S.room = def;
  S.player = { x: def.spawn.x, y: def.spawn.y, dir: -Math.PI / 2, sneak: false };
  S.guards = def.guards.map(makeGuard);
  S.cameras = def.cameras.map(makeCamera);
  S.loot = def.loot.map((l) => ({ ...l, taken: false }));
  S.lootTotal = S.loot.length;
  S.lootGot = 0;
  S.allLoot = false;
  S.moneyAtRoomStart = S.money;
  S.detection = 0;
  S.alarm = 0;
  S.noise = 0;
  S.lockdown = 0;
  S.camY = 0;
  S.coinFx = null;
  S.floats = [];
  log(`Raka masuk ${def.name}.`);
}

function inShadow(px, py) {
  return S.room.shadows.some((s) => Math.hypot(px - s.x, py - s.y) < s.r);
}

function inBush(px, py) {
  return S.room.bushes.some((b) => Math.hypot(px - b.x, py - b.y) < b.r);
}

function tryPickup() {
  for (const l of S.loot) {
    if (l.taken) continue;
    if (Math.hypot(S.player.x - l.x, S.player.y - l.y) < 30) {
      l.taken = true;
      S.lootGot += 1;
      S.roomsLootGot[S.roomIndex] += 1;
      S.money += l.value;
      S.noise = clamp(S.noise + 0.35, 0, 1);
      S.floats.push({ x: l.x, y: l.y - 10, text: `+$${l.value}`, color: '#7dffab', t: 0 });
      log(`${l.name} diambil +$${l.value}.`);
      sfx.pickup();
      if (S.lootGot === S.lootTotal) {
        S.allLoot = true;
        log('SEMUA HARTA — KE EXIT HIJAU!');
      }
      return true;
    }
  }
  return false;
}

function throwCoin(roomX, roomY) {
  if (S.coins <= 0) { log('Koin habis!'); return; }
  S.coins -= 1;
  S.coinFx = { x: roomX, y: roomY, t: 0 };
  S.noise = clamp(S.noise + 0.6, 0, 1);
  const who = sendGuardToCoin(S, roomX, roomY);
  log(who ? `${who} mendengar denting koin…` : 'Koin berdenting di lantai.');
  sfx.coin();
}

function roomCleared() {
  if (S.roomIndex + 1 < ROOMS.length) {
    log(`${S.room.name} selesai!`);
    loadRoom(S.roomIndex + 1);
    return;
  }
  const loot = S.money;
  const ghost = S.everDetected ? 0 : GHOST_BONUS;
  const over = Math.max(0, S.totalTime - 180);
  const speed = Math.max(0, SPEED_BONUS_MAX - Math.floor(over / 10) * 10);
  const mm = String(Math.floor(S.totalTime / 60)).padStart(2, '0');
  const ss = String(Math.floor(S.totalTime % 60)).padStart(2, '0');
  S.victory = {
    loot, ghost, speed, total: loot + ghost + speed,
    timeText: `${mm}:${ss}`,
    lootCount: S.roomsLootGot.reduce((a, b) => a + b, 0),
    lootTotal: ROOMS.reduce((a, r) => a + r.loot.length, 0),
  };
  S.screen = 'victory';
  sfx.win();
  log(`PELARIAN BERHASIL — total $${S.victory.total}.`);
}

function update(dt) {
  S.time += dt;
  S.totalTime += dt;
  const p = S.player;

  // Movement — remember where the step started so lasers see a crossing.
  const a = axis(input);
  p.sneak = input.keys.has('Shift');
  const speed = p.sneak ? SNEAK_SPEED : WALK_SPEED;
  const prevX = p.x;
  const prevY = p.y;
  if (a.x || a.y) {
    p.dir = Math.atan2(a.y, a.x);
    const next = moveCircle(p.x, p.y, a.x * speed * dt, a.y * speed * dt, PLAYER_R, S.room.blocks, ROOM_W, ROOM_H);
    const moved = Math.hypot(next.x - p.x, next.y - p.y);
    p.x = next.x;
    p.y = next.y;
    S.lastStep += moved;
    if (S.lastStep > 46) { S.lastStep = 0; sfx.step(); }
  }

  // v3: the whole map fits in one frame — no camera scroll at all.
  S.camY = 0;

  // How exposed is the thief right now? A bush hides a sneaking thief
  // just like a shadow does — guards see almost nothing of him there.
  const shadow = inShadow(p.x, p.y);
  const bush = inBush(p.x, p.y);
  S.playerHidden = p.sneak && (shadow || bush);
  S.visibility = (p.sneak ? 0.45 : 1) * ((shadow || bush) ? 0.55 : 1);
  S.noise = clamp(S.noise - 0.55 * dt, 0, 1);

  // Guards and cameras watch.
  const events = updateWatchers(S, dt);
  for (const ev of events) {
    if (ev.type === 'suspicious') { log(`${ev.who}: "${guardLine(ev.who, 'suspicious')}"`); sfx.suspicious(); }
    if (ev.type === 'chase') { log(`${ev.who} MENGEJAR Raka!`); sfx.alarm(); }
    if (ev.type === 'caught') {
      S.caughtBy = ev.who;
      S.screen = 'caught';
      sfx.caught();
      log(`TERTANGKAP oleh ${ev.who}!`);
    }
  }

  // Alarm: climbs while anyone is close to a full spot, drains in hiding.
  if (S.detection > 70) S.alarm = clamp(S.alarm + 14 * dt, 0, 100);
  else S.alarm = clamp(S.alarm - 3 * dt, 0, 100);
  if (S.alarm >= 100 && S.lockdown <= 0) {
    S.lockdown = ALARM_LOCKDOWN_SECONDS;
    log('ALARM PENUH — pintu terkunci!');
    sfx.alarm();
  }
  if (S.lockdown > 0) {
    S.lockdown -= dt;
    if (S.lockdown <= 0) { S.lockdown = 0; S.alarm = 55; log('Pintu terbuka lagi. Cepat!'); }
  }

  // Lasers: crossing one spikes the alarm.
  for (const lz of S.room.lasers) {
    if (segmentCrossesLaser(prevX, prevY, p.x, p.y, lz) || pointNearLaser(p, lz)) {
      if (!S._laserHit || S.time - S._laserHit > 1.5) {
        S._laserHit = S.time;
        S.alarm = clamp(S.alarm + 25, 0, 100);
        S.noise = 1;
        log('LASER TERSENTUH — alarm naik!');
        sfx.laser();
      }
    }
  }

  // Coin throw (left or right click): canvas pixels -> world coords.
  // v3: the whole map is on screen, so both axes scale by the same factor.
  if (input.clicked && S.screen === 'play') {
    const cx = (input.clicked.x - ROOM_X) / SX;
    const cy = (input.clicked.y - ROOM_Y) / SY;
    input.clicked = null;
    if (cx >= 0 && cy >= 0 && cx <= ROOM_W && cy <= ROOM_H) throwCoin(cx, cy);
  } else {
    input.clicked = null;
  }

  tryPickup();

  // Exit.
  const e = S.room.exit;
  if (S.allLoot && S.lockdown <= 0 && pointInRect(p.x, p.y, { x: e.x - 8, y: e.y - 8, w: e.w + 16, h: e.h + 16 })) {
    roomCleared();
  }

  // Floating texts and the coin ring.
  for (const f of S.floats) f.t += dt;
  S.floats = S.floats.filter((f) => f.t < 1.6);
  if (S.coinFx) {
    S.coinFx.t += dt;
    if (S.coinFx.t > 1.1) S.coinFx = null;
  }
}

function pointNearLaser(p, lz) {
  const dx = lz.x2 - lz.x1;
  const dy = lz.y2 - lz.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - lz.x1) * dx + (p.y - lz.y1) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (lz.x1 + dx * t), p.y - (lz.y1 + dy * t)) < 12;
}

function throwCoinAtMouse() {
  if (!input.mouse.inside) return;
  const wx = (input.mouse.x - ROOM_X) / SX;
  const wy = (input.mouse.y - ROOM_Y) / SY;
  if (wx >= 0 && wy >= 0 && wx <= ROOM_W && wy <= ROOM_H) throwCoin(wx, wy);
}

function handleKeys() {
  for (const k of input.pressed) {
    if (k === 'Enter' || k === ' ') {
      if (S.screen === 'title') { ensureAudio(); S.screen = 'play'; loadRoom(0); log('Malam dimulai. Jangan ketahuan.'); }
    }
    // C throws a coin at the mouse — the lure, without touching the mouse.
    if (k === 'c' || k === 'C') {
      if (S.screen === 'play') throwCoinAtMouse();
    }
    // H pauses: the CATATAN log, minimap and field notes live on the
    // pause screen now (v4: off the map screen).
    if (k === 'h' || k === 'H') {
      if (S.screen === 'play') S.screen = 'pause';
      else if (S.screen === 'pause') S.screen = 'play';
    }
    if (k === 'r' || k === 'R') {
      if (S.screen === 'caught') { S.money = S.moneyAtRoomStart; S.screen = 'play'; loadRoom(S.roomIndex); }
      else if (S.screen === 'victory') { Object.assign(S, newState()); S.loadRoom = loadRoom; S.screen = 'play'; loadRoom(0); }
      else if (S.screen === 'play') { S.money = S.moneyAtRoomStart; loadRoom(S.roomIndex); }
    }
  }
  input.pressed.clear();
  if (input.clicked && S.screen === 'title') {
    ensureAudio();
    input.clicked = null;
    S.screen = 'play';
    loadRoom(0);
    log('Malam dimulai. Jangan ketahuan.');
  }
}

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  handleKeys();
  if (S.screen === 'play' && !S.frozen) update(dt);
  else if (S.screen === 'title' && !S.frozen) S.time += dt;
  if (S.screen === 'title') drawTitle(ctx, S);
  else if (S.screen === 'victory') drawVictory(ctx, S);
  else if (S.screen === 'caught') drawCaught(ctx, S);
  else if (S.screen === 'pause') drawPause(ctx, S);
  else drawGame(ctx, S);
  requestAnimationFrame(frame);
}

// Boot.
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (params.get('selftest') === '1') {
  runSelftest(S, { loadRoom, tryPickup, throwCoin, throwCoinAtMouse, update, pointNearLaser, input });
} else if (shot) {
  stageShot(S, shot);
  S.frozen = true;
  // v4: the 'title' shot now stages roof gameplay (the title screen is
  // still in the game, just not screenshotted) — only force the title
  // blink time when the shot really shows the title screen.
  if (shot === 'title' && S.screen === 'title') S.time = 1.0;
} else {
  loadRoom(0);
}
requestAnimationFrame(frame);
