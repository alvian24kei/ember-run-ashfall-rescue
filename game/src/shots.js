// Screenshot scenes behind ?shot=start|play|rescue|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (aim at the next objective — ring or rescue beacon —
// climb out of terrain, keep the throttle up), so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER, EVENT_LANDED } from './world.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 42;
const RESCUE_SECONDS = 26;
const END_LIMIT_SECONDS = 900;

/** Highest terrain between the plane and the target, plus a margin:
 *  the autopilot never plans a descent below this. */
function clearAlt(world, tx, tz, margin) {
  const s = world.state;
  let top = 0;
  const steps = 8;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = s.x + (tx - s.x) * t;
    const z = s.z + (tz - s.z) * t;
    top = Math.max(top, world.terrainHeight(x, z));
  }
  return top + margin;
}

/** Steer toward the next objective (ring or rescue), or land on the runway
 *  once everything is done. */
function autopilot(world) {
  const s = world.state;
  const obj = world.nextObjective();
  if (!obj) {
    // Final approach: start the descent early (z 11000) so the plane is
    // already low and slow when the runway opens, and stay slow over it.
    const wantAlt = s.z < 11000 ? 420 : Math.max(38, 420 - (s.z - 11000) * 0.35);
    return {
      pitch: Math.max(-1, Math.min(1, (wantAlt - s.alt) / 180)),
      bank: Math.max(-0.7, Math.min(0.7, -s.x / 200 - s.heading * 1.2 - s.wind * 0.012)),
      throttle: s.z > 12500 ? 0.42 : 0.55,
    };
  }
  const tx = obj.x;
  const ty = obj.y;
  const dx = tx - s.x;
  let wantAlt;
  if (obj.z - s.z < 1400) {
    // Close in: fly the objective itself, but never below the terrain
    // actually between us and it.
    wantAlt = Math.max(ty, clearAlt(world, tx, obj.z, 110));
  } else {
    wantAlt = Math.max(ty + 60, clearAlt(world, tx, obj.z, 220));
  }
  const pitch = Math.max(-1, Math.min(1, (wantAlt - s.alt) / 180));
  // Gentle lateral control: hard banking slaloms past the rings, and the
  // wind term crabs into the crosswind without saturating the bank. The
  // heading term unwinds the turn, so the plane tracks straight instead
  // of winding up into a spiral.
  const bank = Math.max(-0.7, Math.min(0.7, dx / 200 - s.heading * 1.2 - s.wind * 0.012));
  return { pitch, bank, throttle: 0.78 };
}

/**
 * Set `world` to the named scene (start, play, rescue or end; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'rescue' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, autopilot(world));
    return { screen: 'title', best: 0 };
  }
  let limit = PLAY_SECONDS;
  if (name === 'rescue') limit = RESCUE_SECONDS;
  if (name === 'end') limit = END_LIMIT_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world));
    if (events & EVENT_OVER) break;
    if (events & EVENT_LANDED) break;
  }
  if (world.state.landed) return { screen: 'landed', best: world.state.score };
  if (world.state.over) return { screen: 'over', best: world.state.score };
  return { screen: 'play', best: world.state.score };
}
