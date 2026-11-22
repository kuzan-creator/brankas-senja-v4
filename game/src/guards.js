// Sunset Vaults — guards, cameras and detection. One job: the brains that
// watch the room. A guard patrols, grows suspicious when the thief crosses
// its cone in the open, investigates a thrown coin, and chases when the
// alarm is full. A camera sweeps and feeds the same suspicion meter.
import { CONE_FOV, CAM_FOV, GUARD_SPEED, CHASE_SPEED, DOG_SPEED, ROOM_W, ROOM_H } from './config.js';
import { lineOfSight, angleTo, angleDiff, clamp, moveCircle } from './geometry.js';

// What each guard says when he gets suspicious, hears a coin, or gives
// chase — named speech, not a bare "?" (render.js draws these in bubbles).
const GUARD_LINES = {
  BUDI: {
    suspicious: 'Raka? Siapa itu?',
    investigate: 'Denting koin? Aku cek.',
    chase: 'BERHENTI, RAKA!',
  },
  SARI: {
    suspicious: 'Suara apa itu?',
    investigate: 'Ada yang jatuh? Aku lihat.',
    chase: 'BERHENTI! JANGAN LARI!',
  },
  AGUS: {
    suspicious: 'Aku dengar sesuatu...',
    investigate: 'Hmm, suara koin?',
    chase: 'KETAHUAN! BERHENTI!',
  },
  'K-9': {
    suspicious: 'Grr… ada orang!',
    investigate: 'Hmm? Bau koin?',
    chase: 'GUK GUK! DAPAT!',
  },
};

export function guardLine(name, state) {
  const lines = GUARD_LINES[name] || GUARD_LINES.BUDI;
  if (state === 'chase') return lines.chase;
  if (state === 'investigate') return lines.investigate;
  return lines.suspicious;
}

export function makeGuard(def) {
  return {
    name: def.name, role: def.role, dog: !!def.dog,
    x: def.x, y: def.y, angle: angleTo(def.x, def.y, def.patrol[0][0], def.patrol[0][1]),
    patrol: def.patrol, wp: 0, wait: 0,
    speed: def.speed || GUARD_SPEED,
    range: def.range, fov: def.fov || CONE_FOV,
    suspicion: 0, state: 'patrol', // patrol | suspicious | investigate | chase
    lastSeen: null, lookTimer: 0, investigate: null,
  };
}

export function makeCamera(def) {
  return {
    x: def.x, y: def.y, base: def.angle, sweep: def.sweep, speed: def.speed,
    range: def.range, angle: def.angle, t: Math.random() * 6,
    suspicion: 0,
  };
}

function guardSeesPlayer(g, player, blocks) {
  const d = Math.hypot(player.x - g.x, player.y - g.y);
  if (d > g.range) return 0;
  const a = angleTo(g.x, g.y, player.x, player.y);
  if (Math.abs(angleDiff(a, g.angle)) > g.fov / 2) return 0;
  if (!lineOfSight(g.x, g.y, player.x, player.y, blocks, ROOM_W, ROOM_H)) return 0;
  return 1 - (d / g.range) * 0.5;
}

function cameraSeesPlayer(c, player, blocks) {
  const d = Math.hypot(player.x - c.x, player.y - c.y);
  if (d > c.range) return 0;
  const a = angleTo(c.x, c.y, player.x, player.y);
  if (Math.abs(angleDiff(a, c.angle)) > CAM_FOV / 2) return 0;
  if (!lineOfSight(c.x, c.y, player.x, player.y, blocks, ROOM_W, ROOM_H)) return 0;
  return 1 - (d / c.range) * 0.5;
}

function stepToward(g, tx, ty, speed, dt, blocks) {
  const d = Math.hypot(tx - g.x, ty - g.y);
  if (d < 4) return true;
  const vx = ((tx - g.x) / d) * speed * dt;
  const vy = ((ty - g.y) / d) * speed * dt;
  const next = moveCircle(g.x, g.y, vx, vy, 13, blocks, ROOM_W, ROOM_H);
  g.x = next.x;
  g.y = next.y;
  g.angle = angleTo(g.x, g.y, tx, ty);
  return d < 8;
}

// Update every guard and camera for one frame. Returns the frame's events
// (a guard spotting the thief, a camera locking on) for the log and sound.
export function updateWatchers(S, dt) {
  const events = [];
  const blocks = S.room.blocks;
  const vis = S.visibility; // 0..1, how exposed the thief is right now
  let maxSuspicion = 0;

  for (const g of S.guards) {
    const seen = guardSeesPlayer(g, S.player, blocks);
    if (seen > 0) {
      g.suspicion = clamp(g.suspicion + 55 * seen * vis * dt, 0, 100);
      g.lastSeen = { x: S.player.x, y: S.player.y };
      if (g.suspicion > 35 && g.state === 'patrol') {
        g.state = 'suspicious';
        events.push({ type: 'suspicious', who: g.name });
      }
      if (g.suspicion > 80 && g.state !== 'chase') {
        g.state = 'chase';
        S.everDetected = true;
        events.push({ type: 'chase', who: g.name });
      }
    } else {
      g.suspicion = clamp(g.suspicion - 20 * dt, 0, 100);
      if (g.suspicion < 25 && g.state === 'suspicious') g.state = 'patrol';
      if (g.suspicion < 60 && g.state === 'chase') g.state = 'patrol';
    }
    maxSuspicion = Math.max(maxSuspicion, g.suspicion);

    if (g.state === 'patrol') {
      if (g.wait > 0) {
        g.wait -= dt;
      } else {
        const [tx, ty] = g.patrol[g.wp];
        if (stepToward(g, tx, ty, g.speed, dt, blocks)) {
          g.wp = (g.wp + 1) % g.patrol.length;
          g.wait = 1.1;
        }
      }
    } else if (g.state === 'suspicious' && g.lastSeen) {
      const arrived = stepToward(g, g.lastSeen.x, g.lastSeen.y, g.speed * 1.25, dt, blocks);
      if (arrived) {
        g.lookTimer += dt;
        g.angle += dt * 1.6; // scans the spot where the thief was
        if (g.lookTimer > 2.2) { g.lookTimer = 0; g.state = 'patrol'; }
      }
    } else if (g.state === 'investigate' && g.investigate) {
      const arrived = stepToward(g, g.investigate.x, g.investigate.y, g.speed * 1.4, dt, blocks);
      if (arrived) {
        g.lookTimer += dt;
        g.angle += dt * 2.0;
        if (g.lookTimer > 2.4) { g.lookTimer = 0; g.investigate = null; g.state = 'patrol'; }
      }
    } else if (g.state === 'chase') {
      stepToward(g, S.player.x, S.player.y, g.dog ? DOG_SPEED + 40 : CHASE_SPEED, dt, blocks);
      if (Math.hypot(S.player.x - g.x, S.player.y - g.y) < 20) {
        events.push({ type: 'caught', who: g.name });
      }
    }
  }

  for (const c of S.cameras) {
    c.t += dt;
    c.angle = c.base + Math.sin(c.t * c.speed) * c.sweep;
    const seen = cameraSeesPlayer(c, S.player, blocks);
    if (seen > 0) {
      c.suspicion = clamp(c.suspicion + 70 * seen * vis * dt, 0, 100);
      if (c.suspicion > 80) S.everDetected = true;
    } else {
      c.suspicion = clamp(c.suspicion - 26 * dt, 0, 100);
    }
    maxSuspicion = Math.max(maxSuspicion, c.suspicion);
  }

  S.detection = Math.round(maxSuspicion);
  return events;
}

// A thrown coin: the nearest guard on patrol walks over to listen.
export function sendGuardToCoin(S, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const g of S.guards) {
    if (g.state === 'chase') continue;
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < bestD) { bestD = d; best = g; }
  }
  if (best) {
    best.state = 'investigate';
    best.investigate = { x, y };
    best.lookTimer = 0;
    return best.name;
  }
  return null;
}
