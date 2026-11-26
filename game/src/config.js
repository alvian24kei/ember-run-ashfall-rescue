// Ember Run: Ashfall Rescue — tuning numbers, palette and course constants.
// Original game written for the make.fun "best flight game" bounty.
// v2: four sorties, 12 rings, 7 rescue beacons, power-ups, wind gusts,
// combo scoring and a full debrief.
export const VIEW = { width: 1280, height: 720, horizon: 300, focal: 760 };

export const STEP = 1 / 60;

export const COURSE = {
  length: 14200,
  rings: 12,
  runwayZ0: 13100,
  runwayZ1: 14000,
  runwayX: 0,
  runwayHalfWidth: 30,
  islandHalfWidth: 250,
  timeLimit: 330,
  lives: 3,
};

export const PLANE = {
  minSpeed: 55,
  maxSpeed: 265,
  cruiseSpeed: 170,
  accel: 55,
  climbRate: 95, // ft/s at full pitch up
  sinkRate: 70, // ft/s when stalled
  turnRate: 0.75, // lateral speed factor per unit bank
  maxBank: 1,
  maxPitch: 1,
  stallSpeed: 72,
  landingMaxSpeed: 185,
  landingMaxSink: 45,
};

export const GAME_NAME = 'Ember Run: Ashfall Rescue';
export const GAME_SHORT = 'EMBER RUN';
export const GAME_TAGLINE = 'Ashfall rescue at dusk: four sorties, seven survivors, one erupting peak';

// Four sorties, each with a named destination airstrip. Rings and rescues
// are grouped into sorties so the HUD shows a real mission list.
export const SORTIES = [
  { name: 'SORTIE 1 · KORA ATOLL', rings: 3, rescues: 2, strip: 'KORA' },
  { name: 'SORTIE 2 · EMBER PEAK', rings: 3, rescues: 2, strip: 'EMBER' },
  { name: 'SORTIE 3 · ASHFALL RIDGE', rings: 3, rescues: 2, strip: 'RIDGE' },
  { name: 'SORTIE 4 · MERIDIAN FIELD', rings: 3, rescues: 1, strip: 'MERIDIAN' },
];

// Intermediate landing strips: touch down to refuel and patch damage.
export const STRIPS = [
  { name: 'KORA', x: -40, z0: 4300, z1: 5100, halfW: 34 },
  { name: 'EMBER', x: 60, z0: 8800, z1: 9600, halfW: 34 },
  { name: 'RIDGE', x: -50, z0: 11300, z1: 12100, halfW: 34 },
];

export const FUEL = {
  max: 100,
  drainPerSecond: 0.16, // plus throttle * 0.22 /s at full power
  refill: 100,
  canister: 45, // fuel a fuel canister restores
};

export const DAMAGE = {
  crash: 34,
  grazePerSecond: 2.5, // scraping terrain without crashing
  repairOnStrip: 25,
  repairKit: 40, // damage a repair kit restores
};

// Wind gusts: narrow bands along the course where the crosswind spikes.
// The pilot sees them coming on the HUD wind gauge and in the ash streaks.
export const GUST_ZONES = [
  { z0: 3400, z1: 4300, wind: 42 },
  { z0: 7300, z1: 8300, wind: -48 },
  { z0: 10200, z1: 11200, wind: 44 },
];

export const WIND = {
  // Crosswind (lateral push, ft/s) varies along the course; shown on the HUD.
  base: 14,
  gust: 22,
};

// Combo: a ring or rescue collected within COMBO_WINDOW seconds of the
// previous one raises the multiplier (x1..x5) for the next pickup.
export const COMBO = { window: 7, max: 5 };

export const SCORE = {
  ring: 250,
  rescue: 400,
  nearMiss: 50,
  landing: 1000,
  timeBonusPerSecond: 5,
  strip: 150,
  powerup: 60,
};

export const PALETTE = {
  skyTop: '#1c1038',
  skyMid: '#7a2b4d',
  skyHorizon: '#ff7a3c',
  skyEmber: '#ff9d45',
  seaDeep: '#16233f',
  seaShallow: '#2e5a72',
  seaGlint: 'rgba(255,150,70,0.35)',
  sand: '#e8d9a0',
  grass: '#4d8f43',
  grassDark: '#3a7034',
  rock: '#5d4a42',
  rockDark: '#463630',
  lava: '#ff6a1f',
  lavaBright: '#ffd23f',
  smoke: 'rgba(60,50,60,0.6)',
  ash: 'rgba(200,190,180,0.75)',
  snow: '#f4f8fb',
  cloud: 'rgba(255,190,150,0.75)',
  cloudAsh: 'rgba(90,80,90,0.7)',
  runway: '#3a3f46',
  runwayMark: '#f5f5f0',
  ring: '#ffd23f',
  ringGlow: '#ff9d00',
  rescue: '#ff7a3c',
  rescueGlow: '#ff5a1f',
  fuelGreen: '#57d977',
  repairBlue: '#57b8ff',
  shieldBlue: '#7ab8ff',
  planeBody: '#eef1f5',
  planeAccent: '#e0533d',
  planeGlass: '#1c2f45',
  panel: '#10151d',
  panelEdge: '#2c3644',
  gauge: '#0b0f14',
  text: '#f2f5f7',
  muted: '#c8b8a8',
  good: '#57d977',
  warn: '#ffb02e',
  bad: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'ember-run-ashfall.best';
