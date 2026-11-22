// Sunset Vaults — geometry helpers. One job: walls, sight lines and
// vision cones. Everything here is pure math over rectangles, so the
// selftest can check it without a canvas.
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function circleHitsRect(cx, cy, cr, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}

// Is the point blocked by a wall, a piece of furniture, or the room edge?
export function pointBlocked(px, py, blocks, w, h) {
  if (px < 0 || py < 0 || px > w || py > h) return true;
  for (const b of blocks) if (pointInRect(px, py, b)) return true;
  return false;
}

// Walk a ray in small steps; return the distance to the first blocker.
export function raycast(x, y, angle, maxDist, blocks, w, h) {
  const step = 4;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = step; d <= maxDist; d += step) {
    if (pointBlocked(x + dx * d, y + dy * d, blocks, w, h)) return d;
  }
  return maxDist;
}

// True when nothing solid stands between the two points.
export function lineOfSight(x1, y1, x2, y2, blocks, w, h) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(dist / 5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointBlocked(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, blocks, w, h)) return false;
  }
  return true;
}

// Vision cone as a polygon: the eye plus one raycast point per slice.
export function conePolygon(x, y, angle, fov, range, blocks, w, h) {
  const slices = 16;
  const pts = [{ x, y }];
  for (let i = 0; i <= slices; i++) {
    const a = angle - fov / 2 + (fov * i) / slices;
    const d = raycast(x, y, a, range, blocks, w, h);
    pts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return pts;
}

// Move a circle against the blocks; slide along a wall instead of sticking.
export function moveCircle(px, py, dx, dy, r, blocks, w, h) {
  let nx = px + dx;
  let ny = py + dy;
  for (const b of blocks) {
    if (circleHitsRect(nx, py, r, b)) nx = px;
    if (circleHitsRect(px, ny, r, b)) ny = py;
  }
  nx = Math.max(r, Math.min(w - r, nx));
  ny = Math.max(r, Math.min(h - r, ny));
  return { x: nx, y: ny };
}

// Does the segment cross a laser line? Sampled, same step as sight lines.
export function segmentCrossesLaser(x1, y1, x2, y2, laser) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 3));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    if (pointNearSegment(px, py, laser, 7)) return true;
  }
  return false;
}

export function pointNearSegment(px, py, seg, tol) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - seg.x1) * dx + (py - seg.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = seg.x1 + dx * t;
  const cy = seg.y1 + dy * t;
  return Math.hypot(px - cx, py - cy) <= tol;
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
