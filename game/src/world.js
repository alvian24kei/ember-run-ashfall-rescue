// Ember Run: Ashfall Rescue — world: course generation, flight physics,
// rings, rescue beacons, power-ups, wind gusts, combo scoring, collisions,
// landing and scoring. Fixed-step simulation, deterministic for a seed.
import {
  COURSE, PLANE, SCORE, STEP, FUEL, DAMAGE, WIND, STRIPS, SORTIES,
  GUST_ZONES, COMBO,
} from './config.js';
import { mulberry32, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_OVER = 8;
export const EVENT_RESCUE = 16;
export const EVENT_POWERUP = 32;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
export const SCREEN_LANDED = 'landed';

/** Build the fixed course for a seed: islands, mountains, clouds, rings,
 *  rescue beacons and power-ups. */
export function buildCourse(seed) {
  const rng = mulberry32(seed);
  const islands = [];
  let z = 700;
  while (z < 12500) {
    const w = range(rng, 320, 720);
    islands.push({
      x: range(rng, -260, 260),
      z0: z,
      z1: z + range(rng, 420, 780),
      halfW: w / 2,
      h: range(rng, 55, 210),
      tone: rng(),
    });
    z += range(rng, 850, 1150);
  }
  // The runway island: a wide flat island at the end of the course.
  islands.push({
    x: 0, z0: 12900, z1: 14200, halfW: 260, h: 30, tone: 0.5, runway: true,
  });
  // The refuel strips sit on their own flat islands.
  for (const strip of STRIPS) {
    islands.push({
      x: strip.x, z0: strip.z0 - 120, z1: strip.z1 + 120,
      halfW: 150, h: 24, tone: 0.5, strip: strip.name,
    });
  }

  const mountains = [];
  for (let i = 0; i < 11; i += 1) {
    const mz = 1200 + i * 1150 + range(rng, -150, 150);
    mountains.push({
      x: range(rng, -380, 380),
      z: mz,
      base: range(rng, 130, 260),
      h: range(rng, 260, 540),
      volcano: false,
    });
  }
  // Ember Peak: the erupting volcano that gives the run its name — the
  // tallest cone, dead centre of the course, lava-lit at dusk.
  const volcano = mountains.reduce((a, b) => (a.h > b.h ? a : b));
  volcano.x = 40;
  volcano.h = 560;
  volcano.base = 280;
  volcano.volcano = true;

  const clouds = [];
  for (let i = 0; i < 30; i += 1) {
    clouds.push({
      x: range(rng, -650, 650),
      y: range(rng, 950, 1750),
      z: range(rng, 300, 14000),
      r: range(rng, 60, 170),
      ash: rng() < 0.4,
    });
  }

  const rings = [];
  for (let i = 0; i < COURSE.rings; i += 1) {
    rings.push({
      x: Math.round(170 * Math.sin(i * 1.35 + 0.6)),
      y: 380 + Math.round(140 * Math.sin(i * 0.9 + 1.2)) + i * 14,
      z: 1150 + i * 990,
      r: 80,
      taken: false,
    });
  }

  // Rescue beacons: survivors waiting on the islands, one per beacon.
  // They sit just above the island tops near the ring line, so a pilot
  // threading rings flies right past them — but each one sits midway
  // between two rings, so the pilot has room to climb back to ring height.
  const rescues = [];
  const rescueZ = [1645, 3625, 5605, 7585, 9565, 10555, 11545];
  for (let i = 0; i < rescueZ.length; i += 1) {
    const zr = rescueZ[i];
    const bx = Math.round(120 * Math.sin(i * 1.9 + 0.4));
    // Height is measured at the beacon's own spot, so it always floats
    // above whatever terrain is actually there.
    const gy = groundHeightAt(islands, mountains, bx, zr);
    rescues.push({
      x: bx,
      y: Math.round(gy + 160),
      z: zr,
      r: 110,
      taken: false,
      id: i + 1,
    });
  }

  // Power-ups float on the ring line: fuel canisters, repair kits, shields.
  const powerups = [];
  const kinds = ['fuel', 'repair', 'shield', 'fuel', 'shield', 'repair', 'fuel', 'shield', 'repair'];
  for (let i = 0; i < kinds.length; i += 1) {
    const ring = rings[Math.min(rings.length - 1, i + 1)];
    powerups.push({
      kind: kinds[i],
      x: ring.x + (i % 2 === 0 ? 95 : -95),
      y: ring.y + 40,
      z: ring.z - 420,
      r: 55,
      taken: false,
    });
  }

  return { islands, mountains, clouds, rings, rescues, powerups, strips: STRIPS };
}

function groundHeightAt(islands, mountains, x, z) {
  let h = 0;
  for (const isl of islands) {
    if (z >= isl.z0 && z <= isl.z1 && Math.abs(x - isl.x) <= isl.halfW) h = Math.max(h, isl.h);
  }
  for (const m of mountains) {
    const d = Math.hypot(x - m.x, z - m.z);
    if (d < m.base) h = Math.max(h, m.h * (1 - d / m.base));
  }
  return h;
}

/** Crosswind at a course position, ft/s, positive pushes right.
 *  Gust zones spike the wind hard for a short stretch. */
export function windAt(z) {
  let w = WIND.base * Math.sin(z / 1400) + WIND.gust * Math.sin(z / 520 + 1.7) * 0.4;
  for (const gz of GUST_ZONES) {
    if (z >= gz.z0 && z <= gz.z1) {
      const t = (z - gz.z0) / (gz.z1 - gz.z0);
      const ramp = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      w += gz.wind * ramp;
    }
  }
  return w;
}

/** Is the plane inside a gust zone right now? */
export function gustNow(z) {
  return GUST_ZONES.some((gz) => z >= gz.z0 && z <= gz.z1);
}

/** Which sortie the pilot is on, from rings collected. */
export function sortieIndex(rings) {
  let n = 0;
  for (let i = 0; i < SORTIES.length; i += 1) {
    n += SORTIES[i].rings;
    if (rings < n) return i;
  }
  return SORTIES.length - 1;
}

export function freshState() {
  return {
    x: 0,
    alt: 420,
    z: 0,
    heading: 0, // radians, 0 = straight down the course
    speed: 150,
    throttle: 0.7,
    pitch: 0,
    bank: 0,
    vspeed: 0,
    score: 0,
    rings: 0,
    rescues: 0,
    missed: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    shield: false,
    lives: COURSE.lives,
    fuel: FUEL.max,
    damage: 0,
    wind: 0,
    gust: false,
    visitedStrips: new Set(),
    time: 0,
    over: false,
    landed: false,
    crashReason: '',
    message: '',
    messageT: 0,
    nearMissGiven: new Set(),
    // Score breakdown for the debrief screen.
    brk: { ring: 0, rescue: 0, nearMiss: 0, strip: 0, powerup: 0, landing: 0, time: 0 },
  };
}

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    this.course = buildCourse(seed);
    this.state = freshState();
  }

  reset() {
    this.course = buildCourse(this.seed);
    this.state = freshState();
  }

  /** Ground height at (x, z): island tops, runway island, mountain cones, else sea (0). */
  terrainHeight(x, z) {
    let h = 0;
    for (const isl of this.course.islands) {
      if (z >= isl.z0 && z <= isl.z1 && Math.abs(x - isl.x) <= isl.halfW) {
        h = Math.max(h, isl.h);
      }
    }
    for (const m of this.course.mountains) {
      const dx = x - m.x;
      const dz = z - m.z;
      const d = Math.hypot(dx, dz);
      if (d < m.base) h = Math.max(h, m.h * (1 - d / m.base));
    }
    return h;
  }

  nextRing() {
    return this.course.rings.find((r) => !r.taken) ?? null;
  }

  nextRescue() {
    return this.course.rescues.find((r) => !r.taken) ?? null;
  }

  /** The next objective of either kind, whichever comes first. */
  nextObjective() {
    const ring = this.nextRing();
    const rescue = this.nextRescue();
    if (!ring) return rescue ? { kind: 'rescue', ...rescue } : null;
    if (!rescue) return { kind: 'ring', ...ring };
    return ring.z <= rescue.z ? { kind: 'ring', ...ring } : { kind: 'rescue', ...rescue };
  }

  /** Apply a combo pickup: returns the multiplier used for this pickup. */
  comboPickup() {
    const s = this.state;
    if (s.comboT > 0) s.combo = Math.min(COMBO.max, s.combo + 1);
    else s.combo = 1;
    s.comboT = COMBO.window;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    return s.combo;
  }

  /**
   * Advance the simulation one fixed step.
   * input: { pitch: -1..1, bank: -1..1, throttle: 0..1 }
   * Returns an event bitmask.
   */
  step(dt, input) {
    const s = this.state;
    if (s.over || s.landed) return EVENT_NONE;
    let events = EVENT_NONE;
    s.time += dt;

    // Combo timer ticks down.
    if (s.comboT > 0) {
      s.comboT -= dt;
      if (s.comboT <= 0) s.combo = 0;
    }

    // Throttle and speed. Empty tanks mean no power: the plane glides.
    s.throttle = s.fuel > 0 ? input.throttle : 0;
    s.fuel = Math.max(0, s.fuel - (FUEL.drainPerSecond + s.throttle * 0.22) * dt);
    const targetSpeed = PLANE.minSpeed + s.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    s.speed += Math.max(-PLANE.accel, Math.min(PLANE.accel, targetSpeed - s.speed)) * dt;

    // Pitch / bank ease toward the commanded values.
    s.pitch += (input.pitch - s.pitch) * Math.min(1, dt * 6);
    s.bank += (input.bank - s.bank) * Math.min(1, dt * 5);

    // Vertical speed: pitch climbs, stall sinks, drag pulls down at low speed.
    let climb = s.pitch * PLANE.climbRate * (s.speed / PLANE.cruiseSpeed);
    if (s.speed < PLANE.stallSpeed) climb -= PLANE.sinkRate * (1 - s.speed / PLANE.stallSpeed);
    s.vspeed = climb;
    s.alt += climb * dt;

    // Lateral movement from bank; forward movement from speed.
    s.heading += s.bank * PLANE.turnRate * dt * (s.speed / PLANE.cruiseSpeed);
    s.x += Math.sin(s.heading) * s.speed * dt + s.bank * s.speed * 0.5 * dt;
    s.z += Math.cos(s.heading) * s.speed * dt;
    // Crosswind pushes the airframe sideways; the pilot must crab into it.
    // Gust zones push much harder.
    s.wind = windAt(s.z);
    s.gust = gustNow(s.z);
    s.x += s.wind * 0.45 * dt;
    s.x = Math.max(-900, Math.min(900, s.x));
    if (s.alt < 0) s.alt = 0;

    // Ring collection.
    for (const ring of this.course.rings) {
      if (ring.taken) continue;
      if (s.z - ring.z > 60) {
        // Flown past it: mark it missed so the next objective takes over
        // instead of the pilot chasing a ring that is behind them forever.
        ring.taken = true;
        ring.missed = true;
        s.missed += 1;
        s.message = `RING MISSED`;
        s.messageT = 1.4;
        continue;
      }
      if (Math.abs(s.z - ring.z) < 34) {
        const d = Math.hypot(s.x - ring.x, s.alt - ring.y);
        if (d < ring.r) {
          ring.taken = true;
          s.rings += 1;
          const mult = this.comboPickup();
          const pts = SCORE.ring * mult;
          s.score += pts;
          s.brk.ring += pts;
          s.message = `RING ${s.rings}/${COURSE.rings}  +${pts}${mult > 1 ? `  COMBO x${mult}` : ''}`;
          s.messageT = 2.2;
          events |= EVENT_RING;
        }
      }
    }

    // Rescue beacons: fly through the beacon column to pick up a survivor.
    for (const b of this.course.rescues) {
      if (b.taken) continue;
      if (s.z - b.z > 60) {
        b.taken = true;
        b.missed = true;
        s.missed += 1;
        s.message = `SURVIVOR MISSED`;
        s.messageT = 1.4;
        continue;
      }
      if (Math.abs(s.z - b.z) < 40) {
        const d = Math.hypot(s.x - b.x, s.alt - b.y);
        if (d < b.r) {
          b.taken = true;
          s.rescues += 1;
          const mult = this.comboPickup();
          const pts = SCORE.rescue * mult;
          s.score += pts;
          s.brk.rescue += pts;
          s.message = `SURVIVOR RESCUED ${s.rescues}/7  +${pts}${mult > 1 ? `  COMBO x${mult}` : ''}`;
          s.messageT = 2.6;
          events |= EVENT_RESCUE;
        }
      }
    }

    // Power-ups.
    for (const p of this.course.powerups) {
      if (p.taken) continue;
      if (Math.abs(s.z - p.z) < 34) {
        const d = Math.hypot(s.x - p.x, s.alt - p.y);
        if (d < p.r) {
          p.taken = true;
          s.score += SCORE.powerup;
          s.brk.powerup += SCORE.powerup;
          if (p.kind === 'fuel') {
            s.fuel = Math.min(FUEL.max, s.fuel + FUEL.canister);
            s.message = `FUEL CANISTER  +${FUEL.canister}% FUEL  +${SCORE.powerup}`;
          } else if (p.kind === 'repair') {
            s.damage = Math.max(0, s.damage - DAMAGE.repairKit);
            s.message = `REPAIR KIT  -${DAMAGE.repairKit}% DAMAGE  +${SCORE.powerup}`;
          } else {
            s.shield = true;
            s.message = `SHIELD UP — next crash absorbed  +${SCORE.powerup}`;
          }
          s.messageT = 2.4;
          events |= EVENT_POWERUP;
        }
      }
    }

    // Near-miss bonus: skimming a mountain peak.
    for (let i = 0; i < this.course.mountains.length; i += 1) {
      const m = this.course.mountains[i];
      if (s.nearMissGiven.has(i)) continue;
      if (Math.abs(s.z - m.z) < 40) {
        const clearance = s.alt - m.h;
        if (clearance > 0 && clearance < 70 && Math.abs(s.x - m.x) < m.base) {
          s.nearMissGiven.add(i);
          const mult = Math.max(1, s.combo);
          const pts = SCORE.nearMiss * mult;
          s.score += pts;
          s.brk.nearMiss += pts;
          s.message = `NEAR MISS  +${pts}`;
          s.messageT = 1.6;
        }
      }
    }

    // Landing: on the runway strip, slow, gentle, aligned.
    const onRunway =
      s.z >= COURSE.runwayZ0 && s.z <= COURSE.runwayZ1 &&
      Math.abs(s.x - COURSE.runwayX) <= COURSE.runwayHalfWidth + 6;
    const ground = this.terrainHeight(s.x, s.z);

    // Scraping terrain without hitting it wears the airframe.
    if (s.alt - ground > 4 && s.alt - ground < 28) {
      s.damage = Math.min(100, s.damage + DAMAGE.grazePerSecond * dt);
      if (s.damage >= 100) {
        s.over = true;
        s.crashReason = 'Airframe gave out';
        return events | EVENT_OVER;
      }
    }

    // Intermediate strips: touch down gently to refuel and patch damage.
    for (const strip of this.course.strips) {
      if (s.z >= strip.z0 && s.z <= strip.z1 && Math.abs(s.x - strip.x) <= strip.halfW + 4 &&
          s.alt <= ground + 12 && s.speed <= PLANE.landingMaxSpeed && s.vspeed >= -PLANE.landingMaxSink) {
        const first = !s.visitedStrips.has(strip.name);
        s.visitedStrips.add(strip.name);
        s.fuel = FUEL.refill;
        s.damage = Math.max(0, s.damage - DAMAGE.repairOnStrip);
        if (first) {
          s.score += SCORE.strip;
          s.brk.strip += SCORE.strip;
        }
        s.message = `${strip.name} STRIP — REFUELLED${first ? `  +${SCORE.strip}` : ''} · DAMAGE PATCHED`;
        s.messageT = 3;
        // Hop back into the air just past the strip so the run continues.
        s.z = strip.z1 + 60;
        s.alt = Math.max(s.alt, ground + 120);
        s.speed = Math.max(s.speed, 130);
      }
    }
    if (onRunway && s.alt <= ground + 12 && s.speed <= PLANE.landingMaxSpeed && s.vspeed >= -PLANE.landingMaxSink) {
      s.landed = true;
      const timeBonus = Math.max(0, Math.round((COURSE.timeLimit - s.time) * SCORE.timeBonusPerSecond));
      s.score += SCORE.landing + timeBonus;
      s.brk.landing += SCORE.landing;
      s.brk.time += timeBonus;
      s.message = `LANDED! +${SCORE.landing}  TIME BONUS +${timeBonus}`;
      s.messageT = 5;
      return events | EVENT_LANDED;
    }

    // Crash: terrain, mountain, sea, or flying past the course.
    if (s.alt <= ground + 4 || s.z >= COURSE.length + 200) {
      // A shield absorbs one crash completely.
      if (s.shield) {
        s.shield = false;
        s.x = 0;
        s.alt = 750;
        s.z = Math.max(0, s.z - 800);
        s.speed = 140;
        s.heading = 0;
        s.pitch = 0;
        s.bank = 0;
        s.message = 'SHIELD ABSORBED THE CRASH — keep flying!';
        s.messageT = 3;
        return events | EVENT_CRASH;
      }
      s.lives -= 1;
      s.damage = Math.min(100, s.damage + DAMAGE.crash);
      s.crashReason = s.z >= COURSE.length + 200 ? 'Flew past the airfield' : 'Terrain impact';
      if (s.lives <= 0 || s.damage >= 100) {
        s.over = true;
        if (s.damage >= 100) s.crashReason = 'Airframe destroyed';
        return events | EVENT_CRASH | EVENT_OVER;
      }
      // Respawn mid-course with a speed penalty, rings and rescues kept.
      s.x = 0;
      s.alt = 750;
      s.z = Math.max(0, s.z - 1500);
      s.speed = 140;
      s.heading = 0;
      s.pitch = 0;
      s.bank = 0;
      s.message = `CRASH — ${s.crashReason}. ${s.lives} ${s.lives === 1 ? 'life' : 'lives'} left`;
      s.messageT = 3;
      return events | EVENT_CRASH;
    }

    // Time up.
    if (s.time >= COURSE.timeLimit) {
      s.over = true;
      s.crashReason = 'Out of time';
      return events | EVENT_OVER;
    }

    if (s.messageT > 0) s.messageT -= dt;
    return events;
  }
}
