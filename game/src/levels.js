// Sunset Vaults v2.2 — the three rooms of Bank Senja as FLOOR PLANS. One job: data only.
// v2.2 (kuzan: "map-nya tidak terlalu bagus — buat ruangan yang dikelilingi
// tembok, mirip top rank 1-5"): every room is now 6 chambers + a central
// hall, divided by wall bands with door gaps — a readable floor plan, like
// the top-rank stealth maps. Walls block movement AND vision (raycast cones
// and line-of-sight both stop at blocks). Patrol routes go through the door
// gaps only — verified by /tmp/check-v2.mjs, run it after any layout change.
// Map stays 1600x1200 (v2.1), contents ~15% shrunk.
import { ROOM_W, ROOM_H } from './config.js';

// The shared floor plan: two horizontal wall bands (y 400, y 800) with two
// WIDE door gaps each (160), and four vertical walls with a wide door gap
// each (120) — the middle passages are roomy, not pinched. Six chambers
// (top-left / top-middle / top-right / bottom-left / bottom-middle /
// bottom-right) around one open central hall (y 426..800). The bottom band
// has four more walls of its own, so the lower half is not empty.
const PLAN_WALLS = [
  { x: 0, y: 400, w: 480, h: 26, kind: 'wall' },
  { x: 640, y: 400, w: 360, h: 26, kind: 'wall' },
  { x: 1160, y: 400, w: 440, h: 26, kind: 'wall' },
  { x: 0, y: 800, w: 480, h: 26, kind: 'wall' },
  { x: 640, y: 800, w: 360, h: 26, kind: 'wall' },
  { x: 1160, y: 800, w: 440, h: 26, kind: 'wall' },
  { x: 533, y: 0, w: 26, h: 160, kind: 'wall' },
  { x: 1066, y: 0, w: 26, h: 160, kind: 'wall' },
  { x: 533, y: 800, w: 26, h: 80, kind: 'wall' },
  { x: 533, y: 1000, w: 26, h: 200, kind: 'wall' },
  { x: 1066, y: 800, w: 26, h: 80, kind: 'wall' },
  { x: 1066, y: 1000, w: 26, h: 200, kind: 'wall' },
  { x: 100, y: 1080, w: 250, h: 26, kind: 'wall' },
  { x: 1200, y: 1120, w: 200, h: 26, kind: 'wall' },
  { x: 900, y: 1000, w: 26, h: 200, kind: 'wall' },
  { x: 650, y: 1120, w: 300, h: 26, kind: 'wall' },
  // One big L wall in the empty hall: a 400-long arm with a 126-tall leg.
  { x: 300, y: 700, w: 400, h: 26, kind: 'wall' },
  { x: 300, y: 700, w: 26, h: 126, kind: 'wall' },
  // A second L in the hall's upper-left, and a U in the hall's right side —
  // the U's pocket opens upward, the L's pocket opens toward the hall.
  { x: 150, y: 550, w: 300, h: 26, kind: 'wall' },
  { x: 150, y: 550, w: 26, h: 150, kind: 'wall' },
  { x: 1150, y: 750, w: 300, h: 26, kind: 'wall' },
  { x: 1150, y: 600, w: 26, h: 150, kind: 'wall' },
  { x: 1424, y: 600, w: 26, h: 150, kind: 'wall' },
];

const PLAN_PILLARS = [
  { x: 200, y: 120, w: 40, h: 40, kind: 'pillar' },
  { x: 1400, y: 120, w: 40, h: 40, kind: 'pillar' },
  { x: 200, y: 1000, w: 40, h: 40, kind: 'pillar' },
  { x: 1400, y: 1000, w: 40, h: 40, kind: 'pillar' },
];

export const ROOMS = [
  {
    id: 'aula',
    name: 'AULA BANK',
    sub: 'Ruang 1 dari 3 — malam, lampion menyala',
    floor: 'marble',
    spawn: { x: 70, y: 1100 },
    exit: { x: 1480, y: 1080, w: 62, h: 60, label: 'EXIT' },
    blocks: [
      ...PLAN_WALLS,
      ...PLAN_PILLARS,
      { x: 200, y: 180, w: 140, h: 42, kind: 'desk', label: 'MEJA TELLER' },
      { x: 1250, y: 180, w: 140, h: 42, kind: 'desk', label: 'MEJA TELLER' },
      { x: 850, y: 600, w: 190, h: 32, kind: 'counter', label: 'KONTER' },
      // Palace chests: real obstacles — they block movement and sight
      // like walls (checked by the validator). Placed to narrow the
      // hall and the chambers without sealing any door gap or patrol.
      { x: 1000, y: 300, w: 110, h: 44, kind: 'crate', label: 'PETI' },
      { x: 950, y: 950, w: 110, h: 44, kind: 'crate', label: 'PETI' },
      { x: 180, y: 500, w: 110, h: 44, kind: 'crate', label: 'PETI' },
      { x: 90, y: 1100, w: 56, h: 56, kind: 'planter' },
      { x: 1500, y: 950, w: 56, h: 56, kind: 'planter' },
    ],
    lamps: [
      { x: 300, y: 200, r: 150 },
      { x: 1300, y: 200, r: 150 },
      { x: 800, y: 600, r: 170 },
      { x: 1450, y: 1000, r: 130 },
    ],
    shadows: [
      { x: 300, y: 1000, r: 62 },
      { x: 1300, y: 1000, r: 62 },
      { x: 70, y: 950, r: 55 },
    ],
    // Bushes (Mobile Legends style): dense grass a sneaking thief hides in.
    bushes: [
      { x: 560, y: 600, r: 55 },
      { x: 200, y: 300, r: 50 },
      { x: 1300, y: 1050, r: 50 },
    ],
    // Room names painted on the floor — the whole plan reads at a glance.
    labels: [
      { x: 400, y: 90, text: 'RUANG TELLER' },
      { x: 800, y: 320, text: 'AULA BANK' },
      { x: 1333, y: 200, text: 'RUANG KAS' },
      { x: 1030, y: 470, text: 'AULA UTAMA' },
      { x: 266, y: 900, text: 'ARSIP' },
      { x: 800, y: 900, text: 'GUDANG' },
      { x: 1333, y: 900, text: 'RUANG JAGA' },
    ],
    loot: [
      { x: 1250, y: 560, name: 'BERLIAN SENJA', value: 500, kind: 'diamond', pedestal: true },
      { x: 300, y: 300, name: 'KOIN EMAS', value: 100, kind: 'coin' },
      { x: 800, y: 1050, name: 'KOIN EMAS', value: 100, kind: 'coin' },
    ],
    guards: [
      {
        name: 'BUDI', role: 'Penjaga Aula', x: 800, y: 600,
        patrol: [[800, 600], [600, 600], [600, 240], [800, 240], [1200, 240], [1300, 240], [1200, 240], [800, 240], [600, 240], [600, 600]],
        range: 265, fov: 1.22, speed: 62,
      },
    ],
    cameras: [
      { x: 1550, y: 20, angle: Math.PI * 0.75, sweep: 0.9, speed: 0.45, range: 380 },
    ],
    lasers: [],
    ironDoor: null,
  },
  {
    id: 'brankas',
    name: 'RUANG BRANKAS',
    sub: 'Ruang 2 dari 3 — laser dan pintu besi',
    floor: 'steel',
    spawn: { x: 70, y: 1100 },
    exit: { x: 60, y: 60, w: 62, h: 60, label: 'EXIT' },
    blocks: [
      { x: 700, y: 40, w: 200, h: 60, kind: 'vaultdoor', label: 'PINTU BESI' },
      ...PLAN_WALLS,
      ...PLAN_PILLARS,
      { x: 200, y: 470, w: 120, h: 40, kind: 'crate', label: 'PETI ARSIP' },
      { x: 1280, y: 500, w: 120, h: 40, kind: 'crate', label: 'PETI ARSIP' },
      { x: 950, y: 950, w: 110, h: 44, kind: 'crate', label: 'PETI' },
      { x: 450, y: 950, w: 110, h: 44, kind: 'crate', label: 'PETI' },
      { x: 760, y: 640, w: 120, h: 40, kind: 'desk', label: 'MEJA CATATAN' },
    ],
    lamps: [
      { x: 800, y: 140, r: 160 },
      { x: 200, y: 900, r: 140 },
      { x: 1400, y: 900, r: 140 },
    ],
    shadows: [
      { x: 260, y: 600, r: 60 },
      { x: 1350, y: 600, r: 60 },
      { x: 70, y: 950, r: 55 },
    ],
    // Bushes (Mobile Legends style): dense grass a sneaking thief hides in.
    bushes: [
      { x: 240, y: 750, r: 50 },
      { x: 800, y: 900, r: 50 },
      { x: 1400, y: 300, r: 50 },
    ],
    // Room names painted on the floor — the whole plan reads at a glance.
    labels: [
      { x: 266, y: 90, text: 'ARSIP LAMA' },
      { x: 800, y: 320, text: 'BRANKAS UTAMA' },
      { x: 1333, y: 200, text: 'RUANG LASER' },
      { x: 1030, y: 470, text: 'KORIDOR BRANKAS' },
      { x: 330, y: 900, text: 'ARSIP BAWAH' },
      { x: 800, y: 1013, text: 'RUANG BERKAS' },
      { x: 1333, y: 900, text: 'RUANG KUNCI' },
    ],
    loot: [
      { x: 800, y: 140, name: 'MAHKOTA LEDGER', value: 800, kind: 'crown' },
      { x: 1380, y: 980, name: 'KITAB EMAS BANK', value: 400, kind: 'book' },
      { x: 300, y: 1020, name: 'KOIN EMAS', value: 100, kind: 'coin' },
    ],
    guards: [
      {
        name: 'SARI', role: 'Penjaga Brankas', x: 800, y: 600,
        patrol: [[800, 600], [600, 600], [600, 240], [800, 240], [600, 240], [600, 600], [1120, 600], [1120, 1050], [1300, 1050], [1120, 1050], [1120, 600]],
        range: 250, fov: 1.22, speed: 66,
      },
    ],
    cameras: [
      { x: 20, y: 600, angle: 0, sweep: 1.0, speed: 0.5, range: 300 },
      { x: 1580, y: 600, angle: Math.PI, sweep: 1.0, speed: 0.4, range: 300 },
    ],
    // The laser rectangle guards the crown in the top-middle vault chamber.
    lasers: [
      { x1: 700, y1: 210, x2: 900, y2: 210 },
      { x1: 700, y1: 240, x2: 900, y2: 240 },
      { x1: 700, y1: 180, x2: 700, y2: 240 },
      { x1: 900, y1: 180, x2: 900, y2: 240 },
    ],
    ironDoor: { x: 700, y: 40, w: 200, h: 60 },
  },
  {
    id: 'atap',
    name: 'ATAP & PELARIAN',
    sub: 'Ruang 3 dari 3 — langit malam, lampu sorot',
    floor: 'roof',
    spawn: { x: 70, y: 1100 },
    exit: { x: 1480, y: 60, w: 62, h: 60, label: 'PELARIAN' },
    blocks: [
      ...PLAN_WALLS,
      ...PLAN_PILLARS,
      { x: 350, y: 120, w: 90, h: 70, kind: 'vent', label: 'VENTILASI' },
      { x: 1150, y: 120, w: 90, h: 70, kind: 'vent', label: 'VENTILASI' },
      { x: 300, y: 1000, w: 70, h: 70, kind: 'vent', label: 'VENTILASI' },
      { x: 1250, y: 1100, w: 70, h: 70, kind: 'vent', label: 'VENTILASI' },
      { x: 720, y: 660, w: 120, h: 46, kind: 'crate', label: 'PETI ALAT' },
      { x: 1000, y: 300, w: 110, h: 44, kind: 'crate', label: 'PETI' },
      { x: 150, y: 830, w: 110, h: 44, kind: 'crate', label: 'PETI' },
      { x: 950, y: 480, w: 110, h: 44, kind: 'crate', label: 'PETI' },
      { x: 120, y: 150, w: 56, h: 56, kind: 'planter' },
      { x: 1450, y: 1000, w: 56, h: 56, kind: 'planter' },
    ],
    lamps: [
      { x: 300, y: 200, r: 120 },
      { x: 1300, y: 200, r: 120 },
      { x: 800, y: 1050, r: 150 },
    ],
    shadows: [
      { x: 300, y: 1000, r: 62 },
      { x: 1300, y: 1000, r: 62 },
      { x: 70, y: 950, r: 55 },
    ],
    // Bushes (Mobile Legends style): dense grass a sneaking thief hides in.
    bushes: [
      { x: 500, y: 620, r: 50 },
      { x: 1200, y: 1050, r: 50 },
      { x: 250, y: 250, r: 50 },
    ],
    // Room names painted on the floor — the whole plan reads at a glance.
    labels: [
      { x: 266, y: 90, text: 'ATAP BARAT' },
      { x: 800, y: 320, text: 'ATAP UTARA' },
      { x: 1333, y: 320, text: 'MENARA' },
      { x: 800, y: 470, text: 'ATAP TENGAH' },
      { x: 266, y: 900, text: 'GUDANG ALAT' },
      { x: 800, y: 1013, text: 'JALUR LARIKAN' },
      { x: 1333, y: 900, text: 'TITIK PELARIAN' },
    ],
    loot: [
      { x: 1300, y: 200, name: 'KUNCI MASTER SENJA', value: 1000, kind: 'key' },
      { x: 1320, y: 1000, name: 'KOIN EMAS', value: 100, kind: 'coin' },
    ],
    guards: [
      {
        name: 'K-9', role: 'Anjing Penjaga', x: 800, y: 600, dog: true,
        patrol: [[800, 600], [600, 600], [600, 240], [300, 240], [600, 240], [600, 600], [1120, 600], [1120, 1050], [1400, 1090], [1120, 1050], [1120, 600]],
        range: 210, fov: 1.35, speed: 96,
      },
      {
        name: 'AGUS', role: 'Penjaga Atap', x: 1350, y: 240,
        patrol: [[1480, 240], [1200, 240]],
        range: 250, fov: 1.22, speed: 60,
      },
    ],
    cameras: [
      { x: 796, y: 20, angle: Math.PI * 0.5, sweep: 1.2, speed: 0.55, range: 320 },
    ],
    lasers: [],
    ironDoor: null,
  },
];

export function roomSize() {
  return { w: ROOM_W, h: ROOM_H };
}
