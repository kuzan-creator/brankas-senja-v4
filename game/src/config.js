// Sunset Vaults — shared tuning and palette. One job: every number the
// rest of the game agrees on, so a balance tweak lands in one place.
export const VIEW_W = 1280;
export const VIEW_H = 800;

// Playfield frame inside the canvas (HUD panels sit left and right).
// ROOM_W/H are the LOGICAL room size the game plays in (blocks, patrols,
// cones all use these). ROOM_PX_W/H are how big the room is drawn on
// screen. v3: the WHOLE 1600x1200 map fits in one frame, no camera scroll
// (top-rank stealth maps show the full floor plan at once). The scale is
// uniform: SX == SY == 0.6333, so circles stay circles.
// v4: the LEFT panel is gone and the right panel narrowed to ~110px, so
// the map fills ~75% of the frame (a 4:3 map in a 16:10 frame caps there
// with a top bar + bottom chips row). Top bar is thin (36px); the bottom
// chips float over the map's bottom edge.
export const ROOM_X = 74;
export const ROOM_Y = 40;
export const ROOM_W = 1600;
export const ROOM_H = 1200;
export const ROOM_PX_W = 1013;
export const ROOM_PX_H = 760;
export const SX = ROOM_PX_W / ROOM_W;
export const SY = ROOM_PX_H / ROOM_H;
export const TOP_BAR_H = 36;
export const RIGHT_PANEL_X = 1162;
export const RIGHT_PANEL_W = 110;
export const BOTTOM_CHIPS_Y = 764;

export const PLAYER_R = 11;
export const WALK_SPEED = 175;
export const SNEAK_SPEED = 88;
export const GUARD_SPEED = 62;
export const CHASE_SPEED = 148;
export const DOG_SPEED = 96;

export const CONE_RANGE = 265;
export const CONE_FOV = 1.22; // radians, about 70 degrees
export const CAM_RANGE = 300;
export const CAM_FOV = 0.62;

export const ALARM_LOCKDOWN_SECONDS = 6;
export const GHOST_BONUS = 500;
export const SPEED_BONUS_MAX = 300;

export const PALETTE = {
  floor: '#1c2130',
  floorAlt: '#202636',
  wall: '#232838',
  wallTop: '#39415c',
  gold: '#f5c542',
  goldDim: '#a8873a',
  green: '#37d67a',
  red: '#ff5252',
  blue: '#5b8cff',
  yellow: '#ffc93c',
  ink: '#e8e6df',
  dim: '#9aa0b4',
  panel: 'rgba(10,12,20,0.88)',
  panelEdge: '#2c3247',
};
